import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import DashboardShell from "./dashboard-shell";
import type { Candidate, Interview, NeedsAttentionItem } from "@/lib/types";

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

  // ── Needs Attention ─────────────────────────────────────────────
  const [teamSettingsResult, holdCandidatesResult, completedInterviewsResult, stuckCandidatesResult] =
    await Promise.all([
      // Team thresholds
      supabase
        .from("teams")
        .select("threshold_stuck_days, threshold_scorecard_hours")
        .eq("id", teamId)
        .single(),
      // Candidates on hold
      supabase
        .from("candidates")
        .select("id, first_name, last_name, kanban_hold_reason, updated_at")
        .eq("team_id", teamId)
        .eq("kanban_hold", true),
      // Completed interviews — we'll check for missing scorecards below
      supabase
        .from("interviews")
        .select(`
          id, candidate_id, interview_type, scheduled_at,
          candidate:candidates!inner(first_name, last_name),
          interviewers:interview_interviewers(user:users(name))
        `)
        .eq("team_id", teamId)
        .eq("status", "completed"),
      // Candidates stuck in interview stages
      supabase
        .from("candidates")
        .select("id, first_name, last_name, stage, created_at")
        .eq("team_id", teamId)
        .in("stage", ["Group Interview", "1on1 Interview"]),
    ]);

  const thresholdStuckDays = teamSettingsResult.data?.threshold_stuck_days ?? 7;
  const thresholdScorecardHours = teamSettingsResult.data?.threshold_scorecard_hours ?? 48;

  const needsAttention: NeedsAttentionItem[] = [];

  // 1) Hold candidates
  (holdCandidatesResult.data ?? []).forEach((c: { id: string; first_name: string; last_name: string; kanban_hold_reason: string | null; updated_at: string }) => {
    const daysSinceHold = Math.floor(
      (Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    needsAttention.push({
      id: `hold-${c.id}`,
      type: "hold",
      severity: daysSinceHold >= 7 ? "red" : "yellow",
      candidateId: c.id,
      candidateName: `${c.first_name} ${c.last_name}`,
      reason: c.kanban_hold_reason ?? "On hold — no reason specified",
      daysWaiting: daysSinceHold,
      href: `/dashboard/candidates/${c.id}`,
    });
  });

  // 2) Completed interviews without scorecards
  // Check each completed interview for a submitted scorecard in the interview_scorecards table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const i of (completedInterviewsResult.data ?? []) as any[]) {
    const refTime = i.scheduled_at as string | null;
    if (!refTime) continue;

    const hoursSince = Math.floor(
      (Date.now() - new Date(refTime).getTime()) / (1000 * 60 * 60)
    );
    if (hoursSince < thresholdScorecardHours) continue;

    // Check if any submitted scorecard exists for this interview
    const { data: scorecards } = await supabase
      .from("interview_scorecards")
      .select("id")
      .eq("interview_id", i.id)
      .not("submitted_at", "is", null)
      .limit(1);

    if (scorecards && scorecards.length > 0) continue; // scorecard exists

    const daysSince = Math.floor(hoursSince / 24);
    // Supabase !inner join returns object for many-to-one; handle both shapes
    const cand = Array.isArray(i.candidate) ? i.candidate[0] : i.candidate;
    const interviewer = i.interviewers?.[0];
    const interviewerUser = interviewer?.user
      ? (Array.isArray(interviewer.user) ? interviewer.user[0] : interviewer.user)
      : null;

    needsAttention.push({
      id: `scorecard-${i.id}`,
      type: "no_scorecard",
      severity: hoursSince >= thresholdScorecardHours * 2 ? "red" : "yellow",
      candidateId: i.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      reason: `No scorecard after ${i.interview_type} — ${daysSince}d overdue`,
      daysWaiting: daysSince,
      interviewerName: interviewerUser?.name ?? undefined,
      href: `/dashboard/candidates/${i.candidate_id}`,
    });
  }

  // 3) Stuck candidates in interview stages
  // Use stage_history to find when each candidate entered their current stage
  for (const c of (stuckCandidatesResult.data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    stage: string;
    created_at: string;
  }>) {
    // Find latest stage_history entry for the candidate's current stage
    const { data: stageEntry } = await supabase
      .from("stage_history")
      .select("created_at")
      .eq("candidate_id", c.id)
      .eq("to_stage", c.stage)
      .order("created_at", { ascending: false })
      .limit(1);

    const enteredAt = stageEntry?.[0]?.created_at ?? c.created_at;
    const daysInStage = Math.floor(
      (Date.now() - new Date(enteredAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysInStage < thresholdStuckDays) continue;

    needsAttention.push({
      id: `stuck-${c.id}`,
      type: "stuck",
      severity: daysInStage >= thresholdStuckDays + 7 ? "red" : "yellow",
      candidateId: c.id,
      candidateName: `${c.first_name} ${c.last_name}`,
      reason: `Stuck in ${c.stage} for ${daysInStage} days`,
      daysWaiting: daysInStage,
      href: `/dashboard/candidates/${c.id}`,
    });
  }

  // Sort: red items first, then by days waiting descending
  needsAttention.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return b.daysWaiting - a.daysWaiting;
  });

  return (
    <DashboardShell
      stats={stats}
      recentCandidates={recentCandidates}
      upcomingInterviews={upcomingInterviews}
      stageCounts={stageCounts}
      needsAttention={needsAttention}
    />
  );
}
