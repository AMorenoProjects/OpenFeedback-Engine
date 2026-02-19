import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { hashUserId } from "../_shared/crypto.ts";
import { validateVoteRequest } from "../_shared/validation.ts";
import { verifySignedRequest } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // ---- Signature header ----
  const signature = req.headers.get("x-openfeedback-signature");
  if (!signature) {
    return errorResponse("Missing x-openfeedback-signature header", 401);
  }

  // ---- Parse + validate body ----
  const rawBody = await req.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = validateVoteRequest(parsed);
  if (!validation.ok) return errorResponse(validation.error, 400);
  const { auth, vote } = validation.data;

  // ---- Verify signature, timestamp, nonce ----
  const authResult = await verifySignedRequest({ signature, rawBody, auth });
  if (authResult instanceof Response) return authResult;

  const { supabase, projectSecret } = authResult;

  // ---- Hash user_id (salted per project) ----
  const userHash = await hashUserId(auth.user_id, projectSecret);

  // ---- Execute vote ----
  if (vote.direction === "up") {
    const { error: insertError } = await supabase.from("votes").insert({
      suggestion_id: vote.suggestion_id,
      user_hash: userHash,
      project_id: auth.project_id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return errorResponse("Already voted on this suggestion", 409);
      }
      console.error("Vote insert failed:", insertError.message);
      return errorResponse("Vote failed", 500);
    }
    return jsonResponse({ ok: true, action: "voted" }, 201);
  }

  if (vote.direction === "remove") {
    const { error: deleteError } = await supabase
      .from("votes")
      .delete()
      .eq("suggestion_id", vote.suggestion_id)
      .eq("user_hash", userHash)
      .eq("project_id", auth.project_id);

    if (deleteError) {
      console.error("Vote delete failed:", deleteError.message);
      return errorResponse("Vote removal failed", 500);
    }
    return jsonResponse({ ok: true, action: "removed" }, 200);
  }

  return errorResponse("Invalid vote direction", 400);
});
