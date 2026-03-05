import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import OnboardingDashboard from "./onboarding-dashboard";
import type {
  Candidate,
  OnboardingTask,
  CandidateOnboarding,
} from "@/lib/types";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const TEAM_ID = await getTeamId();

  // Fetch candidates and tasks first
  const [candidatesResult, tasksResult] = await Promise.all([
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
  ]);

  const candidates: Candidate[] = candidatesResult.data ?? [];
  const tasks: OnboardingTask[] = tasksResult.data ?? [];

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
    />
  );
}
