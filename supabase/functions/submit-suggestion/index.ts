import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { hashUserId } from "../_shared/crypto.ts";
import { validateSuggestionRequest } from "../_shared/validation.ts";
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

  const validation = validateSuggestionRequest(parsed);
  if (!validation.ok) return errorResponse(validation.error, 400);
  const { auth, suggestion } = validation.data;

  // ---- Verify signature, timestamp, nonce ----
  const authResult = await verifySignedRequest({ signature, rawBody, auth });
  if (authResult instanceof Response) return authResult;

  const { supabase, projectSecret } = authResult;

  // ---- Insert suggestion ----
  const { data: created, error: insertError } = await supabase
    .from("suggestions")
    .insert({
      project_id: auth.project_id,
      title: suggestion.title,
      description: suggestion.description ?? null,
    })
    .select("id, project_id, title, description, status, upvotes, created_at, updated_at")
    .single();

  if (insertError || !created) {
    console.error("Suggestion insert failed:", insertError?.message);
    return errorResponse("Suggestion creation failed", 500);
  }

  // ---- Upsert vault entry (if encrypted payload is provided) ----
  // The vault entry is optional — only written if the host app sends
  // encrypted contact info alongside the auth payload.
  const body = parsed as Record<string, unknown>;
  if (typeof body.encrypted_email === "string" && body.encrypted_email.length > 0) {
    const userHash = await hashUserId(auth.user_id, projectSecret);

    const { error: vaultError } = await supabase
      .from("pseudonymous_vault")
      .upsert(
        {
          user_hash: userHash,
          encrypted_email: body.encrypted_email as string,
          project_id: auth.project_id,
        },
        { onConflict: "project_id,user_hash" },
      );

    if (vaultError) {
      // Non-fatal: the suggestion was already created. Log but don't fail.
      console.error("Vault upsert failed:", vaultError.message);
    }
  }

  return jsonResponse({ ok: true, suggestion: created }, 201);
});
