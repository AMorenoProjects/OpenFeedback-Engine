import { signRequestBody, generateNonce } from "./server";

export interface OpenFeedbackProxyConfig {
    projectId: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    hmacSecret: string;
    getUser: (req: Request) => Promise<string | null>;
}

export function OpenFeedbackProxy(config: OpenFeedbackProxyConfig) {
    return async function handler(req: Request) {
        if (req.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            const userId = await config.getUser(req);
            if (!userId) {
                return new Response("Unauthorized", { status: 401 });
            }

            const body = await req.json();
            const { action, payload, encryptedEmail } = body;

            const nonce = generateNonce();
            const timestamp = Date.now();
            const auth = {
                user_id: userId,
                nonce,
                timestamp,
                project_id: config.projectId,
            };

            let endpoint = "";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bodyObj: any = { auth };

            if (action === "vote") {
                endpoint = "submit-vote";
                bodyObj.vote = payload;
            } else if (action === "submit-suggestion") {
                endpoint = "submit-suggestion";
                bodyObj.suggestion = payload;
                if (encryptedEmail) {
                    bodyObj.encrypted_email = encryptedEmail;
                }
            } else {
                return new Response("Invalid action", { status: 400 });
            }

            const bodyStr = JSON.stringify(bodyObj);
            const signature = signRequestBody(bodyStr, config.hmacSecret);

            const res = await fetch(`${config.supabaseUrl}/functions/v1/${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.supabaseAnonKey}`,
                    "x-openfeedback-signature": signature,
                },
                body: bodyStr,
            });

            if (!res.ok) {
                return new Response(await res.text(), { status: res.status });
            }

            return new Response(JSON.stringify(await res.json()), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        } catch (error) {
            console.error("[OpenFeedbackProxy] Error:", error);
            return new Response("Internal Server Error", { status: 500 });
        }
    };
}
