// Components
export { OpenFeedbackProvider, useOpenFeedback } from "./components/OpenFeedbackProvider";

// Hooks
export { useSuggestions } from "./hooks/useSuggestions";
export { useVote } from "./hooks/useVote";
export type { SignedAuthParams } from "./hooks/useVote";
export { useSubmitSuggestion } from "./hooks/useSubmitSuggestion";

// Types (domain types re-exported from @openfeedback/client via ./types)
export type {
  OpenFeedbackConfig,
  AuthContext,
  OpenFeedbackProviderProps,
  Suggestion,
  SuggestionStatusType,
  AuthPayload,
  VoteIntent,
  VoteDirectionType,
  SuggestionIntent,
} from "./types";

// Utilities
export { cn } from "./utils/cn";
