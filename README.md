# OpenFeedback Engine

> **The Headless Feedback Infrastructure for the Modern Next.js Ecosystem.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)

[🇪🇸 Leer en Español](./README.es.md)

---

## 🚀 Overview

**OpenFeedback Engine** is not just another feedback portal. It is an open-source infrastructure designed for developers who want to integrate feedback collection, voting, and roadmaps directly into their SaaS applications without sacrificing visual identity or forcing users to create external accounts.

Unlike monolithic solutions (Canny, Jira PD), OpenFeedback operates as a set of primitives (SDKs and APIs) that integrate into your development lifecycle, automating user communication and ensuring data sovereignty.

## ✨ Key Features

-   **Headless by Design**: Full UI control. Use our unstyled hooks or the optional default theme.
-   **Signed Stateless Auth**: Cryptographic authentication without session storage. Your users never need a second login.
-   **Pseudonymous Vault**: GDPR-first privacy. Votes are public but anonymous; emails are encrypted and stored in an isolated vault.
-   **Developer Experience**: Built for Next.js App Router and Server Actions.
-   **Self-Hosted**: You own the data. Runs on your Supabase instance.

## 🏗️ Architecture

This project is a monorepo managed with `pnpm` and `turborepo`.

### Packages (`packages/*`)

-   **`@openfeedback/client`**: Core logic, API client, Zod schemas, and cryptographic signing utilities.
-   **`@openfeedback/react`**: React SDK containing the `<OpenFeedbackProvider>`, hooks (`useVote`, `useSuggestions`), and components.
-   **`@openfeedback/cli`**: CLI tool for syncing roadmaps and generating changelogs.

### Applications (`apps/*`)

-   **`apps/demo-app`**: A Next.js reference implementation demonstrating the SDK in action.
-   **`apps/web-dashboard`**: Administrative panel for project management and moderation.
-   **`apps/docs`**: Documentation site.

### Backend (`supabase/*`)

-   **Database**: PostgreSQL schema with Row Level Security (RLS) enabled on all tables.
-   **Edge Functions**: Deno-based serverless functions for secure write operations (`submit-vote`, `submit-suggestion`).

## 🛠️ Getting Started

### Prerequisites

-   Node.js >= 20
-   pnpm >= 9
-   Docker (for local Supabase development)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/openfeedback-engine.git
    cd openfeedback-engine
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Start the development environment:**
    ```bash
    pnpm dev
    ```

### Running the Demo

To verify the installation and see the engine in action:

```bash
pnpm dev --filter demo-app
```

Visit `http://localhost:3000` to interact with the feedback board.

## 🔒 Security & Privacy

OpenFeedback employs a **Signed Stateless Auth** mechanism. Requests are signed server-side using an HMAC-SHA256 signature, ensuring that votes are authentic without requiring a dedicated session database for the feedback engine.

User emails are stored in a **Pseudonymous Vault**, isolated from public vote data and encrypted at rest, ensuring compliance with strict privacy regulations like GDPR.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

Currently in active development (Phase 2 - Core Engine Complete).