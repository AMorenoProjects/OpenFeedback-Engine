# Database — Supabase Setup

Guide to initializing the OpenFeedback Engine database in a Supabase project. Covers the complete schema, RLS security policies, and the copy-and-paste ready SQL starter.

---

## Quick Start (1 minute)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** (left sidebar).
3. Copy the contents of `supabase/00_init.sql` and paste it into the editor.
4. Click **Run**.

That's it. The 7 tables, indexes, RLS policies, and the upvotes trigger are created in a single execution.

> **Note:** the script uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run it multiple times without duplicating tables.

---

## Table Schema

### `projects`

Tenants registry. Each host application is registered as a project.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique identifier, auto-generated |
| `name` | `text` | Project name |
| `hmac_secret` | `text` | Shared secret to verify HMAC-SHA256 signatures. **Must never reach the browser.** |
| `created_at` | `timestamptz` | Creation date |
| `updated_at` | `timestamptz` | Last modification date |

**RLS:** Anon denied. Authenticated can only read projects they are members of (via `project_members`). Write operations restricted to service role.

---

### `project_members`

Links Supabase Auth users with the projects they can manage from the dashboard.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique identifier |
| `project_id` | `uuid` (FK → `projects`) | Project it belongs to |
| `user_id` | `uuid` (FK → `auth.users`) | Supabase Auth user |
| `role` | `text` | Role: `owner`, `admin` or `viewer` |
| `created_at` | `timestamptz` | Creation date |

**Constraint:** `UNIQUE(project_id, user_id)` — a user cannot have a duplicate membership.

**RLS:** Each authenticated user only sees their own memberships. Anon denied.

---

### `suggestions`

Public feedback board. Each suggestion belongs to a project.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique identifier |
| `project_id` | `uuid` (FK → `projects`) | Project it belongs to |
| `title` | `text` | Title (1–300 characters) |
| `description` | `text` | Optional description (max. 5000 characters) |
| `status` | `text` | Status: `open`, `planned`, `in_progress`, `shipped`, `closed` |
| `upvotes` | `integer` | Votes counter (automatically maintained by trigger) |
| `created_at` | `timestamptz` | Creation date |
| `updated_at` | `timestamptz` | Last modification date |

**Indexes:** `(project_id)`, `(project_id, status)`.

**RLS:**
- Anon and authenticated: public read.
- Anon: write denied.
- Authenticated (project owner/admin): can update and delete.
- Inserts: only via Edge Functions (service role).

---

### `votes`

Public votes ledger. Stores a user hash, never their real identity.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique identifier |
| `suggestion_id` | `uuid` (FK → `suggestions`) | Voted suggestion |
| `user_hash` | `text` | `HMAC(user_id, project_hmac_secret)` — salted hash, non-reversible |
| `project_id` | `uuid` (FK → `projects`) | Project (for efficient queries) |
| `created_at` | `timestamptz` | Vote date |

**Constraint:** `UNIQUE(suggestion_id, user_hash)` — a user can only vote once per suggestion.

**Indexes:** `(suggestion_id)`, `(user_hash)`, `(project_id)`.

**RLS:** Public read (anon + authenticated). Write denied for both — mutations go through the `submit-vote` Edge Function with service role.

---

### `pseudonymous_vault`

GDPR compliance layer. Stores client-side encrypted emails, separate from the public votes ledger.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique identifier |
| `user_hash` | `text` | Same hash as in `votes` |
| `encrypted_email` | `text` | Email encrypted on the client before sending |
| `project_id` | `uuid` (FK → `projects`) | Associated project |
| `created_at` | `timestamptz` | Creation date |

**Constraint:** `UNIQUE(project_id, user_hash)` — one entry per user per project.

**RLS:** Completely blocked for anon and authenticated. Only service role (Edge Functions) can read and write.

**Why a separate table?**
- The votes ledger is public and does not contain PII.
- The vault isolates personal data, allowing PII to be purged with a single `TRUNCATE` without affecting votes.
- PII access can be audited independently.

---

### `used_nonces`

Replay attacks prevention. Edge Functions register every used nonce.

