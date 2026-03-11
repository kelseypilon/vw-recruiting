import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import ProfileForm from "./profile-form";
import type { TeamUser } from "@/lib/types";

// Always serve fresh data (esp. after Google OAuth callback)
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user email
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

  if (!authUser?.email) {
    return (
      <div className="text-center py-12 text-[#a59494]">
        Unable to load profile. Please sign in again.
      </div>
    );
  }

  // Fetch full user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("email", authUser.email)
    .single();

  if (!profile) {
    return (
      <div className="text-center py-12 text-[#a59494]">
        User profile not found.
      </div>
    );
  }

  return (
    <Suspense>
      <ProfileForm user={profile as TeamUser} />
    </Suspense>
  );
}
