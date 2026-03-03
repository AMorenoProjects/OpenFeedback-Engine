# OpenFeedback Engine

**The ultimate zero-friction, headless feedback infrastructure for Next.js SaaS applications.**

![Demo](./demo.gif)

Embed a complete feedback board, voting system, and roadmap directly into your product. Your users never leave your app, never see magic links, and never need a separate account!

## ✨ Features

- **Zero-Friction for Users:** Your users vote and suggest features directly using their existing session in your app. No logins or third-party portals.
- **Headless & Customizable:** Ship with your own UI. We provide the React hooks and context; you bring your Tailwind classes or UI libraries.
- **Supabase Self-Hosted:** You own your data. Runs entirely on your own Supabase instance with Row Level Security.
- **"Zero Crypto" Developer Experience:** Cryptography (HMAC signing) is handled seamlessly on your server via a simple Next.js Proxy Route. No complex crypto logic required on the client!
- **Privacy-First:** User votes are mathematically hashed. Emails are encrypted in a dedicated vault for GDPR compliance.

---

## Prerequisites

Before you begin, make sure you have the following:

| Requirement | Why |
| --- | --- |
| **Next.js 13+** (App Router) | The Proxy Route and Provider require the App Router (`app/` directory). |
| **Supabase account** | Your database, auth, and Edge Functions run on your own Supabase instance. [Create a free account](https://supabase.com/dashboard). |
| **Supabase CLI** | Required to deploy the Edge Functions that handle votes and suggestions. [Install guide](https://supabase.com/docs/guides/cli/getting-started). |
| **Tailwind CSS** | The quickstart UI in Step 5 uses Tailwind classes. [Install guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs). |

---

## 🚀 Get Started in 5 Minutes

### Step 1: Database Setup

OpenFeedback runs on your own Supabase database. Let's initialize it:

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** on the left sidebar.
3. Copy the contents of [`supabase/00_init.sql`](./supabase/00_init.sql) and click **Run**. This creates all necessary tables, indexes, and security policies.
4. Now, run this snippet to create your first OpenFeedback project. First, generate a secure HMAC secret in your terminal:

```bash
# Generate a cryptographically secure 32-byte hex secret
openssl rand -hex 32
# Or with Node.js:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then paste the generated secret into this SQL query and run it:

```sql
insert into projects (name, hmac_secret)
values ('My Awesome SaaS', '<paste-your-generated-secret-here>')
returning id;
```

> **IMPORTANT:** Save the `id` returned by this query (your `OpenFeedback Project ID`) and the secret you generated. You will need both in Step 3.

### Step 2: Deploy Edge Functions

The Edge Functions handle all write operations (votes and suggestions). Without them, your database won't receive any data.

Link your local project to Supabase and deploy both functions:

```bash
supabase link --project-ref <your-supabase-project-ref>
supabase functions deploy submit-vote
supabase functions deploy submit-suggestion
```

> You can find your project ref in the Supabase Dashboard under **Settings -> General**.

### Step 3: Installation

Install the OpenFeedback packages in your Next.js application:

```bash
pnpm add @openfeedback/react @openfeedback/client
# or use npm/yarn
```

### Step 4: Environment Variables

Create or update your `.env.local` file with the keys from your Supabase project (Dashboard -> Settings -> API) and the credentials from Step 1.

```env
# Public Supabase keys (Safe to expose to the browser)
# Found in: Supabase Dashboard -> Settings -> API -> Project URL / anon key
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."

# OpenFeedback specific (Safe to expose to the browser)
NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID="<the-uuid-id-returned-in-step-1>"

# Server-only HMAC Secret (NEVER expose this to the browser!)
# This is the secret you generated with `openssl rand -hex 32` in Step 1
OPENFEEDBACK_HMAC_SECRET="<the-secret-you-generated-in-step-1>"
```

### Step 5: Add the Proxy Route (Server Setup)

To keep your app secure and prevent forged votes, OpenFeedback routes all write requests through your Next.js backend.

Create a new file at `app/api/openfeedback/route.ts` (App Router).

The `getUser` function must return the authenticated user's ID from your auth provider. Here are examples for common providers:

**NextAuth v5:**

```typescript
// app/api/openfeedback/route.ts
import { OpenFeedbackProxy } from "@openfeedback/client/next";
import { auth } from "@/auth";

export const POST = OpenFeedbackProxy({
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  getUser: async () => {
    const session = await auth();
    return session?.user?.id || null;
  },
});
```

**Supabase Auth:**

```typescript
// app/api/openfeedback/route.ts
import { OpenFeedbackProxy } from "@openfeedback/client/next";
import { createClient } from "@/lib/supabase/server";

export const POST = OpenFeedbackProxy({
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  getUser: async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  },
});
```

**Clerk:**

```typescript
// app/api/openfeedback/route.ts
import { OpenFeedbackProxy } from "@openfeedback/client/next";
import { currentUser } from "@clerk/nextjs/server";

export const POST = OpenFeedbackProxy({
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  getUser: async () => {
    const user = await currentUser();
    return user?.id || null;
  },
});
```

### Step 6: Quickstart UI (Client Setup)

You are ready! Let's build a functional Feedback Board. You can completely copy and paste this file to get started immediately:

```tsx
// app/feedback/page.tsx
"use client";

import {
  OpenFeedbackProvider,
  useSuggestions,
  useVote,
  useSubmitSuggestion
} from "@openfeedback/react";
import type { Suggestion } from "@openfeedback/react";

const config = {
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
};

// 1. Wrap your UI in the Provider
export default function FeedbackPage() {
  return (
    <OpenFeedbackProvider
      config={config}
      anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
    >
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Feature Requests</h1>

        <SubmitForm />

        <div className="mt-8 border-t border-gray-100 pt-8">
          <SuggestionList />
        </div>
      </div>
    </OpenFeedbackProvider>
  );
}

// 2. Component to create new suggestions
function SubmitForm() {
  const { submit } = useSubmitSuggestion();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        await submit({
          title: formData.get("title") as string,
          description: formData.get("description") as string,
        });
        e.currentTarget.reset();
      }}
      className="flex flex-col gap-3"
    >
      <input
        name="title"
        placeholder="Suggest a new feature..."
        required
        className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <textarea
        name="description"
        placeholder="Why do you need this?"
        rows={3}
        className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none"
      />
      <button
        type="submit"
        className="bg-black text-white font-medium px-4 py-2 rounded self-start hover:bg-gray-800 transition-colors"
      >
        Submit Request
      </button>
    </form>
  );
}

