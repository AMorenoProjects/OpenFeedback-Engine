import { useState, useCallback } from "react";
import { useOpenFeedback } from "../components/OpenFeedbackProvider";
import type { Suggestion, SuggestionIntent } from "../types";
import type { SignedAuthParams } from "./useVote";

interface UseSubmitSuggestionReturn {
  submit: (
    suggestion: SuggestionIntent,
    signedAuth: SignedAuthParams,
    encryptedEmail?: string,
  ) => Promise<{ ok: true; suggestion: Suggestion }>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for creating new suggestions via the submit-suggestion Edge Function.
 *
 * Each call requires a fresh `signedAuth` with a unique nonce, current
 * timestamp, and a signature computed server-side over the full JSON body.
 */
export function useSubmitSuggestion(): UseSubmitSuggestionReturn {
  const { client, authContext, config } = useOpenFeedback();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (
      suggestion: SuggestionIntent,
      signedAuth: SignedAuthParams,
      encryptedEmail?: string,
    ) => {
      if (!authContext) {
        throw new Error(
          "useSubmitSuggestion requires an authContext in <OpenFeedbackProvider>",
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await client.submitSuggestion(
          suggestion,
          {
            signature: signedAuth.signature,
            auth: {
              user_id: authContext.userId,
              nonce: signedAuth.nonce,
              timestamp: signedAuth.timestamp,
              project_id: config.projectId,
            },
          },
          encryptedEmail,
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

  return { submit, isLoading, error };
}
