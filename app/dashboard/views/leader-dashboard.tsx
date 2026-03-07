"use client";

import Link from "next/link";

/* ── Types ─────────────────────────────────────────────────────── */

interface UpcomingInterview {
  id: string;
  candidateId: string;
  candidateName: string;
  type: string;
  interviewerName: string;
  scheduledAt: string;
  status: string;
}

interface OnboardingCandidate {
  candidateId: string;
  candidateName: string;
  completion: number;
  overdue: number;
}

interface TaskItem {
  candidateId: string;
  candidateName: string;
  type?: string;
  taskTitle?: string;
}

interface Props {
  orderedStages: { name: string; color: string | null }[];
  stageCounts: Record<string, number>;
  myInterviews: UpcomingInterview[];
  pendingScorecards: TaskItem[];
  myOnboardingCandidates: OnboardingCandidate[];
  overdueOnboarding: TaskItem[];
}

/* ── Helpers ────────────────────────────────────────────────────── */

const FALLBACK_COLORS: Record<string, string> = {
  "New Lead": "#6B7280",
  "Application Sent": "#3B82F6",
  "Under Review": "#8B5CF6",
  "Group Interview": "#F59E0B",
  "1on1 Interview": "#EF4444",
  Offer: "#10B981",
  Onboarding: "#059669",
  "Not a Fit": "#DC2626",
};

/* ── Component ──────────────────────────────────────────────────── */

export default function LeaderDashboard({
  orderedStages,
  stageCounts,
  myInterviews,
  pendingScorecards,
  myOnboardingCandidates,
  overdueOnboarding,
}: Props) {
  const maxStageCount = Math.max(...orderedStages.map((s) => stageCounts[s.name] ?? 0), 1);

  return (
    <div className="space-y-6">
      {/* ── RECRUITING SECTION ────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-velvet mb-4 flex items-center gap-2">
          <span>🎯</span> Recruiting
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Funnel (view only) */}
          <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
            <h4 className="text-sm font-semibold text-velvet mb-4">Pipeline Overview</h4>
            <div className="space-y-2.5">
              {orderedStages.map((stage) => {
                const count = stageCounts[stage.name] ?? 0;
                const color = stage.color ?? FALLBACK_COLORS[stage.name] ?? "#6B7280";
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-velvet">{stage.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-velvet">{count}</span>
                    </div>
                    <div className="h-2 bg-[#f5f0f0] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max((count / maxStageCount) * 100, count > 0 ? 4 : 0)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Upcoming Interviews + Missing Scorecards */}
          <div className="space-y-6">
            {/* My Interviews */}
            <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
              <h4 className="text-sm font-semibold text-velvet mb-4">My Interviews This Week</h4>
              {myInterviews.length === 0 ? (
                <p className="text-sm text-grey text-center py-6">No interviews scheduled</p>
              ) : (
                <div className="space-y-2">
                  {myInterviews.map((interview) => (
                    <Link
                      key={interview.id}
                      href={`/dashboard/candidates/${interview.candidateId}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-[#f5f0f0]/50 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-lapis/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-lapis">
                            {interview.candidateName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-velvet group-hover:text-lapis transition">
                            {interview.candidateName}
                          </p>
                          <p className="text-xs text-grey">{interview.type}</p>
                        </div>
                      </div>
                      <span className="text-xs text-grey whitespace-nowrap">
                        {new Date(interview.scheduledAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Missing Scorecards */}
            {pendingScorecards.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span>⚠️</span>
                  <h4 className="text-sm font-semibold text-velvet">Missing Scorecards</h4>
                  <span className="text-xs font-medium text-white bg-amber-500 px-2 py-0.5 rounded-full">
                    {pendingScorecards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingScorecards.map((sc, idx) => (
                    <Link
                      key={`${sc.candidateId}-${idx}`}
                      href={`/dashboard/candidates/${sc.candidateId}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-amber-50/50 transition group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs">📝</span>
                        <span className="text-sm font-medium text-velvet group-hover:text-lapis transition">
                          {sc.candidateName}
                        </span>
                      </div>
                      <span className="text-xs text-grey">{sc.type}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ONBOARDING SECTION ────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-velvet mb-4 flex items-center gap-2">
          <span>🚀</span> Onboarding
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Onboarding Candidates */}
          <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
            <h4 className="text-sm font-semibold text-velvet mb-4">Candidates I&apos;m Onboarding</h4>
            {myOnboardingCandidates.length === 0 ? (
              <p className="text-sm text-grey text-center py-6">No candidates in onboarding</p>
            ) : (
              <div className="space-y-3">
                {myOnboardingCandidates.map((c) => (
                  <Link
                    key={c.candidateId}
                    href={`/dashboard/candidates/${c.candidateId}`}
                    className="block p-3 rounded-lg hover:bg-[#f5f0f0]/50 transition group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-velvet group-hover:text-lapis transition">
                        {c.candidateName}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.overdue > 0 && (
                          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            {c.overdue} overdue
                          </span>
                        )}
                        <span className="text-xs font-semibold text-velvet">{c.completion}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#f5f0f0] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${c.completion}%`,
                          backgroundColor: c.completion === 100 ? "#10B981" : "var(--color-lapis)",
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Overdue Tasks Assigned to Me */}
          <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
            <h4 className="text-sm font-semibold text-velvet mb-4">My Overdue Tasks</h4>
            {overdueOnboarding.length === 0 ? (
              <p className="text-sm text-emerald-600 font-medium text-center py-6">
                No overdue tasks ✓
              </p>
            ) : (
              <div className="space-y-2">
                {overdueOnboarding.map((task, idx) => (
                  <Link
                    key={`${task.candidateId}-${idx}`}
                    href={`/dashboard/candidates/${task.candidateId}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-red-50/50 transition group"
                  >
                    <span className="text-sm shrink-0">🔴</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-velvet group-hover:text-lapis transition truncate">
                        {task.taskTitle}
                      </p>
                      <p className="text-xs text-grey truncate">
                        {task.candidateName}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
