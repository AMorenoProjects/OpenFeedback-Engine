// ---------------------------------------------------------------------------
// Server-side HMAC signing utilities
// ---------------------------------------------------------------------------
// SECURITY: These functions use the project's HMAC secret and must ONLY run
// on the server (Next.js Server Actions, API routes, etc.).
// Never import this module in client-side (browser) code.
// ---------------------------------------------------------------------------

import { createHmac, randomBytes } from "node:crypto";
import { AUTH } from "./constants";

/**
 * Sign a JSON request body with HMAC-SHA256.
 * Returns the hex-encoded signature to send in the `x-openfeedback-signature` header.
 *
 * @param body - The full JSON body string (not an object — serialize first).
 * @param hmacSecret - The project's HMAC secret.
 */
export function signRequestBody(body: string, hmacSecret: string): string {
  return createHmac(
    AUTH.HMAC_ALGORITHM === "SHA-256" ? "sha256" : "sha256",
    hmacSecret,
  )
    .update(body)
    .digest("hex");
}

/**
 * Generate a cryptographically random nonce string (hex-encoded).
 * Default 16 bytes = 32 hex characters.
 */
export function generateNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}
