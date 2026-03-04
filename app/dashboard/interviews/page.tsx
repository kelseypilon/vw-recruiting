import { createClient } from "@/lib/supabase/server";
import InterviewsDashboard from "./interviews-dashboard";
import type { Interview, ScoringCriterion, Candidate } from "@/lib/types";

const TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

export default async function InterviewsPage() {
  const supabase = await createClient();

  const [interviewsResult, criteriaResult, candidatesResult] = await Promise.all([
    supabase
      .from("interviews")
      .select("*, candidate:candidates(first_name, last_name, role_applied, stage)")
      .eq("team_id", TEAM_ID)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("scoring_criteria")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("order_index"),
    supabase
      .from("candidates")
      .select("id, first_name, last_name, role_applied, stage")
      .eq("team_id", TEAM_ID)
      .in("stage", ["Group Interview", "1on1 Interview", "Under Review"]),
  ]);

  const interviews: Interview[] = interviewsResult.data ?? [];
  const criteria: ScoringCriterion[] = criteriaResult.data ?? [];
  const eligibleCandidates: Candidate[] = (candidatesResult.data ?? []) as Candidate[];

  return (
    <InterviewsDashboard
      interviews={interviews}
      criteria={criteria}
      eligibleCandidates={eligibleCandidates}
      teamId={TEAM_ID}
    />
  );
}
