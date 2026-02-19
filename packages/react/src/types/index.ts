// Re-export canonical types from @openfeedback/client — single source of truth.
// DO NOT define domain types here. Extend only with React-specific concerns.
export type {
  Suggestion,
  SuggestionStatusType,
  AuthPayload,
  VoteIntent,
  VoteDirectionType,
  SuggestionIntent,
} from "@openfeedback/client";

export interface OpenFeedbackConfig {
  projectId: string;
  apiUrl: string;
}

/**
 * Auth context passed by the host app into <OpenFeedbackProvider>.
 * The host app is responsible for computing the HMAC signature over
 * the full signed request body (auth + action) using its project secret.
 *
 * SECURITY: The `hmacSecret` must NEVER be passed here or exposed to the
 * browser. Signing must happen server-side (e.g., in a Next.js Server Action
 * or API route). This context only carries the pre-computed signature.
 */
export interface AuthContext {
  userId: string;
  signature: string;
  timestamp: number;
  nonce: string;
  encryptedPayload?: string;
}

export interface OpenFeedbackProviderProps {
  config: OpenFeedbackConfig;
  authContext?: AuthContext;
  children: React.ReactNode;
}
