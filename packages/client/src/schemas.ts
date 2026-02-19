import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Suggestion
// ---------------------------------------------------------------------------

export const SuggestionStatus = z.enum([
  "open",
  "planned",
  "in_progress",
  "shipped",
  "closed",
]);

export const SuggestionSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  status: SuggestionStatus.default("open"),
  upvotes: z.int().min(0).default(0),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export const CreateSuggestionSchema = SuggestionSchema.pick({
  project_id: true,
  title: true,
  description: true,
});

// ---------------------------------------------------------------------------
// Auth — Signed Stateless Payload
// ---------------------------------------------------------------------------
// The host app signs this payload with its project HMAC secret.
// The backend verifies: HMAC(payload, secret) === signature header.
// ---------------------------------------------------------------------------

export const AuthPayloadSchema = z.object({
  /** Stable user identifier from the host app (never stored raw — hashed before DB write). */
  user_id: z.string().min(1),
  /** One-time value to prevent replay attacks, checked against a Bloom filter. */
  nonce: z.string().min(8).max(128),
  /** Unix epoch ms when the payload was created. Must be within TIMESTAMP_TOLERANCE_MS of server time. */
  timestamp: z.number().int().positive(),
  /** Project ID this request belongs to. */
  project_id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Vote Intent
// ---------------------------------------------------------------------------
// Sent by the client when casting or removing a vote.
// The signature covers the full AuthPayload; VoteIntent is the action body.
// ---------------------------------------------------------------------------

export const VoteDirection = z.enum(["up", "remove"]);

export const VoteIntentSchema = z.object({
  suggestion_id: z.uuid(),
  direction: VoteDirection,
});

// ---------------------------------------------------------------------------
// Suggestion Intent
// ---------------------------------------------------------------------------
// Sent by the client when creating a new suggestion.
// ---------------------------------------------------------------------------

export const SuggestionIntentSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
});

// ---------------------------------------------------------------------------
// Signed Request Envelopes
// ---------------------------------------------------------------------------
// Wire format for requests hitting Edge Functions.
// The HMAC signature covers the full JSON body (auth + action).
// ---------------------------------------------------------------------------

export const SignedVoteRequestSchema = z.object({
  auth: AuthPayloadSchema,
  vote: VoteIntentSchema,
});

export const SignedSuggestionRequestSchema = z.object({
  auth: AuthPayloadSchema,
  suggestion: SuggestionIntentSchema,
  encrypted_email: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Encrypted Contact — Pseudonymous Vault entry
// ---------------------------------------------------------------------------
// Stored separately from votes so that the public vote ledger carries no PII.
// Encryption happens client-side with the project's public key.
// ---------------------------------------------------------------------------

export const VaultEntrySchema = z.object({
  user_hash: z.string().min(1),
  encrypted_email: z.string().min(1),
  project_id: z.uuid(),
});
