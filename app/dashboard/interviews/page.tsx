import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import InterviewsDashboard from "./interviews-dashboard";
import type {
  Interview,
  ScoringCriterion,
  Candidate,
  TeamUser,
  EmailTemplate,
} from "@/lib/types";

export default async function InterviewsPage() {
  const supabase = await createClient();
  const TEAM_ID = await getTeamId();

  const [interviewsResult, criteriaResult, candidatesResult, usersResult, templatesResult] =
    await Promise.all([
      supabase
        .from("interviews")
        .select(
          "*, candidate:candidates(first_name, last_name, role_applied, stage)"
        )
        .eq("team_id", TEAM_ID)
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("scoring_criteria")
        .select("*")
        .eq("team_id", TEAM_ID)
        .order("order_index"),
      supabase
        .from("candidates")
        .select("id, first_name, last_name, email, role_applied, stage")
        .eq("team_id", TEAM_ID)
        .in("stage", ["Group Interview", "1on1 Interview", "Under Review"]),
      supabase
        .from("users")
        .select("id, team_id, name, email, role, from_email, google_booking_url, phone")
        .eq("team_id", TEAM_ID),
      supabase
        .from("email_templates")
        .select("*")
        .eq("team_id", TEAM_ID)
        .eq("is_active", true),
    ]);

  const interviews: Interview[] = interviewsResult.data ?? [];
  const criteria: ScoringCriterion[] = criteriaResult.data ?? [];
  const eligibleCandidates: Candidate[] =
    (candidatesResult.data ?? []) as Candidate[];
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const emailTemplates: EmailTemplate[] =
    (templatesResult.data ?? []) as EmailTemplate[];

  return (
    <InterviewsDashboard
      interviews={interviews}
      criteria={criteria}
      eligibleCandidates={eligibleCandidates}
      leaders={leaders}
      emailTemplates={emailTemplates}
      teamId={TEAM_ID}
    />
  );
}
