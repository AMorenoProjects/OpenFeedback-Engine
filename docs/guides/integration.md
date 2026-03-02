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

## 🔒 3. The Server Side Proxy (The "Plug & Play" Auth)

To prove to the Edge Functions that a user clicking "Upvote" in the browser is exactly who they claim to be—without forcing them to log into another portal—we use their existing session token in your App.

Instead of writing cryptography code by hand, you simply spawn an API route. Create `app/api/openfeedback/route.ts`:

```typescript
import { OpenFeedbackProxy } from "@openfeedback/client/next";
import { getSession } from "@/lib/auth"; // Your app's auth library

export const POST = OpenFeedbackProxy({
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,
  supabaseUrl: process.env.NEXT_PUBLIC_OPENFEEDBACK_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY!,
  getUser: async () => {
    // Only logged-in users get to vote. The SDK will securely sign 
    // the request using this ID server-side.
    const session = await getSession();
    return session?.user?.id || null; 
  }
});
```

## ⚛️ 4. The React Provider

Wrap your application (or just the route where the feedback board will live) with the `<OpenFeedbackProvider>`. The simplest way is embedding it into your `app/layout.tsx`:

```tsx
import { OpenFeedbackProvider } from "@openfeedback/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OpenFeedbackProvider
          config={{
            projectId: "your-project-id", // Match the one in your environment
            apiUrl: process.env.NEXT_PUBLIC_OPENFEEDBACK_URL!,
            // proxyUrl: "/api/openfeedback" // Default location
          }}
          anonKey={process.env.NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY!}
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

(The `userId` prop is only used for UI-optimistic rendering of user's own votes; security authorization happens behind the scenes in the Route Handler).

```tsx
"use client";

import { FeedbackBoard } from "@openfeedback/react";

export default function FeedbackPage() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Roadmap</h1>
            <FeedbackBoard userId="current_user_id" />
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
