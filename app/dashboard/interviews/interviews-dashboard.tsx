"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Interview,
  TeamUser,
  Team,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  interviews: Interview[];
  leaders: TeamUser[];
  teamId: string;
  team: Team | null;
  currentUserId: string;
}

/* ── Helpers ───────────────────────────────────────────────────── */

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: "bg-blue-100", text: "text-blue-800", label: "Scheduled" },
    completed: { bg: "bg-green-100", text: "text-green-800", label: "Completed" },
    cancelled: { bg: "bg-gray-100", text: "text-gray-600", label: "Cancelled" },
    no_show: { bg: "bg-red-100", text: "text-red-800", label: "No Show" },
  };
  return map[status] ?? { bg: "bg-gray-100", text: "text-gray-600", label: status };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Not scheduled";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── Main Component ────────────────────────────────────────────── */

export default function InterviewsDashboard({
  interviews: initialInterviews,
  leaders,
  teamId,
  team,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [interviews, setInterviews] = useState(initialInterviews);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");

  const filtered = interviews.filter((i) => {
    if (filter === "all") return true;
    return i.status === filter;
  });

  const upcoming = interviews.filter(
    (i) => i.status === "scheduled" && i.scheduled_at && new Date(i.scheduled_at) >= new Date()
  );
  const completedCount = interviews.filter((i) => i.status === "completed").length;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#272727]">Interviews</h2>
          <p className="text-sm text-[#a59494] mt-0.5">
            {upcoming.length} upcoming · {completedCount} completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
          >
            <option value="all">All Interviews</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Upcoming" value={upcoming.length} color="#3B82F6" />
        <StatCard label="Completed" value={completedCount} color="#10B981" />
        <StatCard label="Total" value={interviews.length} color="var(--brand-primary)" />
      </div>

      {/* Interview list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <p className="text-[#a59494] mb-2">No interviews found</p>
          <p className="text-xs text-[#a59494]">
            Interviews are created when candidates are moved to interview stages on the pipeline.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#a59494]/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Candidate
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#a59494]/10">
              {filtered.map((interview) => {
                const badge = statusBadge(interview.status);
                return (
                  <tr key={interview.id} className="hover:bg-[#f5f0f0]/50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-brand">
                            {interview.candidate?.first_name?.[0]}
                            {interview.candidate?.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#272727]">
                            {interview.candidate?.first_name} {interview.candidate?.last_name}
                          </p>
                          <p className="text-xs text-[#a59494]">
                            {interview.candidate?.role_applied ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#272727]">
                      {interview.interview_type}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#272727]">
                      {formatDate(interview.scheduled_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {interview.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => router.push(`/dashboard/candidates/${interview.candidate_id}`)}
                              className="text-xs font-medium text-brand hover:text-brand-dark transition"
                            >
                              Score
                            </button>
                            <button
                              onClick={async () => {
                                await fetch("/api/interviews", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "update_interview",
                                    payload: { id: interview.id, status: "completed" },
                                  }),
                                });
                                setInterviews((prev) =>
                                  prev.map((i) =>
                                    i.id === interview.id ? { ...i, status: "completed" as const } : i
                                  )
                                );
                              }}
                              className="text-xs font-medium text-green-600 hover:text-green-800 transition"
                            >
                              Complete
                            </button>
                          </>
                        )}
                        {interview.status === "completed" && (
                          <button
                            onClick={() => router.push(`/dashboard/candidates/${interview.candidate_id}`)}
                            className="text-xs font-medium text-brand hover:text-brand-dark transition"
                          >
                            View Scores
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <p className="text-xs font-medium text-[#a59494] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
