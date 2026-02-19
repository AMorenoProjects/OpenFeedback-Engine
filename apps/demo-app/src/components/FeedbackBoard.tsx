"use client";

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

  return (
    <OpenFeedbackProvider config={config} anonKey={anonKey} authContext={authContext}>
      <div className="space-y-8">
        <NewSuggestionForm userId={userId} />
        <SuggestionList userId={userId} />
      </div>
    </OpenFeedbackProvider>
  );
}
