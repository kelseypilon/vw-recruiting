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

  const [stagesResult, candidatesResult, profileResult, usersResult, sessionsResult, teamResult, stageHistoryResult] = await Promise.all([
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
    // Fetch the most recent stage transition per candidate for accurate daysInStage
    adminSupabase
      .from("stage_history")
      .select("candidate_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const stages: PipelineStage[] = stagesResult.data ?? [];
  const candidates: Candidate[] = candidatesResult.data ?? [];
  const currentUserId = profileResult.data?.id ?? "";
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const upcomingSessions: GroupInterviewSession[] = (sessionsResult.data ?? []) as GroupInterviewSession[];
  const teamZoomLink: string | null = teamResult.data?.group_interview_zoom_link ?? null;
  const businessUnits: string[] = (teamResult.data?.business_units as string[] | null) ?? ["Residential", "Commercial"];

  // Build map of candidate_id -> most recent stage transition date
  const stageHistoryMap = new Map<string, string>();
  for (const entry of stageHistoryResult.data ?? []) {
    // First entry per candidate (ordered desc) is the most recent
    if (!stageHistoryMap.has(entry.candidate_id)) {
      stageHistoryMap.set(entry.candidate_id, entry.created_at);
    }
  }

  const now = new Date();
  const candidateCards: CandidateCard[] = candidates.map((c) => {
    // Use the most recent stage transition date, or fall back to created_at
    const stageEnteredAt = stageHistoryMap.get(c.id) ?? c.created_at;
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
