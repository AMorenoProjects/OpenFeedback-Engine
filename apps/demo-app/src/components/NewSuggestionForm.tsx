"use client";

import {
  useSubmitSuggestion,
  SuggestionSearch,
  TrustBadge,
  cn,
  type Suggestion,
} from "@openfeedback/react";
import { useState } from "react";

interface NewSuggestionFormProps {
  userId: string;
  userEmail?: string;
  onCreated?: () => void;
  onExistingSelected?: (suggestion: Suggestion) => void;
  className?: string;
}

export function NewSuggestionForm({
  userId,
  userEmail,
  onCreated,
  onExistingSelected,
  className,
}: NewSuggestionFormProps) {
  const { submit, isLoading, error } = useSubmitSuggestion();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);

    try {
      await submit({ title, description: description || undefined });

      setTitle("");
      setDescription("");
      setSuccess(true);
      if (onCreated) onCreated();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // error is captured by the hook
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "relative overflow-hidden bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 p-6 space-y-4 shadow-[0_0_40px_rgba(99,102,241,0.05)]",
        "before:absolute before:inset-0 before:bg-gradient-to-b before:from-indigo-500/5 before:to-transparent before:pointer-events-none",
        className,
      )}
    >
      <div className="absolute top-0 right-0 p-2 opacity-20 hover:opacity-100 transition-opacity">
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_10px_#818cf8]" />
      </div>

      <div className="space-y-1">
        <label className="font-mono text-xs text-zinc-500 uppercase tracking-widest block">TITLE_PAYLOAD</label>
        <SuggestionSearch
          value={title}
          onChange={setTitle}
          onSelect={(suggestion) => {
            setTitle("");
            onExistingSelected?.(suggestion);
          }}
          placeholder="What should we build next?"
          inputClassName="w-full bg-zinc-950/50 border border-zinc-800 px-4 py-3 text-base text-zinc-100 font-sans
                     placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
                     focus:outline-none transition-all rounded-sm shadow-inner"
          dropdownClassName="mt-1 bg-zinc-900 border border-zinc-700 rounded-sm shadow-lg max-h-48 overflow-y-auto"
          itemClassName="hover:bg-zinc-800 cursor-pointer text-zinc-300 font-sans border-b border-zinc-800 last:border-b-0"
        />
      </div>

      <div className="space-y-1">
        <label className="font-mono text-xs text-zinc-500 uppercase tracking-widest block">DETAIL_BUFFER (OPT)</label>
        <textarea
          placeholder="Provide context or architecture requirements..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={4}
          className="w-full bg-zinc-950/50 border border-zinc-800 px-4 py-3 text-sm text-zinc-300 font-sans
                     placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
                     focus:outline-none transition-all rounded-sm resize-none shadow-inner"
        />
      </div>

      <div className="pt-2 flex flex-col items-start gap-4">
        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="relative inline-flex items-center justify-center px-6 py-2.5 font-display text-sm uppercase tracking-wider
                     text-indigo-100 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full md:w-auto
                     hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] overflow-hidden group"
        >
          <span className="relative z-10">{isLoading ? "[ EXECUTING... ]" : "[ TRANSMIT ]"}</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
        </button>

        <TrustBadge
          userEmail={userEmail}
          className="font-mono text-zinc-500"
        />

        <div className="h-6 w-full ml-1">
          {success && (
            <span className="font-mono text-xs text-emerald-400 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> 201 Created: Payload Accepted
            </span>
          )}
          {error && (
            <span className="font-mono text-xs text-red-400 flex items-center gap-2 animate-in fade-in duration-300">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full" /> 500 ERR: {error.message}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
