import { FeedbackBoard } from "@/components/FeedbackBoard";

const DEMO_USER_ID = "demo-user-001";

const config = {
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
};

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function Home() {
  return (
    <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Feature Requests
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          Vote on existing ideas or suggest new ones to help us prioritize our roadmap.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#18181b]/50 backdrop-blur-xl shadow-2xl p-6 sm:p-10 relative overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none"></div>

        <div className="relative z-10">
          <FeedbackBoard
            config={config}
            anonKey={anonKey}
            userId={DEMO_USER_ID}
          />
        </div>
      </div>
    </main>
  );
}
