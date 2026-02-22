"use client";

import { useSubmitSuggestion } from "@openfeedback/react";
import { useState } from "react";
import { signSuggestion } from "@/app/actions";

interface NewSuggestionFormProps {
  userId: string;
  onCreated?: () => void;
}

export function NewSuggestionForm({ userId, onCreated }: NewSuggestionFormProps) {
  const { submit, isLoading, error } = useSubmitSuggestion();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);

    try {
      const signedAuth = await signSuggestion(
        userId,
        title,
        description || undefined,
      );

      await submit(
        { title, description: description || undefined },
        signedAuth,
      );

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
      className="relative overflow-hidden bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 p-6 space-y-4 shadow-[0_0_40px_rgba(99,102,241,0.05)]
                 before:absolute before:inset-0 before:bg-gradient-to-b before:from-indigo-500/5 before:to-transparent before:pointer-events-none"
    >
      <div className="absolute top-0 right-0 p-2 opacity-20 hover:opacity-100 transition-opacity">
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_10px_#818cf8]" />
      </div>

      <div className="space-y-1">
        <label className="font-mono text-xs text-zinc-500 uppercase tracking-widest block">TITLE_PAYLOAD</label>
        <input
          type="text"
          placeholder="What should we build next?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={300}
          className="w-full bg-zinc-950/50 border border-zinc-800 px-4 py-3 text-base text-zinc-100 font-sans 
                     placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 
                     focus:outline-none transition-all rounded-sm shadow-inner"
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
