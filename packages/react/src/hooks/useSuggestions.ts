import { useState, useEffect, useCallback } from "react";
import type { Suggestion, SuggestionStatusType } from "../types";
import { useOpenFeedback } from "../components/OpenFeedbackProvider";

interface UseSuggestionsOptions {
  status?: SuggestionStatusType;
  orderBy?: "upvotes" | "created_at";
  ascending?: boolean;
}

interface UseSuggestionsReturn {
  suggestions: Suggestion[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSuggestions(
  options?: UseSuggestionsOptions,
): UseSuggestionsReturn {
  const { client } = useOpenFeedback();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await client.getSuggestions(options);
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, options?.status, options?.orderBy, options?.ascending]);

  useEffect(() => {
    void fetchSuggestions();
  }, [fetchSuggestions]);

  return { suggestions, isLoading, error, refetch: fetchSuggestions };
}
