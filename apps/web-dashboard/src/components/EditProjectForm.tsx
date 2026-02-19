"use client";

import { useActionState } from "react";
import { updateProject } from "@/app/(dashboard)/projects/actions";

interface EditProjectFormProps {
  projectId: string;
  currentName: string;
}

export function EditProjectForm({ projectId, currentName }: EditProjectFormProps) {
  const updateWithId = (_prev: unknown, formData: FormData) =>
    updateProject(projectId, formData);

  const [state, formAction, pending] = useActionState(updateWithId, null);

  return (
    <form action={formAction} className="flex gap-3">
      <input
        name="name"
        type="text"
        defaultValue={currentName}
        required
        className="flex-1 rounded-of border border-of-neutral-300 px-3 py-2 text-sm focus:border-of-primary-500 focus:outline-none focus:ring-1 focus:ring-of-primary-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-of bg-of-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-of-primary-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state?.error && (
        <p className="self-center text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
