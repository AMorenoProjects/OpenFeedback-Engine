# OpenFeedback Engine

**Headless, self-hosted feedback infrastructure for Next.js SaaS applications.**

Embed feedback collection, voting, and roadmaps directly into your app. No external portals. No extra user accounts. Your users stay in your product.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green)](https://supabase.com/)

---

## Features

- **Zero-Friction Feedback** &mdash; Users vote and suggest without leaving your app. No magic links, no separate accounts.
- **Signed Stateless Auth** &mdash; Every write operation is secured with HMAC-SHA256 signatures. No session storage. Nonce + timestamp prevent replay attacks.
- **Pseudonymous Vault** &mdash; Public votes are anonymous. Emails are encrypted in an isolated table, decrypted only for just-in-time notifications. GDPR-compliant by design.
- **Headless Components** &mdash; Shadcn-style primitives that accept `className` props and merge via `cn()`. Use the default theme or bring your own.
- **Reactive Search** &mdash; `SuggestionSearch` component with debounced client-side filtering. Users discover existing ideas before creating duplicates.
- **Trust Micro-Copy** &mdash; `TrustBadge` shows masked email (`j***o@gmail.com`) with a lock icon to signal privacy.
- **Roadmap as Code** &mdash; Manage suggestion statuses from a `ROADMAP.md` file. `openfeedback sync` pushes changes to the database.
- **Self-Hosted** &mdash; Runs on your own Supabase instance with Row Level Security enabled. You own the data.

---

## Prerequisites

| Tool | Version |
|------|---------|
| **Node.js** | >= 20 |
| **pnpm** | >= 9 |
| **Supabase Project** | With Edge Functions enabled |

---

## Installation

### As an SDK consumer (your Next.js app)

```bash
pnpm add @openfeedback/react @openfeedback/client
```

### For local development of the engine itself

```bash
git clone https://github.com/your-org/openfeedback-engine.git
cd openfeedback-engine
pnpm install
pnpm build
```

---

## Configuration (Environment Variables)

Your Next.js app needs these variables. Create a `.env.local` file:

```bash
# Public (exposed to the browser)
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Server-only (NEVER expose to the client)
OPENFEEDBACK_HMAC_SECRET="your-project-hmac-secret"
```

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Base URL of your Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key (JWT) for public reads via PostgREST |
| `NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID` | Client + Server | UUID of your project in the `projects` table |
| `OPENFEEDBACK_HMAC_SECRET` | **Server only** | HMAC secret for signing write requests. Must never reach the browser. |

> **Security:** Variables prefixed with `NEXT_PUBLIC_` are bundled into the client. `OPENFEEDBACK_HMAC_SECRET` has no prefix, so it only exists on the server (Server Actions, API routes).

---

## Quick Start (Next.js App Router)

### 1. Create the server-side proxy route

The proxy handles HMAC signing on the server. The `hmacSecret` never leaves this context.

```typescript
// app/api/openfeedback/route.ts
import { OpenFeedbackProxy } from "@openfeedback/client/next";

export const POST = OpenFeedbackProxy({
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  getUser: async () => {
    // Replace with your auth (NextAuth, Clerk, Supabase Auth, etc.)
    const session = await getSession();
    return session?.user?.id || null;
  },
});
```

### 2. Mount the provider and render feedback

```tsx
// app/feedback/page.tsx (Server Component)
import { FeedbackBoard } from "@/components/FeedbackBoard";

const config = {
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
};

export default function FeedbackPage() {
  return (
    <FeedbackBoard
      config={config}
      anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      userId="user-id-from-your-auth"
      userEmail="user@example.com" // Optional: enables TrustBadge
    />
  );
}
```

```tsx
// components/FeedbackBoard.tsx (Client Component)
"use client";
import {
  OpenFeedbackProvider,
  useSuggestions,
  useVote,
  useSubmitSuggestion,
  SuggestionSearch,
  TrustBadge,
  type OpenFeedbackConfig,
} from "@openfeedback/react";

export function FeedbackBoard({ config, anonKey, userId, userEmail }) {
  return (
    <OpenFeedbackProvider config={config} anonKey={anonKey}>
      {/* Your feedback UI here. Use the hooks: */}
      {/* useSuggestions()        — read suggestions */}
      {/* useVote()               — cast/remove votes */}
      {/* useSubmitSuggestion()   — create suggestions */}
      {/* useSearchSuggestions()  — debounced client-side search */}
      {/* <SuggestionSearch />    — search input with dropdown */}
      {/* <TrustBadge />          — masked email badge */}
    </OpenFeedbackProvider>
  );
}
```

### 3. Use the hooks

```tsx
// Read suggestions (public, no auth required)
const { suggestions, isLoading, refetch } = useSuggestions({ orderBy: "upvotes" });

// Vote (auth handled by the proxy route)
const { vote } = useVote();
await vote(suggestionId, "up", { signature, nonce, timestamp });

// Submit a new suggestion
const { submit } = useSubmitSuggestion();
await submit({ title: "Dark mode", description: "Please add dark mode support" });

// Search existing suggestions (client-side, debounced)
const { results, isSearching } = useSearchSuggestions({ query: "dark mode" });
```

---

## Architecture

```
Browser (Client Components)                    Server (Next.js)
┌─────────────────────────┐                   ┌─────────────────────────────┐
│ <OpenFeedbackProvider>  │                   │ /api/openfeedback (Proxy)   │
│                         │                   │                             │
│  useSuggestions() ──────┼── GET /rest/v1 ──►│                             │
│                         │                   │  1. Verify user session     │
│  useVote()         ─────┼── POST /proxy ───►│  2. Build JSON body         │
│  useSubmitSuggestion()  │                   │  3. HMAC-SHA256(body, key)  │
│                         │                   │  4. Forward to Edge Fn      │
│  <SuggestionSearch />   │                   └──────────────┬──────────────┘
│  <TrustBadge />         │                                  │
└─────────────────────────┘                                  ▼
                                              ┌─────────────────────────────┐
                                              │ Supabase                    │
                                              │                             │
                                              │  Edge Functions:            │
                                              │    submit-vote              │
                                              │    submit-suggestion        │
                                              │                             │
                                              │  PostgreSQL (RLS):          │
                                              │    projects                 │
                                              │    suggestions              │
                                              │    votes (user_hash only)   │
                                              │    pseudonymous_vault       │
                                              └─────────────────────────────┘
```

**Key security invariant:** The HMAC secret never reaches the browser. The proxy route signs every write request server-side. Edge Functions verify the signature with constant-time comparison before touching the database.

---

## Monorepo Structure

```
packages/
  react/       @openfeedback/react     React SDK: Provider, hooks, headless components
  client/      @openfeedback/client    Vanilla JS client, Zod schemas, types
               @openfeedback/client/server  Node.js-only HMAC signing utilities
               @openfeedback/client/next    Next.js proxy route helper
  cli/         @openfeedback/cli       CLI: openfeedback sync, openfeedback changelog

apps/
  demo-app/       Reference Next.js implementation
  web-dashboard/  Admin panel for managing suggestions
  docs/           Technical documentation
```

### SDK Exports (`@openfeedback/react`)

| Export | Type | Description |
|--------|------|-------------|
| `OpenFeedbackProvider` | Component | Context provider (wraps your feedback UI) |
| `SuggestionSearch` | Component | Headless search input with dropdown (Shadcn-style) |
| `TrustBadge` | Component | Masked email + lock icon micro-copy |
| `useSuggestions` | Hook | Read suggestions list |
| `useVote` | Hook | Cast or remove a vote |
| `useSubmitSuggestion` | Hook | Create a new suggestion |
| `useSearchSuggestions` | Hook | Debounced client-side search over cached suggestions |
| `cn` | Utility | `clsx` + `tailwind-merge` class merger |
| `maskEmail` | Utility | `"user@example.com"` &rarr; `"u***r@example.com"` |

---

## Development Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages (Turborepo)
pnpm dev              # Dev mode with watch
pnpm type-check       # TypeScript checking across all packages
pnpm clean            # Clean dist/ and node_modules/

# Single package
pnpm --filter @openfeedback/react build
pnpm --filter @openfeedback/client build
pnpm --filter @openfeedback/cli build
pnpm --filter @openfeedback/demo-app dev   # http://localhost:3099
```

---

## CLI: Roadmap as Code

The `@openfeedback/cli` package syncs suggestion statuses between a `ROADMAP.md` file and the database.

```bash
# Preview changes without writing
openfeedback sync --dry-run

# Apply status changes to the database
openfeedback sync

# Scan git history for suggestion references
openfeedback changelog --since v1.0.0
```

The CLI requires three environment variables: `OPENFEEDBACK_API_URL`, `OPENFEEDBACK_SERVICE_KEY`, and `OPENFEEDBACK_PROJECT_ID`. See [CLI documentation](./apps/docs/cli.md) for full details.

---

## License

The core engine and SDKs are licensed under the [MIT License](LICENSE).
