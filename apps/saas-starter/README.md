# OpenFeedback SaaS Starter

A fully functional, elegantly designed **B2B SaaS Dashboard Starter** built with Next.js 15, Tailwind CSS 4, and powered directly by **OpenFeedback Engine**.

This template comes pre-configured with the `<FeedbackBoard>` seamlessly integrated into a dedicated `/feedback` route, allowing your users to vote on features and submit suggestions without ever leaving your app or creating a secondary account.

## 🚀 Push to Deploy

Get started immediately by deploying this template to Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjandro%2FOpenFeedback-Engine%2Ftree%2Fmain%2Fapps%2Fsaas-starter&envStrict=NEXT_PUBLIC_OPENFEEDBACK_URL,NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY,OPENFEEDBACK_HMAC_SECRET)

## 🛠️ Local Development

### Prerequisites

- Your own OpenFeedback Engine instance running on Supabase.
- The `OPENFEEDBACK_HMAC_SECRET` from your Admin Dashboard.
- The Supabase Project URL and Anon Key.

### Setup

1. Copy the `.env.local.example` (or create `.env.local`):

```bash
cp .env.local.example .env.local
```

2. Fill in the credentials obtained from your OpenFeedback web dashboard:

```env
NEXT_PUBLIC_OPENFEEDBACK_URL="https://your-project.supabase.co"
NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY="your-anon-key"
OPENFEEDBACK_HMAC_SECRET="your-hmac-secret-from-dashboard"
```

3. Install dependencies and run the server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. Navigate to **Feedback & Roadmap** in the sidebar to see the engine in action.

## 📦 What's Included?

- **Premium Dark Mode UI**: A generic Sidebar and Header layout featuring glassmorphism elements tailored for modern SaaS.
- **Server Actions Pre-Wired**: Secure cryptographic signing happens out of the box in `app/actions/openfeedback.ts`, mimicking the exact signature logic dictated by the Engine.
- **Root Provider**: `<OpenFeedbackProvider>` injected at the `layout.tsx` level so the board can be summoned anywhere in your Component Tree.

## 🌐 The Tech Stack

- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [@openfeedback/react](https://github.com/jandro/OpenFeedback-Engine) for the UI Primitives.
- [@openfeedback/server](https://github.com/jandro/OpenFeedback-Engine) for the secure edge signing.

---
*Built as a reference template for OpenFeedback Engine Phase 2.*
