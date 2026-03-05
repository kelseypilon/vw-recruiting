import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import DashboardShell from "./dashboard-shell";
import type { Candidate, Interview } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const teamId = await getTeamId();

  // Calculate this week's date range
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const [
    totalResult,
    reviewResult,
    interviewsWeekResult,
    onboardingResult,
    recentCandidatesResult,
    upcomingInterviewsResult,
    stageCountsResult,
  ] = await Promise.all([
    // Total candidates
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId),
    // Under Review count
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("stage", "Under Review"),
    // Interviews scheduled this week
    supabase
      .from("interviews")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "scheduled")
      .gte("scheduled_at", startOfWeek.toISOString())
      .lt("scheduled_at", endOfWeek.toISOString()),
    // Onboarding count
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("stage", "Onboarding"),
    // Recent candidates (last 5)
    supabase
      .from("candidates")
      .select("id, first_name, last_name, stage, composite_score, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(5),
    // Upcoming interviews (next 5)
    supabase
      .from("interviews")
      .select("*, candidate:candidates(first_name, last_name, role_applied, stage)")
      .eq("team_id", teamId)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    // Stage distribution for pipeline chart
    supabase
      .from("candidates")
      .select("stage")
      .eq("team_id", teamId),
  ]);

  const stats = {
    totalCandidates: totalResult.count ?? 0,
    underReview: reviewResult.count ?? 0,
    interviewsThisWeek: interviewsWeekResult.count ?? 0,
    onboarding: onboardingResult.count ?? 0,
  };

  const recentCandidates = (recentCandidatesResult.data ?? []) as Candidate[];
  const upcomingInterviews = (upcomingInterviewsResult.data ?? []) as Interview[];

  // Build stage distribution
  const stageData = stageCountsResult.data ?? [];
  const stageCounts: Record<string, number> = {};
  stageData.forEach((row: { stage: string }) => {
    stageCounts[row.stage] = (stageCounts[row.stage] ?? 0) + 1;
  });

  return (
    <DashboardShell
      stats={stats}
      recentCandidates={recentCandidates}
      upcomingInterviews={upcomingInterviews}
      stageCounts={stageCounts}
    />
  );
}
