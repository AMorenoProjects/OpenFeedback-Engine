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
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-zinc-900/50 border border-zinc-800/80 rounded-sm"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/30 border border-red-900/50 p-6 text-red-400 font-mono text-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600/80" />
        <span className="font-bold">FATAL_EXCEPTION:</span> {error.message}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 bg-zinc-900/10 text-zinc-500 font-mono text-sm">
        <span className="text-2xl mb-2 opacity-50">⸘</span>
        <span>NO_PAYLOADS_FOUND</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end border-b border-zinc-800 pb-2 mb-6">
        <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <span>{">"}</span> Active_Threads
        </h2>
        <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20">
          COUNT: {suggestions.length}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {suggestions.map((s, index) => (
          <SuggestionCard key={s.id} suggestion={s} userId={userId} onVoted={refetch} index={index} />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  userId,
  onVoted,
  index
}: {
  suggestion: Suggestion;
  userId: string;
  onVoted: () => Promise<void>;
  index: number;
}) {
  const { vote, isLoading: isVoting, error: voteError } = useVote();
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Compute status colors
  const statusColor: Record<string, string> = {
    'under_review': 'text-amber-400 border-amber-400/30 bg-amber-400/5',
    'planned': 'text-indigo-400 border-indigo-400/30 bg-indigo-400/5',
    'in_progress': 'text-blue-400 border-blue-400/30 bg-blue-400/5',
    'shipped': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    'open': 'text-zinc-400 border-zinc-700 bg-zinc-800/30',
    'closed': 'text-zinc-600 border-zinc-800 bg-zinc-900/50'
  };

  const currentStatusColor = statusColor[suggestion.status] || statusColor['open'];

  async function handleVote(direction: "up" | "remove") {
    try {
      setLastAction(null);
      const signedAuth = await signVote(userId, suggestion.id, direction);
      const result = await vote(suggestion.id, direction, signedAuth);
      setLastAction(result.action);

      // Temporary confirmation message layout
      setTimeout(() => setLastAction(null), 2500);

      await onVoted();
    } catch {
      // error is captured by the hook
    }
  }

  return (
    <div className="group flex gap-0 sm:gap-6 bg-zinc-900/20 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800 transition-all duration-300 relative overflow-hidden">

      {/* Decorative Index Number */}
      <div className="hidden sm:block absolute top-4 right-4 font-display text-6xl text-zinc-800/20 font-bold select-none pointer-events-none group-hover:text-zinc-700/30 transition-colors">
        {(index + 1).toString().padStart(2, '0')}
      </div>

      {/* Upvote Matrix Button */}
      <div className="w-16 sm:w-20 shrink-0 border-r border-zinc-800/50 flex flex-col items-center justify-center p-2 bg-zinc-950/30">
        <button
          onClick={() => handleVote("up")}
          disabled={isVoting}
          className="w-full aspect-square flex flex-col items-center justify-center gap-1 bg-zinc-900 hover:bg-indigo-600 hover:text-white border border-zinc-800 hover:border-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
        >
          <span className={`text-xl transition-transform group-hover/btn:-translate-y-1 ${isVoting ? 'animate-bounce' : ''}`}>
            ▲
          </span>
        </button>
        <span className="font-mono text-lg font-bold text-zinc-200 mt-2 mb-1">
          {suggestion.upvotes}
        </span>
        <button
          onClick={() => handleVote("remove")}
          disabled={isVoting}
          title="Remove vote"
          className="font-mono text-[10px] uppercase text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          [-R]
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 py-4 pr-6 pl-4 sm:pl-0 z-10 flex flex-col">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-sans text-lg font-medium text-zinc-100 group-hover:text-indigo-200 transition-colors pr-6">
            {suggestion.title}
          </h3>
        </div>

        {suggestion.description ? (
          <p className="mt-2 text-sm text-zinc-400 font-sans line-clamp-2 leading-relaxed max-w-2xl">
            {suggestion.description}
          </p>
        ) : null}

        <div className="mt-auto pt-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${currentStatusColor}`}>
              {suggestion.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-[10px] text-zinc-600">
              ID: {suggestion.id.split('-')[0]}...
            </span>
          </div>

          <div className="h-4 flex items-center">
            {lastAction && (
              <span className="font-mono text-[10px] text-indigo-400 animate-in fade-in slide-in-from-bottom-2">
                OK: {lastAction.toUpperCase()}D
              </span>
            )}
            {voteError && (
              <span className="font-mono text-[10px] text-red-500 max-w-[200px] truncate" title={voteError.message}>
                ERR: {voteError.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
