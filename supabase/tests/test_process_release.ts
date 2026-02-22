// Test Script for QA Test 5: Release Processing & Changelog Sync
// Simulates the expected behavior of the process-release Edge Function

console.log("==================================================");
console.log("QA TEST 5: CLI RELEASE & EDGE FUNCTION SYNC");
console.log("==================================================");

// Mock Database State representing the PostgreSQL table "suggestions"
const MockDatabase = {
    suggestionsTable: new Map<string, { title: string, status: string }>([
        ["sug_1", { title: "Export to CSV", status: "planned" }],
        ["sug_2", { title: "Dark mode support", status: "open" }],
        ["sug_3", { title: "API Webhooks", status: "in_progress" }],
        ["sug_4", { title: "OIDC SSO", status: "open" }],
    ]),

    // Mocks the `update().in()` behavior of the Supabase Client
    async markAsShipped(suggestionIds: string[]): Promise<{ data: any[], error: any }> {
        const updated = [];

        for (const id of suggestionIds) {
            if (this.suggestionsTable.has(id)) {
                const item = this.suggestionsTable.get(id)!;
                item.status = "shipped";
                this.suggestionsTable.set(id, item);
                updated.push({ id });
            }
        }

        return { data: updated, error: null };
    }
};

// Mocks the behavior of the `process-release` Edge Function
async function handleProcessRelease(reqBody: any, authHeader: string): Promise<{ status: number, body: any }> {
    const EXPECTED_BEARER = "Bearer valid_service_key";

    if (authHeader !== EXPECTED_BEARER) {
        return { status: 401, body: { error: "Unauthorized: Invalid Bearer token" } };
    }

    const { project_id, version, suggestion_ids, changelog_markdown } = reqBody;

    if (!project_id || !version || !Array.isArray(suggestion_ids)) {
        return { status: 400, body: { error: "Missing required fields: project_id, version, suggestion_ids" } };
    }

    if (suggestion_ids.length === 0) {
        return { status: 200, body: { message: "No suggestions to update." } };
    }

    const { data, error } = await MockDatabase.markAsShipped(suggestion_ids);

    if (error) {
        return { status: 500, body: { error: "Database update failed" } };
    }

    return {
        status: 200,
        body: {
            ok: true,
            version,
            updated_count: data?.length || 0,
            message: "Release processed successfully"
        }
    };
}

async function runReleaseTest() {
    console.log("Scenario 1: Missing Authorization Header");
    const res1 = await handleProcessRelease(
        { project_id: "proj_1", version: "v1.0.0", suggestion_ids: ["sug_1"] },
        "Bearer invalid_key"
    );
    if (res1.status === 401) console.log("✅ PASS: Correctly rejected invalid auth.");
    else { console.error("❌ FAIL: Did not reject invalid auth."); Deno.exit(1); }

    console.log("\nScenario 2: Missing Required Fields");
    const res2 = await handleProcessRelease(
        { project_id: "proj_1", suggestion_ids: ["sug_1"] },
        "Bearer valid_service_key"
    );
    if (res2.status === 400) console.log("✅ PASS: Correctly rejected missing version.");
    else { console.error("❌ FAIL: Did not catch missing version."); Deno.exit(1); }

    console.log("\nScenario 3: Valid Payload processing 2 suggestions");
    // Verify initial state
    console.log("Initial status of sug_1:", MockDatabase.suggestionsTable.get("sug_1")?.status);
    console.log("Initial status of sug_2:", MockDatabase.suggestionsTable.get("sug_2")?.status);

    const res3 = await handleProcessRelease(
        {
            project_id: "proj_1",
            version: "v1.1.0",
            suggestion_ids: ["sug_1", "sug_2"],
            changelog_markdown: "## v1.1.0\nShipped Export to CSV and Dark mode."
        },
        "Bearer valid_service_key"
    );

    if (res3.status === 200 && res3.body.updated_count === 2) {
        console.log("✅ PASS: Edge Function processed the valid payload successfully.");
        console.log("Final status of sug_1:", MockDatabase.suggestionsTable.get("sug_1")?.status);
        console.log("Final status of sug_2:", MockDatabase.suggestionsTable.get("sug_2")?.status);

        if (MockDatabase.suggestionsTable.get("sug_1")?.status === "shipped" &&
            MockDatabase.suggestionsTable.get("sug_2")?.status === "shipped") {
            console.log("\n🚀 ALL TESTS PASSED: Edge function simulation complete.");
        } else {
            console.error("\n❌ FAIL: Database state did not update."); Deno.exit(1);
        }
    } else {
        console.error("❌ FAIL: Edge Function failed valid payload.", res3); Deno.exit(1);
    }
}

runReleaseTest();
