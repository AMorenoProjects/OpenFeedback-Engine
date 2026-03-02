import { OpenFeedbackProxy } from "@openfeedback/client/next";

// Dummy auth for demo purposes (e.g. NextAuth or similar would go here)
async function getSession() {
    return { user: { id: "demo-user-123" } };
}

export const POST = OpenFeedbackProxy({
    projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
    hmacSecret: process.env.OPENFEEDBACK_HMAC_SECRET!,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    getUser: async () => {
        // In a real app, verify the session securely
        const session = await getSession();
        return session?.user?.id || null;
    },
});
