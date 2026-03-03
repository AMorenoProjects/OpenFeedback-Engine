# System Architecture

> Technical document describing the implemented architecture of OpenFeedback Engine.

---

## 1. Overview

OpenFeedback Engine is a monorepo containing three layers:

```
┌─────────────────────────────────────────────────────┐
│                    Host App (Next.js)                │
│                                                     │
│ Route Handler (Proxy)   Browser                     │
│  ┌──────────────┐      ┌──────────────────────────┐ │
│  │OpenFeedback- │◀─req─│ <OpenFeedbackProvider>   │ │
│  │    Proxy     │      │  ├─ useSuggestions()      │ │
│  └──────────────┘      │  ├─ useVote()            │ │
│  @openfeedback/        │  └─ useSubmitSuggestion() │ │
│  client/next           │  @openfeedback/react      │ │
│                        └──────────┬───────────────┘ │
└───────────┬───────────────────────┼─────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  Supabase          │
                          │                    │
                  Reads   │  PostgREST API     │  Writes
                 (anon) ──│  (GET /rest/v1/)   │── (Edge Functions)
                          │                    │
                          │  ┌──────────────┐  │
                          │  │ submit-vote   │  │
                          │  │ submit-       │  │
                          │  │  suggestion   │  │
                          │  └──────┬───────┘  │
                          │         │ service   │
                          │         │ role      │
                          │  ┌──────▼───────┐  │
                          │  │ PostgreSQL    │  │
                          │  │ + RLS         │  │
                          │  └──────────────┘  │
                          └────────────────────┘
```

**Reads** (suggestions, votes) go straight to PostgREST using the `anon key`. RLS allows public read access.

**Writes** (voting, creating a suggestion) pass through Edge Functions that verify the HMAC signature before writing using the `service role` (bypassing RLS).

---

## 2. Monorepo Structure

```text
/
├── apps/
│   ├── web-dashboard/         # Admin panel for Managed clients
│   ├── docs/                  # Documentation site
│   └── demo-app/              # Next.js example app
│
├── packages/
│   ├── react/                 # React SDK (@openfeedback/react)
│   │   └── src/
│   │       ├── components/    # OpenFeedbackProvider
│   │       ├── hooks/         # useSuggestions, useVote, useSubmitSuggestion
│   │       ├── types/         # Re-exports from @openfeedback/client
│   │       └── utils/         # cn() (clsx + tailwind-merge)
│   │
│   ├── client/                # JS Client (@openfeedback/client)
│   │   └── src/
│   │       ├── index.ts       # Browser-safe entry point
│   │       ├── server.ts      # Node.js entry point (HMAC signing)
│   │       ├── schemas.ts     # Zod schemas (source of truth for types)
│   │       ├── types.ts       # TypeScript types inferred from Zod
│   │       ├── constants.ts   # TABLE names, AUTH config
│   │       ├── api-client.ts  # OpenFeedbackClient class
│   │       └── signing.ts     # signRequestBody(), generateNonce()
│   │
│   ├── cli/                   # CLI (@openfeedback/cli)
│   ├── typescript-config/     # Shared TSConfigs
│   └── tailwind-config/       # Shared Tailwind preset
│
├── supabase/
│   ├── migrations/
│   │   └── 20260217_init.sql  # Full schema + RLS + triggers
│   └── functions/
│       ├── _shared/           # Shared logic between Edge Functions
│       │   ├── auth.ts        # Complete verification pipeline
│       │   ├── crypto.ts      # HMAC, timingSafeEqual, hashUserId
│       │   ├── nonce.ts       # Async verification in used_nonces table
│       │   ├── cors.ts        # CORS headers
│       │   ├── response.ts    # JSON/error response helpers
│       │   └── validation.ts  # Runtime payload validation
│       ├── submit-vote/       # Edge Function: vote/unvote
│       └── submit-suggestion/ # Edge Function: create suggestion
│
└── docker/                    # Self-Hosting configuration
```

### Monorepo Tools

| Tool | Purpose |
|---|---|
| **pnpm workspaces** | Dependency management with strict isolation |
| **Turborepo** | Build orchestration with incremental caching |
| **tsup** (esbuild) | Library compilation — dual ESM/CJS + `.d.ts` |
| **TypeScript 5.7+** | Strict mode, `noUncheckedIndexedAccess`, `bundler` moduleResolution |

---

## 3. Packages and Responsibilities

### `@openfeedback/client` (packages/client)

The shared contract between frontend and backend. Three entry points:

| Import | Environment | Content |
|---|---|---|
| `@openfeedback/client` | Browser + Node | Zod schemas, types, `OpenFeedbackClient`, constants |
| `@openfeedback/client/server` | Node.js Only | `signRequestBody()`, `generateNonce()` (uses `node:crypto`) |
| `@openfeedback/client/next` | Server (Next.js) | Preconfigured `OpenFeedbackProxy()` Route Handler |

