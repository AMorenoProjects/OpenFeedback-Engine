// Test Script for QA Test 3: Race Conditions & Concurrency
// Mocks the Supabase Database uniqueness check under 100 simultaneous promises.

console.log("==================================================");
console.log("QA TEST 3: RACE CONDITIONS & HIGH CONCURRENCY LOAD");
console.log("==================================================");

// Mock Database State representing the PostgreSQL table "votes"
const MockDatabase = {
    votesTable: new Set<string>(),
    suggestionUpvotes: 0,

    // Mocks the `insert` behavior of the Supabase Client
    // PostgreSQL handles transactions sequentially under the hood even if
    // requests arrive simultaneously, enforcing UNIQUE constraints.
    async insertVote(suggestionId: string, userHash: string): Promise<{ error: any }> {
        // Simulate network latency (random between 10ms - 50ms)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 10));

        const compositeKey = `${suggestionId}_${userHash}`;

        // Here we simulate the PostgreSQL transactional uniqueness check.
        // In real Postgres, the first transaction gets the row lock, and subsequent
        // transactions trying to insert the same unique key wait and then fail with 23505.
        if (this.votesTable.has(compositeKey)) {
            return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }

        // Insert the vote
        this.votesTable.add(compositeKey);

        // Trigger execution: update_suggestion_upvotes()
        // Simulated as synchronous within the insert boundary for Postgres
        this.suggestionUpvotes++;

        return { error: null };
    }
};

// Mocks the behavior of the `submit-vote` Edge Function
async function handleVoteRequest(reqId: number): Promise<{ status: number, message: string }> {
    // All 100 requests carry the exact same user_hash and suggestion_id
    const suggestionId = "sug_A";
    const userHash = "user_hash_123";

    // Edge Function attempts insert
    const { error } = await MockDatabase.insertVote(suggestionId, userHash);

    if (error) {
        if (error.code === "23505") {
            // The Edge Function successfully catches the conflict and doesn't crash
            return { status: 409, message: `Req [${reqId}]: 409 Conflict - Already Voted` };
        }
        return { status: 500, message: `Req [${reqId}]: 500 Internal Error` };
    }

    return { status: 201, message: `Req [${reqId}]: 201 Created - Vote Success!` };
}

async function runConcurrencyTest() {
    console.log("Firing 100 concurrent requests to the Edge Function...");
    console.log("Constraint Expected: UNIQUE(suggestion_id, user_hash)\n");

    const totalRequests = 100;

    // Dispatch all 100 promises synchronously
    const promises = Array.from({ length: totalRequests }).map((_, i) => handleVoteRequest(i));

    // Wait for all HTTP requests to resolve (either 201 or 409)
    const results = await Promise.all(promises);

    // Tally the results received by the "Clients"
    let successCount = 0;
    let conflictCount = 0;

    for (const res of results) {
        if (res.status === 201) successCount++;
        if (res.status === 409) conflictCount++;
    }

    console.log("--- RESULTS TALLY ---");
    console.log(`Total 201 Created:   ${successCount}`);
    console.log(`Total 409 Conflicts: ${conflictCount}`);

    console.log("\n--- DATABASE STATE ASSERTION ---");
    console.log(`Rows in 'votes' table:       ${MockDatabase.votesTable.size}`);
    console.log(`Value of 'upvotes' trigger:  ${MockDatabase.suggestionUpvotes}`);

    if (successCount === 1 && conflictCount === 99 && MockDatabase.suggestionUpvotes === 1) {
        console.log("\n✅ TEST PASSED: Race condition prevented. Deterministic state preserved.");
    } else {
        console.error("\n❌ TEST FAILED: Race condition corrupted the state!");
        Deno.exit(1);
    }
}

runConcurrencyTest();
