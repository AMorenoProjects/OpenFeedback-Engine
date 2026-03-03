# Proxy Authorization (DX Improvement)

> Documentation on the current "Plug & Play" integration model via Next.js Route Handlers.

## Evolution of the Integration (DX)

Originally, OpenFeedback required the developer to create custom Server Actions that imported cryptographic functions (`signRequestBody`, `generateNonce`) from `@openfeedback/client/server`. This required deep knowledge of the "Signed Stateless Auth" model and exposed an error surface susceptible to vulnerabilities (such as the Oracle Attack, where a generic misconfigured endpoint allowed a user to forge votes).

To solve this and achieve the golden rule of **less than 10 lines of code for integration**, we introduced the **Proxy Route Handler** pattern (`@openfeedback/client/next`).

## How the Proxy works

Instead of delegating cryptographic operations to the manual host app code, the SDK exports a complete route handler for Next.js (App Router).

### The current flow is as follows:

1. **The React Component requests an action**
   Hooks like `useVote` no longer generate cryptographic requirements. They simply make a raw `POST` internally (e.g. to `/api/openfeedback`) with the action (`vote`) and the payload.
   
2. **The Proxy Intercepts**
   The Route Handler built with `OpenFeedbackProxy` receives the request in the client backend.
   
3. **Identity Resolution (Zero Trust Client)**
   The Proxy invokes the `getUser()` function defined by the developer to read the real HTTP cookies/session (e.g. the NextAuth session) and securely extract the `user_id`. It never trusts a `user_id` sent by the browser for authoring purposes.
   
4. **Signing and Forwarding**
   If the user is authenticated, the Proxy generates a `nonce` and `timestamp` locally, creates the `auth` object by combining it with the `user_id`, applies the signature using `OPENFEEDBACK_HMAC_SECRET`, and forwards (proxies) the final request to the Supabase Edge Function (`submit-vote` or `submit-suggestion`).

## Architectural Advantages

- **Oracle Attack Mitigation:** It's impossible for the frontend client to forge the identity, since the payload sent to Supabase contains a `user_id` injected 100% on the server via secure host sessions.
- **Zero Crypto:** Developers don't see hashes, signatures, or nonces. They only provide their secret as an environment variable when initializing the handler.
- **Transparency:** To the browser, it looks like it's simply interacting with a normal REST API `/api/openfeedback`. All the "Stateless Signed Auth" going to the background OpenFeedback Engine is invisible.

## Migration: Hooks API (before vs. now)

With the introduction of the Proxy, the signature of the hooks changed to remove the cryptographic parameters that the developer had to pass manually.

### Before (pre-Proxy, deprecated)

```tsx
// Developers had to generate and pass signature, nonce, and timestamp
const { vote } = useVote();
await vote(suggestionId, "up", { signature, nonce, timestamp });
```

### Now (with Proxy Route Handler)

```tsx
// Cryptography is transparent — the Proxy handles it server-side
const { vote, isVotingOn } = useVote();
await vote(suggestionId, "up");
```

| Hook                   | Cryptographic Parameters | Notes                                      |
| ---------------------- | ------------------------ | ------------------------------------------ |
| `useVote`              | Removed                  | Only `(suggestionId, direction)`.          |
| `useSubmitSuggestion`  | Removed                  | Only `{ title, description }`.             |
| `useSuggestions`       | Never had them           | Public read, without authentication.       |
| `useSearchSuggestions` | Never had them           | Client-side filtering on public data.      |

> **Note:** If you find old examples passing `{ signature, nonce, timestamp }` to a hook, they are obsolete. The current API does not accept those parameters — all authentication happens transparently in the Proxy Route Handler.
