"use server";

import { signRequestBody, generateNonce } from "@openfeedback/client/server";

const hmacSecret = process.env.OPENFEEDBACK_HMAC_SECRET!;
const projectId = "your-project-id";

export async function signVote(
    userId: string,
    suggestionId: string,
    direction: "up" | "remove",
) {
    const nonce = generateNonce();
    const timestamp = Date.now();

    const body = JSON.stringify({
        auth: {
            user_id: userId,
            nonce,
            timestamp,
            project_id: projectId,
        },
        vote: {
            suggestion_id: suggestionId,
            direction,
        },
    });

    const signature = signRequestBody(body, hmacSecret);

    return { signature, nonce, timestamp };
}

export async function signSuggestion(
    userId: string,
    title: string,
    description?: string,
) {
    const nonce = generateNonce();
    const timestamp = Date.now();

    const body = JSON.stringify({
        auth: {
            user_id: userId,
            nonce,
            timestamp,
            project_id: projectId,
        },
        suggestion: {
            title,
            ...(description ? { description } : {}),
        },
    });

    const signature = signRequestBody(body, hmacSecret);

    return { signature, nonce, timestamp };
}
