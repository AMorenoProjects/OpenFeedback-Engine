/** Database table names — single source of truth for queries and RLS references. */
export const TABLE = {
  PROJECTS: "projects",
  SUGGESTIONS: "suggestions",
  VOTES: "votes",
  PSEUDONYMOUS_VAULT: "pseudonymous_vault",
  PROJECT_MEMBERS: "project_members",
} as const;

/** Auth configuration defaults */
export const AUTH = {
  /** Maximum age (ms) for a signed payload to be considered valid. */
  TIMESTAMP_TOLERANCE_MS: 5 * 60 * 1000, // 5 minutes
  /** HMAC algorithm used for signature verification. */
  HMAC_ALGORITHM: "SHA-256",
} as const;
