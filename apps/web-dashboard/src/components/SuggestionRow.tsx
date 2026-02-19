"use client";

import { useState, useTransition } from "react";
import { StatusBadge } from "./StatusBadge";
import {
  updateSuggestionStatus,
  deleteSuggestion,
} from "@/app/(dashboard)/projects/[projectId]/moderation/actions";

interface Suggestion {
  id: string;
  title: string;
  description: string | null;
  status: string;
  upvotes: number;
  created_at: string;
}

interface SuggestionRowProps {
  suggestion: Suggestion;
  projectId: string;
}

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "shipped", label: "Shipped" },
  { value: "closed", label: "Closed" },
];

export function SuggestionRow({ suggestion, projectId }: SuggestionRowProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    startTransition(async () => {
      await updateSuggestionStatus(suggestion.id, newStatus, projectId);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSuggestion(suggestion.id, projectId);
    });
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-of border border-of-neutral-200 bg-white p-4 ${
        isPending ? "opacity-50" : ""
      }`}
    >
      {/* Upvotes */}
      <div className="flex flex-col items-center">
        <span className="text-lg font-semibold text-of-neutral-700">
          {suggestion.upvotes}
        </span>
        <span className="text-xs text-of-neutral-400">votes</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-of-neutral-900 truncate">
            {suggestion.title}
          </h3>
          <StatusBadge status={suggestion.status} />
        </div>
        {suggestion.description && (
          <p className="mt-1 text-sm text-of-neutral-500 truncate">
            {suggestion.description}
          </p>
        )}
        <p className="mt-1 text-xs text-of-neutral-400">
          {new Date(suggestion.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <select
          value={suggestion.status}
          onChange={handleStatusChange}
          disabled={isPending}
          className="rounded-of border border-of-neutral-300 px-2 py-1 text-sm focus:border-of-primary-500 focus:outline-none"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isPending}
            className="rounded-of border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-of bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-of border border-of-neutral-300 px-3 py-1 text-sm text-of-neutral-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
