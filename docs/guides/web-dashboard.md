# Admin Dashboard

> Technical documentation of the administrative panel for project owners.
> Application: `apps/web-dashboard` — Next.js 15 (App Router), port `3100`.

---

## 1. Overview

The Admin Dashboard allows project owners to manage their settings and moderate feedback from end users. It is an application independent of the public SDK — it does not share authentication with the users who vote.

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                          │
│                     (Next.js App Router)                      │
│                                                              │
│  Browser                        Server (Server Actions)      │
│  ┌──────────────────────┐      ┌──────────────────────────┐  │
│  │ Login (Supabase Auth)│      │ createProject()          │  │
│  │ Project list         │      │   → service role client  │  │
│  │ Project detail       │      │   → crypto.randomBytes   │  │
│  │ Moderation panel     │      │ updateSuggestionStatus() │  │
│  │                      │      │   → authenticated client │  │
│  │ supabase browser     │      │   → RLS checks access    │  │
│  │ client (auth only)   │      │                          │  │
│  └──────────┬───────────┘      └────────────┬─────────────┘  │
└─────────────┼───────────────────────────────┼────────────────┘
              │                               │
              │  Supabase Auth                │  Supabase
              │  (email/password)             │  (anon key + RLS)
              │                               │  (service role for writes)
              ▼                               ▼
        ┌─────────────────────────────────────────┐
        │              Supabase                    │
        │                                          │
        │  auth.users    project_members           │
        │  (identity)    (membership + role)       │
        │                                          │
        │  projects      suggestions    votes      │
        │  (RLS scoped)  (RLS scoped)  (read-only) │
        └──────────────────────────────────────────┘
```

---

## 2. Authentication

The dashboard uses **Supabase Auth** with email and password. This system is completely independent of the Signed Stateless Auth used by the end users of the SDK.

### Login Flow

```
Browser                    Middleware                   Supabase Auth
  │                           │                              │
  │  GET /projects            │                              │
  │──────────────────────────▶│                              │
  │                           │  getUser() → null            │
  │                           │──────────────────────────────▶│
  │                           │◀─ no session ────────────────│
  │  302 → /login             │                              │
  │◀──────────────────────────│                              │
  │                           │                              │
  │  signInWithPassword()     │                              │
  │──────────────────────────────────────────────────────────▶│
  │◀─ session cookie ────────────────────────────────────────│
  │                           │                              │
  │  GET /projects            │                              │
  │──────────────────────────▶│                              │
  │                           │  getUser() → user ✓          │
  │                           │──────────────────────────────▶│
  │  200 (page rendered)      │                              │
  │◀──────────────────────────│                              │
