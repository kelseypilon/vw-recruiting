import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import CandidateProfile from "./candidate-profile";
import type {
  Candidate,
  PipelineStage,
  CandidateNote,
  StageHistoryEntry,
  EmailTemplate,
  TeamUser,
} from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const TEAM_ID = await getTeamId();

  // Fetch candidate, stages, notes, stage history, templates, and leaders in parallel
  const [
    candidateResult,
    stagesResult,
    notesResult,
    historyResult,
    templatesResult,
    usersResult,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("*")
      .eq("id", id)
      .eq("team_id", TEAM_ID)
      .single(),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("order_index"),
    supabase
      .from("candidate_notes")
      .select("*, author:users(name, email)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("stage_history")
      .select("*, changer:users(name)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_templates")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("users")
      .select(
        "id, team_id, name, email, role, from_email, google_booking_url, phone"
      )
      .eq("team_id", TEAM_ID),
  ]);

  if (!candidateResult.data) {
    notFound();
  }

  const candidate: Candidate = candidateResult.data;
  const stages: PipelineStage[] = stagesResult.data ?? [];
  const notes: CandidateNote[] = notesResult.data ?? [];
  const history: StageHistoryEntry[] = historyResult.data ?? [];
  const emailTemplates: EmailTemplate[] = templatesResult.data ?? [];
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];

  return (
    <CandidateProfile
      candidate={candidate}
      stages={stages}
      notes={notes}
      history={history}
      emailTemplates={emailTemplates}
      leaders={leaders}
      teamId={TEAM_ID}
    />
  );
}
