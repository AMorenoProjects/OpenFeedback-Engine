import { useState, useCallback, useRef } from "react";
import { useOpenFeedback } from "../components/OpenFeedbackProvider";
import type { VoteDirectionType, Suggestion } from "../types";

interface UseVoteReturn {
  vote: (
    suggestionId: string,
    direction: VoteDirectionType,
  ) => Promise<{ ok: true; action: string }>;
  isLoading: boolean;
  isVotingOn: (id: string) => boolean;
  error: Error | null;
}

function applyDelta(delta: number): (s: Suggestion) => Suggestion {
  return (s) => ({ ...s, upvotes: Math.max(0, s.upvotes + delta) });
}

/**
 * Hook for casting/removing votes.
 * Routes the request through the configured OpenFeedback proxy to securely
 * build the API signature server-side.
 *
 * Features:
 * - Optimistic UI updates via Provider pub/sub
 * - Automatic rollback on server error
 * - Per-suggestion anti-spam lock (concurrent votes on same suggestion are throttled)
 */
export function useVote(): UseVoteReturn {
  const { proxyUrl, config, emitSuggestionUpdate } = useOpenFeedback();
  const [error, setError] = useState<Error | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Ref mirror of pendingIds for synchronous checks inside the async callback
  const pendingRef = useRef<Set<string>>(new Set());

  const isVotingOn = useCallback(
    (id: string) => pendingIds.has(id),
    [pendingIds],
  );

  const vote = useCallback(
    async (
      suggestionId: string,
      direction: VoteDirectionType,
    ): Promise<{ ok: true; action: string }> => {
      // Anti-spam: reject if a vote for this suggestion is already in flight
      if (pendingRef.current.has(suggestionId)) {
        return { ok: true, action: "throttled" };
      }

      // Mark in-flight
      pendingRef.current.add(suggestionId);
      setPendingIds((prev) => new Set(prev).add(suggestionId));
      setError(null);

      // Optimistic update
      const delta = direction === "up" ? 1 : -1;
      emitSuggestionUpdate(suggestionId, applyDelta(delta));

      try {
        const res = await fetch(proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "vote",
            payload: {
              suggestion_id: suggestionId,
              direction,
            },
          }),
        });

        if (!res.ok) {
          throw new Error((await res.text()) || "Failed to vote");
        }

        const data = await res.json();
        return data;
      } catch (err) {
        // Rollback optimistic update
        emitSuggestionUpdate(suggestionId, applyDelta(-delta));

        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        throw wrapped;
      } finally {
        pendingRef.current.delete(suggestionId);
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(suggestionId);
          return next;
        });
      }
    },
    [proxyUrl, config.projectId, emitSuggestionUpdate],
  );

  const isLoading = pendingIds.size > 0;

  return { vote, isLoading, isVotingOn, error };
}
