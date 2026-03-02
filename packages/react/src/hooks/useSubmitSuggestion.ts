import { useState, useCallback } from "react";
import { useOpenFeedback } from "../components/OpenFeedbackProvider";
import type { Suggestion, SuggestionIntent } from "../types";

interface UseSubmitSuggestionReturn {
  submit: (
    suggestion: SuggestionIntent,
    encryptedEmail?: string,
  ) => Promise<{ ok: true; suggestion: Suggestion }>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for creating new suggestions.
 * Routes the request through the configured OpenFeedback proxy to securely
 * build the API signature server-side.
 */
export function useSubmitSuggestion(): UseSubmitSuggestionReturn {
  const { proxyUrl, config } = useOpenFeedback();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (
      suggestion: SuggestionIntent,
      encryptedEmail?: string,
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "submit-suggestion",
            payload: suggestion,
            encryptedEmail,
          }),
        });

        if (!res.ok) {
          throw new Error(await res.text() || "Failed to submit suggestion");
        }

        const data = await res.json();
        return data;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        setError(wrapped);
        throw wrapped;
      } finally {
        setIsLoading(false);
      }
    },
    [proxyUrl, config.projectId],
  );

  return { submit, isLoading, error };
}
