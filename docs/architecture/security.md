# Security Model

> Documentation of the authentication system, data protection, and security invariants that must be respected in all future code.

---

## 1. Signed Stateless Auth

OpenFeedback does not use sessions, custom JWT tokens, or cookies. Instead, the host app signs every write request with HMAC-SHA256 using a shared secret.

### Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (SDK)                        │
│                                                         │
│  1. Sends the write attempt as plain JSON:              │
│     POST /api/openfeedback                              │
│     { action: "vote", payload: {...} }                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              PROXY ROUTE HANDLER (Next.js)               │
│                                                         │
│  2. Fetches user session (zero trust to browser)        │
│  3. Builds the complete body:                           │
│     body = JSON.stringify({                             │
│       auth: { user_id, nonce, timestamp, project_id },  │
│       vote: { suggestion_id, direction }                │
│     })                                                  │
│  4. Signs the complete body:                            │
│     signature = HMAC-SHA256(body, hmac_secret)          │
│  5. Sends POST to Edge Function with signature header   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  EDGE FUNCTION (Deno)                    │
│                                                         │
│  6. Reads rawBody as string (DO NOT re-serialize)       │
│  7. Validates body structure (runtime checks)           │
│  7. Verifies timestamp ±5 minutes                       │
│  8. Fetches project.hmac_secret from DB                 │
│  9. expected = HMAC-SHA256(rawBody, secret)             │
│ 10. timingSafeEqual(received, expected)                 │
│ 11. Verifies nonce wasn't used (replay protection)      │
│ 12. user_hash = HMAC(user_id, secret) ← salted          │
│ 13. Executes operation in DB with service role          │
└─────────────────────────────────────────────────────────┘
```

### Why this design

| Decision | Rejected Alternative | Reason |
|---|---|---|
| HMAC per request | JWT with expiration | Needs no token exchange or refresh. Every request is self-contained |
| Full body signature | Only auth signature | Prevents an attacker from changing the vote target without invalidating the signature |
| Raw body signing | Re-serialization | `JSON.stringify` does not guarantee key order between implementations |
| `hmac_secret` on server | Secret in browser | The browser never touches the secret. The signature is computed server-side |

---

## 2. Replay Attacks Protection

Every request includes a `nonce` (cryptographic random single-use value) and a `timestamp`.

### Nonce

- Generated with `crypto.randomBytes(16)` (128 bits of entropy)
- Verified against the **`used_nonces`** table in PostgreSQL
- The nonce is marked as used (via `INSERT`) **only after** verifying the HMAC signature (prevents an attacker from "poisoning" the database with invalid requests)
- The composite PK `(project_id, nonce)` guarantees the Request will fail (`23505 Unique Violation`) indicating a secure replay attack even with distributed Edge Functions.

### Timestamp

- Tolerance window: **5 minutes** (`TIMESTAMP_TOLERANCE_MS`)
- Calculated as `|server_time - client_timestamp| <= 5min`
- Prevents replay of requests captured more than 5 minutes ago

### Known Limitations (MVP)

- Cleanups of the `used_nonces` table do not currently occur periodically via Cron Tasks in the DB, which may affect disk size in the future. It results in the need for an eventual cleanup trigger for old timestamps.

---

## 3. Timing-Safe Comparison

HMAC signature comparison uses `timingSafeEqual()`:

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

**Why:** A standard equality check (`===`) short circuits at the first mismatch. An attacker could measure response times to guess the correct signature byte by byte. XOR over all characters takes the same time regardless of where the mismatch is.

---

## 4. Salted User Hash

The `user_id` from the host app is never stored directly in the database.

```
user_hash = HMAC-SHA256(user_id, project_hmac_secret)
```

| Property | Detail |
|---|---|
| **Algorithm** | HMAC-SHA256 (not plain SHA-256) |
| **Salt** | The project's `hmac_secret` |
| **Per-project** | The same `user_id` produces different hashes in different projects |
| **Irreversible** | You cannot recover `user_id` from `user_hash` without the secret |

**Why not plain SHA-256:** Without salt, the same user would have the identical hash across all projects using OpenFeedback. This would allow cross-project correlation (identifying that user X voted on project A and project B). With salted HMAC, each project produces a unique hash.

---

## 5. Pseudonymous Vault (GDPR)

See diagram: `docs/Diagramas/Diagrama_Pseudonymous Vault.png`

### Design

```
votes (PUBLIC)                 pseudonymous_vault (PRIVATE)
┌────────────────────┐        ┌──────────────────────────┐
│ suggestion_id      │        │ user_hash                │
│ user_hash ─────────┼────────│ encrypted_email          │
│ project_id         │        │ project_id               │
└────────────────────┘        └──────────────────────────┘
  Read: anon, auth              Read: only service_role
  Write: only service_role      Write: only service_role
