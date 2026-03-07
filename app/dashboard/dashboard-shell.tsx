"use client";

import Link from "next/link";
import type { Candidate, Interview } from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Stats {
  totalCandidates: number;
  underReview: number;
  interviewsThisWeek: number;
  onboarding: number;
}

interface Props {
  stats: Stats;
  recentCandidates: Candidate[];
  upcomingInterviews: Interview[];
  stageCounts: Record<string, number>;
}

/* ── Stage colors ──────────────────────────────────────────────── */

const STAGE_COLORS: Record<string, string> = {
  "New Lead": "#6B7280",
  "Application Sent": "#3B82F6",
  "Under Review": "#8B5CF6",
  "Group Interview": "#F59E0B",
  "1on1 Interview": "#EF4444",
  Offer: "#10B981",
  Onboarding: "#059669",
  "Not a Fit": "#DC2626",
};

/* ── Main Component ────────────────────────────────────────────── */

export default function DashboardShell({
  stats,
  recentCandidates,
  upcomingInterviews,
  stageCounts,
}: Props) {
  const statCards = [
    {
      label: "Total Candidates",
      value: stats.totalCandidates,
      color: "var(--brand-primary)",
      href: "/dashboard/candidates",
    },
    {
      label: "Under Review",
      value: stats.underReview,
      color: "#8B5CF6",
      href: "/dashboard/candidates",
    },
    {
      label: "Interviews This Week",
      value: stats.interviewsThisWeek,
      color: "#F59E0B",
      href: "/dashboard/interviews",
    },
    {
      label: "In Onboarding",
      value: stats.onboarding,
      color: "#10B981",
      href: "/dashboard/onboarding",
    },
  ];

  // Pipeline data for chart
  const pipelineStages = [
    "New Lead",
    "Application Sent",
    "Under Review",
    "Group Interview",
    "1on1 Interview",
    "Offer",
    "Onboarding",
  ];
  const maxStageCount = Math.max(
    ...pipelineStages.map((s) => stageCounts[s] ?? 0),
    1
  );

  return (
    <>
      <h2 className="text-2xl font-bold text-[#272727] mb-6">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#a59494]">
                {card.label}
              </span>
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: card.color }}
              />
            </div>
            <p className="text-3xl font-bold text-[#272727] group-hover:text-brand transition">
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#272727]">
              Pipeline Distribution
            </h3>
            <Link
              href="/dashboard/candidates"
              className="text-xs font-medium text-brand hover:text-brand-dark transition"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const count = stageCounts[stage] ?? 0;
              const color = STAGE_COLORS[stage] ?? "#6B7280";
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-[#272727]">{stage}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#272727]">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 bg-[#f5f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(count / maxStageCount) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent candidates */}
        <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#272727]">
              Recent Candidates
            </h3>
            <Link
              href="/dashboard/candidates"
              className="text-xs font-medium text-brand hover:text-brand-dark transition"
            >
              View All
            </Link>
          </div>
          {recentCandidates.length === 0 ? (
            <p className="text-sm text-[#a59494] text-center py-6">
              No candidates yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentCandidates.map((c) => {
                const stageColor = STAGE_COLORS[c.stage] ?? "#6B7280";
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/candidates/${c.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#f5f0f0]/50 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">
                        {c.first_name[0]}
                        {c.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#272727] truncate">
                        {c.first_name} {c.last_name}
                      </p>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: stageColor + "20",
                          color: stageColor,
                        }}
                      >
                        {c.stage}
                      </span>
                    </div>
                    {c.composite_score !== null && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.composite_score >= 80
                            ? "bg-green-100 text-green-800"
                            : c.composite_score >= 60
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {Number(c.composite_score).toFixed(0)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming interviews */}
        <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#272727]">
              Upcoming Interviews
            </h3>
            <Link
              href="/dashboard/interviews"
              className="text-xs font-medium text-brand hover:text-brand-dark transition"
            >
              View All
            </Link>
          </div>
          {upcomingInterviews.length === 0 ? (
            <p className="text-sm text-[#a59494] text-center py-6">
              No upcoming interviews scheduled
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#a59494]/10">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                      Scheduled
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#a59494]/10">
                  {upcomingInterviews.map((interview) => (
                    <tr
                      key={interview.id}
                      className="hover:bg-[#f5f0f0]/50 transition"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-brand">
                              {interview.candidate?.first_name?.[0]}
                              {interview.candidate?.last_name?.[0]}
                            </span>
                          </div>
                          <span className="text-sm text-[#272727]">
                            {interview.candidate?.first_name}{" "}
                            {interview.candidate?.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-[#272727]">
                        {interview.interview_type}
                      </td>
                      <td className="px-3 py-3 text-sm text-[#272727]">
                        {interview.scheduled_at
                          ? new Date(interview.scheduled_at).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              }
                            )
                          : "TBD"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
