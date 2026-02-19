import type { z } from "zod/v4";
import type {
  SuggestionSchema,
  SuggestionStatus,
  CreateSuggestionSchema,
  AuthPayloadSchema,
  VoteIntentSchema,
  VoteDirection,
  SuggestionIntentSchema,
  SignedVoteRequestSchema,
  SignedSuggestionRequestSchema,
  VaultEntrySchema,
} from "./schemas";

// ---------------------------------------------------------------------------
// Inferred types — always derived from Zod schemas to stay in sync.
// ---------------------------------------------------------------------------

export type Suggestion = z.infer<typeof SuggestionSchema>;
export type SuggestionStatusType = z.infer<typeof SuggestionStatus>;
export type CreateSuggestion = z.infer<typeof CreateSuggestionSchema>;

export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export type VoteIntent = z.infer<typeof VoteIntentSchema>;
export type VoteDirectionType = z.infer<typeof VoteDirection>;

export type SuggestionIntent = z.infer<typeof SuggestionIntentSchema>;

export type SignedVoteRequest = z.infer<typeof SignedVoteRequestSchema>;
export type SignedSuggestionRequest = z.infer<typeof SignedSuggestionRequestSchema>;

export type VaultEntry = z.infer<typeof VaultEntrySchema>;

// ---------------------------------------------------------------------------
// Database row types (what comes back from Supabase queries).
// ---------------------------------------------------------------------------

export interface VoteRow {
  id: string;
  suggestion_id: string;
  user_hash: string;
  project_id: string;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  hmac_secret: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// API Response types
// ---------------------------------------------------------------------------

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  [key: string]: T | boolean;
}

export interface ApiErrorResponse {
  error: string;
}
