import Link from "next/link";
import { TABLE } from "@openfeedback/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: memberships } = await supabase
    .from(TABLE.PROJECT_MEMBERS)
    .select("project_id, role");

  const projectIds = memberships?.map((m) => m.project_id) ?? [];

  let projects: Array<{ id: string; name: string; created_at: string }> = [];

  if (projectIds.length > 0) {
    const { data } = await supabase
      .from(TABLE.PROJECTS)
      .select("id, name, created_at")
      .in("id", projectIds)
      .order("created_at", { ascending: false });

    projects = data ?? [];
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-of bg-of-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-of-primary-700"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-of border border-of-neutral-200 bg-white p-8 text-center">
          <p className="text-of-neutral-500">No projects yet.</p>
          <Link
            href="/projects/new"
            className="mt-2 inline-block text-sm text-of-primary-600 hover:text-of-primary-700"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-of border border-of-neutral-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <h2 className="font-medium text-of-neutral-900">
                {project.name}
              </h2>
              <p className="mt-1 text-xs text-of-neutral-400">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
