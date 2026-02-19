"use server";

import { revalidatePath } from "next/cache";
import { TABLE, SuggestionStatus } from "@openfeedback/client";
import { requireProjectAccess } from "@/lib/auth-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/errors";

export async function updateSuggestionStatus(
  suggestionId: string,
  status: string,
  projectId: string
) {
  const parsed = SuggestionStatus.safeParse(status);
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  await requireProjectAccess(projectId);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from(TABLE.SUGGESTIONS)
    .update({ status: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("project_id", projectId);

  if (error) {
    return { error: sanitizeError(error) };
  }

  revalidatePath(`/projects/${projectId}/moderation`);
  return { error: null };
}

export async function deleteSuggestion(
  suggestionId: string,
  projectId: string
) {
  await requireProjectAccess(projectId);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from(TABLE.SUGGESTIONS)
    .delete()
    .eq("id", suggestionId)
    .eq("project_id", projectId);

  if (error) {
    return { error: sanitizeError(error) };
  }

  revalidatePath(`/projects/${projectId}/moderation`);
  return { error: null };
}
