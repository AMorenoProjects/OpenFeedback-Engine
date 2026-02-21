# Launch Marketing Copy: OpenFeedback Engine

> This document contains the draft content for soft-launching OpenFeedback Engine on developer communities (HackerNews, Reddit r/nextjs, X). The priority is a highly technical, value-driven tone rather than a pure marketing pitch.

## Option 1: The "Show HN" Technical Deep-Dive

**Title:** Show HN: OpenFeedback Engine – A headless, no-login feedback board via HMAC signatures

**Body:**

Hey HN,

I’m launching OpenFeedback Engine today. It’s an open-source, stateless feedback and roadmap system designed specifically for the Next.js ecosystem. 

**The Problem:**
I noticed a frustrating trend building B2B SaaS apps. As soon as you wanted to collect user feedback or show a roadmap, you had to either:
1. Pay $50/mo for a tool like Canny and force your paying users to create a *separate account* simply to upvote a feature.
2. Rely on gross "Magic Link" iframes that shattered your product’s aesthetic and retention loop.
3. Build the entire CRUD infrastructure yourself from scratch.

I wanted something different: a system where users could vote seamlessly inside my app, using the authentication session *they already had*, without my server having to proxy every single REST request just to pass user contexts securely.

**The Solution:**
OpenFeedback operates entirely headlessly with **Signed Stateless Auth**.

Here’s how it works:
When a user clicks "Upvote" on your React frontend, instead of hitting a backend server, your Next.js App issues a simple Server Action. That Server Action grabs the User ID from your existing session (NextAuth/Clerk) and cryptographically signs a payload using an `HMAC-SHA256` secret and a `nonce`.

That signed payload is shipped straight to our Supabase Edge Functions. The Edge Function verifies the HMAC signature, checks the nonce against a PostgreSQL persistence table to prevent Replay Attacks, and performs the database write.

The result? You don't need a dedicated session database for the feedback portal, your users never leave the app, and you get 100% data sovereignty since it all runs inside your own Supabase instance.

**Features:**
*   GDPR First: We separate public vote hashes from a "Pseudonymous Vault" that stores encrypted emails for notifications.
*   Zero-Friction CLI: `npx @openfeedback/cli init` scaffolds the Server Actions and Provider in 10 seconds.
*   Push-to-Deploy: Comes with a fully styled SaaS Starter Template and a Moderation Dashboard.

The repo is fully open-source (MIT). I’d love your feedback on the architecture, specifically our approach to nonce verification on the Edge versus Redis.

GitHub: [Link to Repo]
Demo: [Link to saas-starter or demo-app deployment]

Cheers!

---

## Option 2: The Reddit `r/nextjs` / `r/reactjs` Showcase

**Title:** I got tired of 3rd-party feedback tools ruining UX, so I open-sourced a Headless, No-Login alternative for Next.js 15.

**Body:**

Hey everyone, building my last SaaS I realized I hated sending my users away to a separate portal just to vote on a roadmap feature. It breaks the visual theme and kills engagement when they have to "Log in again".

So I built **OpenFeedback Engine**.

It’s completely open-source and built on top of Next.js App Router and Supabase. The core idea is simple: **Don't make your users log in twice**.

It uses **Server Actions** to tap into your existing Auth (whether you use NextAuth, Clerk, Supabase Auth, etc.), signs a cryptographic HMAC payload proving the user is who they say they are, and validates the vote directly on an Edge Function.

**What you get out of the box:**
1.  **A 1-click CLI:** Run `npx @openfeedback/cli init`. It wires up the Server Actions and the `<OpenFeedbackProvider>` automatically.
2.  **Fully styled Drop-in UI:** Just drop `<FeedbackBoard />` anywhere in your code. It inherits your Tailwind dark/light mode context instantly.
3.  **An Admin Dashboard:** A standalone Next.js template to manage roadmap statuses and your API keys securely.

It’s basically the logic and UI of a $50/mo feedback SaaS, but you host the database for free and keep 100% control over the UI.

I've documented the entire integration process and set up a SaaS Starter template if you want to deploy it right now.

Check it out: [Link to Repo]

Would love to hear what the Next.js community thinks about the Server-Side Request Signing pattern!

---

## Option 3: Twitter / X Thread (Action-Oriented)

**Tweet 1:**
Stop forcing your SaaS users to create a second account on a 3rd-party portal just to upvote a feature. 🛑

Today I’m open-sourcing OpenFeedback Engine: The headless, stateless no-login feedback board built for the modern Next.js stack. 🧵👇
[Link/Image of the beautifully integrated Board]

**Tweet 2:**
The magic is in the architecture. 🏗️
Instead of shared cookies or complex OAuth, OpenFeedback uses "Signed Stateless Auth".
Your Next.js Server Action signs payloads via HMAC-SHA256, and our Supabase Edge Function verifies them. 100% secure, 0% user friction.

**Tweet 3:**
Worried about GDPR and privacy? 🛡️
We use a "Pseudonymous Vault." The public votes DB is isolated from the encrypted email store where notifications live. Real privacy by design.

**Tweet 4:**
You can integrate it into any Next.js (App Router) project in 60 seconds.
`npx @openfeedback/cli init` wires up the Provider and Server Actions. Just drop `<FeedbackBoard />` into your layout and you're done.

Fully Open Source (MIT). Star the repo here: [Link] ⭐
