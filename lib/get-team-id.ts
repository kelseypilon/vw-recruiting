import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

export async function getTeamId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieTeamId = cookieStore.get("vw_team_id")?.value;
  if (cookieTeamId) return cookieTeamId;

  // Fallback: resolve from authenticated user's record
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("users")
        .select("team_id")
        .eq("email", user.email)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (profile?.team_id) return profile.team_id;
    }
  } catch {
    // Auth lookup failed — fall through to hardcoded default
  }

  return DEFAULT_TEAM_ID;
}
