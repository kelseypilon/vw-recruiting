import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import AdminDashboard from "./views/admin-dashboard";
import LeaderDashboard from "./views/leader-dashboard";
import YourTasksToday from "./views/your-tasks-today";
import type { NeedsAttentionItem } from "@/lib/types";

/* ── helpers ──────────────────────────────────────────────────── */

function weekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7)); // Monday
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 7);
  return { start: mon.toISOString(), end: sun.toISOString() };
}

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function hoursAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

/* ── page ─────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const teamId = await getTeamId();
  const week = weekRange();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(now.getDate() + 7);

  // ── Resolve current user ────────────────────────────────────
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = authUser?.email
    ? await admin
        .from("users")
        .select("id, role, name, email")
        .eq("team_id", teamId)
        .eq("email", authUser.email)
        .eq("is_active", true)
        .single()
    : { data: null };

  const userId = profile?.id ?? "";
  const userRole = profile?.role ?? "member";
  const isAdmin = userRole === "owner" || userRole === "leader"; // "owner" = admin; leaders also get elevated access

  // ── Look up dynamic stage names by ghl_tag ─────────────────
  const { data: taggedStages } = await admin
    .from("pipeline_stages")
    .select("name, ghl_tag")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .in("ghl_tag", ["vw_not_fit", "vw_group_interview", "vw_1on1_interview"]);

  const stageByTag = (tag: string, fallback: string) =>
    taggedStages?.find((s: { ghl_tag: string }) => s.ghl_tag === tag)?.name ?? fallback;

  const notAFitName = stageByTag("vw_not_fit", "Not a Fit");
  const groupInterviewName = stageByTag("vw_group_interview", "Group Interview");
  const oneOnOneName = stageByTag("vw_1on1_interview", "1on1 Interview");

  // ── Parallel data fetch ─────────────────────────────────────
  const excludedStages = [notAFitName, "Archived"];

  const [
    activeCandidatesResult,
    interviewsWeekResult,
    onboardingTasksResult,
    stageCountsResult,
    upcomingInterviewsResult,
    teamResult,
    todayInterviewsResult,
    myOnboardingTasksResult,
    myScorecardResult,
    holdCandidatesResult,
    completedInterviewsResult,
    stuckCandidatesResult,
    recentStageMovesResult,
    recentNotesResult,
    recentScorecardEventsResult,
    pipelineStagesResult,
  ] = await Promise.all([
    // 1. Active candidates (not archived/not-a-fit/not onboarding)
    admin
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .not("stage", "in", `(${excludedStages.join(",")})`),

    // 2. Interviews this week
    admin
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .in("status", ["scheduled", "completed"])
      .gte("scheduled_at", week.start)
      .lt("scheduled_at", week.end),

    // 3. Onboarding data for completion %
    admin
      .from("candidate_onboarding")
      .select("candidate_id, completed_at, due_date, assigned_user_id, task:onboarding_tasks!inner(title)")
      .eq("task.team_id", teamId),

    // 4. Stage counts for funnel (include hire_track + is_isa for filtering)
    admin
      .from("candidates")
      .select("stage, hire_track, is_isa")
      .eq("team_id", teamId),

    // 5. Upcoming interviews next 7 days (admin table)
    admin
      .from("interviews")
      .select(`
        id, candidate_id, interview_type, scheduled_at, status,
        candidate:candidates!inner(first_name, last_name),
        interviewers:interview_interviewers(user:users(id, name))
      `)
      .eq("team_id", teamId)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", sevenDaysOut.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(15),

    // 6. Team thresholds
    admin
      .from("teams")
      .select("threshold_stuck_days, threshold_scorecard_hours")
      .eq("id", teamId)
      .single(),

    // 7. Today's interviews assigned to me (Your Tasks Today)
    admin
      .from("interview_interviewers")
      .select(`
        interview:interviews!inner(
          id, candidate_id, interview_type, scheduled_at, status,
          candidate:candidates!inner(first_name, last_name)
        )
      `)
      .eq("user_id", userId)
      .gte("interview.scheduled_at", todayStart.toISOString())
      .lt("interview.scheduled_at", todayEnd.toISOString())
      .eq("interview.status", "scheduled"),

    // 8. My overdue / due-today onboarding tasks
    admin
      .from("candidate_onboarding")
      .select(`
        id, due_date, completed_at,
        task:onboarding_tasks!inner(title),
        candidate:candidates!inner(id, first_name, last_name)
      `)
      .eq("assigned_user_id", userId)
      .is("completed_at", null)
      .lte("due_date", todayEnd.toISOString()),

    // 9. Completed interviews where I haven't submitted a scorecard
    admin
      .from("interview_interviewers")
      .select(`
        interview:interviews!inner(
          id, candidate_id, interview_type, scheduled_at, status,
          candidate:candidates!inner(first_name, last_name)
        )
      `)
      .eq("user_id", userId)
      .eq("interview.status", "completed"),

    // 10. Hold candidates (Needs Attention)
    admin
      .from("candidates")
      .select("id, first_name, last_name, kanban_hold_reason, created_at, stage")
      .eq("team_id", teamId)
      .eq("kanban_hold", true),

    // 11. Completed interviews for scorecard check
    admin
      .from("interviews")
      .select(`
        id, candidate_id, interview_type, scheduled_at,
        candidate:candidates!inner(first_name, last_name),
        interviewers:interview_interviewers(user:users(id, name))
      `)
      .eq("team_id", teamId)
      .eq("status", "completed"),

    // 12. Stuck candidates (in interview stages)
    admin
      .from("candidates")
      .select("id, first_name, last_name, stage, created_at")
      .eq("team_id", teamId)
      .in("stage", [groupInterviewName, oneOnOneName]),

    // 13. Recent stage moves (activity feed)
    admin
      .from("stage_history")
      .select("id, candidate_id, from_stage, to_stage, created_at, changer:users(name), candidate:candidates!inner(first_name, last_name)")
      .eq("candidate.team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(20),

    // 14. Recent notes (activity feed)
    admin
      .from("candidate_notes")
      .select("id, candidate_id, created_at, author:users!inner(name), candidate:candidates!inner(first_name, last_name)")
      .eq("candidate.team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(10),

    // 15. Recent scorecards submitted (activity feed)
    admin
      .from("interview_scorecards")
      .select("id, candidate_id, submitted_at, evaluator:users(name), candidate:candidates!inner(first_name, last_name)")
      .eq("team_id", teamId)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(10),

    // 16. Pipeline stages (ordered)
    admin
      .from("pipeline_stages")
      .select("name, order_index, color")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("order_index"),
  ]);

  // ── Derived data ────────────────────────────────────────────

  const thresholdStuckDays = teamResult.data?.threshold_stuck_days ?? 7;
  const thresholdScorecardHours = teamResult.data?.threshold_scorecard_hours ?? 48;

  // Stage counts & ordered stages
  const stageRows = (stageCountsResult.data ?? []) as Array<{ stage: string; hire_track: string; is_isa: boolean }>;
  const stageCounts: Record<string, number> = {};
  for (const row of stageRows) {
    stageCounts[row.stage] = (stageCounts[row.stage] ?? 0) + 1;
  }
  const orderedStages: { name: string; color: string | null }[] = (pipelineStagesResult.data ?? []).map(
    (s: { name: string; color: string | null }) => ({ name: s.name, color: s.color })
  );

  // Onboarding completion %
  const onboardingRows = onboardingTasksResult.data ?? [];
  const onboardingByCand: Record<string, { total: number; done: number }> = {};
  for (const r of onboardingRows as Array<{ candidate_id: string; completed_at: string | null }>) {
    if (!onboardingByCand[r.candidate_id]) onboardingByCand[r.candidate_id] = { total: 0, done: 0 };
    onboardingByCand[r.candidate_id].total++;
    if (r.completed_at) onboardingByCand[r.candidate_id].done++;
  }
  const onboardingCandidates = Object.values(onboardingByCand);
  const avgCompletion = onboardingCandidates.length > 0
    ? Math.round(onboardingCandidates.reduce((s, c) => s + (c.done / c.total) * 100, 0) / onboardingCandidates.length)
    : 0;

  // Overdue onboarding tasks
  const todayStr = now.toISOString().split("T")[0];
  const overdueCount = onboardingRows.filter(
    (r: { completed_at: string | null; due_date: string | null }) => !r.completed_at && r.due_date && r.due_date < todayStr
  ).length;

  // ── Your Tasks Today ───────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayInterviews: Array<{ candidateId: string; candidateName: string; type: string }> = [];
  for (const row of (todayInterviewsResult.data ?? []) as any[]) {
    const interview = Array.isArray(row.interview) ? row.interview[0] : row.interview;
    if (!interview) continue;
    const cand = Array.isArray(interview.candidate) ? interview.candidate[0] : interview.candidate;
    todayInterviews.push({
      candidateId: interview.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      type: interview.interview_type,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overdueOnboarding: Array<{ candidateId: string; candidateName: string; taskTitle: string }> = [];
  for (const row of (myOnboardingTasksResult.data ?? []) as any[]) {
    const cand = Array.isArray(row.candidate) ? row.candidate[0] : row.candidate;
    const task = Array.isArray(row.task) ? row.task[0] : row.task;
    overdueOnboarding.push({
      candidateId: cand?.id ?? "",
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      taskTitle: task?.title ?? "Task",
    });
  }

  // Missing scorecards for me
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingScorecards: Array<{ candidateId: string; candidateName: string; type: string }> = [];
  for (const row of (myScorecardResult.data ?? []) as any[]) {
    const interview = Array.isArray(row.interview) ? row.interview[0] : row.interview;
    if (!interview) continue;
    // Check if I already submitted a scorecard for this interview
    const { data: existingCard } = await admin
      .from("interview_scorecards")
      .select("id")
      .eq("interview_id", interview.id)
      .eq("interviewer_user_id", userId)
      .not("submitted_at", "is", null)
      .limit(1);
    if (existingCard && existingCard.length > 0) continue;
    const cand = Array.isArray(interview.candidate) ? interview.candidate[0] : interview.candidate;
    pendingScorecards.push({
      candidateId: interview.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      type: interview.interview_type,
    });
  }

  // ── Needs Attention (admin) ─────────────────────────────────

  const needsAttention: NeedsAttentionItem[] = [];

  // Hold candidates
  for (const c of (holdCandidatesResult.data ?? []) as Array<{
    id: string; first_name: string; last_name: string; kanban_hold_reason: string | null; created_at: string;
  }>) {
    const days = daysAgo(c.created_at);
    needsAttention.push({
      id: `hold-${c.id}`,
      type: "hold",
      severity: days >= 7 ? "red" : "yellow",
      candidateId: c.id,
      candidateName: `${c.first_name} ${c.last_name}`,
      reason: c.kanban_hold_reason ?? "On hold — no reason specified",
      daysWaiting: days,
      href: `/dashboard/candidates/${c.id}`,
    });
  }

  // Completed interviews without scorecards
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const i of (completedInterviewsResult.data ?? []) as any[]) {
    const refTime = i.scheduled_at as string | null;
    if (!refTime) continue;
    const hours = hoursAgo(refTime);
    if (hours < thresholdScorecardHours) continue;

    const { data: scorecards } = await admin
      .from("interview_scorecards")
      .select("id")
      .eq("interview_id", i.id)
      .not("submitted_at", "is", null)
      .limit(1);
    if (scorecards && scorecards.length > 0) continue;

    const days = Math.floor(hours / 24);
    const cand = Array.isArray(i.candidate) ? i.candidate[0] : i.candidate;
    const interviewer = i.interviewers?.[0];
    const interviewerUser = interviewer?.user
      ? (Array.isArray(interviewer.user) ? interviewer.user[0] : interviewer.user)
      : null;

    needsAttention.push({
      id: `scorecard-${i.id}`,
      type: "no_scorecard",
      severity: hours >= thresholdScorecardHours * 2 ? "red" : "yellow",
      candidateId: i.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      reason: `No scorecard after ${i.interview_type} — ${days}d overdue`,
      daysWaiting: days,
      interviewerName: interviewerUser?.name ?? undefined,
      href: `/dashboard/candidates/${i.candidate_id}`,
    });
  }

  // Stuck candidates
  for (const c of (stuckCandidatesResult.data ?? []) as Array<{
    id: string; first_name: string; last_name: string; stage: string; created_at: string;
  }>) {
    const { data: stageEntry } = await admin
      .from("stage_history")
      .select("created_at")
      .eq("candidate_id", c.id)
      .eq("to_stage", c.stage)
      .order("created_at", { ascending: false })
      .limit(1);

    const enteredAt = stageEntry?.[0]?.created_at ?? c.created_at;
    const days = daysAgo(enteredAt);
    if (days < thresholdStuckDays) continue;

    needsAttention.push({
      id: `stuck-${c.id}`,
      type: "stuck",
      severity: days >= thresholdStuckDays + 7 ? "red" : "yellow",
      candidateId: c.id,
      candidateName: `${c.first_name} ${c.last_name}`,
      reason: `Stuck in ${c.stage} for ${days} days`,
      daysWaiting: days,
      href: `/dashboard/candidates/${c.id}`,
    });
  }

  needsAttention.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return b.daysWaiting - a.daysWaiting;
  });

  // ── Activity feed ───────────────────────────────────────────

  type ActivityItem = {
    id: string;
    type: "stage_move" | "note" | "scorecard" | "email";
    candidateId: string;
    candidateName: string;
    description: string;
    timestamp: string;
  };

  const activityFeed: ActivityItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (recentStageMovesResult.data ?? []) as any[]) {
    const cand = Array.isArray(r.candidate) ? r.candidate[0] : r.candidate;
    const changer = Array.isArray(r.changer) ? r.changer[0] : r.changer;
    activityFeed.push({
      id: `stage-${r.id}`,
      type: "stage_move",
      candidateId: r.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      description: `${changer?.name ?? "System"} moved to ${r.to_stage}`,
      timestamp: r.created_at,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (recentNotesResult.data ?? []) as any[]) {
    const cand = Array.isArray(r.candidate) ? r.candidate[0] : r.candidate;
    const author = Array.isArray(r.author) ? r.author[0] : r.author;
    activityFeed.push({
      id: `note-${r.id}`,
      type: "note",
      candidateId: r.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      description: `${author?.name ?? "Unknown"} added a note`,
      timestamp: r.created_at,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (recentScorecardEventsResult.data ?? []) as any[]) {
    const cand = Array.isArray(r.candidate) ? r.candidate[0] : r.candidate;
    const evaluator = Array.isArray(r.evaluator) ? r.evaluator[0] : r.evaluator;
    activityFeed.push({
      id: `scorecard-evt-${r.id}`,
      type: "scorecard",
      candidateId: r.candidate_id,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      description: `${evaluator?.name ?? "Unknown"} submitted scorecard`,
      timestamp: r.submitted_at,
    });
  }

  activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const activityFeedSlice = activityFeed.slice(0, 15);

  // ── Upcoming interviews table ───────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcomingInterviews = ((upcomingInterviewsResult.data ?? []) as any[]).map((i) => {
    const cand = Array.isArray(i.candidate) ? i.candidate[0] : i.candidate;
    const interviewer = i.interviewers?.[0];
    const interviewerUser = interviewer?.user
      ? (Array.isArray(interviewer.user) ? interviewer.user[0] : interviewer.user)
      : null;
    return {
      id: i.id as string,
      candidateId: i.candidate_id as string,
      candidateName: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      type: i.interview_type as string,
      interviewerName: interviewerUser?.name ?? "Unassigned",
      scheduledAt: i.scheduled_at as string,
      status: i.status as string,
    };
  });

  // ── Leader-specific data ────────────────────────────────────

  // My upcoming interviews (leader)
  const myInterviews = upcomingInterviews.filter((i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (upcomingInterviewsResult.data ?? []) as any[];
    const match = raw.find((r) => r.id === i.id);
    if (!match) return false;
    return match.interviewers?.some((iv: { user: { id: string } | { id: string }[] }) => {
      const u = Array.isArray(iv.user) ? iv.user[0] : iv.user;
      return u?.id === userId;
    });
  });

  // Onboarding candidates assigned to me (leader)
  const myOnboardingCandidates: Array<{
    candidateId: string;
    candidateName: string;
    completion: number;
    overdue: number;
  }> = [];

  // Group by candidate for my assigned tasks
  const myTasksByCand: Record<string, { name: string; total: number; done: number; overdue: number }> = {};
  for (const row of onboardingRows as Array<{
    candidate_id: string; completed_at: string | null; due_date: string | null; assigned_user_id: string | null;
  }>) {
    if (row.assigned_user_id !== userId) continue;
    if (!myTasksByCand[row.candidate_id]) {
      myTasksByCand[row.candidate_id] = { name: "", total: 0, done: 0, overdue: 0 };
    }
    myTasksByCand[row.candidate_id].total++;
    if (row.completed_at) myTasksByCand[row.candidate_id].done++;
    if (!row.completed_at && row.due_date && row.due_date < todayStr) {
      myTasksByCand[row.candidate_id].overdue++;
    }
  }

  // Lookup candidate names for my onboarding list
  const myOnboardingCandIds = Object.keys(myTasksByCand);
  if (myOnboardingCandIds.length > 0) {
    const { data: candNames } = await admin
      .from("candidates")
      .select("id, first_name, last_name")
      .in("id", myOnboardingCandIds);
    for (const c of candNames ?? []) {
      const entry = myTasksByCand[c.id];
      if (!entry) continue;
      myOnboardingCandidates.push({
        candidateId: c.id,
        candidateName: `${c.first_name} ${c.last_name}`,
        completion: entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0,
        overdue: entry.overdue,
      });
    }
  }

  // ── Conversion rates for funnel ─────────────────────────────

  const conversionRates: Record<string, number> = {};
  for (let i = 0; i < orderedStages.length - 1; i++) {
    const current = stageCounts[orderedStages[i].name] ?? 0;
    const next = stageCounts[orderedStages[i + 1].name] ?? 0;
    conversionRates[orderedStages[i].name] = current > 0 ? Math.round((next / current) * 100) : 0;
  }

  // ── Stats ───────────────────────────────────────────────────

  const stats = {
    activeCandidates: activeCandidatesResult.count ?? 0,
    interviewsThisWeek: interviewsWeekResult.count ?? 0,
    onboardingCompletion: avgCompletion,
    overdueTasks: overdueCount,
  };

  // ── Render ──────────────────────────────────────────────────

  const tasksToday = {
    interviews: todayInterviews,
    onboarding: overdueOnboarding,
    scorecards: pendingScorecards,
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-velvet mb-6">Dashboard</h2>

      <YourTasksToday tasks={tasksToday} />

      {isAdmin ? (
        <AdminDashboard
          stats={stats}
          needsAttention={needsAttention}
          orderedStages={orderedStages}
          stageCounts={stageCounts}
          conversionRates={conversionRates}
          activityFeed={activityFeedSlice}
          upcomingInterviews={upcomingInterviews}
          candidateStageRows={stageRows}
        />
      ) : (
        <LeaderDashboard
          orderedStages={orderedStages}
          stageCounts={stageCounts}
          myInterviews={myInterviews}
          pendingScorecards={pendingScorecards}
          myOnboardingCandidates={myOnboardingCandidates}
          overdueOnboarding={overdueOnboarding}
        />
      )}
    </>
  );
}
