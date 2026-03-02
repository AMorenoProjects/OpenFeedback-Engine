// Components
export { OpenFeedbackProvider, useOpenFeedback } from "./components/OpenFeedbackProvider";
export { SuggestionSearch } from "./components/SuggestionSearch";
export { TrustBadge } from "./components/TrustBadge";

// Hooks
export { useSuggestions } from "./hooks/useSuggestions";
export { useVote } from "./hooks/useVote";
export { useSubmitSuggestion } from "./hooks/useSubmitSuggestion";
export { useSearchSuggestions } from "./hooks/useSearchSuggestions";

// Types (domain types re-exported from @openfeedback/client via ./types)
export type {
  OpenFeedbackConfig,
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
export { maskEmail } from "./utils/mask-email";
