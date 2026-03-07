import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import SettingsDashboard from "./settings-dashboard";
import type {
  Team,
  TeamUser,
  PipelineStage,
  EmailTemplate,
  ScoringCriterion,
  InterviewQuestion,
  OnboardingTask,
  GroupInterviewPrompt,
  InterestedInOption,
} from "@/lib/types";

export default async function SettingsPage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user to resolve current user ID
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

  const [
    teamResult,
    usersResult,
    stagesResult,
    templatesResult,
    criteriaResult,
    questionsResult,
    profileResult,
    onboardingTasksResult,
    groupPromptsResult,
    interestedInResult,
  ] = await Promise.all([
    supabase.from("teams").select("*").eq("id", TEAM_ID).single(),
    supabase.from("users").select("*").eq("team_id", TEAM_ID).order("name"),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("order_index"),
    supabase
      .from("email_templates")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("name"),
    supabase
      .from("scoring_criteria")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("order_index"),
    supabase
      .from("interview_questions")
      .select("*")
      .eq("team_id", TEAM_ID)
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
    supabase
      .from("onboarding_tasks")
      .select("*, default_assignee:users!onboarding_tasks_default_assignee_id_fkey(name)")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("order_index"),
    supabase
      .from("group_interview_prompts")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("order_index"),
    supabase
      .from("interested_in_options")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("order_index"),
  ]);

  const currentUserId = profileResult.data?.id ?? "";

  return (
    <SettingsDashboard
      team={(teamResult.data as Team) ?? null}
      users={(usersResult.data as TeamUser[]) ?? []}
      stages={(stagesResult.data as PipelineStage[]) ?? []}
      templates={(templatesResult.data as EmailTemplate[]) ?? []}
      criteria={(criteriaResult.data as ScoringCriterion[]) ?? []}
      interviewQuestions={(questionsResult.data as InterviewQuestion[]) ?? []}
      onboardingTasks={(onboardingTasksResult.data as OnboardingTask[]) ?? []}
      groupInterviewPrompts={(groupPromptsResult.data as GroupInterviewPrompt[]) ?? []}
      interestedInOptions={(interestedInResult.data as InterestedInOption[]) ?? []}
      teamId={TEAM_ID}
      currentUserId={currentUserId}
    />
  );
}
