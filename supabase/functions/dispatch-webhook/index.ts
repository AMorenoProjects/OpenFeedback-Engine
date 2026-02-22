// @ts-ignore - Valid Deno jsr import
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Valid Deno jsr import
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

/**
 * Expected Payload from Supabase Database Webhooks:
 * {
 *   "type": "INSERT" | "UPDATE",
 *   "table": "suggestions",
 *   "record": { id, title, status, project_id, ... },
 *   "old_record": { ... }
 * }
 */
// @ts-ignore - Deno is available at edge runtime
Deno.serve(async (req: Request) => {
    if (req.method !== "POST") return errorResponse("Method not allowed", 405);

    const signature = req.headers.get("x-supabase-signature"); // Optional: for db webhook security
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return errorResponse("Invalid JSON payload", 400);
    }

    const { type, table, record, old_record } = payload;

    if (table !== "suggestions" || !record || !record.project_id) {
        return errorResponse("Ignored: invalid payload format", 200);
    }

    // Determine the event type
    let eventType = "";
    if (type === "INSERT") {
        eventType = "suggestion.created";
    } else if (type === "UPDATE" && record.status === "shipped" && old_record?.status !== "shipped") {
        eventType = "suggestion.shipped";
    } else {
        // We don't care about other transitions for now
        return jsonResponse({ message: "Ignored: non-actionable transition" }, 200);
    }

    // Fetch active webhooks for this project & event types
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-ignore
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
        return errorResponse("Server misconfiguration", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: webhooks, error } = await supabase
        .from("webhooks")
        .select("url, secret, events")
        .eq("project_id", record.project_id)
        .eq("is_active", true)
        // Basic array overlap check: does the webhook subscribe to this event?
        .contains('events', [eventType]);

    if (error || !webhooks || webhooks.length === 0) {
        return jsonResponse({ message: `No active webhooks found for ${eventType}` }, 200);
    }

    // Dispatch the webhooks
    const dispatchPromises = webhooks.map(async (hook: any) => {
        try {
            // Basic formatting based on generic URL
            // If it's a discord webhook URL, format for Discord rich embed
            let body: any = {
                event: eventType,
                suggestion: {
                    id: record.id,
                    title: record.title,
                    status: record.status
                }
            };

            if (hook.url.includes("discord.com/api/webhooks")) {
                body = {
                    "content": eventType === "suggestion.created"
                        ? `🚀 **New Suggestion Created:** ${record.title}`
                        : `✅ **Suggestion Shipped:** ${record.title}`,
                    "embeds": [{
                        "title": record.title,
                        "color": eventType === "suggestion.created" ? 5814783 : 3066993,
                        "footer": { "text": `ID: ${record.id}` }
                    }]
                };
            }

            const res = await fetch(hook.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            console.log(`Dispatched to ${hook.url}: Status ${res.status}`);
            return { url: hook.url, status: res.status };
        } catch (e) {
            console.error(`Failed to dispatch to ${hook.url}`, e);
            return { url: hook.url, status: "error", error: String(e) };
        }
    });

    const results = await Promise.all(dispatchPromises);

    return jsonResponse({
        ok: true,
        event: eventType,
        dispatched: results
    }, 200);
});
