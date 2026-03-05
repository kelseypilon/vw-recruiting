import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CandidateProfile from "./candidate-profile";
import type {
  Candidate,
  PipelineStage,
  CandidateNote,
  StageHistoryEntry,
  EmailTemplate,
} from "@/lib/types";

// TODO: look up from authenticated user's profile once users table is populated
const TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch candidate, stages, notes, and stage history in parallel
  const [candidateResult, stagesResult, notesResult, historyResult, templatesResult] =
    await Promise.all([
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
    ]);

  if (!candidateResult.data) {
    notFound();
  }

  const candidate: Candidate = candidateResult.data;
  const stages: PipelineStage[] = stagesResult.data ?? [];
  const notes: CandidateNote[] = notesResult.data ?? [];
  const history: StageHistoryEntry[] = historyResult.data ?? [];
  const emailTemplates: EmailTemplate[] = templatesResult.data ?? [];

  return (
    <CandidateProfile
      candidate={candidate}
      stages={stages}
      notes={notes}
      history={history}
      emailTemplates={emailTemplates}
      teamId={TEAM_ID}
    />
  );
}
