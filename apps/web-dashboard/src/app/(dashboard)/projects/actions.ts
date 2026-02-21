"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TABLE } from "@openfeedback/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireProjectAccess } from "@/lib/auth-guard";
import { sanitizeError } from "@/lib/errors";

export async function createProject(_prev: { error: string } | null, formData: FormData) {
  const { user } = await requireAuth();
  const name = formData.get("name") as string | null;

  if (!name || name.trim().length === 0) {
    return { error: "Project name is required." };
  }

  const hmacSecret = crypto.randomBytes(32).toString("hex");
  const admin = createAdminClient();

  const { data: project, error: projectError } = await admin
    .from(TABLE.PROJECTS)
    .insert({ name: name.trim(), hmac_secret: hmacSecret })
    .select("id")
    .single();

  if (projectError || !project) {
    return { error: sanitizeError(projectError) };
  }

  const { error: memberError } = await admin
    .from(TABLE.PROJECT_MEMBERS)
    .insert({
      project_id: project.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    // Rollback: delete the project if membership creation fails
    await admin.from(TABLE.PROJECTS).delete().eq("id", project.id);
    return { error: sanitizeError(memberError) };
  }

  redirect(`/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  await requireProjectAccess(projectId);
  const name = formData.get("name") as string | null;

  if (!name || name.trim().length === 0) {
    return { error: "Project name is required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(TABLE.PROJECTS)
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    return { error: sanitizeError(error) };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function deleteProject(projectId: string) {
  const { role } = await requireProjectAccess(projectId);

  if (role !== "owner") {
    return { error: "Only the project owner can delete a project." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(TABLE.PROJECTS)
    .delete()
    .eq("id", projectId);

  if (error) {
    return { error: sanitizeError(error) };
  }

  redirect("/projects");
}

export async function regenerateHmacSecret(projectId: string) {
  const { role } = await requireProjectAccess(projectId);

  if (role !== "owner" && role !== "admin") {
    return { error: "You do not have permission to regenerate the API key." };
  }

  const hmacSecret = crypto.randomBytes(32).toString("hex");
  const admin = createAdminClient();

  const { error } = await admin
    .from(TABLE.PROJECTS)
    .update({ hmac_secret: hmacSecret, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    return { error: sanitizeError(error) };
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}
