import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import GroupInterviewsDashboard from "./group-interviews-dashboard";
import type { Candidate, TeamUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GroupInterviewsPage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user to resolve current user ID
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

  // Look up dynamic stage names by ghl_tag
  const { data: taggedStages } = await supabase
    .from("pipeline_stages")
    .select("name, ghl_tag")
    .eq("team_id", TEAM_ID)
    .eq("is_active", true)
    .in("ghl_tag", ["vw_group_interview", "vw_1on1_interview"]);

  const stageByTag = (tag: string, fallback: string) =>
    taggedStages?.find((s: { ghl_tag: string }) => s.ghl_tag === tag)?.name ?? fallback;

  const groupInterviewName = stageByTag("vw_group_interview", "Group Interview");
  const oneOnOneName = stageByTag("vw_1on1_interview", "1on1 Interview");

  const [candidatesResult, usersResult, profileResult, teamResult] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, first_name, last_name, email, role_applied, stage")
      .eq("team_id", TEAM_ID)
      .in("stage", [groupInterviewName, oneOnOneName, "Under Review"]),
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
      .select("group_interview_date, settings")
      .eq("id", TEAM_ID)
      .single(),
  ]);

  const eligibleCandidates: Candidate[] =
    (candidatesResult.data ?? []) as Candidate[];
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const currentUserId: string = profileResult.data?.id ?? "";

  const teamSettings = (teamResult.data?.settings ?? {}) as Record<string, unknown>;
  const teamDefaultMeetingLink = (teamSettings.default_meeting_link as string) ?? null;

  return (
    <GroupInterviewsDashboard
      eligibleCandidates={eligibleCandidates}
      leaders={leaders}
      teamId={TEAM_ID}
      currentUserId={currentUserId}
      teamDefaultMeetingLink={teamDefaultMeetingLink}
    />
  );
}
