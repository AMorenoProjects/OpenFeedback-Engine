"use client";

import { useSuggestions, useVote, type Suggestion } from "@openfeedback/react";
import { useState } from "react";
import { signVote } from "@/app/actions";

interface SuggestionListProps {
  userId: string;
}

export function SuggestionList({ userId }: SuggestionListProps) {
  const { suggestions, isLoading, error, refetch } = useSuggestions({
    orderBy: "upvotes",
  });

  if (isLoading) {
    return <p className="text-of-neutral-400 text-sm">Loading suggestions...</p>;
  }

  if (error) {
    return (
      <div className="rounded-of border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Error: {error.message}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <p className="text-of-neutral-400 text-sm">
        No suggestions yet. Be the first to submit one!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-of-neutral-800">
        Suggestions ({suggestions.length})
      </h2>
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} userId={userId} onVoted={refetch} />
      ))}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  userId,
  onVoted,
}: {
  suggestion: Suggestion;
  userId: string;
  onVoted: () => Promise<void>;
}) {
  const { vote, isLoading: isVoting, error: voteError } = useVote();
  const [lastAction, setLastAction] = useState<string | null>(null);

  async function handleVote(direction: "up" | "remove") {
    try {
      const signedAuth = await signVote(userId, suggestion.id, direction);
      const result = await vote(suggestion.id, direction, signedAuth);
      setLastAction(result.action);
      await onVoted();
    } catch {
      // error is captured by the hook
    }
  }

  return (
    <div className="flex gap-4 rounded-of border border-of-neutral-200 bg-white p-4">
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => handleVote("up")}
          disabled={isVoting}
          className="rounded-of bg-of-primary-50 px-3 py-1 text-of-primary-600 hover:bg-of-primary-100 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {isVoting ? "..." : "▲"}
        </button>
        <span className="text-lg font-bold text-of-neutral-700">
          {suggestion.upvotes}
        </span>
        <button
          onClick={() => handleVote("remove")}
          disabled={isVoting}
          className="rounded-of text-of-neutral-400 hover:text-of-neutral-600 disabled:opacity-50 text-xs transition-colors"
        >
          undo
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-of-neutral-900">{suggestion.title}</h3>
        {suggestion.description && (
          <p className="mt-1 text-sm text-of-neutral-500 line-clamp-2">
            {suggestion.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-of-neutral-400">
          <span className="rounded bg-of-neutral-100 px-1.5 py-0.5">
            {suggestion.status}
          </span>
          {lastAction && (
            <span className="text-of-primary-600">✓ {lastAction}</span>
          )}
          {voteError && (
            <span className="text-red-500">{voteError.message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