**`OpenFeedbackClient`** is the typed HTTP wrapper:
- **Reads** (`getSuggestions`, `getSuggestion`, `hasVoted`): Use PostgREST with `anon key`
- **Writes** (`submitVote`, `submitSuggestion`): Calls the internal Next.js Proxy if injected. Internally calls Edge Functions with an HMAC signature.

### `@openfeedback/react` (packages/react)

React SDK. Depends on `@openfeedback/client`.

| Export | Type | Description |
|---|---|---|
| `<OpenFeedbackProvider>` | Component | Instantiates `OpenFeedbackClient`, provides context (`proxyUrl`) |
| `useOpenFeedback()` | Hook | Access to the client and configuration |
| `useSuggestions()` | Hook | Fetches suggestions with loading/error state |
| `useVote()` | Hook | Vote/unvote (routes to internal Next.js proxy) |
| `useSubmitSuggestion()` | Hook | Create suggestion (routes to internal Next.js proxy) |
| `cn()` | Utility | `clsx` + `tailwind-merge` for headless components |

### `@openfeedback/cli` (packages/cli)

Command-line tool (skeleton). Planned for:
- Git history analysis with fuzzy matching
- Changelog generation
- `openfeedback sync` for Roadmap-as-Code

### Edge Functions (supabase/functions/)

All Edge Functions share the same authentication pipeline via `_shared/`:

```
Request → CORS check → Parse JSON → Validate body → Check timestamp
        → Fetch project secret → Verify HMAC (constant-time)
        → Check nonce replay → Execute business logic
```

| Function | Endpoint | Action |
|---|---|---|
| `submit-vote` | `POST /functions/v1/submit-vote` | INSERT or DELETE in `votes` |
| `submit-suggestion` | `POST /functions/v1/submit-suggestion` | INSERT in `suggestions` + UPSERT in `pseudonymous_vault` |

---

## 4. Data Flow: Vote Lifecycle

```
1. Browser (React Hook):
   │
   ├─ useVote()
   └─ POST /api/openfeedback
       Body: { action: "vote", payload: {...} }

2. Host App (Proxy Route Handler):
   │
   ├─ session = getUser()
   ├─ auth = { user_id: session.id, nonce: generateNonce(), timestamp: Date.now(), project_id }
   ├─ body = JSON.stringify({ auth, vote: { suggestion_id, direction: "up" } })
   ├─ signature = signRequestBody(body, HMAC_SECRET)
   └─ POST /functions/v1/submit-vote (Headers: { x-openfeedback-signature })

3. Edge Function (submit-vote):
   │
   ├─ Validate body with validateVoteRequest()
   ├─ Verify timestamp (±5 min)
   ├─ Fetch project.hmac_secret from DB
   ├─ Compute HMAC(rawBody, secret)
   ├─ timingSafeEqual(received_sig, expected_sig)
   ├─ Mark nonce as used
   ├─ userHash = HMAC(user_id, project_secret)  ← salted per-project
   └─ INSERT INTO votes (suggestion_id, user_hash, project_id)
```
4. PostgreSQL Trigger:
   │
   └─ UPDATE suggestions SET upvotes = upvotes + 1
```

---

## 5. Shared Configuration

### TypeScript (`packages/typescript-config`)

| Config | Usage | Details |
|---|---|---|
| `base.json` | Base for all | `strict`, `noUncheckedIndexedAccess`, `bundler` resolution |
| `react-library.json` | `packages/react` | Extends base + `jsx: "react-jsx"`, DOM libs |
| `nextjs.json` | `apps/demo-app` | Extends base + `jsx: "preserve"`, Next.js plugin |
| `node.json` | `packages/cli` | Extends base, no DOM libs |

### Tailwind (`packages/tailwind-config`)

Shared preset with custom color scales:
- `of-primary-{50..900}` — blue for primary actions
- `of-neutral-{50..900}` — grays for base UI
- `borderRadius.of` — standard `0.5rem`

---

## 6. Integrations and Webhooks (Phase 5)

To support notifications in native collaboration tools like Slack or Discord, OpenFeedback implements an **Outbound Webhooks** system.

1. A `webhooks` table stores endpoints configured per project.
2. A **PostgreSQL Trigger** listens for `INSERT` or `UPDATE` events (e.g., when the status changes to `shipped`) in the `suggestions` table.
3. The trigger queues and reliably transmits the payload asynchronously using `pg_net` to the `dispatch-webhook` Edge Function.
4. `dispatch-webhook` transforms the standard payload into rich formats (like Discord Embeds) and executes the final HTTP POST to the consumer.

*Discord Event Example: suggestion.created*
```json
{
  "content": "🚀 **New Suggestion Created:** Export to PDF",
  "embeds": [{
       "title": "Export to PDF",
       "color": 5814783,
       "footer": { "text": "ID: [...]" }
  }]
}
```
