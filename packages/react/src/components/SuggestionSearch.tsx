import { useState, useRef, useEffect } from "react";
import type { Suggestion } from "../types";
import { useSearchSuggestions } from "../hooks/useSearchSuggestions";
import { cn } from "../utils/cn";

interface SuggestionSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  itemClassName?: string;
  debounceMs?: number;
}

export function SuggestionSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Search or create a suggestion...",
  className,
  inputClassName,
  dropdownClassName,
  itemClassName,
  debounceMs,
}: SuggestionSearchProps): React.JSX.Element {
  const { results, isSearching } = useSearchSuggestions({
    query: value,
    debounceMs,
  });
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = isOpen && value.trim().length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={cn(inputClassName)}
      />
      {showDropdown && (
        <div className={cn("absolute z-10 w-full", dropdownClassName)}>
          {isSearching ? (
            <div className={cn("px-3 py-2 text-sm opacity-60", itemClassName)}>
              Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => {
                  onSelect?.(suggestion);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm",
                  itemClassName,
                )}
              >
                <span>{suggestion.title}</span>
                <span className="ml-2 opacity-50">
                  {suggestion.upvotes} vote{suggestion.upvotes !== 1 ? "s" : ""}
                </span>
              </button>
            ))
          ) : (
            <div className={cn("px-3 py-2 text-sm opacity-60", itemClassName)}>
              No matches — this will be a new idea
            </div>
          )}
        </div>
      )}
    </div>
  );
}
