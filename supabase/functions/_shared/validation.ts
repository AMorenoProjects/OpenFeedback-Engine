// ---------------------------------------------------------------------------
// Runtime request validation
// ---------------------------------------------------------------------------
// Mirrors the Zod schemas from @openfeedback/client but implemented inline
// to keep Edge Functions free of npm import-map complexity.
// ---------------------------------------------------------------------------

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// -- Auth payload (shared across all signed endpoints) ----------------------

export interface AuthPayload {
  user_id: string;
  nonce: string;
  timestamp: number;
  project_id: string;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function validateAuthPayload(
  raw: unknown,
): ValidationResult<AuthPayload> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Missing or invalid 'auth' object" };
  }
  const auth = raw as Record<string, unknown>;

  if (typeof auth.user_id !== "string" || auth.user_id.length === 0) {
    return { ok: false, error: "auth.user_id must be a non-empty string" };
  }
  if (
    typeof auth.nonce !== "string" ||
    auth.nonce.length < 8 ||
    auth.nonce.length > 128
  ) {
    return {
      ok: false,
      error: "auth.nonce must be a string between 8 and 128 characters",
    };
  }
  if (
    typeof auth.timestamp !== "number" ||
    !Number.isInteger(auth.timestamp) ||
    auth.timestamp <= 0
  ) {
    return { ok: false, error: "auth.timestamp must be a positive integer" };
  }
  if (typeof auth.project_id !== "string" || !UUID_RE.test(auth.project_id)) {
    return { ok: false, error: "auth.project_id must be a valid UUID" };
  }

  return {
    ok: true,
    data: {
      user_id: auth.user_id as string,
      nonce: auth.nonce as string,
      timestamp: auth.timestamp as number,
      project_id: auth.project_id as string,
    },
  };
}

// -- Vote Intent ------------------------------------------------------------

export interface VoteIntent {
  suggestion_id: string;
  direction: "up" | "remove";
}

export interface SignedVoteRequest {
  auth: AuthPayload;
  vote: VoteIntent;
}

export function validateVoteRequest(
  raw: unknown,
): ValidationResult<SignedVoteRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  const authResult = validateAuthPayload(obj.auth);
  if (!authResult.ok) return authResult;

  if (typeof obj.vote !== "object" || obj.vote === null) {
    return { ok: false, error: "Missing or invalid 'vote' object" };
  }
  const vote = obj.vote as Record<string, unknown>;

  if (
    typeof vote.suggestion_id !== "string" ||
    !UUID_RE.test(vote.suggestion_id)
  ) {
    return { ok: false, error: "vote.suggestion_id must be a valid UUID" };
  }
  if (vote.direction !== "up" && vote.direction !== "remove") {
    return { ok: false, error: "vote.direction must be 'up' or 'remove'" };
  }

  return {
    ok: true,
    data: {
      auth: authResult.data,
      vote: {
        suggestion_id: vote.suggestion_id as string,
        direction: vote.direction as "up" | "remove",
      },
    },
  };
}

// -- Suggestion Intent ------------------------------------------------------

export interface SuggestionIntent {
  title: string;
  description?: string;
}

export interface SignedSuggestionRequest {
  auth: AuthPayload;
  suggestion: SuggestionIntent;
}

export function validateSuggestionRequest(
  raw: unknown,
): ValidationResult<SignedSuggestionRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  const authResult = validateAuthPayload(obj.auth);
  if (!authResult.ok) return authResult;

  if (typeof obj.suggestion !== "object" || obj.suggestion === null) {
    return { ok: false, error: "Missing or invalid 'suggestion' object" };
  }
  const suggestion = obj.suggestion as Record<string, unknown>;

  if (
    typeof suggestion.title !== "string" ||
    suggestion.title.length === 0 ||
    suggestion.title.length > 300
  ) {
    return {
      ok: false,
      error: "suggestion.title must be a string between 1 and 300 characters",
    };
  }

  if (
    suggestion.description !== undefined &&
    suggestion.description !== null
  ) {
    if (
      typeof suggestion.description !== "string" ||
      suggestion.description.length > 5000
    ) {
      return {
        ok: false,
        error: "suggestion.description must be a string of at most 5000 characters",
      };
    }
  }

  return {
    ok: true,
    data: {
      auth: authResult.data,
      suggestion: {
        title: suggestion.title as string,
        description: (suggestion.description as string | undefined) ?? undefined,
      },
    },
  };
}
