import { useState, useCallback } from "react";
import { useOpenFeedback } from "../components/OpenFeedbackProvider";
import type { VoteDirectionType } from "../types";

/**
 * Per-call signed auth parameters.
 * Each operation needs a fresh nonce + timestamp + signature to prevent
 * replay attacks. The host app's Server Action generates these.
 */
export interface SignedAuthParams {
  signature: string;
  nonce: string;
  timestamp: number;
}

interface UseVoteReturn {
  vote: (
    suggestionId: string,
    direction: VoteDirectionType,
    signedAuth: SignedAuthParams,
  ) => Promise<{ ok: true; action: string }>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for casting/removing votes via the submit-vote Edge Function.
 *
 * Each call requires a fresh `signedAuth` with a unique nonce, current
 * timestamp, and a signature computed server-side over the full JSON body
 * (auth + vote). See `@openfeedback/client/server` for `signRequestBody`.
 */
export function useVote(): UseVoteReturn {
  const { client, authContext, config } = useOpenFeedback();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vote = useCallback(
    async (
      suggestionId: string,
      direction: VoteDirectionType,
      signedAuth: SignedAuthParams,
    ) => {
      if (!authContext) {
        throw new Error("useVote requires an authContext in <OpenFeedbackProvider>");
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await client.submitVote(
          { suggestion_id: suggestionId, direction },
          {
            signature: signedAuth.signature,
            auth: {
              user_id: authContext.userId,
              nonce: signedAuth.nonce,
              timestamp: signedAuth.timestamp,
              project_id: config.projectId,
            },
          },
        );
        return result;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        throw wrapped;
      } finally {
        setIsLoading(false);
      }
    },
    [client, authContext, config.projectId],
  );

  return { vote, isLoading, error };
}
