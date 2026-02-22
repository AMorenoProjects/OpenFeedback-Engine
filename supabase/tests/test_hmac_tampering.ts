import { computeHmac, bufferToHex, timingSafeEqual } from "../functions/_shared/crypto.ts";

const HMAC_SECRET = "super-secret-key-123";

async function runTest() {
    console.log("Running HMAC Tampering Test...");

    // 1. Original Valid Payload
    const originalPayload = {
        auth: {
            user_id: "user_legit",
            project_id: "proj_123",
            timestamp: Date.now(),
            nonce: "random-nonce-123",
        },
        vote: {
            suggestion_id: "sug_A",
            direction: "up",
        }
    };

    const originalRawBody = JSON.stringify(originalPayload);

    // 2. Client signs the original payload
    const expectedBuf = await computeHmac(originalRawBody, HMAC_SECRET);
    const validSignature = bufferToHex(expectedBuf);
    console.log("Original Signature:", validSignature);

    // 3. Attacker intercepts and modifies the payload string directly
    // Change "direction":"up" to "direction":"down"
    const tamperedRawBody = originalRawBody.replace('"direction":"up"', '"direction":"down"');
    console.log("Tampered Raw Body:", tamperedRawBody);

    // 4. Server receives tamperedRawBody and validSignature
    // The server parses it (it's valid JSON) and re-computes the HMAC on the rawBody
    const serverComputedBuf = await computeHmac(tamperedRawBody, HMAC_SECRET);
    const serverComputedHex = bufferToHex(serverComputedBuf);

    // 5. Server checks if signatures match
    const isValid = timingSafeEqual(validSignature, serverComputedHex);

    console.log("Server Computed Signature:", serverComputedHex);
    console.log("Signatures Match?", isValid);

    if (isValid) {
        console.error("❌ TEST FAILED: Tampered payload was accepted!");
        Deno.exit(1);
    } else {
        console.log("✅ TEST PASSED: Tampered payload was successfully rejected.");
    }
}

runTest();
