import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { computeHmac, bufferToHex, timingSafeEqual } from "./crypto.ts";
import { checkAndMarkNonce } from "./nonce.ts";
import { errorResponse } from "./response.ts";
import type { AuthPayload } from "./validation.ts";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export interface VerifiedAuth {
  supabase: SupabaseClient;
  projectSecret: string;
  auth: AuthPayload;
}

/**
 * Full auth verification pipeline shared by all signed Edge Functions.
 *
 * Returns either a `VerifiedAuth` context to proceed, or a `Response` to
 * return immediately (error case).
 *
 * Steps:
 * 1. Extract + validate `x-openfeedback-signature` header
 * 2. Validate timestamp freshness
 * 3. Init Supabase service-role client
 * 4. Fetch project HMAC secret
 * 5. Verify HMAC signature (constant-time) over raw body
 * 6. Check + mark nonce (after signature is verified)
 */
export async function verifySignedRequest(
  req: {
    signature: string;
    rawBody: string;
    auth: AuthPayload;
  },
): Promise<VerifiedAuth | Response> {
  const { signature, rawBody, auth } = req;

  // ---- Timestamp freshness ----
  const drift = Math.abs(Date.now() - auth.timestamp);
  if (drift > TIMESTAMP_TOLERANCE_MS) {
    return errorResponse("Request expired", 401);
  }

  // ---- Supabase service-role client ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("Server misconfiguration", 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ---- Fetch project ----
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, hmac_secret")
    .eq("id", auth.project_id)
    .single();

  if (projectError || !project) {
    return errorResponse("Unknown project", 404);
  }

  // ---- HMAC verification (raw body, constant-time) ----
  const expectedBuf = await computeHmac(rawBody, project.hmac_secret);
  const expectedHex = bufferToHex(expectedBuf);

  if (!timingSafeEqual(signature, expectedHex)) {
    return errorResponse("Invalid signature", 401);
  }

  // ---- Nonce replay (after signature to prevent poisoning) ----
  const nonceKey = `${auth.project_id}:${auth.nonce}`;
  if (!checkAndMarkNonce(nonceKey)) {
    return errorResponse("Replay detected", 401);
  }

  return {
    supabase,
    projectSecret: project.hmac_secret,
    auth,
  };
}
