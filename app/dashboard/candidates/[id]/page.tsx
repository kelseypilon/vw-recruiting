import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import CandidateProfile from "./candidate-profile";
import type {
  Candidate,
  PipelineStage,
  CandidateNote,
  StageHistoryEntry,
  EmailTemplate,
  TeamUser,
  OnboardingTask,
  CandidateOnboarding,
  Team,
} from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Fetch candidate, stages, notes, stage history, templates, leaders, onboarding data, and team in parallel
  const [
    candidateResult,
    stagesResult,
    notesResult,
    historyResult,
    templatesResult,
    usersResult,
    tasksResult,
    onboardingResult,
    teamResult,
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
        "id, team_id, name, email, role, from_email"
      )
      .eq("team_id", TEAM_ID),
    supabase
      .from("onboarding_tasks")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("order_index"),
    supabase
      .from("candidate_onboarding")
      .select("*, task:onboarding_tasks(*)")
      .eq("candidate_id", id),
    supabase
      .from("teams")
      .select("*")
      .eq("id", TEAM_ID)
      .single(),
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
  const onboardingTasks: OnboardingTask[] = tasksResult.data ?? [];
  const onboardingProgress: CandidateOnboarding[] =
    (onboardingResult.data ?? []) as CandidateOnboarding[];
  const team: Team | null = (teamResult.data as Team) ?? null;

  return (
    <CandidateProfile
      candidate={candidate}
      stages={stages}
      notes={notes}
      history={history}
      emailTemplates={emailTemplates}
      leaders={leaders}
      teamId={TEAM_ID}
      onboardingTasks={onboardingTasks}
      onboardingProgress={onboardingProgress}
      team={team}
    />
  );
}
