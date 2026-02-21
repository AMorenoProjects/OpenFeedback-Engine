# Integration Guide: OpenFeedback Engine

> This guide provides a manual step-by-step walkthrough to integrate **OpenFeedback Engine** into an existing Next.js (App Router) project without using the automated CLI. It covers the complete lifecycle of secure, stateless feedback collection.

---

## 🏗️ 1. Infrastructure Preparation (Supabase)

The core strength of OpenFeedback relies on Supabase for data sovereignty and Edge-side verification.

1. **Create a Supabase Project:** Or use your existing one where your application's user base lives.
2. **Apply Migrations:** Your database needs the `/supabase/migrations` applied. These install:
   - The `votes` table (public metrics).
   - The `pseudonymous_vault` (encrypted email storage).
   - The `used_nonces` table (replay attack mitigation).
3. **Deploy the Edge Functions:** Run `supabase functions deploy` to upload the logic that safely parses your Signed Actions before hitting Postgres via the Service Role.
4. **Acquire Credentials:** From your Supabase Dashboard, get:
   - `NEXT_PUBLIC_OPENFEEDBACK_URL`
   - `NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY`
   - Generate a custom 32-byte hexadecimal string for your `OPENFEEDBACK_HMAC_SECRET` (You can also do this in the `web-dashboard`).

## ⚙️ 2. The Setup

Install the required workspace packages into your Next.js application:

```bash
npm install @openfeedback/react @openfeedback/server @openfeedback/client
```

Add your environment variables to `.env.local`:

```env
NEXT_PUBLIC_OPENFEEDBACK_URL="..."
NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY="..."
OPENFEEDBACK_HMAC_SECRET="..."
```

## 🔒 3. The Server Side Signer (The "No Login" Magic)

To prove to the Edge Functions that a user clicking "Upvote" in the browser is exactly who they claim to be—without forcing them to log into another portal—we use their existing session token in your App.

Create a proxy file `app/actions/openfeedback.ts`:

```typescript
"use server";

import { signRequestBody, generateNonce } from "@openfeedback/client/server";

const hmacSecret = process.env.OPENFEEDBACK_HMAC_SECRET!;
const projectId = "your-project-id";

// Wrap the Vote Intent
export async function signVote(
  userId: string,
  suggestionId: string,
  direction: "up" | "remove",
) {
  const nonce = generateNonce();
  const timestamp = Date.now();

  const body = JSON.stringify({
    auth: { user_id: userId, nonce, timestamp, project_id: projectId },
    vote: { suggestion_id: suggestionId, direction },
  });

  const signature = signRequestBody(body, hmacSecret);
  return { signature, nonce, timestamp };
}

// Wrap the Submission Intent
export async function signSuggestion(
  userId: string,
  title: string,
  description?: string,
) {
  const nonce = generateNonce();
  const timestamp = Date.now();

  const body = JSON.stringify({
    auth: { user_id: userId, nonce, timestamp, project_id: projectId },
    suggestion: { title, ...(description ? { description } : {}) },
  });

  const signature = signRequestBody(body, hmacSecret);
  return { signature, nonce, timestamp };
}
```

## ⚛️ 4. The React Provider

Wrap your application (or just the route where the feedback board will live) with the `<OpenFeedbackProvider>`. The simplest way is embedding it into your `app/layout.tsx`:

```tsx
import { OpenFeedbackProvider } from "@openfeedback/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  
  // Example: Grab your user inside the layout (from Supabase Auth, NextAuth, Clerk, etc.)
  const sessionUser = { id: "user-123" }; 

  return (
    <html lang="en">
      <body>
        <OpenFeedbackProvider
          config={{
            projectId: "your-project-id", // Match the one in your Server Action
            apiUrl: process.env.NEXT_PUBLIC_OPENFEEDBACK_URL!
          }}
          anonKey={process.env.NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY!}
          authContext={{ 
            userId: sessionUser?.id || "anonymous-viewer", 
            nonce: "initial", 
            signature: "initial", 
            timestamp: 0 
          }}
        >
          {children}
        </OpenFeedbackProvider>
      </body>
    </html>
  );
}
```

## 🎨 5. Embedding the UI

Drop our ready-made Feedback Board anywhere in your tree. It automatically inherits your Next.js Theme and links into the Provider.

```tsx
"use client";

import { FeedbackBoard } from "@openfeedback/react";

export default function FeedbackPage() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Roadmap</h1>
            <FeedbackBoard />
        </div>
    );
}
```

## 🚨 Troubleshooting

- **401 Unauthorized (`Signature verification failed!`):**
  - Ensure the `OPENFEEDBACK_HMAC_SECRET` in your Next.js `.env.local` exactly matches the one stored in the `projects` table on Supabase.
- **400 Bad Request (`Nonce already used`):**
  - This prevents replay attacks natively within 5 minutes. If this happens during normal use, ensure `generateNonce()` is dynamically called *inside* the server action function block, not defined globally at the file level.
- **Data Not Refreshing:**
  - `useSuggestions()` polls via SWR currently. If optimistic UI isn't displaying correctly on a vote, check your Client SDK version. The backend returns absolute Truth.
