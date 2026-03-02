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
  /**
   * Optional URL for the server-side proxy route.
   * Defaults to '/api/openfeedback'
   */
  proxyUrl?: string;
}

export interface OpenFeedbackProviderProps {
  config: OpenFeedbackConfig;
  /** Supabase anon key — required for public read queries via PostgREST */
  anonKey: string;
  children: React.ReactNode;
}
