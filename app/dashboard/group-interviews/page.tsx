import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import GroupInterviewsDashboard from "./group-interviews-dashboard";
import type { Candidate, TeamUser } from "@/lib/types";

export default async function GroupInterviewsPage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user to resolve current user ID
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

  const [candidatesResult, usersResult, profileResult, teamResult] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, first_name, last_name, email, role_applied, stage")
      .eq("team_id", TEAM_ID)
      .in("stage", ["Group Interview", "1on1 Interview", "Under Review"]),
    supabase
      .from("users")
      .select("id, team_id, name, email, role, from_email")
      .eq("team_id", TEAM_ID),
    authUser?.email
      ? supabase
          .from("users")
          .select("id")
          .eq("team_id", TEAM_ID)
          .eq("email", authUser.email)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("teams")
      .select("group_interview_zoom_link, group_interview_date")
      .eq("id", TEAM_ID)
      .single(),
  ]);

  const eligibleCandidates: Candidate[] =
    (candidatesResult.data ?? []) as Candidate[];
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const currentUserId: string = profileResult.data?.id ?? "";

  return (
    <GroupInterviewsDashboard
      eligibleCandidates={eligibleCandidates}
      leaders={leaders}
      teamId={TEAM_ID}
      currentUserId={currentUserId}
      teamZoomLink={teamResult.data?.group_interview_zoom_link ?? null}
      teamInterviewDate={teamResult.data?.group_interview_date ?? null}
    />
  );
}
