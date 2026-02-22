// @ts-ignore - Valid Deno jsr import
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Valid Deno jsr import
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflightResponse } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

// @ts-ignore - Deno is available at edge runtime
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return corsPreflightResponse();
    if (req.method !== "POST") return errorResponse("Method not allowed", 405);

    const authHeader = req.headers.get("Authorization");
    // @ts-ignore - Deno is available at edge runtime
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
        return errorResponse("Unauthorized: Invalid Bearer token", 401);
    }

    let parsed: any;
    try {
        parsed = await req.json();
    } catch {
        return errorResponse("Invalid JSON body", 400);
    }

    const { project_id, version, suggestion_ids, changelog_markdown } = parsed;

    if (!project_id || !version || !Array.isArray(suggestion_ids)) {
        return errorResponse("Missing required fields: project_id, version, suggestion_ids", 400);
    }

    if (suggestion_ids.length === 0) {
        return jsonResponse({ message: "No suggestions to update." }, 200);
    }

    // @ts-ignore - Deno is available at edge runtime
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !serviceRoleKey) {
        return errorResponse("Server misconfiguration", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Mark all referenced suggestions as shipped
    const { data, error } = await supabase
        .from("suggestions")
        .update({ status: "shipped" })
        .in("id", suggestion_ids)
        .eq("project_id", project_id)
        .select("id");

    if (error) {
        console.error("Failed to update suggestions", error);
        return errorResponse("Database update failed", 500);
    }

    // Future enhancement: We could insert the `changelog_markdown` into a `releases` table here
    // and trigger email notifications via the pseudonymous_vault.
    console.log(`Successfully marked ${data?.length || 0} suggestions as shipped for version ${version}.`);

    return jsonResponse({
        ok: true,
        version,
        updated_count: data?.length || 0,
        message: "Release processed successfully",
    }, 200);
});
