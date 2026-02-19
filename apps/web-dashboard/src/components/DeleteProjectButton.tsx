"use client";

import { useState } from "react";
import { deleteProject } from "@/app/(dashboard)/projects/actions";

interface DeleteProjectButtonProps {
  projectId: string;
}

export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await deleteProject(projectId);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-of border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Delete Project
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-red-600">Are you sure? This cannot be undone.</span>
      <button
        type="button"
        onClick={handleDelete}
        className="rounded-of bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Confirm Delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-of border border-of-neutral-300 px-4 py-2 text-sm text-of-neutral-600 hover:bg-of-neutral-100"
      >
        Cancel
      </button>
    </div>
  );
}
