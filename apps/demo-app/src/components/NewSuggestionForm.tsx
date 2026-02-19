"use client";

import { useSubmitSuggestion } from "@openfeedback/react";
import { useState } from "react";
import { signSuggestion } from "@/app/actions";

interface NewSuggestionFormProps {
  userId: string;
}

export function NewSuggestionForm({ userId }: NewSuggestionFormProps) {
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
    } catch {
      // error is captured by the hook
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-of border border-of-neutral-200 bg-white p-4 space-y-3">
      <h2 className="text-lg font-semibold text-of-neutral-800">
        New Suggestion
      </h2>

      <input
        type="text"
        placeholder="Title (required)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={300}
        className="w-full rounded-of border border-of-neutral-300 px-3 py-2 text-sm focus:border-of-primary-400 focus:outline-none focus:ring-1 focus:ring-of-primary-400"
      />

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={5000}
        rows={3}
        className="w-full rounded-of border border-of-neutral-300 px-3 py-2 text-sm focus:border-of-primary-400 focus:outline-none focus:ring-1 focus:ring-of-primary-400 resize-none"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="rounded-of bg-of-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-of-primary-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Submitting..." : "Submit"}
        </button>

        {success && (
          <span className="text-sm text-green-600">Suggestion created!</span>
        )}
        {error && (
          <span className="text-sm text-red-500">{error.message}</span>
        )}
      </div>
    </form>
  );
}
