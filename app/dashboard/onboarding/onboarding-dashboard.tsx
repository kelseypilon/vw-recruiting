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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [automationTask, setAutomationTask] = useState<OnboardingTask | null>(null);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);
  const [automationResult, setAutomationResult] = useState<{ success: boolean; message: string } | null>(null);
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

  // Reset onboarding — deletes all progress, allowing re-initialization with different track
  async function handleResetOnboarding() {
    if (resetInput !== "RESET" || !selectedCandidate || isResetting) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          candidate_id: selectedCandidate,
        }),
      });
      const result = await res.json();
      if (!result.error) {
        // Remove all progress for this candidate
        setProgress((prev) => prev.filter((p) => p.candidate_id !== selectedCandidate));
        // Clear hire_type/hire_track locally
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === selectedCandidate ? { ...c, hire_type: null, hire_track: "agent" } : c
          )
        );
      }
    } catch {
      // ignore
    }
    setIsResetting(false);
    setShowResetConfirm(false);
    setResetInput("");
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

  // Run automation — calls API, then marks task complete on success
  async function handleRunAutomation() {
    if (!automationTask || !candidate || isRunningAutomation) return;
    setIsRunningAutomation(true);
    setAutomationResult(null);

    try {
      const entry = progressMap.get(automationTask.id);
      const res = await fetch("/api/onboarding/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: automationTask.id,
          candidate_id: candidate.id,
          team_id: teamId,
          automation_key: automationTask.automation_key,
          entry_id: entry?.id,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setAutomationResult({ success: false, message: result.error });
      } else {
        setAutomationResult({
          success: true,
          message: result.message ?? "Automation completed successfully.",
        });
        // Auto-mark task complete
        if (entry) {
          const now = new Date().toISOString();
          setProgress((prev) =>
            prev.map((p) =>
              p.id === entry.id ? { ...p, completed_at: now } : p
            )
          );
          // Also persist the toggle
          await fetch("/api/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "toggle",
              entry_id: entry.id,
              completed_at: now,
            }),
          });
        }
      }
    } catch {
      setAutomationResult({
        success: false,
        message: "Network error — please try again.",
      });
    }
    setIsRunningAutomation(false);
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
                    <div className="flex items-center gap-4">
                      {can("manage_onboarding") && candidateProgress.length > 0 && (
                        <button
                          onClick={() => { setShowResetConfirm(true); setResetInput(""); }}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                          title="Reset onboarding and choose a different hire track"
                        >
                          Reset
                        </button>
                      )}
                      <div className="text-right">
                        <p className="text-2xl font-bold text-brand">
                          {Math.round(progressPercent)}%
                        </p>
                        <p className="text-xs text-[#a59494]">
                          {completedCount} of {totalTasks} tasks
                        </p>
                      </div>
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
                      <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary, #1B6CA8)" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <line x1="20" y1="8" x2="20" y2="14" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-[#272727] mb-1">
                        Select hire track to begin onboarding
                      </p>
                      <p className="text-xs text-[#a59494] mb-5">
                        This determines which tasks appear for {candidate.first_name}
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
                      onRunAutomation={(task) => {
                        setAutomationTask(task);
                        setAutomationResult(null);
                      }}
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

      {/* Automation Confirmation Modal */}
      {automationTask && candidate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#a59494]/10">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <h3 className="text-lg font-bold text-[#272727]">Run Automation</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {automationResult ? (
                <>
                  <div
                    className={`p-4 rounded-lg border ${
                      automationResult.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {automationResult.success ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" className="shrink-0 mt-0.5">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" className="shrink-0 mt-0.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      )}
                      <div>
                        <p className={`text-sm font-medium ${automationResult.success ? "text-green-800" : "text-red-800"}`}>
                          {automationResult.success ? "Success" : "Failed"}
                        </p>
                        <p className={`text-xs mt-1 ${automationResult.success ? "text-green-700" : "text-red-700"}`}>
                          {automationResult.message}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setAutomationTask(null); setAutomationResult(null); }}
                      className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-800 font-medium">
                      {automationTask.title}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      This will run the <span className="font-mono font-semibold">{automationTask.automation_key ?? "automation"}</span> integration
                      for {candidate.first_name} {candidate.last_name}.
                    </p>
                  </div>
                  <p className="text-xs text-[#a59494]">
                    The task will be automatically marked as complete if the automation succeeds.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => { setAutomationTask(null); setAutomationResult(null); }}
                      disabled={isRunningAutomation}
                      className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRunAutomation}
                      disabled={isRunningAutomation}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-50"
                    >
                      {isRunningAutomation ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Running...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          Run Automation
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && candidate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#a59494]/10">
              <h3 className="text-lg font-bold text-[#272727]">Reset Onboarding</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700 font-medium">
                  This will permanently delete all onboarding progress for{" "}
                  {candidate.first_name} {candidate.last_name}.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {completedCount} completed task{completedCount !== 1 ? "s" : ""} and{" "}
                  {totalTasks - completedCount} pending task{totalTasks - completedCount !== 1 ? "s" : ""} will be removed.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">
                  Type <span className="font-mono font-bold text-red-600">RESET</span> to confirm
                </label>
                <input
                  type="text"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder="Type RESET"
                  className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowResetConfirm(false); setResetInput(""); }}
                  className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetOnboarding}
                  disabled={resetInput !== "RESET" || isResetting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isResetting ? "Resetting..." : "Reset Onboarding"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
