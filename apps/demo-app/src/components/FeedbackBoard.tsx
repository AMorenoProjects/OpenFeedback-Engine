"use client";

import { useState } from "react";
import {
  OpenFeedbackProvider,
  type OpenFeedbackConfig,
  type AuthContext,
} from "@openfeedback/react";
import { SuggestionList } from "./SuggestionList";
import { NewSuggestionForm } from "./NewSuggestionForm";

interface FeedbackBoardProps {
  config: OpenFeedbackConfig;
  anonKey: string;
  userId: string;
}

export function FeedbackBoard({ config, anonKey, userId }: FeedbackBoardProps) {
  // Minimal authContext — only userId is needed for the provider.
  // Fresh nonce/timestamp/signature are generated per-call via Server Actions.
  const authContext: AuthContext = {
    userId,
    signature: "",
    timestamp: 0,
    nonce: "",
  };

  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <OpenFeedbackProvider config={config} anonKey={anonKey} authContext={authContext}>
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mt-12 w-full max-w-7xl mx-auto">
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="sticky top-8">
            <h1 className="font-display text-4xl font-bold tracking-tighter text-white mb-2 uppercase border-b border-indigo-500/30 pb-4">
              Feedback<span className="text-indigo-500">_</span>
            </h1>
            <p className="font-mono text-xs text-zinc-400 mb-8 uppercase tracking-widest pl-1 border-l-2 border-indigo-500/50">
              SYS_REQ: Submit Ideation Payload
            </p>
            <NewSuggestionForm userId={userId} onCreated={() => setRefreshKey(k => k + 1)} />
          </div>
        </div>
        <div className="w-full lg:w-2/3">
          <SuggestionList key={refreshKey} userId={userId} />
        </div>
      </div>
    </OpenFeedbackProvider>
  );
}
