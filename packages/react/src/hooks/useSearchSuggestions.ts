import { useState, useEffect, useMemo } from "react";
import type { Suggestion } from "../types";
import { useSuggestions } from "./useSuggestions";

interface UseSearchSuggestionsOptions {
  query: string;
  debounceMs?: number;
}

interface UseSearchSuggestionsReturn {
  results: Suggestion[];
  isSearching: boolean;
}

export function useSearchSuggestions({
  query,
  debounceMs = 250,
}: UseSearchSuggestionsOptions): UseSearchSuggestionsReturn {
  const { suggestions, isLoading } = useSuggestions();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const results = useMemo(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return suggestions.filter((s) =>
      s.title.toLowerCase().includes(trimmed),
    );
  }, [debouncedQuery, suggestions]);

  const isSearching = query !== debouncedQuery || isLoading;

  return { results, isSearching };
}
