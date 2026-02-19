"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "shipped", label: "Shipped" },
  { value: "closed", label: "Closed" },
];

interface StatusFilterProps {
  projectId: string;
  currentStatus?: string;
  currentQuery?: string;
}

export function StatusFilter({ projectId, currentStatus, currentQuery }: StatusFilterProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentQuery ?? "");
  const active = currentStatus ?? "all";

  function navigate(status: string, q: string) {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    const qs = params.toString();
    router.push(`/projects/${projectId}/moderation${qs ? `?${qs}` : ""}`);
  }

  function handleStatusClick(status: string) {
    navigate(status, search);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(active, search);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleStatusClick(s.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              active === s.value
                ? "bg-of-primary-600 text-white"
                : "bg-of-neutral-100 text-of-neutral-600 hover:bg-of-neutral-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-of border border-of-neutral-300 px-3 py-1.5 text-sm focus:border-of-primary-500 focus:outline-none focus:ring-1 focus:ring-of-primary-500"
        />
        <button
          type="submit"
          className="rounded-of bg-of-neutral-100 px-3 py-1.5 text-sm text-of-neutral-600 hover:bg-of-neutral-200"
        >
          Search
        </button>
      </form>
    </div>
  );
}