```

### Middleware

`src/middleware.ts` protects all routes except `/login`, `/auth/*`, and Next.js static assets. On every request:

1. Refreshes the Supabase session (cookies)
2. Calls `getUser()` to verify authentication
3. Redirects to `/login` if there is no valid session

**Matcher:** `/((?!_next/static|_next/image|favicon.ico|login|auth).*)`

### Difference with SDK Auth

| Aspect | SDK (end users) | Dashboard (admins) |
|---|---|---|
| Mechanism | HMAC-SHA256 per request | Supabase Auth (session cookie) |
| Identity | `user_hash` (pseudonym) | `auth.users.id` (real UUID) |
| Storage | Stateless | Session cookie |
| Associated Table | `votes`, `pseudonymous_vault` | `project_members` |

---

## 3. Authorization Model

### `project_members` Table

Migration: `supabase/migrations/20260219_project_members.sql`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK → `auth.users(id)` ON DELETE CASCADE | |
| `role` | `text` | NOT NULL, default `'owner'`, CHECK enum | `owner`, `admin`, `viewer` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `uq_project_member (project_id, user_id)` — a user cannot have duplicated roles in the same project.

### Roles and Permissions

| Permission | `owner` | `admin` | `viewer` |
|---|---|---|---|
| View project and `hmac_secret` | Yes | Yes | Yes |
| Edit project name | Yes | Yes | No |
| Delete project | Yes | No | No |
| View suggestions | Yes | Yes | Yes |
| Change suggestion status | Yes | Yes | No |
| Delete suggestion | Yes | Yes | No |

### Updated RLS Policies

The migration `20260219_project_members.sql` modifies the RLS policies of the original schema:

**`project_members`:**

| Policy | Role | Operation | Rule |
|---|---|---|---|
| `members_select_own` | `authenticated` | SELECT | `user_id = auth.uid()` |
| `members_no_anon` | `anon` | ALL | `USING (false)` |

**`projects`** (replaces `projects_no_authenticated_access`):

| Policy | Role | Operation | Rule |
|---|---|---|---|
| `projects_no_anon_access` | `anon` | ALL | `USING (false)` — unmodified |
| `projects_authenticated_read_own` | `authenticated` | SELECT | Exists in `project_members` with `user_id = auth.uid()` |
| `projects_no_authenticated_insert` | `authenticated` | INSERT | `WITH CHECK (false)` |
| `projects_no_authenticated_update` | `authenticated` | UPDATE | `USING (false)` |
| `projects_no_authenticated_delete` | `authenticated` | DELETE | `USING (false)` |

**`suggestions`** (replaces `suggestions_no_authenticated_update` and `_delete`):

| Policy | Role | Operation | Rule |
|---|---|---|---|
| `suggestions_authenticated_update_own` | `authenticated` | UPDATE | Member with role `owner` or `admin` |
| `suggestions_authenticated_delete_own` | `authenticated` | DELETE | Member with role `owner` or `admin` |

> **Note:** The SELECT and INSERT policies on `suggestions` remain unchanged. Reading is still public, and insertion is still denied for `authenticated` (suggestions are created via Edge Functions).

---

## 4. Supabase Clients

The dashboard uses three Supabase clients for distinct purposes:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Browser (Client Components)                                 │
│  ┌────────────────────────────┐                              │
│  │ createBrowserClient()      │ ← Only for auth              │
│  │ supabase.auth.signIn()     │   (login, logout, session)   │
│  │ supabase.auth.signOut()    │                              │
│  └────────────────────────────┘                              │
│                                                              │
│  Server (Server Components + Server Actions)                 │
│  ┌────────────────────────────┐                              │
│  │ createServerSupabaseClient │ ← Reads + moderation writes  │
│  │ (cookie-based, anon key)   │   RLS filters by membership  │
│  │                            │                              │
│  │ Used in:                   │                              │
│  │ - Server Components        │ ← Read projects,             │
│  │ - updateSuggestionStatus() │   suggestions, stats         │
│  │ - deleteSuggestion()       │                              │
│  └────────────────────────────┘                              │
│                                                              │
│  ┌────────────────────────────┐                              │
│  │ createAdminClient()        │ ← Only Server Actions that    │
│  │ (service role key)         │   require RLS bypass         │
│  │                            │                              │
│  │ Used in:                   │                              │
│  │ - createProject()          │ ← INSERT in projects + the   │
│  │ - updateProject()          │   first membership row       │
│  │ - deleteProject()          │                              │
│  └────────────────────────────┘                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Client | File | Key used | Execution Context | Purpose |
|---|---|---|---|---|
| Browser | `lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Auth (login/logout) |
| Server | `lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies | Server | Queries with RLS |
| Admin | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Server (Actions) | Bypass RLS for CRU in `projects` |

### Why two server-side clients

- **Server client (anon + cookies):** Uses the authenticated user's session. RLS automatically verifies that the user is a project member. Used to read projects, read suggestions, and moderate (UPDATE/DELETE on suggestions).

- **Admin client (service role):** Required only for operations that RLS blocks for `authenticated`: INSERT in `projects`, INSERT in `project_members` (for the first owner), UPDATE/DELETE in `projects`. Each Server Action using the admin client verifies membership manually before executing (`requireProjectAccess()`).

---

## 5. File Structure

```text
apps/web-dashboard/
├── src/
│   ├── middleware.ts                              # Route protection
│   ├── app/
│   │   ├── layout.tsx                             # Root layout
│   │   ├── globals.css                            # Tailwind directives
│   │   ├── login/
│   │   │   └── page.tsx                           # Login form
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts                       # Code exchange (email confirm)
│   │   └── (dashboard)/                           # Authenticated route group
│   │       ├── layout.tsx                         # Sidebar + Header
│   │       ├── page.tsx                           # Redirect → /projects
│   │       └── projects/
│   │           ├── page.tsx                        # List of projects
│   │           ├── actions.ts                      # Server Actions: Project CRUD
│   │           ├── new/
│   │           │   └── page.tsx                    # Create project
│   │           └── [projectId]/
│   │               ├── page.tsx                    # Details: settings, API key, stats
│   │               └── moderation/
│   │                   ├── page.tsx                # List suggestions + filters
│   │                   └── actions.ts              # Server Actions: status, delete
│   ├── components/
│   │   ├── Sidebar.tsx                            # Side navigation
│   │   ├── Header.tsx                             # Top bar with email
│   │   ├── LogoutButton.tsx                       # Client Component (signOut)
│   │   ├── CreateProjectForm.tsx                  # New project form
│   │   ├── EditProjectForm.tsx                    # Inline name editing
│   │   ├── DeleteProjectButton.tsx                # Button with confirmation
│   │   ├── SecretDisplay.tsx                      # hmac_secret masked + reveal + copy
│   │   ├── SuggestionRow.tsx                      # Suggestion row with actions
│   │   ├── StatusBadge.tsx                        # Colored badge by status
│   │   └── StatusFilter.tsx                       # Filter tabs by status
│   └── lib/
│       ├── errors.ts                              # Error sanitization
│       ├── auth-guard.ts                          # requireAuth(), requireProjectAccess()
│       └── supabase/
│           ├── client.ts                          # Browser client
│           ├── server.ts                          # Server client (cookies)
│           ├── admin.ts                           # Service role client
│           └── middleware.ts                      # Session refresh helper
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
└── .env.local.example
```

---

## 6. Screens

### 6.1 Login (`/login`)

Form with email and password. Uses the Supabase browser client (`signInWithPassword`). Sanitized errors: always shows "Invalid email or password" regardless of the real cause. Redirects to `/projects` upon successful login.

### 6.2 Project List (`/projects`)

Server Component querying `project_members` → `projects` using the server client (RLS returns only the user's projects). Displays cards with name and creation date. "New Project" button goes to `/projects/new`.

### 6.3 Create Project (`/projects/new`)

Form executing the `createProject()` Server Action:

1. Validates that the user is authenticated (`requireAuth()`)
2. Generates `hmac_secret` using `crypto.randomBytes(32).toString("hex")` (256 bits)
3. Inserts into `projects` via service role (bypasses RLS)
4. Inserts row into `project_members` with `role: 'owner'` via service role
5. If membership insertion fails, rolls back the project
6. Redirects to `/projects/{id}`

### 6.4 Project Details (`/projects/[projectId]`)

Server Component exposing four sections:

```
┌──────────────────────────────────────────┐
│  ← Back to Projects                      │
├──────────────────────────────────────────┤
│  Project Settings                        │
│  [project name            ] [Save]       │
├──────────────────────────────────────────┤
│  API Key                                 │
│  Use this HMAC secret to sign requests   │
│  ┌──────────────────────────────────┐    │
│  │ a1b2c3d4••••••••••••••••••ef78   │    │
│  └──────────────────────────────────┘    │
│  [Reveal] [Copy]                         │
├──────────────────────────────────────────┤
│  Suggestions: 42    │    Votes: 187      │
├──────────────────────────────────────────┤
│        Open Moderation Panel             │
├──────────────────────────────────────────┤
│  ⚠ Danger Zone                           │
│  [Delete Project] → [Confirm] [Cancel]   │
└──────────────────────────────────────────┘
```

**`SecretDisplay`:** The `hmac_secret` is fetched server-side (Server Component reads from the `projects` table via RLS). It is passed as a prop to the `SecretDisplay` Client Component, which masks it by default (first 8 + last 4 characters). Provides "Reveal" and "Copy to clipboard" buttons.

> **Security:** The `hmac_secret` is readable because the `projects` RLS allows SELECT for authenticated members. There's no risk of leakage to the browser because the dashboard is a private application for admins. The secret only reaches the rendered HTML for users with legitimate access.

### 6.5 Moderation (`/projects/[projectId]/moderation`)

List of suggestions for the project with filtering and actions:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to My Project                                        │
│  Moderation                                                   │
│                                                              │
│  [All] [Open] [Planned] [In Progress] [Shipped] [Closed]    │
│  [Search by title...                              ] [Search] │
│                                                              │
│  ┌───┬───────────────────────────────┬──────────┬──────────┐ │
│  │ 12│ Dark mode support    [Open]   │ [▼ Open ]│ [Delete] │ │
│  │   │ Allow users to toggle...      │          │          │ │
│  │   │ 2026-02-15                    │          │          │ │
│  ├───┼───────────────────────────────┼──────────┼──────────┤ │
│  │  8│ Export to CSV        [Shipped]│ [▼ Ship ]│ [Delete] │ │
│  │   │ 2026-02-10                    │          │          │ │
│  └───┴───────────────────────────────┴──────────┴──────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Filters:** State tabs and title search use URL query parameters (`?status=open&q=dark`). The Server Component reads these parameters and builds the Supabase query with `.eq("status", ...)` and `.ilike("title", ...)`.

**Status Change:** The dropdown fires the `updateSuggestionStatus()` Server Action. The action validates the new status against the Zod `SuggestionStatus` enum before updating. RLS allows the UPDATE because the user is a member with an `owner` or `admin` role.

**Delete suggestion:** Button with two-step confirmation (click → "Confirm" / "Cancel"). Fires `deleteSuggestion()` which uses the authenticated server client. RLS allows the DELETE via the `suggestions_authenticated_delete_own` policy.

---

## 7. Server Actions

All dashboard mutations are executed as Next.js Server Actions (`"use server"`).

### Projects (`projects/actions.ts`)

| Action | Client | Auth check | Description |
|---|---|---|---|
| `createProject()` | Admin (service role) | `requireAuth()` | Generates `hmac_secret`, inserts project + membership |
| `updateProject()` | Admin (service role) | `requireProjectAccess()` | Updates project name |
| `deleteProject()` | Admin (service role) | `requireProjectAccess()` + `role === 'owner'` | Deletes project (cascaded) |

### Moderation (`moderation/actions.ts`)

| Action | Client | Auth check | Description |
|---|---|---|---|
| `updateSuggestionStatus()` | Server (authenticated) | `requireProjectAccess()` | Validates status with Zod, updates via RLS |
| `deleteSuggestion()` | Server (authenticated) | `requireProjectAccess()` | Deletes via RLS |

### Authorization Guards (`lib/auth-guard.ts`)

```
requireAuth()
├── Fetches user session via cookies
├── Validates that the user exists
└── Returns { supabase, user }

requireProjectAccess(projectId)
├── Calls requireAuth()
├── Queries project_members via RLS
│   (only returns rows where user_id = auth.uid())
├── Validates that a membership exists
└── Returns { supabase, user, role }
```

---

## 8. Error Sanitization

`lib/errors.ts` maps Supabase/PostgreSQL errors to generic messages. `error.message` from Supabase is never exposed to the client.

| PostgreSQL Code | End User Message |
|---|---|
| `23505` (unique violation) | "This record already exists." |
| `23503` (FK violation) | "Referenced record not found." |
| `42501` (insufficient privilege) | "You do not have permission to perform this action." |
| `PGRST116` (not found) | "Record not found." |
| Any other | "An unexpected error occurred." |

---

## 9. Configuration

### Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | Public key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (admin client) | Private key (bypasses RLS) |

> **`SUPABASE_SERVICE_ROLE_KEY` does not have the `NEXT_PUBLIC_` prefix** — it is never exposed to the browser.

### Workspace Dependencies

| Package | Usage |
|---|---|
| `@openfeedback/client` | `TABLE` constants, `SuggestionStatus` Zod enum, types |
| `@openfeedback/typescript-config` | Base tsconfig (`nextjs.json`) |
| `@openfeedback/tailwind-config` | Preset with `of-primary` and `of-neutral` colors |

---

## 10. Development Setup

```bash
# 1. Install dependencies (from the monorepo root)
pnpm install

# 2. Configure environment variables
cp apps/web-dashboard/.env.local.example apps/web-dashboard/.env.local
# Edit .env.local with your Supabase project credentials

# 3. Apply the project_members migration
# (via Supabase CLI or the SQL editor in dashboard)
# File: supabase/migrations/20260219_project_members.sql

# 4. Create an admin user in Supabase Auth
# Via Supabase Dashboard → Authentication → Add User

# 5. Start the dashboard
pnpm --filter @openfeedback/web-dashboard dev
# → http://localhost:3100

# 6. Production build
pnpm --filter @openfeedback/web-dashboard build
```

---

## 11. Relationship with the Rest of the System

```
                  End Users                 Admins (dashboard)
                  ──────────────────        ──────────────────
Authentication    HMAC per request          Supabase Auth (session)
Identity in DB    user_hash (pseudo)        auth.users.id (real)
Access Table      (none)                    project_members
Read Access       anon key + public RLS     authenticated + RLS by membership
Write Access      Edge Functions            Server Actions (service role / RLS)
                  (service role)
```

The dashboard does not interfere with the SDK flow:

- End users continue creating suggestions and voting via Edge Functions with HMAC
- Admins manage state and moderate via Server Actions using Supabase Auth
- Both paths converge on the same PostgreSQL tables, protected by distinct RLS policies for each role
