import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import KanbanBoard from "./kanban-board";
import type { PipelineStage, Candidate, CandidateCard } from "@/lib/types";

export default async function CandidatesPage() {
  const supabase = await createClient();
  const teamId = await getTeamId();

  const [stagesResult, candidatesResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("order_index"),
    supabase.from("candidates").select("*").eq("team_id", teamId),
  ]);

  const stages: PipelineStage[] = stagesResult.data ?? [];
  const candidates: Candidate[] = candidatesResult.data ?? [];

  const now = new Date();
  const candidateCards: CandidateCard[] = candidates.map((c) => ({
    ...c,
    daysInStage: Math.max(
      1,
      Math.floor(
        (now.getTime() - new Date(c.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    ),
  }));

  return <KanbanBoard stages={stages} candidates={candidateCards} teamId={teamId} />;
}
