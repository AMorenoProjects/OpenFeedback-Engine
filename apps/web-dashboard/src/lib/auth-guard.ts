import { TABLE } from "@openfeedback/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function requireProjectAccess(projectId: string) {
  const { supabase, user } = await requireAuth();

  const { data } = await supabase
    .from(TABLE.PROJECT_MEMBERS)
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!data) {
    throw new Error("Forbidden");
  }

  return { supabase, user, role: data.role as string };
}
