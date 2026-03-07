import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import KanbanBoard from "./kanban-board";
import type { PipelineStage, Candidate, CandidateCard, TeamUser, GroupInterviewSession } from "@/lib/types";

export default async function CandidatesPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const teamId = await getTeamId();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const [stagesResult, candidatesResult, profileResult, usersResult, sessionsResult, teamResult] = await Promise.all([
    adminSupabase
      .from("pipeline_stages")
      .select("*")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("order_index"),
    adminSupabase.from("candidates").select("*").eq("team_id", teamId),
    authUser?.email
      ? adminSupabase
          .from("users")
          .select("id")
          .eq("team_id", teamId)
          .eq("email", authUser.email)
          .single()
      : Promise.resolve({ data: null }),
    adminSupabase
      .from("users")
      .select("id, team_id, name, email, role, from_email, google_booking_url")
      .eq("team_id", teamId),
    adminSupabase
      .from("group_interview_sessions")
      .select("*")
      .eq("team_id", teamId)
      .eq("status", "upcoming")
      .order("session_date", { ascending: true }),
    adminSupabase
      .from("teams")
      .select("group_interview_zoom_link, business_units")
      .eq("id", teamId)
      .single(),
  ]);

  // Log any query errors (server component — logs to server console)
  if (stagesResult.error) console.error("Failed to load stages:", stagesResult.error.message);
  if (candidatesResult.error) console.error("Failed to load candidates:", candidatesResult.error.message);
  if (usersResult.error) console.error("Failed to load users:", usersResult.error.message);

  const stages: PipelineStage[] = stagesResult.data ?? [];
  const candidates: Candidate[] = candidatesResult.data ?? [];
  const currentUserId = profileResult.data?.id ?? "";
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const upcomingSessions: GroupInterviewSession[] = (sessionsResult.data ?? []) as GroupInterviewSession[];
  const teamZoomLink: string | null = teamResult.data?.group_interview_zoom_link ?? null;
  const businessUnits: string[] = (teamResult.data?.business_units as string[] | null) ?? ["Residential", "Commercial"];

  const now = new Date();
  const candidateCards: CandidateCard[] = candidates.map((c) => {
    // Use stage_entered_at (backfilled by migration), fall back to created_at
    const stageEnteredAt = c.stage_entered_at ?? c.created_at;
    return {
      ...c,
      daysInStage: Math.max(
        1,
        Math.floor(
          (now.getTime() - new Date(stageEnteredAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      ),
    };
  });

  return (
    <KanbanBoard
      stages={stages}
      candidates={candidateCards}
      teamId={teamId}
      currentUserId={currentUserId}
      leaders={leaders}
      upcomingSessions={upcomingSessions}
      teamZoomLink={teamZoomLink}
      businessUnits={businessUnits}
    />
  );
}