```

### Principles

1. **Table Separation:** Votes are public and contain no PII. The email is kept in an isolated table that neither `anon` nor `authenticated` can read.

2. **Client-side Encryption:** The email is encrypted in the host app's browser before being sent. Not even OpenFeedback sees the plaintext email — only the host app can decrypt it.

3. **GDPR Erasure:** Complying with an erasure request takes a single `TRUNCATE pseudonymous_vault` or `DELETE WHERE user_hash = X`. Votes remain as anonymous records.

4. **Just-in-Time Access:** The vault is only queried when it's time to notify (e.g. "Your feature request shipped"). The host app decrypts the email temporarily to send the notification.

---

## 6. RLS (Row Level Security)

All tables have RLS enabled with explicit policies for `anon` AND `authenticated`:

| Table | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `projects` | Fully denied | Fully denied | Full access |
| `suggestions` | Read only | Read only | Full access |
| `votes` | Read only | Read only | Full access |
| `pseudonymous_vault` | Fully denied | Fully denied | Full access |

**Principle:** The `anon`/`authenticated` roles can never write directly. All writes go through Edge Functions using the `service_role`.

---

## 7. Security Invariants

These rules must not be bypassed in any future code:

| # | Rule | Reference |
|---|---|---|
| 1 | **HMAC covers the entire body** (auth + action), not just auth | `_shared/auth.ts` |
| 2 | **Sign the raw body string**, never re-serialize with `JSON.stringify` | `_shared/auth.ts` |
| 3 | **Constant-time comparison** for signatures (`timingSafeEqual`) | `_shared/crypto.ts` |
| 4 | **Salted user hash** with `HMAC(user_id, project_secret)` | `_shared/crypto.ts` |
| 5 | **Sanitize Errors**: never expose `supabaseError.message` to the client | Edge Functions |
| 6 | **Async nonce storage** in DB (cross-instance safe) | `_shared/nonce.ts` |
| 7 | **`hmac_secret` never reaches the browser** | `@openfeedback/client/server` is Node-only |
| 8 | **Runtime validation** of all request bodies (not only TS `as`) | `_shared/validation.ts` |
| 9 | **Nonce is marked after** signature check (prevents poisoning) | `_shared/auth.ts` |

---

## 8. Error Sanitization

Edge Functions **never** return internal PostgreSQL error messages to the client.

```typescript
// BAD (leaks DB internals)
return errorResponse(`Vote failed: ${insertError.message}`, 500);

// GOOD (internal log + generic message)
console.error("Vote insert failed:", insertError.message);
return errorResponse("Vote failed", 500);
```

This prevents an attacker from obtaining table names, columns, constraints, or PostgreSQL engine details through error messages.

---

## 9. CORS

Edge Functions include CORS headers in all responses:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-openfeedback-signature, Authorization
Access-Control-Max-Age: 86400
```

`OPTIONS` (preflight) requests get a `204 No Content` response with these headers.

> **Note:** `Allow-Origin: *` is appropriate because authentication relies on per-request HMAC signatures, not cookies. There is no security benefit to restricting origins since the secret is never in the browser.
