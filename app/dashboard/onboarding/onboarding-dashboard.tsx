"use client";

import { useState } from "react";
import type {
  Candidate,
  OnboardingTask,
  CandidateOnboarding,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  candidates: Candidate[];
  tasks: OnboardingTask[];
  progress: CandidateOnboarding[];
  teamId: string;
}

/* ── Main Component ────────────────────────────────────────────── */

export default function OnboardingDashboard({
  candidates,
  tasks,
  progress: initialProgress,
  teamId,
}: Props) {
  const [progress, setProgress] = useState(initialProgress);
  const [selectedCandidate, setSelectedCandidate] = useState<string>(
    candidates[0]?.id ?? ""
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState("");

  const candidate = candidates.find((c) => c.id === selectedCandidate);
  const candidateProgress = progress.filter(
    (p) => p.candidate_id === selectedCandidate
  );

  // Build a map of task_id -> progress entry for the selected candidate
  const progressMap = new Map<string, CandidateOnboarding>();
  candidateProgress.forEach((p) => progressMap.set(p.task_id, p));

  const completedCount = candidateProgress.filter((p) => p.completed_at).length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  // Initialize onboarding for a candidate (create entries for all tasks)
  async function handleInitialize() {
    if (!selectedCandidate || isInitializing) return;
    setIsInitializing(true);
    setInitError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initialize",
          candidate_id: selectedCandidate,
          task_ids: tasks.map((t) => t.id),
        }),
      });
      const result = await res.json();

      if (result.error) {
        setInitError(result.error);
      } else if (result.data) {
        setProgress((prev) => [
          ...prev.filter((p) => p.candidate_id !== selectedCandidate),
          ...(result.data as CandidateOnboarding[]),
        ]);
      }
    } catch {
      setInitError("Network error — please try again");
    }
    setIsInitializing(false);
  }

  // Toggle task completion
  async function handleToggleTask(taskId: string) {
    const existing = progressMap.get(taskId);
    if (!existing) return;

    const newCompleted = existing.completed_at ? null : new Date().toISOString();

    // Optimistic update
    setProgress((prev) =>
      prev.map((p) =>
        p.id === existing.id ? { ...p, completed_at: newCompleted } : p
      )
    );

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          entry_id: existing.id,
          completed_at: newCompleted,
        }),
      });
      const result = await res.json();

      if (result.error) {
        // Revert on error
        setProgress((prev) =>
          prev.map((p) =>
            p.id === existing.id
              ? { ...p, completed_at: existing.completed_at }
              : p
          )
        );
      }
    } catch {
      // Revert on network error
      setProgress((prev) =>
        prev.map((p) =>
          p.id === existing.id
            ? { ...p, completed_at: existing.completed_at }
            : p
        )
      );
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#272727]">Onboarding</h2>
          <p className="text-sm text-[#a59494] mt-0.5">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} in onboarding
          </p>
        </div>
      </div>

      {/* Alert if no onboarding tasks are configured */}
      {tasks.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">No onboarding tasks configured</p>
              <p className="text-xs text-amber-700 mt-1">
                Run the onboarding tasks seed migration (20260304000005) in your Supabase SQL Editor to add 14 default tasks.
                The tasks must exist in the <code className="bg-amber-100 px-1 rounded">onboarding_tasks</code> table with matching <code className="bg-amber-100 px-1 rounded">team_id</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f5f0f0] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a59494" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="text-[#a59494] mb-1">No candidates in onboarding yet</p>
          <p className="text-sm text-[#a59494]">
            Move candidates to the Onboarding stage to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: candidate selector */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-[#272727] mb-3">Candidates</h3>
              <div className="space-y-2">
                {candidates.map((c) => {
                  const cProgress = progress.filter(
                    (p) => p.candidate_id === c.id
                  );
                  const cCompleted = cProgress.filter(
                    (p) => p.completed_at
                  ).length;
                  const cTotal = cProgress.length || totalTasks;
                  const cPercent = cTotal > 0 ? (cCompleted / cTotal) * 100 : 0;
                  const isSelected = c.id === selectedCandidate;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCandidate(c.id)}
                      className={`w-full text-left p-3 rounded-lg transition ${
                        isSelected
                          ? "bg-[#1c759e]/10 border border-[#1c759e]/30"
                          : "hover:bg-[#f5f0f0] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1c759e] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">
                            {c.first_name[0]}
                            {c.last_name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#272727] truncate">
                            {c.first_name} {c.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-[#f5f0f0] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#10B981] rounded-full transition-all"
                                style={{ width: `${cPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#a59494] whitespace-nowrap">
                              {cCompleted}/{cTotal}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: task checklist */}
          <div className="lg:col-span-3">
            {candidate && (
              <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
                {/* Candidate header */}
                <div className="px-6 py-4 border-b border-[#a59494]/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#272727]">
                        {candidate.first_name} {candidate.last_name}
                      </h3>
                      <p className="text-sm text-[#a59494]">
                        {candidate.role_applied ?? "Agent"} · Onboarding
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#1c759e]">
                        {Math.round(progressPercent)}%
                      </p>
                      <p className="text-xs text-[#a59494]">
                        {completedCount} of {totalTasks} tasks
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-[#f5f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor:
                          progressPercent === 100 ? "#10B981" : "#1c759e",
                      }}
                    />
                  </div>
                </div>

                {/* Tasks */}
                <div className="px-6 py-4">
                  {initError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm text-red-700">{initError}</p>
                    </div>
                  )}

                  {candidateProgress.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-[#a59494] mb-3">
                        Onboarding hasn&apos;t been started yet
                      </p>
                      <button
                        onClick={handleInitialize}
                        disabled={isInitializing}
                        className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] text-white text-sm font-semibold transition disabled:opacity-50"
                      >
                        {isInitializing
                          ? "Initializing..."
                          : `Initialize ${totalTasks} Tasks`}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const entry = progressMap.get(task.id);
                        const isCompleted = !!entry?.completed_at;

                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition ${
                              isCompleted
                                ? "bg-green-50/50"
                                : "hover:bg-[#f5f0f0]/50"
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleTask(task.id)}
                              disabled={!entry}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                                isCompleted
                                  ? "bg-[#10B981] border-[#10B981]"
                                  : "border-[#a59494]/40 hover:border-[#1c759e]"
                              } disabled:opacity-40`}
                            >
                              {isCompleted && (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="3"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>

                            {/* Task info */}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${
                                  isCompleted
                                    ? "text-[#a59494] line-through"
                                    : "text-[#272727]"
                                }`}
                              >
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-[#a59494]">
                                  {task.owner_role}
                                </span>
                                {task.timing && (
                                  <>
                                    <span className="text-[10px] text-[#a59494]">
                                      ·
                                    </span>
                                    <span className="text-[10px] text-[#a59494]">
                                      {task.timing}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Completed date */}
                            {isCompleted && entry?.completed_at && (
                              <span className="text-xs text-[#10B981] whitespace-nowrap">
                                {new Date(entry.completed_at).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