// 3. Component to list and vote on suggestions
function SuggestionList() {
  const { suggestions, isLoading } = useSuggestions({ orderBy: "upvotes" });
  const { vote, isVotingOn } = useVote();

  if (isLoading) return <p className="text-gray-500">Loading suggestions...</p>;
  if (!suggestions?.length) return <p className="text-gray-500">No suggestions yet. Be the first to add one!</p>;

  return (
    <ul className="flex flex-col gap-4">
      {suggestions.map((s: Suggestion) => (
        <li key={s.id} className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg relative bg-gray-50">
          <button
            onClick={() => vote(s.id, "up")}
            disabled={isVotingOn(s.id)}
            className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-100 min-w-[3rem] transition-colors disabled:opacity-50"
          >
            <span className="text-lg leading-none">▲</span>
            <span className="font-bold text-gray-800 mt-1">{s.upvotes}</span>
          </button>

          <div>
            <h3 className="font-semibold text-gray-900">{s.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{s.description}</p>
            <span className="text-[10px] text-gray-500 mt-3 block uppercase font-mono font-bold tracking-wider">
              Status: {s.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

That's it! You now have a working, real-time feedback system embedded directly in your SaaS. No crypto parameters required on the client, and all mutations are securely verified in your Next.js proxy route before they hit your Supabase Edge Functions.

---

## 📚 Advanced Documentation

See the `apps/docs` and `docs` folders for detailed guides on:
- Edge Functions (`apps/docs/database-setup.md`)
- Proxy Auth Internal Architecture (`docs/architecture/proxy-auth.md`)
- Custom UI Primitives and Advanced Usage
- Configuring the CLI for Roadmap Sync (`ROADMAP.md` syncing)
