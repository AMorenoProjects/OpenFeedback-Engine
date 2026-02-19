import { FeedbackBoard } from "@/components/FeedbackBoard";

const DEMO_USER_ID = "demo-user-001";

const config = {
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
};

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-of-neutral-900 mb-2">
        OpenFeedback Demo
      </h1>
      <p className="text-of-neutral-500 mb-8">
        Validation app for the OpenFeedback Engine core.
      </p>

      <FeedbackBoard
        config={config}
        anonKey={anonKey}
        userId={DEMO_USER_ID}
      />
    </main>
  );
}
