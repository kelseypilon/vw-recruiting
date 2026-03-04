import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./dashboard-shell";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single();

  const teamId = profile?.team_id;
  if (!teamId) redirect("/login");

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
