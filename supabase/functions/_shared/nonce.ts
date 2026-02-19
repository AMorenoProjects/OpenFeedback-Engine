// ---------------------------------------------------------------------------
// Bounded nonce store with FIFO eviction
// ---------------------------------------------------------------------------
// In production, replace with Redis SET + TTL or a Bloom filter.
// This in-memory Set resets on cold start (acceptable for MVP).
// Bounded to MAX_SIZE to prevent memory exhaustion.
// ---------------------------------------------------------------------------

const NONCE_MAX_SIZE = 100_000;
const NONCE_EVICTION_COUNT = 10_000;

const usedNonces = new Set<string>();

/**
 * Check if a nonce has been used and mark it.
 * Returns `true` if the nonce is fresh, `false` if it's a replay.
 */
export function checkAndMarkNonce(nonceKey: string): boolean {
  if (usedNonces.has(nonceKey)) {
    return false;
  }

  if (usedNonces.size >= NONCE_MAX_SIZE) {
    let evicted = 0;
    for (const key of usedNonces) {
      usedNonces.delete(key);
      evicted++;
      if (evicted >= NONCE_EVICTION_COUNT) break;
    }
  }

  usedNonces.add(nonceKey);
  return true;
}
