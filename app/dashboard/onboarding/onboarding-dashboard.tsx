"use client";

import { useState } from "react";
import OnboardingTaskList from "./onboarding-task-list";
import OnboardingEmailModal from "./onboarding-email-modal";
import { usePermissions } from "@/lib/user-permissions-context";
import type {
  Candidate,
  OnboardingTask,
  CandidateOnboarding,
  EmailTemplate,
  TeamUser,
  Team,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  candidates: Candidate[];
  tasks: OnboardingTask[];
  progress: CandidateOnboarding[];
  teamId: string;
  emailTemplates: EmailTemplate[];
  leaders: TeamUser[];
  team: Team | null;
}

/* ── Main Component ────────────────────────────────────────────── */

export default function OnboardingDashboard({
  candidates: initialCandidates,
  tasks,
  progress: initialProgress,
  teamId,
  emailTemplates,
  leaders,
  team,
}: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [progress, setProgress] = useState(initialProgress);
  const [selectedCandidate, setSelectedCandidate] = useState<string>(
    initialCandidates[0]?.id ?? ""
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState("");
  const [emailModalTask, setEmailModalTask] = useState<OnboardingTask | null>(
    null
  );
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const { can } = usePermissions();

  const candidate = candidates.find((c) => c.id === selectedCandidate);
  const candidateProgress = progress.filter(
    (p) => p.candidate_id === selectedCandidate
  );

  // Build a map of task_id -> progress entry for the selected candidate
  const progressMap = new Map<string, CandidateOnboarding>();
  candidateProgress.forEach((p) => progressMap.set(p.task_id, p));

  const completedCount = candidateProgress.filter(
    (p) => p.completed_at
  ).length;
  const totalTasks = candidateProgress.length || tasks.length;
  const progressPercent =
    totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  // Initialize onboarding for a candidate with hire type
  async function handleInitialize(hireType: "agent" | "employee") {
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
          hire_type: hireType,
          team_id: teamId,
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
        // Update candidate's hire_type locally
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === selectedCandidate
              ? { ...c, hire_type: hireType }
              : c
          )
        );
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

    const newCompleted = existing.completed_at
      ? null
      : new Date().toISOString();

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
        setProgress((prev) =>
          prev.map((p) =>
            p.id === existing.id
              ? { ...p, completed_at: existing.completed_at }
              : p
          )
        );
      }
    } catch {
      setProgress((prev) =>
        prev.map((p) =>
          p.id === existing.id
            ? { ...p, completed_at: existing.completed_at }
            : p
        )
      );
    }
  }

  function handleEmailSent(taskId: string) {
    handleToggleTask(taskId);
    setEmailModalTask(null);
  }

  async function handleSendReminders() {
    setIsSendingReminders(true);
    setReminderMessage("");
    try {
      const res = await fetch("/api/onboarding/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const result = await res.json();
      if (result.error) {
        setReminderMessage(`Error: ${result.error}`);
      } else if (result.emails_sent === 0) {
        setReminderMessage("No overdue or due-today tasks found.");
      } else {
        setReminderMessage(
          `Sent ${result.emails_sent} reminder email${result.emails_sent !== 1 ? "s" : ""} for ${result.total_tasks} task${result.total_tasks !== 1 ? "s" : ""}.`
        );
      }
    } catch {
      setReminderMessage("Network error — please try again.");
    }
    setIsSendingReminders(false);
    // Clear message after 5 seconds
    setTimeout(() => setReminderMessage(""), 5000);
  }

  // Filter tasks to only those that have a progress entry (matched to hire type)
  const activeTasks =
    candidateProgress.length > 0
      ? tasks.filter((t) => progressMap.has(t.id))
      : tasks;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#272727]">Onboarding</h2>
          <p className="text-sm text-[#a59494] mt-0.5">
            {candidates.length} candidate
            {candidates.length !== 1 ? "s" : ""} in onboarding
          </p>
        </div>
        <div className="flex items-center gap-3">
          {reminderMessage && (
            <span
              className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                reminderMessage.startsWith("Error")
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600"
              }`}
            >
              {reminderMessage}
            </span>
          )}
          {can("manage_onboarding") && (
            <button
              onClick={handleSendReminders}
              disabled={isSendingReminders}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
              title="Send email reminders for overdue and due-today tasks to assigned team members"
            >
              {isSendingReminders ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Sending...
                </span>
              ) : (
                "Send Reminders Now"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Alert if no onboarding tasks are configured */}
      {tasks.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              className="shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                No onboarding tasks configured
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Run the onboarding rebuild migration
                (20260305000004) in your Supabase SQL Editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f5f0f0] flex items-center justify-center mx-auto mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a59494"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="text-[#a59494] mb-1">
            No candidates in onboarding yet
          </p>
          <p className="text-sm text-[#a59494]">
            Move candidates to the Onboarding stage to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: candidate selector */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-[#272727] mb-3">
                Candidates
              </h3>
              <div className="space-y-2">
                {candidates.map((c) => {
                  const cProgress = progress.filter(
                    (p) => p.candidate_id === c.id
                  );
                  const cCompleted = cProgress.filter(
                    (p) => p.completed_at
                  ).length;
                  const cTotal = cProgress.length || tasks.length;
                  const cPercent =
                    cTotal > 0 ? (cCompleted / cTotal) * 100 : 0;
                  const isSelected = c.id === selectedCandidate;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCandidate(c.id)}
                      className={`w-full text-left p-3 rounded-lg transition ${
                        isSelected
                          ? "bg-brand/10 border border-brand/30"
                          : "hover:bg-[#f5f0f0] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">
                            {c.first_name[0]}
                            {c.last_name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-[#272727] truncate">
                              {c.first_name} {c.last_name}
                            </p>
                            {c.hire_type && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-brand/10 text-brand shrink-0">
                                {c.hire_type === "agent" ? "AGT" : "EMP"}
                              </span>
                            )}
                          </div>
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-[#272727]">
                          {candidate.first_name} {candidate.last_name}
                        </h3>
                        {candidate.hire_type && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                            {candidate.hire_type === "agent"
                              ? "Agent"
                              : "Employee"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#a59494]">
                        {candidate.role_applied ?? "Agent"} · Onboarding
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-brand">
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
                          progressPercent === 100 ? "#10B981" : "var(--brand-primary)",
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
                      <p className="text-sm text-[#a59494] mb-4">
                        Select hire type to initialize onboarding
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleInitialize("agent")}
                          disabled={isInitializing}
                          className="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                        >
                          {isInitializing
                            ? "Initializing..."
                            : "Start as Agent"}
                        </button>
                        <button
                          onClick={() => handleInitialize("employee")}
                          disabled={isInitializing}
                          className="px-5 py-2.5 rounded-lg border-2 border-brand text-brand hover:bg-brand/5 text-sm font-semibold transition disabled:opacity-50"
                        >
                          {isInitializing
                            ? "Initializing..."
                            : "Start as Employee"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <OnboardingTaskList
                      tasks={activeTasks}
                      progress={candidateProgress}
                      candidate={candidate}
                      onToggle={handleToggleTask}
                      onEmailTask={(task) => setEmailModalTask(task)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModalTask && candidate?.email && (
        <OnboardingEmailModal
          task={emailModalTask}
          candidate={candidate}
          templates={emailTemplates}
          leaders={leaders}
          team={team}
          onSent={() => handleEmailSent(emailModalTask.id)}
          onClose={() => setEmailModalTask(null)}
        />
      )}
    </>
  );
}
