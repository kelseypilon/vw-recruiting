import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./dashboard-shell";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch stats from the database
  const [totalResult, reviewResult, interviewResult, onboardingResult] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("stage", "Under Review"),
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("stage", "Group Interview")
        .or("stage.eq.1on1 Interview"),
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("stage", "Onboarding"),
    ]);

  const stats = {
    totalCandidates: totalResult.count ?? 0,
    underReview: reviewResult.count ?? 0,
    interviewsThisWeek: interviewResult.count ?? 0,
    onboarding: onboardingResult.count ?? 0,
  };

  return <DashboardShell email={user.email ?? ""} stats={stats} />;
}
