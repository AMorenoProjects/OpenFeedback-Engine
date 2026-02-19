"use client";

import { useActionState } from "react";
import { createProject } from "@/app/(dashboard)/projects/actions";

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-of-neutral-700"
        >
          Project Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-of border border-of-neutral-300 px-3 py-2 text-sm focus:border-of-primary-500 focus:outline-none focus:ring-1 focus:ring-of-primary-500"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-of bg-of-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-of-primary-700 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Project"}
        </button>
      </div>
    </form>
  );
}
