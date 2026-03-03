// @ts-ignore - Valid Deno jsr import
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - Valid Deno jsr import
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

// ---------------------------------------------------------------------------
// SSRF Prevention: validate webhook URLs before dispatching
// ---------------------------------------------------------------------------

const BLOCKED_HOSTNAME_PATTERNS = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^169\.254\.\d+\.\d+$/,       // Link-local / cloud metadata
    /^0\.0\.0\.0$/,
    /^\[::1?\]$/,                  // IPv6 loopback
    /^metadata\.google\.internal$/i,
];

function isWebhookUrlSafe(urlStr: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(urlStr);
    } catch {
        return false;
    }

    // Must be HTTPS (exception: known webhook providers already use HTTPS,
    // but we enforce it universally)
    if (parsed.protocol !== "https:") {
        return false;
    }

    // Block private/internal hostnames
    const hostname = parsed.hostname;
    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
        if (pattern.test(hostname)) {
            return false;
        }
    }

    return true;
}

function redactUrl(urlStr: string): string {
    try {
        const parsed = new URL(urlStr);
        return `${parsed.protocol}//${parsed.hostname}/***`;
    } catch {
        return "<invalid-url>";
    }
}

// ---------------------------------------------------------------------------
// Authentication: verify the request comes from Supabase (service role)
// ---------------------------------------------------------------------------

function verifyInternalCaller(req: Request, serviceRoleKey: string): boolean {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return false;

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token.length !== serviceRoleKey.length) return false;

    // Constant-time comparison to prevent timing attacks
    let result = 0;
    for (let i = 0; i < token.length; i++) {
        result |= token.charCodeAt(i) ^ serviceRoleKey.charCodeAt(i);
    }
    return result === 0;
}

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

    // @ts-ignore
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl || !serviceRoleKey) {
        return errorResponse("Server misconfiguration", 500);
    }

    // Authenticate: only Supabase internal triggers (with service role) can invoke this
    if (!verifyInternalCaller(req, serviceRoleKey)) {
        return errorResponse("Unauthorized", 401);
    }

    let payload: Record<string, unknown>;
    try {
        payload = await req.json();
    } catch {
        return errorResponse("Invalid JSON payload", 400);
    }

    const { type, table, record, old_record } = payload as {
        type: string;
        table: string;
        record: Record<string, unknown> | null;
        old_record: Record<string, unknown> | null;
    };

    if (table !== "suggestions" || !record || !record.project_id) {
        return jsonResponse({ message: "Ignored: invalid payload format" }, 200);
    }

    // Determine the event type
    let eventType = "";
    if (type === "INSERT") {
        eventType = "suggestion.created";
    } else if (type === "UPDATE" && record.status === "shipped" && old_record?.status !== "shipped") {
        eventType = "suggestion.shipped";
    } else {
        return jsonResponse({ message: "Ignored: non-actionable transition" }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: webhooks, error } = await supabase
        .from("webhooks")
        .select("url, secret, events")
        .eq("project_id", record.project_id as string)
        .eq("is_active", true)
        .contains('events', [eventType]);

    if (error || !webhooks || webhooks.length === 0) {
        return jsonResponse({ message: "No active webhooks for this event" }, 200);
    }

    // Dispatch the webhooks (only to safe URLs)
    let dispatched = 0;
    let skipped = 0;

    const dispatchPromises = webhooks.map(async (hook: { url: string; secret: string | null; events: string[] }) => {
        // SSRF prevention: reject non-HTTPS and private network URLs
        if (!isWebhookUrlSafe(hook.url)) {
            console.warn(`[Webhook] Skipped unsafe URL for project ${record.project_id}: ${redactUrl(hook.url)}`);
            skipped++;
            return;
        }

        try {
            let body: Record<string, unknown> = {
                event: eventType,
                suggestion: {
                    id: record.id,
                    title: record.title,
                    status: record.status,
                },
            };

            if (hook.url.includes("discord.com/api/webhooks")) {
                body = {
                    content: eventType === "suggestion.created"
                        ? `**New Suggestion Created:** ${record.title}`
                        : `**Suggestion Shipped:** ${record.title}`,
                    embeds: [{
                        title: record.title as string,
                        color: eventType === "suggestion.created" ? 5814783 : 3066993,
                        footer: { text: `ID: ${record.id}` },
                    }],
                };
            } else if (hook.url.includes("hooks.slack.com")) {
                const text = eventType === "suggestion.created"
                    ? `*New Suggestion Created:*\n>${record.title}\nID: \`${record.id}\``
                    : `*Suggestion Shipped:*\n>${record.title}\nID: \`${record.id}\``;
                body = { text };
            }

            const res = await fetch(hook.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            // Redact URL in logs to avoid leaking webhook tokens
            console.log(`[Webhook] Dispatched to ${redactUrl(hook.url)}: ${res.status}`);
            dispatched++;
        } catch (e) {
            console.error(`[Webhook] Failed to dispatch to ${redactUrl(hook.url)}:`, e instanceof Error ? e.message : String(e));
        }
    });

    await Promise.all(dispatchPromises);

    // Response does NOT include webhook URLs (prevents information exposure)
    return jsonResponse({
        ok: true,
        event: eventType,
        dispatched,
        skipped,
    }, 200);
});
