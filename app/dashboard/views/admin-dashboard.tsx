"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { NeedsAttentionItem } from "@/lib/types";

/* ── Types ─────────────────────────────────────────────────────── */

interface Stats {
  activeCandidates: number;
  interviewsThisWeek: number;
  onboardingCompletion: number;
  overdueTasks: number;
}

interface ActivityItem {
  id: string;
  type: "stage_move" | "note" | "scorecard" | "email";
  candidateId: string;
  candidateName: string;
  description: string;
  timestamp: string;
}

interface UpcomingInterview {
  id: string;
  candidateId: string;
  candidateName: string;
  type: string;
  interviewerName: string;
  scheduledAt: string;
  status: string;
}

interface CandidateStageRow {
  stage: string;
  hire_track: string;
  is_isa: boolean;
}

interface Props {
  stats: Stats;
  needsAttention: NeedsAttentionItem[];
  orderedStages: { name: string; color: string | null }[];
  stageCounts: Record<string, number>;
  conversionRates: Record<string, number>;
  activityFeed: ActivityItem[];
  upcomingInterviews: UpcomingInterview[];
  candidateStageRows?: CandidateStageRow[];
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

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  stage_move: { bg: "bg-blue-50", text: "text-blue-600", icon: "↗️" },
  note: { bg: "bg-amber-50", text: "text-amber-600", icon: "📝" },
  scorecard: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "✅" },
  email: { bg: "bg-purple-50", text: "text-purple-600", icon: "📧" },
};

/* ── Component ──────────────────────────────────────────────────── */

