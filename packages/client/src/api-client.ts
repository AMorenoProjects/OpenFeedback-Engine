// ---------------------------------------------------------------------------
// OpenFeedbackClient — Typed HTTP client for the Edge Function API
// ---------------------------------------------------------------------------
// This client is used by both the React SDK (browser) and server-side code.
// It does NOT handle HMAC signing — the host app's server must sign the
// request body and pass the signature through the auth context.
// ---------------------------------------------------------------------------

import type {
  Suggestion,
  AuthPayload,
  VoteIntent,
  SuggestionIntent,
  ApiErrorResponse,
} from "./types";

export interface OpenFeedbackClientConfig {
  /** Base URL of the Supabase project (e.g., https://<ref>.supabase.co) */
  apiUrl: string;
  /** Supabase anon key — used for public read queries */
  anonKey: string;
  /** Project UUID */
  projectId: string;
}

interface SignedRequestOptions {
  /** Pre-computed HMAC-SHA256 signature of the full JSON body */
  signature: string;
  /** The auth payload (user_id, nonce, timestamp, project_id) */
  auth: AuthPayload;
}

export class OpenFeedbackClient {
  private readonly config: OpenFeedbackClientConfig;

  constructor(config: OpenFeedbackClientConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Public read endpoints (use anon key, hit Supabase REST directly)
  // -------------------------------------------------------------------------

  /**
   * Fetch all suggestions for the configured project.
   * Uses the Supabase PostgREST API with the anon key (public read via RLS).
   */
  async getSuggestions(options?: {
    status?: string;
    orderBy?: "upvotes" | "created_at";
    ascending?: boolean;
  }): Promise<Suggestion[]> {
    const params = new URLSearchParams();
    params.set("project_id", `eq.${this.config.projectId}`);
    params.set("select", "*");

    if (options?.status) {
      params.set("status", `eq.${options.status}`);
    }

    const orderCol = options?.orderBy ?? "created_at";
    const orderDir = options?.ascending ? "asc" : "desc";
    params.set("order", `${orderCol}.${orderDir}`);

    const res = await fetch(
      `${this.config.apiUrl}/rest/v1/suggestions?${params.toString()}`,
      {
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
        },
      },
    );

    if (!res.ok) {
      throw new OpenFeedbackApiError("Failed to fetch suggestions", res.status);
    }

    return res.json() as Promise<Suggestion[]>;
  }

  /**
   * Fetch a single suggestion by ID.
   */
  async getSuggestion(id: string): Promise<Suggestion | null> {
    const params = new URLSearchParams();
    params.set("id", `eq.${id}`);
    params.set("project_id", `eq.${this.config.projectId}`);
    params.set("select", "*");

    const res = await fetch(
      `${this.config.apiUrl}/rest/v1/suggestions?${params.toString()}`,
      {
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
          Accept: "application/vnd.pgrst.object+json",
        },
      },
    );

    if (res.status === 406) return null; // no rows found
    if (!res.ok) {
      throw new OpenFeedbackApiError("Failed to fetch suggestion", res.status);
    }

    return res.json() as Promise<Suggestion>;
  }

  /**
   * Check if a user has voted on a specific suggestion.
   * Requires the user_hash (computed server-side).
   */
  async hasVoted(suggestionId: string, userHash: string): Promise<boolean> {
    const params = new URLSearchParams();
    params.set("suggestion_id", `eq.${suggestionId}`);
    params.set("user_hash", `eq.${userHash}`);
    params.set("project_id", `eq.${this.config.projectId}`);
    params.set("select", "id");

    const res = await fetch(
      `${this.config.apiUrl}/rest/v1/votes?${params.toString()}`,
      {
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
          Prefer: "count=exact",
        },
      },
    );

    if (!res.ok) {
      throw new OpenFeedbackApiError("Failed to check vote status", res.status);
    }

    const contentRange = res.headers.get("content-range");
    if (!contentRange) return false;

    // Format: "0-0/1" or "*/0"
    const total = contentRange.split("/")[1];
    return total !== undefined && parseInt(total, 10) > 0;
  }

  // -------------------------------------------------------------------------
  // Signed write endpoints (hit Edge Functions)
  // -------------------------------------------------------------------------

  /**
   * Submit a vote (up or remove) via the submit-vote Edge Function.
   * The signature must cover the FULL JSON body (auth + vote).
   */
  async submitVote(
    vote: VoteIntent,
    signedAuth: SignedRequestOptions,
  ): Promise<{ ok: true; action: string }> {
    const body = JSON.stringify({
      auth: signedAuth.auth,
      vote,
    });

    return this.callEdgeFunction<{ ok: true; action: string }>(
      "submit-vote",
      body,
      signedAuth.signature,
    );
  }

  /**
   * Submit a new suggestion via the submit-suggestion Edge Function.
   * Optionally includes an encrypted email for the pseudonymous vault.
   */
  async submitSuggestion(
    suggestion: SuggestionIntent,
    signedAuth: SignedRequestOptions,
    encryptedEmail?: string,
  ): Promise<{ ok: true; suggestion: Suggestion }> {
    const payload: Record<string, unknown> = {
      auth: signedAuth.auth,
      suggestion,
    };
    if (encryptedEmail) {
      payload.encrypted_email = encryptedEmail;
    }

    const body = JSON.stringify(payload);

    return this.callEdgeFunction<{ ok: true; suggestion: Suggestion }>(
      "submit-suggestion",
      body,
      signedAuth.signature,
    );
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async callEdgeFunction<T>(
    functionName: string,
    body: string,
    signature: string,
  ): Promise<T> {
    const res = await fetch(
      `${this.config.apiUrl}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.anonKey}`,
          "x-openfeedback-signature": signature,
        },
        body,
      },
    );

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
      throw new OpenFeedbackApiError(
        errorBody?.error ?? `Edge Function error (${res.status})`,
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }
}

export class OpenFeedbackApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenFeedbackApiError";
    this.status = status;
  }
}
