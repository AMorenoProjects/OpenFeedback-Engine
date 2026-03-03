# OpenFeedback Engine: Project Blueprint

> **Tagline:** The "Headless" feedback infrastructure for the modern Next.js ecosystem.
> **Version:** 2.0.0
> **Status:** Phase 2 completed — Core Engine implemented
> **License:** MIT (Core) / Commercial (Managed Services)

---

## 1. Executive Summary

**OpenFeedback Engine** is not just another feedback portal. It is an open-source infrastructure designed for developers who want to integrate feedback collection, voting, and roadmaps directly into their SaaS applications, without sacrificing their visual identity or forcing users to create external accounts.

Unlike monolithic solutions (Canny, Jira PD), OpenFeedback works as a set of primitives (SDKs and APIs) that integrate into the development lifecycle (Git), automating user communication (Changelogs), and ensuring data sovereignty (GDPR-first).

## 2. Problem Analysis (The Pain)

SaaS founders and Indie developers face a trilemma with current tools:

*   **User Friction:** External tools require the user to sign up again to vote. Result: Low participation (<5% of users).
*   **Visual Inconsistency:** External "Feedback Boards" (iframe or subdomain) break the user experience and branding.
*   **Overhead and Privacy Risk:** Enterprise solutions are expensive and centralized. Storing European users' data on third-party servers (USA) complicates **GDPR** compliance.
*   **Workflow Disconnection:** Feedback lives in a silo. Closing the loop ("Shipping it") depends on manual processes prone to human error.

## 3. The Solution (The Gain)

A **Headless** and **Self-Hosted** system that lives inside your application.

### Design Principles

1.  **Signed Stateless Auth:** Cryptographic stateless authentication. The backend validates HMAC-SHA256 signature, timestamp, and nonce (protected by bounded Set in RAM with FIFO eviction).
2.  **Pseudonymous Vault:** Honesty in privacy. The vote is public and anonymous; the email is saved encrypted in an isolated table for "Just-In-Time" notifications.
3.  **Developer Experience (DX) Obsessive:** Designed for Next.js (App Router, Server Actions). Installed via `npm install @openfeedback/react @openfeedback/client`.
4.  **Headless with Optional Theme:** Works out of the box by importing `@openfeedback/react/styles.css`. Customizable, but beautiful by default.
5.  **No-Black-Magic:** No automatic "Git-Write-Backs" in CI. The developer controls the synchronization with `openfeedback sync`.

## 4. Technical Stack

### 4.1 Frontend (The SDK)
*   **Language:** TypeScript (strict, no `any`).
*   **Target Framework:** React 18/19, Next.js (App Router).
*   **Packaging:** NPM Registry (`@openfeedback/react`, `@openfeedback/client`).
*   **Build:** tsup (esbuild) — dual ESM/CJS with type declarations.
*   **Styles:** Headless (no styles) + Optional theme based on Tailwind CSS and Radix UI.
*   **Utilities:** `clsx` + `tailwind-merge` for class composition.

### 4.2 Backend (Supabase)
*   **Database:** PostgreSQL via Supabase (with RLS enabled on all tables).
*   **Read API:** PostgREST (Supabase REST API with `anon key`).
*   **Write API:** Supabase Edge Functions (Deno runtime, `service role`).
*   **Security:** HMAC-SHA256 validation in Edge Functions. User IDs hashed with per-project salt. Constant-time comparison.
*   **Privacy:** Pseudonymous Vault — isolated PII table with client-side encrypted emails.

### 4.3 DevOps & CLI
*   **Tool:** `@openfeedback/cli` (Node.js, skeleton implemented).
*   **Planned feature:** Git history analysis with Fuzzy Matching, changelog generation, `openfeedback sync`.

### 4.4 Monorepo
*   **Workspaces:** pnpm 9.x
*   **Orchestration:** Turborepo with incremental cache
*   **Shared Configs:** `@openfeedback/typescript-config`, `@openfeedback/tailwind-config`

## 5. Module Architecture

### Module A: Transparent Auth SDK (Implemented)

The `<OpenFeedbackProvider>` component injects the auth context and API client.

```tsx
// The signature is computed server-side in a Server Action
const { signature, auth } = await signVoteRequest(userId, suggestionId, "up");

// The Provider receives the pre-signed auth context
<OpenFeedbackProvider
  config={{ projectId: "...", apiUrl: "https://..." }}
  anonKey="sb-anon-key"
  authContext={{
    userId: currentUser.id,
    signature,
    timestamp: auth.timestamp,
    nonce: auth.nonce,
  }}
>
  {children}
</OpenFeedbackProvider>
```

### Module B: Headless Hooks (Implemented)

Hooks for complete UI control:

*   `useSuggestions(options?)`: Fetch list with filtering and ordering.
*   `useVote()`: Vote/unvote with server-side signature.
*   `useSubmitSuggestion()`: Create new feedback with server-side signature.

### Module C: Changelog Generator (Planned)

A pipeline connecting your code with feedback:

