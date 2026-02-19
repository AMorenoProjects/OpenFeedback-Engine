import Link from "next/link";
import { notFound } from "next/navigation";
import { TABLE } from "@openfeedback/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SuggestionRow } from "@/components/SuggestionRow";
import { StatusFilter } from "@/components/StatusFilter";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function ModerationPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { status, q } = await searchParams;
  const supabase = await createServerSupabaseClient();

  // Verify project exists and user has access (RLS handles this)
  const { data: project } = await supabase
    .from(TABLE.PROJECTS)
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) {
    notFound();
  }

  let query = supabase
    .from(TABLE.SUGGESTIONS)
    .select("id, title, description, status, upvotes, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: suggestions } = await query;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-of-neutral-500 hover:text-of-neutral-700"
        >
          &larr; Back to {project.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Moderation</h1>
      </div>

      <StatusFilter projectId={projectId} currentStatus={status} currentQuery={q} />

      {(!suggestions || suggestions.length === 0) ? (
        <div className="mt-4 rounded-of border border-of-neutral-200 bg-white p-8 text-center">
          <p className="text-of-neutral-500">No suggestions found.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.id}
              suggestion={suggestion}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