export default function AdminDashboard({
  stats,
  needsAttention,
  orderedStages,
  stageCounts,
  conversionRates,
  activityFeed,
  upcomingInterviews,
  candidateStageRows,
}: Props) {
  const [hireTrackFilter, setHireTrackFilter] = useState<"all" | "agent" | "employee">("all");

  // Compute filtered stage counts based on hire track toggle
  const filteredStageCounts = useMemo(() => {
    if (hireTrackFilter === "all" || !candidateStageRows) return stageCounts;
    const counts: Record<string, number> = {};
    for (const row of candidateStageRows) {
      if (row.hire_track === hireTrackFilter || row.hire_track === "all" || row.hire_track === "both") {
        counts[row.stage] = (counts[row.stage] ?? 0) + 1;
      }
    }
    return counts;
  }, [hireTrackFilter, candidateStageRows, stageCounts]);

  // Recompute conversion rates for filtered counts
  const filteredConversionRates = useMemo(() => {
    if (hireTrackFilter === "all") return conversionRates;
    const rates: Record<string, number> = {};
    for (let i = 0; i < orderedStages.length - 1; i++) {
      const current = filteredStageCounts[orderedStages[i].name] ?? 0;
      const next = filteredStageCounts[orderedStages[i + 1].name] ?? 0;
      rates[orderedStages[i].name] = current > 0 ? Math.round((next / current) * 100) : 0;
    }
    return rates;
  }, [hireTrackFilter, filteredStageCounts, orderedStages, conversionRates]);

  // ISA count badge
  const isaCount = useMemo(() => {
    if (!candidateStageRows) return 0;
    return candidateStageRows.filter((r) => r.is_isa).length;
  }, [candidateStageRows]);

  // Compute filtered active count
  const filteredActiveCount = useMemo(() => {
    if (hireTrackFilter === "all" || !candidateStageRows) return stats.activeCandidates;
    const excluded = new Set(["Not a Fit", "Archived"]);
    return candidateStageRows.filter(
      (r) =>
        !excluded.has(r.stage) &&
        (r.hire_track === hireTrackFilter || r.hire_track === "all" || r.hire_track === "both")
    ).length;
  }, [hireTrackFilter, candidateStageRows, stats.activeCandidates]);

  const statCards = [
    {
      label: "Active Candidates",
      value: filteredActiveCount,
      color: "var(--color-lapis)",
      href: "/dashboard/candidates",
    },
    {
      label: "Interviews This Week",
      value: stats.interviewsThisWeek,
      color: "#F59E0B",
      href: "/dashboard/interviews",
    },
    {
      label: "Onboarding Completion",
      value: `${stats.onboardingCompletion}%`,
      color: "#10B981",
      href: "/dashboard/onboarding",
    },
    {
      label: "Overdue Tasks",
      value: stats.overdueTasks,
      color: stats.overdueTasks > 0 ? "#EF4444" : "#10B981",
      href: "/dashboard/onboarding",
    },
  ];

  const maxStageCount = Math.max(...orderedStages.map((s) => filteredStageCounts[s.name] ?? 0), 1);

  return (
    <>
      {/* ── Hire Track Toggle + ISA Badge ──────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(["all", "agent", "employee"] as const).map((track) => (
            <button
              key={track}
              onClick={() => setHireTrackFilter(track)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                hireTrackFilter === track
                  ? "bg-lapis text-white"
                  : "bg-white border border-[#a59494]/20 text-[#272727] hover:bg-[#f5f0f0]"
              }`}
            >
              {track === "all" ? "All" : track === "agent" ? "Agent" : "Employee"}
            </button>
          ))}
        </div>
        {isaCount > 0 && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
            ISA Candidates: {isaCount}
          </span>
        )}
      </div>

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-grey">{card.label}</span>
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: card.color }}
              />
            </div>
            <p className="text-3xl font-bold text-velvet group-hover:text-lapis transition">
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      {/* ── 3-column layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* LEFT — Needs Attention (hidden when empty) */}
        {needsAttention.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🔔</span>
            <h3 className="text-sm font-semibold text-velvet">Needs Attention</h3>
            <span className="text-xs font-medium text-white bg-red-500 px-2 py-0.5 rounded-full">
              {needsAttention.length}
            </span>
          </div>

          <div className="space-y-1.5">
              {needsAttention.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-[#f5f0f0]/50 transition group"
                >
                  <span className="text-sm shrink-0">
                    {item.severity === "red" ? "🔴" : "⚠️"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-velvet group-hover:text-lapis transition truncate">
                      {item.candidateName}
                    </p>
                    <p className="text-xs text-grey truncate">
                      {item.reason}
                      {item.interviewerName && (
                        <span className="ml-1 opacity-70">
                          — {item.interviewerName}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      item.severity === "red"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.daysWaiting}d
                  </span>
                </Link>
              ))}
              {needsAttention.length > 8 && (
                <Link
                  href="/dashboard/candidates"
                  className="block text-xs text-center text-lapis font-medium pt-2 hover:underline"
                >
                  View all {needsAttention.length} items →
                </Link>
              )}
            </div>
        </div>
        )}

        {/* MIDDLE — Pipeline Funnel */}
        <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-velvet">Pipeline Funnel</h3>
            <Link
              href="/dashboard/candidates"
              className="text-xs font-medium text-lapis hover:text-lapis-dark transition"
            >
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {orderedStages.map((stage) => {
              const count = filteredStageCounts[stage.name] ?? 0;
              const color = stage.color ?? FALLBACK_COLORS[stage.name] ?? "#6B7280";
              const rate = filteredConversionRates[stage.name];
              return (
                <div key={stage.name}>
                  <Link
                    href="/dashboard/candidates"
                    className="block hover:bg-[#f5f0f0]/30 rounded-lg p-1 -m-1 transition"
                  >
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
                  </Link>
                  {rate !== undefined && (
                    <div className="flex justify-end pr-1 mt-0.5">
                      <span className="text-[10px] text-grey">{rate}% →</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Activity Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
          <h3 className="text-sm font-semibold text-velvet mb-4">Activity Feed</h3>

          {activityFeed.length === 0 ? (
            <p className="text-sm text-grey text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-1">
              {activityFeed.map((item) => {
                const style = ACTIVITY_COLORS[item.type] ?? ACTIVITY_COLORS.note;
                return (
                  <Link
                    key={item.id}
                    href={`/dashboard/candidates/${item.candidateId}`}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[#f5f0f0]/50 transition group"
                  >
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${style.bg}`}
                    >
                      {style.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-velvet group-hover:text-lapis transition">
                        <span className="font-medium">{item.candidateName}</span>
                      </p>
                      <p className="text-[11px] text-grey truncate">{item.description}</p>
                    </div>
                    <span className="text-[10px] text-grey whitespace-nowrap shrink-0 pt-0.5">
                      {relativeTime(item.timestamp)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom — Upcoming Interviews ───────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-velvet">
            Upcoming Interviews
            <span className="ml-2 text-xs font-normal text-grey">Next 7 days</span>
          </h3>
          <Link
            href="/dashboard/interviews"
            className="text-xs font-medium text-lapis hover:text-lapis-dark transition"
          >
            View All
          </Link>
        </div>

        {upcomingInterviews.length === 0 ? (
          <p className="text-sm text-grey text-center py-8">No interviews scheduled this week</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#a59494]/10">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-grey uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-grey uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-grey uppercase tracking-wider">
                    Interviewer
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-grey uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-grey uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#a59494]/10">
                {upcomingInterviews.map((interview) => (
                  <tr
                    key={interview.id}
                    className="hover:bg-[#f5f0f0]/50 transition cursor-pointer"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/dashboard/candidates/${interview.candidateId}`}
                        className="flex items-center gap-2 hover:text-lapis transition"
                      >
                        <div className="w-7 h-7 rounded-full bg-lapis/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-lapis">
                            {interview.candidateName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-velvet">
                          {interview.candidateName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-velvet">
                      {interview.type}
                    </td>
                    <td className="px-3 py-3 text-sm text-grey">
                      {interview.interviewerName}
                    </td>
                    <td className="px-3 py-3 text-sm text-velvet">
                      {new Date(interview.scheduledAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {interview.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
