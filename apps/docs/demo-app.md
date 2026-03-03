# Demo App — Core Engine Validation

Next.js application (App Router) that validates the complete operation of `@openfeedback/react`, `@openfeedback/client` and the Supabase backend (Edge Functions + PostgreSQL). It serves as a reference integration example for any Next.js app that wants to embed OpenFeedback.

---

## Quick Start

```bash
# 1. Build SDK packages (Turborepo resolves the order)
pnpm build

# 2. Configure environment variables
cp apps/demo-app/.env.local.example apps/demo-app/.env.local
# Edit .env.local with your values (see "Environment Variables" section)

# 3. Start development server
pnpm --filter @openfeedback/demo-app dev
# → http://localhost:3099
```

---

## Environment Variables

The `.env.local` file in `apps/demo-app/` must contain:

| Variable | Exposure | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Base URL of the Supabase project (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Anon key (public JWT) for PostgREST reads |
| `NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID` | Client + Server | UUID of the project in the `projects` table |
| `OPENFEEDBACK_HMAC_SECRET` | **Server only** | Shared HMAC secret with the backend. Used to sign every write request. **Must never reach the browser.** |

> **Security:** variables with the `NEXT_PUBLIC_` prefix are visible in the client bundle. `OPENFEEDBACK_HMAC_SECRET` does not have that prefix and therefore only exists in the server environment (Server Actions, API routes).

---

## File Structure

```
apps/demo-app/
├── .env.local                  # Environment variables (not committed)
├── package.json                # Next.js 15 + workspace dependencies
├── tsconfig.json               # Extends @openfeedback/typescript-config/nextjs
├── next.config.ts              # transpilePackages for SDK packages
├── tailwind.config.ts          # Imports @openfeedback/tailwind-config preset
├── postcss.config.mjs
└── src/
    ├── app/
    │   ├── globals.css         # Tailwind directives
    │   ├── layout.tsx          # Root layout (metadata, body with of-neutral classes)
    │   ├── page.tsx            # Server Component: mounts FeedbackBoard with config
    │   └── actions.ts          # Server Actions: signVote, signSuggestion
    └── components/
        ├── FeedbackBoard.tsx   # Client Component: <OpenFeedbackProvider> wrapper
        ├── SuggestionList.tsx  # useSuggestions (read) + useVote (write)
        └── NewSuggestionForm.tsx # useSubmitSuggestion (suggestion creation)
```

---

## Integration Architecture

### Flow Diagram

```
┌───────────────────────────────────────────────────────────────┐
│  Browser (Client Components)                                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  <OpenFeedbackProvider>                                 │  │
│  │    config = { projectId, apiUrl }                       │  │
│  │    anonKey = NEXT_PUBLIC_SUPABASE_ANON_KEY              │  │
│  │    authContext = { userId, ... }                        │  │
│  │                                                         │  │
│  │  ┌──────────────────┐  ┌───────────────────────────┐   │  │
│  │  │  useSuggestions   │  │  useVote / useSubmitSug.  │   │  │
│  │  │  (public read)    │  │  (signed write)           │   │  │
│  │  └────────┬─────────┘  └────────────┬──────────────┘   │  │
│  └───────────┼─────────────────────────┼───────────────────┘  │
│              │                         │                      │
│              │ GET /rest/v1/suggestions │ 1. Call Server       │
│              │ (anon key)              │    Action to sign     │
│              │                         │ 2. POST /functions/v1 │
│              │                         │    with signature     │
└──────────────┼─────────────────────────┼──────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js Server (Server Actions)                             │
│                                                              │
│  signVote(userId, suggestionId, direction)                   │
│  signSuggestion(userId, title, description?)                 │
│    1. Generates fresh nonce + timestamp                      │
│    2. Builds the complete JSON body (auth + payload)         │
│    3. HMAC-SHA256(body, OPENFEEDBACK_HMAC_SECRET)            │
│    4. Returns { signature, nonce, timestamp }                │
└──────────────────────────────────────────────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                    │
│                                                              │
│  PostgREST ← reads (anon key, RLS: public SELECT)           │
│  Edge Functions ← writes (service role, bypass RLS)          │
│    submit-vote:       verifies signature → INSERT/DELETE votes │
│    submit-suggestion: verifies signature → INSERT suggestions  │
│  Trigger: update_suggestion_upvotes() maintains the counter  │
└──────────────────────────────────────────────────────────────┘
```

### Vote Flow (step by step)

1. The user clicks on "▲" in a suggestion.
2. `SuggestionList.tsx` calls the Server Action `signVote(userId, suggestionId, "up")`.
3. The Server Action (in the Next.js server):
   - Generates a cryptographically random `nonce` (16 hex bytes).
   - Captures the current `timestamp` (`Date.now()`).
   - Builds the exact JSON body: `{ auth: { user_id, nonce, timestamp, project_id }, vote: { suggestion_id, direction } }`.
   - Signs the body with `HMAC-SHA256(body, hmacSecret)` using `signRequestBody` from `@openfeedback/client/server`.
   - Returns `{ signature, nonce, timestamp }` to the client.
4. The component calls `vote(suggestionId, "up", { signature, nonce, timestamp })` from the `useVote` hook.
5. The hook uses `OpenFeedbackClient.submitVote()` which:
   - Reconstructs the body with the same auth values (userId from context + received nonce/timestamp).
   - Sends `POST /functions/v1/submit-vote` with the body in the payload and the signature in the `x-openfeedback-signature` header.
6. The `submit-vote` Edge Function:
   - Validates the body (structure, types, UUIDs).
   - Verifies the timestamp freshness (< 5 minutes drift).
   - Fetches the project's `hmac_secret` from the `projects` table.
   - Recomputes `HMAC-SHA256(rawBody, hmac_secret)` and compares it with the signature (constant-time).
   - Verifies that the nonce hasn't been used (anti-replay).
   - Computes `user_hash = HMAC(user_id, project_secret)` (never stores the real user_id).
   - Inserts into `votes` or returns 409 if already voted.
7. The `update_suggestion_upvotes()` trigger automatically increments `suggestions.upvotes`.
8. The component calls `refetch()` from `useSuggestions` to update the list.

---

## Components in detail

### `page.tsx` — Server Component

```tsx
// Read environment config (server-side)
const config = {
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
};
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Render FeedbackBoard (client component)
<FeedbackBoard config={config} anonKey={anonKey} userId={DEMO_USER_ID} />
```

The `userId` is hardcoded as `"demo-user-001"` for the demo. In a real app, it would come from your authentication system (e.g., `session.user.id`).

### `FeedbackBoard.tsx` — Provider wrapper

Mounts `<OpenFeedbackProvider>` with:
- `config`: projectId + apiUrl.
- `anonKey`: for public PostgREST reads.
- `authContext`: only carries `userId`. `signature`, `nonce` and `timestamp` fields are generated freshly for each operation via Server Actions (see "Fixed Bug" section).

### `SuggestionList.tsx` — Read + Voting

Uses two hooks:
- `useSuggestions({ orderBy: "upvotes" })` — Automatic fetch on mount. Returns `{ suggestions, isLoading, error, refetch }`.
- `useVote()` — Returns `{ vote, isLoading, error }`. Each call to `vote()` receives freshly signed auth.

### `NewSuggestionForm.tsx` — Suggestion creation

Controlled form with `title` and `description`. Uses `useSubmitSuggestion()` which returns `{ submit, isLoading, error }`. The flow is identical to voting: calls Server Action to sign, then the hook to send.

### `actions.ts` — Server Actions

Two exported `"use server"` functions:

```typescript
signVote(userId, suggestionId, direction)
  → { signature, nonce, timestamp }

signSuggestion(userId, title, description?)
  → { signature, nonce, timestamp }
```

Both:
1. Generate `nonce` with `generateNonce()` from `@openfeedback/client/server`.
2. Build the exact JSON body that the Edge Function expects.
3. Sign with `signRequestBody(body, hmacSecret)`.
4. Return only the necessary parameters (the secret never leaves the server).

---

## Fixed SDK Bug: per-call nonce

### Problem

The `useVote` and `useSubmitSuggestion` hooks originally took `nonce` and `timestamp` from the provider's `authContext` which is set on mount. This meant that:

- The first operation worked correctly.
- The second operation with the same `authContext` was rejected by the Edge Function as **replay** (already used nonce).

In practice, only one single write operation could be made per session.

### Solution

The hook signatures were modified to accept a fresh `SignedAuthParams` object for each call:

```typescript
// Before (broken for multiple operations):
vote(suggestionId, direction, signature)
// The hook read nonce/timestamp from the provider context (fixed)

// After (correct):
vote(suggestionId, direction, { signature, nonce, timestamp })
// Each call receives fresh auth from the Server Action
```

**Modified files:**
- `packages/react/src/hooks/useVote.ts` — New parameter `signedAuth: SignedAuthParams`.
- `packages/react/src/hooks/useSubmitSuggestion.ts` — Same change.
- `packages/react/src/index.ts` — Exports `SignedAuthParams` type.

**New exported type:**

```typescript
interface SignedAuthParams {
  signature: string;
  nonce: string;
  timestamp: number;
}
```

The provider's `authContext` is still necessary to provide the `userId`, but it is no longer responsible for the per-operation nonce or timestamp.

---

## Backend: what was deployed in Supabase

### Schema (4 tables)

The `supabase/migrations/20260217_init.sql` migration creates:

| Table | Anon/authenticated access | Purpose |
|---|---|---|
| `projects` | Denied (service role only) | Tenant registry + `hmac_secret` |
| `suggestions` | Public SELECT, no writes | Feedback board |
| `votes` | Public SELECT, no writes | Votes ledger (stores `user_hash`, not `user_id`) |
| `pseudonymous_vault` | Denied (service role only) | Encrypted PII for GDPR-compliant notifications |

### Edge Functions (2)

| Function | Route | Action |
|---|---|---|
| `submit-vote` | `POST /functions/v1/submit-vote` | Insert or remove vote |
| `submit-suggestion` | `POST /functions/v1/submit-suggestion` | Create suggestion + optional vault entry |

Both follow the same authentication pipeline:

```
Validate body → Verify timestamp → Fetch hmac_secret → Verify HMAC signature → Check nonce → Execute operation
```

### Automatic Trigger

`update_suggestion_upvotes()` runs `AFTER INSERT` and `AFTER DELETE` on `votes`, keeping `suggestions.upvotes` in sync without extra logic in the Edge Function.

---

## Performed E2E Validation

| Scenario | Method | Expected result | Actual result |
|---|---|---|---|
| Read suggestions (anon key) | `GET /rest/v1/suggestions` | 200 + suggestions array | 200 + 3 suggestions |
| Signed vote | `POST /functions/v1/submit-vote` | 201 `{ ok: true, action: "voted" }` | 201 OK |
| Upvotes trigger | SELECT after vote | `upvotes` incremented | `upvotes: 0 → 1` |
| Duplicate vote (same user + suggestion) | `POST /functions/v1/submit-vote` | 409 "Already voted" | 409 OK |
| Signed suggestion creation | `POST /functions/v1/submit-suggestion` | 201 + complete suggestion | 201 OK |
| Next.js Build | `pnpm build` | Without errors | Successful build |
| Dev server | `pnpm dev` | HTTP 200 | 200 OK |

---

## Integration pattern for your app

To integrate OpenFeedback in a real Next.js app, replicate this pattern:

### 1. Install dependencies

```bash
pnpm add @openfeedback/react @openfeedback/client
```

### 2. Create Server Actions for signing

```typescript
// app/actions.ts
"use server";
import { signRequestBody, generateNonce } from "@openfeedback/client/server";

const hmacSecret = process.env.OPENFEEDBACK_HMAC_SECRET!;
const projectId = process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!;

export async function signVote(userId: string, suggestionId: string, direction: "up" | "remove") {
  const nonce = generateNonce();
  const timestamp = Date.now();
  const body = JSON.stringify({
    auth: { user_id: userId, nonce, timestamp, project_id: projectId },
    vote: { suggestion_id: suggestionId, direction },
  });
  return { signature: signRequestBody(body, hmacSecret), nonce, timestamp };
}
```

### 3. Mount the Provider

```tsx
// In a Client Component
import { OpenFeedbackProvider } from "@openfeedback/react";

<OpenFeedbackProvider
  config={{ projectId: "...", apiUrl: "https://xxx.supabase.co" }}
  anonKey="eyJ..."
  authContext={{ userId: session.user.id, signature: "", nonce: "", timestamp: 0 }}
>
  {children}
</OpenFeedbackProvider>
```

### 4. Use the hooks

```tsx
// Read (without auth)
const { suggestions, isLoading, refetch } = useSuggestions({ orderBy: "upvotes" });

// Write (with Server Action to sign)
const { vote } = useVote();
const signedAuth = await signVote(userId, suggestionId, "up");
await vote(suggestionId, "up", signedAuth);
```

### Key point: the signature is always on the server

The `hmacSecret` must **never** reach the client. The pattern is:

1. The client decides what action to take (e.g., vote for X).
2. It calls a Server Action passing the action parameters.
3. The Server Action builds the complete body, signs it, and returns `{ signature, nonce, timestamp }`.
4. The client passes those values to the hook, which sends the signed request to the Edge Function.

---

## Useful commands

```bash
# Development
pnpm --filter @openfeedback/demo-app dev     # Dev server on :3099

# Build
pnpm build                                    # Full monorepo build
pnpm --filter @openfeedback/demo-app build    # Build demo only

# Type check
pnpm --filter @openfeedback/demo-app type-check
```
