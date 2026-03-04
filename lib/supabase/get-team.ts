import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get the authenticated user's team_id from the users table.
 * Returns null if the user has no profile or isn't authenticated.
 * Does NOT redirect — callers handle the fallback.
 */
export async function getTeamId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single();

  return profile?.team_id ?? null;
}
