// Dummy OpenFeedback Provider for the Demo App
"use client";

import { useMemo } from "react";
import { OpenFeedbackProvider as SDKProvider } from "@openfeedback/react";

// The demo uses a public Supabase URL and Anon Key defined in the environment
const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const PROJECT_ID = process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID || "proj_local_123";

/**
 * OpenFeedbackClientWrapper
 *
 * The new NextAuth-style DX allows the developer to just pass configuration and keys,
 * without having any knowledge of the cryptographic signature process.
 */
export function OpenFeedbackClientWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const config = useMemo(() => ({
        projectId: PROJECT_ID,
        apiUrl: API_URL,
    }), []);

    return (
        <SDKProvider
            config={config}
            anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key"}
        >
            {children}
        </SDKProvider>
    );
}