| Column | Type | Description |
|---|---|---|
| `project_id` | `uuid` (FK → `projects`, PK) | Project |
| `nonce` | `text` (PK) | Single-use nonce |
| `created_at` | `timestamptz` | usage Moment |

**Compound PK:** `(project_id, nonce)`.

**RLS:** Enabled without policies = implicit denial for anon and authenticated. Service role automatically bypasses RLS.

---

### `webhooks`

Allows projects to register webhook URLs for events like suggestion creation or shipment.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Unique identifier |
| `project_id` | `uuid` (FK → `projects`) | Associated project |
| `url` | `text` | Target webhook URL |
| `events` | `text[]` | Subscribed events (default: `suggestion.created`, `suggestion.shipped`) |
| `secret` | `text` | Optional secret to sign webhook payloads |
| `is_active` | `boolean` | Indicates if the webhook is active |
| `created_at` | `timestamptz` | Creation date |

**RLS:** Project members can read. Owners and admins can manage (full CRUD).

---

## Automatic upvotes trigger

The script creates an `update_suggestion_upvotes()` function with two triggers:

- `AFTER INSERT` on `votes` → increments `suggestions.upvotes`.
- `AFTER DELETE` on `votes` → decrements `suggestions.upvotes` (minimum 0).

This keeps the counter synchronized without extra logic in the Edge Functions. The function uses `SECURITY DEFINER` to be able to update `suggestions` independently of the caller's RLS policies.

---

## RLS Security Model

All tables have Row Level Security enabled. The general principle is:

| Table | Anon | Authenticated | Service Role |
|---|---|---|---|
| `projects` | Denied | Read (only their projects) | Total |
| `project_members` | Denied | Read (only their memberships) | Total |
| `suggestions` | Read | Read + Update/Delete (admins) | Total |
| `votes` | Read | Read | Total |
| `pseudonymous_vault` | Denied | Denied | Total |
| `used_nonces` | Denied (implicit) | Denied (implicit) | Total |
| `webhooks` | Denied (implicit) | Read + CRUD (admins) | Total |

> **Important:** the service role automatically bypasses RLS in Supabase. Edge Functions (`submit-vote`, `submit-suggestion`) use this role for all writes, after verifying the HMAC payload signature.

---

## Individual Migrations vs. SQL Starter

The repository contains incremental migrations in `supabase/migrations/`:

| Migration | Content |
|---|---|
| `20260217_init.sql` | Core tables: projects, suggestions, votes, pseudonymous_vault + trigger |
| `20260219_project_members.sql` | project_members table + RLS update for dashboard |
| `20260221_used_nonces.sql` | used_nonces table for replay prevention |
| `20260222_add_webhooks_table_and_triggers.sql` | webhooks table + dispatch trigger |

The `supabase/00_init.sql` file is the consolidation of all these migrations into a single script, designed for users setting up a Supabase project from scratch. If you already ran the individual migrations, **you don't need to run `00_init.sql`**.

---

## Required Environment Variables

After running the SQL, your application will need these variables to connect:

| Variable | Where to get it | Usage |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API → Project URL | Client PostgREST reads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Settings → API → anon key | Authentication for public reads |
| `OPENFEEDBACK_HMAC_SECRET` | Defined by you when creating the project in the `projects` table | Payload signing (server only) |
| `NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID` | UUID of the record inserted into `projects` | Identifies your project |

> **Security:** `OPENFEEDBACK_HMAC_SECRET` is only for the server (Server Actions / API Routes). Never use the `NEXT_PUBLIC_` prefix for this variable.

---

## Creating your first project

After running the starter SQL, insert your first project using the Supabase SQL Editor:

```sql
insert into projects (name, hmac_secret)
values ('My App', 'a-long-and-secure-random-secret')
returning id;
```

Save the returned `id` — it is your `OPENFEEDBACK_PROJECT_ID`. The `hmac_secret` must be a long random string (minimum 32 characters). You can generate it with:

```bash
openssl rand -hex 32
```

If you use the administration dashboard, create your membership as well:

```sql
insert into project_members (project_id, user_id, role)
values ('<project-id>', '<your-auth-user-id>', 'owner');
```
