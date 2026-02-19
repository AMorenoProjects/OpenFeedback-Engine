// ---------------------------------------------------------------------------
// Cryptographic helpers for Signed Stateless Auth
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256 of `payload` using `secret`.
 * Returns the raw ArrayBuffer — call `bufferToHex()` to get a hex string.
 */
export async function computeHmac(
  payload: string,
  secret: string,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(payload));
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two hex strings.
 * Prevents timing side-channel attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)!;
  }
  return result === 0;
}

/**
 * Salted user hash: HMAC(user_id, project_secret).
 * Project-specific salt prevents cross-project user correlation.
 */
export async function hashUserId(
  userId: string,
  projectSecret: string,
): Promise<string> {
  const digest = await computeHmac(userId, projectSecret);
  return bufferToHex(digest);
}
