import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import OnboardingDashboard from "./onboarding-dashboard";
import type {
  Candidate,
  OnboardingTask,
  CandidateOnboarding,
  EmailTemplate,
  TeamUser,
  Team,
} from "@/lib/types";

export default async function OnboardingPage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Fetch candidates, tasks, templates, users, and team in parallel
  const [candidatesResult, tasksResult, templatesResult, usersResult, teamResult] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*")
        .eq("team_id", TEAM_ID)
        .eq("stage", "Onboarding"),
      supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("team_id", TEAM_ID)
        .eq("is_active", true)
        .order("order_index"),
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
        .from("teams")
        .select("*")
        .eq("id", TEAM_ID)
        .single(),
    ]);

  const candidates: Candidate[] = candidatesResult.data ?? [];
  const tasks: OnboardingTask[] = tasksResult.data ?? [];
  const emailTemplates: EmailTemplate[] = templatesResult.data ?? [];
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const team: Team | null = (teamResult.data as Team) ?? null;

  // Fetch progress scoped to these candidates
  const candidateIds = candidates.map((c) => c.id);
  let progress: CandidateOnboarding[] = [];
  if (candidateIds.length > 0) {
    const { data } = await supabase
      .from("candidate_onboarding")
      .select("*, task:onboarding_tasks(*), assignee:users(name)")
      .in("candidate_id", candidateIds)
      .order("created_at");
    progress = (data ?? []) as CandidateOnboarding[];
  }

  return (
    <OnboardingDashboard
      candidates={candidates}
      tasks={tasks}
      progress={progress}
      teamId={TEAM_ID}
      emailTemplates={emailTemplates}
      leaders={leaders}
      team={team}
    />
  );
}
