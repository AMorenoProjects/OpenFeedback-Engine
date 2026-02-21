"use client";

import { FeedbackBoard } from "@/components/FeedbackBoard";

export default function FeedbackPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-of-text-heading">Feedback & Roadmap</h1>
                <p className="text-zinc-400">
                    Help us shape the future of MySaaS. Vote on existing ideas or submit your own.
                </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 md:p-8">
                <FeedbackBoard
                    config={{
                        projectId: "your-project-id",
                        apiUrl: process.env.NEXT_PUBLIC_OPENFEEDBACK_URL!
                    }}
                    anonKey={process.env.NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY!}
                    userId="simulated-user-123"
                />
            </div>
        </div>
    );
}
