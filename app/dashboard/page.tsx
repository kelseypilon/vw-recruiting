import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./dashboard-shell";

// TODO: look up from authenticated user's profile once users table is populated
const TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

export default async function DashboardPage() {
  const supabase = await createClient();
  const teamId = TEAM_ID;

  const [totalResult, reviewResult, interviewResult, onboardingResult] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId),
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("stage", "Under Review"),
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId)
        .in("stage", ["Group Interview", "1on1 Interview"]),
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("stage", "Onboarding"),
    ]);

  const stats = {
    totalCandidates: totalResult.count ?? 0,
    underReview: reviewResult.count ?? 0,
    interviewsThisWeek: interviewResult.count ?? 0,
    onboarding: onboardingResult.count ?? 0,
  };

  return <DashboardShell stats={stats} />;
}
