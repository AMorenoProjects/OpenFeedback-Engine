/** Sanitize Supabase/Postgres errors into user-safe messages. */
export function sanitizeError(error: { message?: string; code?: string } | null): string {
  if (!error) return "An unexpected error occurred.";

  const knownCodes: Record<string, string> = {
    "23505": "This record already exists.",
    "23503": "Referenced record not found.",
    "42501": "You do not have permission to perform this action.",
    PGRST116: "Record not found.",
  };

  if (error.code && error.code in knownCodes) {
    return knownCodes[error.code]!;
  }

  return "An unexpected error occurred.";
}