1.  Dev commits: `feat: allow png export`.
2.  CI detects fuzzy match with Suggestion #45 "Export to PNG". Bot comments on PR: "Closes #45?". Dev confirms.
3.  CI/CD runs `openfeedback release`.
4.  System marks #45 as "Shipped" and decrypts emails temporarily to notify.

### Module D: Roadmap as Code (Planned)

The truth about the roadmap lives in the repository, not in an opaque database:

1.  Create `ROADMAP.md` in your repo using "Anchor-based" format: `- [ ] Feature Name <!-- id: 123 -->`.
2.  Run `npx openfeedback sync` locally.
3.  YOU commit. Zero surprises in CI. Complete control.

## 6. Go-to-Market Strategy

### Entry Vector: Next.js Niche
We are not competing against Canny in general. We are competing to be the default choice in the Next.js / Vercel ecosystem.

*   **Tactic:** Create "Starters" and "Boilerplates" for SaaS that already include OpenFeedback pre-installed.

### Differentiator: Honest Privacy (GDPR)
No fake "Zero-Knowledge" promises that break functionalities. We offer **Auditable Pseudonymity**: votes are not publicly linked to identities, but the administrator retains the (encrypted) technical capability to contact users.

### Business Model (Open Core)
*   **Self-Hosted Standard:** Free and open source.
*   **Enterprise Support:** Support contracts and auditing for large volumes.

## 7. Development Roadmap

### Phase 1: Scaffold (Completed)
*   **Deliverable:** Monorepo with pnpm + Turborepo, shared configs, skeleton for all packages.
*   **Status:** Working build of `@openfeedback/client`, `@openfeedback/react`, `@openfeedback/cli`.

### Phase 2: Core Engine (Completed)
*   **Deliverable:** PostgreSQL Schema + RLS, Edge Functions (submit-vote, submit-suggestion), API Client, React Hooks.
*   **Security audit:** 9 vulnerabilities identified and fixed (timing attacks, unsigned vote payload, unsalted hashes, unbounded nonce store, missing CORS, leaked DB errors, missing runtime validation, duplicate types, missing authenticated-role RLS).

### Phase 3: Demo App (Completed)
*   **Objective:** Functional Next.js app to demonstrate the SDK end-to-end.
*   **Deliverable:** `apps/demo-app` with Server Actions, Provider, and components using the 3 hooks.

### Phase 4: CLI & Changelog (Completed)
*   **Objective:** Functional CLI for changelog generation.
*   **Deliverable:** `openfeedback-changelog-action` for GitHub Marketplace ready to use. CLI command ready for CI/CD.

### Phase 5: Ecosystem and Stability (Completed)
*   **Objective:** Robustness and extensibility.
*   **Deliverable:** Outbound webhooks and Slack/Discord integration. (Note: Extensibility of the "Plugin System" is satisfied effectively and securely via webhooks, delegating the logic to consumers).

## 8. Repository Structure (Current)

```text
/
├── apps/
│   ├── web-dashboard/          # Admin panel (placeholder)
│   ├── docs/                   # Documentation (placeholder)
│   └── demo-app/               # Next.js example app (placeholder)
│
├── packages/
│   ├── react/                  # React SDK — Provider, Hooks, cn()
│   ├── client/                 # JS Client — Schemas, API Client, Signing
│   ├── cli/                    # CLI (skeleton)
│   ├── typescript-config/      # Shared TSConfigs
│   └── tailwind-config/        # Shared Tailwind preset
│
├── supabase/
│   ├── migrations/             # SQL Schema + RLS + Triggers
│   └── functions/
│       ├── _shared/            # Auth, Crypto, CORS, Validation
│       ├── submit-vote/        # Edge Function: vote
│       └── submit-suggestion/  # Edge Function: create suggestion
│
├── docker/                     # Self-Hosting (placeholder)
└── docs/                       # Project documentation
    ├── blueprint.md            # This file (Vision and Architecture)
    ├── architecture/
    │   ├── overview.md         # System architecture
    │   ├── database.md         # Database schema
    │   ├── security.md         # Security model
    │   └── Diagramas/          # Auth Flow SVG
    ├── guides/                 
    │   ├── integration.md      # SDK integration guide
    │   └── web-dashboard.md    # Admin Dashboard manual
    └── strategy/               
        ├── analisis-estrategico.md # Niche market analysis
        └── launch-copy.md      # Launch copy texts

## 9. Additional Documentation

| Document | Content |
|---|---|
| [architecture/overview.md](./architecture/overview.md) | Overview, monorepo structure, data flow, package responsibilities |
| [architecture/database.md](./architecture/database.md) | Tables, RLS, triggers, Pseudonymous Vault design |
| [architecture/security.md](./architecture/security.md) | Signed Stateless Auth, HMAC, nonces, timing-safe, security invariants |
| [guides/integration.md](./guides/integration.md) | Step-by-step guide to integrate in Next.js with code examples |
| [guides/web-dashboard.md](./guides/web-dashboard.md) | Admin Dashboard setup and management |
| [architecture/Diagramas/](./architecture/Diagramas/) | Visual diagrams of auth and vault |
