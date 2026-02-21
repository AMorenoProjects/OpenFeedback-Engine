// @ts-ignore - Valid Deno jsr import
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Check if a nonce has been used and mark it in the database.
 * Returns `true` if the nonce is fresh, `false` if it's a replay.
 */
export async function checkAndMarkNonce(
  supabase: SupabaseClient,
  projectId: string,
  nonce: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("used_nonces")
    .insert([{ project_id: projectId, nonce }]);

  if (error) {
    // 23505 is the PostgreSQL error code for unique violation.
    // If the insert fails because the primary key already exists, it is a replay.
    if (error.code === "23505") {
      console.warn(`[Replay Attack Blocked] Nonce already used: ${nonce}`);
      return false;
    }
    // For other DB errors, we also fail secure to prevent bypassing the check.
    console.error(`[Nonce DB Error] Failed to insert nonce: ${error.message}`);
    return false;
  }

  return true;
}
