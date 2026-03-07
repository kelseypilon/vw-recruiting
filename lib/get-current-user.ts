import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import type { TeamUser } from "@/lib/types";

/**
 * Get the current authenticated user's profile from the users table.
 * Returns null if not authenticated or user record not found.
 */
export async function getCurrentUserProfile(): Promise<TeamUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const teamId = await getTeamId();

  // Look up user in the users table by auth email + team
  const { data } = await supabase
    .from("users")
    .select("id, team_id, name, email, role, from_email")
    .eq("team_id", teamId)
    .eq("email", user.email ?? "")
    .single();

  return (data as TeamUser) ?? null;
}
