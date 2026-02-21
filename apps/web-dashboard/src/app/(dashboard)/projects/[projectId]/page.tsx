import Link from "next/link";
import { notFound } from "next/navigation";
import { TABLE } from "@openfeedback/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SecretDisplay } from "@/components/SecretDisplay";
import { EditProjectForm } from "@/components/EditProjectForm";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: project } = await supabase
    .from(TABLE.PROJECTS)
    .select("id, name, hmac_secret, created_at, updated_at")
    .eq("id", projectId)
    .single();

  if (!project) {
    notFound();
  }

  const { count: suggestionsCount } = await supabase
    .from(TABLE.SUGGESTIONS)
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { count: votesCount } = await supabase
    .from(TABLE.VOTES)
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/projects"
          className="text-sm text-of-neutral-500 hover:text-of-neutral-700"
        >
          &larr; Back to Projects
        </Link>
      </div>

      {/* Project Name */}
      <div className="rounded-of border border-of-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Project Settings</h2>
        <EditProjectForm projectId={project.id} currentName={project.name} />
      </div>

      {/* API Key */}
      <div className="rounded-of border border-of-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">API Key</h2>
        <p className="mb-3 text-sm text-of-neutral-500">
          Use this HMAC secret to sign requests from your application.
          Keep it server-side only.
        </p>
        <SecretDisplay projectId={projectId} secret={project.hmac_secret} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-of border border-of-neutral-200 bg-white p-5">
          <p className="text-sm text-of-neutral-500">Suggestions</p>
          <p className="mt-1 text-2xl font-semibold">{suggestionsCount ?? 0}</p>
        </div>
        <div className="rounded-of border border-of-neutral-200 bg-white p-5">
          <p className="text-sm text-of-neutral-500">Votes</p>
          <p className="mt-1 text-2xl font-semibold">{votesCount ?? 0}</p>
        </div>
      </div>

      {/* Moderation Link */}
      <Link
        href={`/projects/${projectId}/moderation`}
        className="block rounded-of border border-of-neutral-200 bg-white p-5 text-center text-sm font-medium text-of-primary-600 hover:bg-of-primary-50"
      >
        Open Moderation Panel
      </Link>

      {/* Danger Zone */}
      <div className="rounded-of border border-red-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="mb-4 text-sm text-of-neutral-500">
          Deleting a project removes all its suggestions, votes, and data permanently.
        </p>
        <DeleteProjectButton projectId={projectId} />
      </div>
    </div>
  );
}
