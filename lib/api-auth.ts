import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verify that the request comes from an authenticated user.
 * Returns { userId, email, teamId } or null if not authenticated.
 */
export async function verifyAuth(): Promise<{
  userId: string;
  email: string;
  teamId: string;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    // Look up the user in our users table to get their team_id
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, team_id")
      .eq("email", user.email)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!profile) return null;

    return {
      userId: profile.id,
      email: user.email,
      teamId: profile.team_id,
    };
  } catch {
    return null;
  }
}

/**
 * Verify the user belongs to a specific team.
 */
export async function verifyTeamAccess(teamId: string): Promise<{
  userId: string;
  email: string;
  teamId: string;
} | null> {
  const auth = await verifyAuth();
  if (!auth) return null;
  if (auth.teamId !== teamId) return null;
  return auth;
}
