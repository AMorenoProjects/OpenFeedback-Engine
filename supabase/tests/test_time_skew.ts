// Test Script for QA Test 2: Time-Skew / Edge Cases

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

function validateTimestamp(payloadTimestamp: number, label: string): boolean {
    const currentServerTime = Date.now();
    const drift = Math.abs(currentServerTime - payloadTimestamp);

    console.log(`\n--- Evaluating Payload: [${label}] ---`);
    console.log(`Payload Timestamp: ${payloadTimestamp} (${new Date(payloadTimestamp).toISOString()})`);
    console.log(`Server Time:       ${currentServerTime} (${new Date(currentServerTime).toISOString()})`);
    console.log(`Absolute Drift is: ${drift}ms`);

    if (drift > TIMESTAMP_TOLERANCE_MS) {
        console.log(`❌ RESULT: Error 401 - Request expired or too far in the future.`);
        return false;
    }

    console.log(`✅ RESULT: 200 OK - Timestamp is within the 5 minute tolerance window.`);
    return true;
}

function runTests() {
    console.log("==========================================");
    console.log("QA TEST 2: TIME-SKEW VULNERABILITY TESTING");
    console.log("==========================================");

    // Scenario 1: Valid Timestamp (10 seconds ago)
    const validTimestamp = Date.now() - (10 * 1000);
    validateTimestamp(validTimestamp, "Legitimate Request - 10s ago");

    // Scenario 2: Deep Past Timestamp (6 minutes ago)
    const pastTimestamp = Date.now() - (6 * 60 * 1000);
    validateTimestamp(pastTimestamp, "Expired Request - 6 minutes ago");

    // Scenario 3: Deep Future Timestamp (1 year ahead)
    // This tests if an attacker can pre-mine nonces and payloads for the future
    // and keep them indefinitely lingering in memory or preventing evictions.
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const futureTimestamp = Date.now() + oneYearMs;
    validateTimestamp(futureTimestamp, "Futuristic Replay Attack - 1 Year Ahead");

    console.log("\n==========================================");
    console.log("TEST SUITE COMPLETED");
}

runTests();
