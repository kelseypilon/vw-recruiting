import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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
  OnboardingTask,
  CandidateOnboarding,
  Team,
  Interview,
  InterviewScorecard,
  InterviewQuestion,
  CandidateGroupSession,
  GroupInterviewNote,
} from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user to resolve current user ID
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

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
    interviewsResult,
    scorecardsResult,
    questionsResult,
    profileResult,
    groupSessionsResult,
    groupNotesResult,
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
      .select("id, team_id, name, email, role, from_email")
      .eq("team_id", TEAM_ID),
    supabase
      .from("onboarding_tasks")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("order_index"),
    supabase
      .from("candidate_onboarding")
      .select("*, task:onboarding_tasks(*), assigned_user:users!candidate_onboarding_assigned_user_id_fkey(name)")
      .eq("candidate_id", id),
    supabase.from("teams").select("*").eq("id", TEAM_ID).single(),
    supabase
      .from("interviews")
      .select(
        "*, candidate:candidates(first_name, last_name, role_applied, stage)"
      )
      .eq("team_id", TEAM_ID)
      .eq("candidate_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("interview_scorecards")
      .select(
        "*, evaluator:users!interview_scorecards_interviewer_user_id_fkey(name, scorecard_visibility)"
      )
      .eq("candidate_id", id)
      .eq("team_id", TEAM_ID),
    supabase
      .from("interview_questions")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("category")
      .order("sort_order"),
    authUser?.email
      ? supabase
          .from("users")
          .select("id")
          .eq("team_id", TEAM_ID)
          .eq("email", authUser.email)
          .single()
      : Promise.resolve({ data: null }),
    // Group interview sessions this candidate participated in
    supabase
      .from("group_interview_candidates")
      .select(
        "session_id, session:group_interview_sessions(id, title, session_date, status, created_by, creator:users!group_interview_sessions_created_by_fkey(name))"
      )
      .eq("candidate_id", id),
    // Group interview notes for this candidate
    supabase
      .from("group_interview_notes")
      .select("*, author:users!group_interview_notes_author_user_id_fkey(name)")
      .eq("candidate_id", id)
      .order("updated_at", { ascending: false }),
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
  const interviews: Interview[] = (interviewsResult.data ?? []) as Interview[];
  const scorecards: InterviewScorecard[] =
    (scorecardsResult.data ?? []) as InterviewScorecard[];
  const allQuestions: InterviewQuestion[] =
    (questionsResult.data ?? []) as InterviewQuestion[];
  const currentUserId: string = profileResult.data?.id ?? "";

  // Load user's personal question set (fall back to all questions if none)
  let interviewQuestions = allQuestions;
  if (currentUserId) {
    const { data: selections } = await supabase
      .from("interviewer_question_selections")
      .select("*, question:interview_questions(*)")
      .eq("user_id", currentUserId)
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("sort_order");

    if (selections && selections.length > 0) {
      interviewQuestions = selections
        .map((s: { question: InterviewQuestion | null }) => s.question)
        .filter(Boolean) as InterviewQuestion[];
    }
  }
  const groupSessions: CandidateGroupSession[] =
    (groupSessionsResult.data ?? []) as unknown as CandidateGroupSession[];
  const groupNotes: GroupInterviewNote[] =
    (groupNotesResult.data ?? []) as GroupInterviewNote[];

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
      interviews={interviews}
      scorecards={scorecards}
      interviewQuestions={interviewQuestions}
      currentUserId={currentUserId}
      groupSessions={groupSessions}
      groupNotes={groupNotes}
    />
  );
}
