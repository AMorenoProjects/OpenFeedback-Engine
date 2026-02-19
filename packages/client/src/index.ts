export const CLIENT_VERSION = "0.1.0";

// Constants
export { TABLE, AUTH } from "./constants";

// Zod Schemas
export {
  SuggestionSchema,
  SuggestionStatus,
  CreateSuggestionSchema,
  AuthPayloadSchema,
  VoteDirection,
  VoteIntentSchema,
  SuggestionIntentSchema,
  SignedVoteRequestSchema,
  SignedSuggestionRequestSchema,
  VaultEntrySchema,
} from "./schemas";

// TypeScript types
export type {
  Suggestion,
  SuggestionStatusType,
  CreateSuggestion,
  AuthPayload,
  VoteIntent,
  VoteDirectionType,
  SuggestionIntent,
  SignedVoteRequest,
  SignedSuggestionRequest,
  VaultEntry,
  VoteRow,
  ProjectRow,
  ApiSuccessResponse,
  ApiErrorResponse,
} from "./types";

// API Client (browser-safe)
export { OpenFeedbackClient, OpenFeedbackApiError, type OpenFeedbackClientConfig } from "./api-client";
