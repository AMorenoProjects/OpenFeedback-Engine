# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenFeedback Engine is a headless, self-hosted feedback infrastructure for Next.js/React SaaS applications. It provides SDKs and APIs for embedding feedback collection, voting, and roadmaps directly into apps — no external portals or extra user accounts required.

**License:** MIT (Core) / Commercial (Managed Services)

## Build & Development Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages (via Turborepo)
pnpm dev              # Dev mode with watch (via Turborepo)
pnpm type-check       # TypeScript type checking across all packages
pnpm clean            # Clean all dist/ and node_modules/

# Single package build
pnpm --filter @openfeedback/react build
pnpm --filter @openfeedback/cli build
pnpm --filter @openfeedback/client build
```

## Monorepo Structure

pnpm workspaces + Turborepo. Packages build with `tsup` (esbuild-based, dual ESM/CJS output).

- `packages/react` — Core React SDK (`@openfeedback/react`): `<OpenFeedbackProvider>`, hooks (`useSuggestions`, `useVote`, `useSubmitSuggestion`), `cn()` utility
- `packages/client` — Vanilla JS client (`@openfeedback/client`): Zod schemas, `OpenFeedbackClient` API class, types. Two entry points: `@openfeedback/client` (browser-safe) and `@openfeedback/client/server` (Node.js HMAC signing)
- `packages/cli` — CLI tool (`@openfeedback/cli`): changelog generation, `openfeedback sync`
- `packages/typescript-config` — Shared tsconfigs: `base.json`, `react-library.json`, `nextjs.json`, `node.json`
- `packages/tailwind-config` — Shared Tailwind preset with `of-primary` and `of-neutral` color scales
- `apps/demo-app` — Next.js demo app
- `apps/web-dashboard` — Admin panel for managed clients
- `apps/docs` — Documentation site
- `docker/` — Self-hosting configuration

## Tech Stack

- **Frontend SDK:** TypeScript (strict, no `any`), React 18/19, Tailwind CSS + Radix UI
- **Backend:** Supabase (PostgreSQL + RLS + Edge Functions)
- **Styling utilities:** `clsx` + `tailwind-merge` via the `cn()` helper in `packages/react/src/utils/cn.ts`
- **Build:** tsup for libraries, Turborepo for orchestration

## Key Design Decisions

- **Signed Stateless Auth:** No session storage. Backend validates cryptographic signature + timestamp + nonce. Bloom filter in RAM prevents replay attacks.
- **Pseudonymous Vault:** Votes are public and anonymous. Emails are encrypted in an isolated table, decrypted only for just-in-time notifications (GDPR strategy).
- **Roadmap as Code:** Roadmap state lives in `ROADMAP.md` with anchor-based format (`<!-- id: 123 -->`). `openfeedback sync` syncs with DB locally; the developer commits manually.
- **Headless + Default Theme:** Components are unstyled by default but ship with an optional theme via `@openfeedback/react/styles.css`.
- **All SDK components are client components** — tsup banner injects `"use client"` directive.

## Database Schema (`supabase/migrations/`)

4 tables with RLS enabled on all. Explicit deny policies for both `anon` AND `authenticated` roles:
- `projects` — tenant config + `hmac_secret`. No access for anon or authenticated.
- `suggestions` — public read (anon + authenticated), no direct writes. Upvote count maintained by trigger.
- `votes` — public read, no direct writes. Stores `user_hash` (HMAC of user_id salted with project secret), never raw identity. Unique constraint on `(suggestion_id, user_hash)`.
- `pseudonymous_vault` — no access for anon or authenticated. Maps `user_hash` → `encrypted_email` for GDPR-compliant notifications.

Write path: all mutations go through Supabase Edge Functions using the service role (bypasses RLS). Two functions exist:
- `submit-vote` — cast or remove a vote
- `submit-suggestion` — create a new suggestion (optionally upserts vault entry)

Shared auth logic lives in `supabase/functions/_shared/` (crypto, nonce, CORS, validation, auth pipeline).

## Security Invariants

These are hard rules that must not be violated in any future code:
- **HMAC covers the full request body** (auth + action payload), not just the auth portion. Prevents vote-target swapping.
- **Sign the raw body string**, never a re-serialized `JSON.stringify`. Prevents key-order mismatches.
- **Constant-time signature comparison** (`timingSafeEqual`). Never use `===` or `!==` to compare HMAC signatures.
- **Salted user_hash**: `HMAC(user_id, project_hmac_secret)`, not plain `SHA-256(user_id)`. Prevents cross-project user correlation.
- **Sanitize error responses**: never forward `supabaseError.message` to the client. Log internally, return generic message.
- **Nonce store must be bounded**: the in-memory Set has a max size with FIFO eviction. Never use an unbounded collection.
- **`hmacSecret` must never reach the browser**. Signing happens server-side only (Next.js Server Action / API route).

## Conventions

- Blueprint and docs are written in Spanish. Code, APIs, and variable names are in English.
- Shared TypeScript configs are extended via `@openfeedback/typescript-config` workspace package.
- React SDK exports from single entry point `packages/react/src/index.ts`.
- All domain types are derived from Zod schemas in `packages/client/src/schemas.ts` — never define types manually.
- `packages/react` re-exports domain types from `@openfeedback/client` — never duplicate type definitions across packages.
- Table names are constants in `packages/client/src/constants.ts` (`TABLE.PROJECTS`, etc.).
- Edge Functions use Deno runtime with `jsr:` imports for Supabase dependencies.
- Edge Functions must validate request bodies at runtime (not just TypeScript `as` assertions).
- `@openfeedback/client/server` is Node.js-only (uses `node:crypto`). Never import in browser code.
- React hooks receive the HMAC `signature` as a parameter — signing is the host app's server-side responsibility.
