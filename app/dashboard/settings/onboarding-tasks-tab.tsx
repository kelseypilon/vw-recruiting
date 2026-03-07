"use client";

import { useState } from "react";
import type { OnboardingTask, TeamUser } from "@/lib/types";

/* ── Stage labels ────────────────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  stage_1_hiring: "Stage 1 — Hiring",
  stage_2_leadership: "Stage 2 — Leadership Pre-Onboarding",
  stage_3_accounts: "Stage 3 — Account Set Up",
  stage_4_office: "Stage 4 — Office Onboarding",
  stage_5_headshots: "Stage 5 — After Headshots",
  stage_6_payroll: "Stage 6 — Payroll",
};

const STAGE_ORDER = [
  "stage_1_hiring",
  "stage_2_leadership",
  "stage_3_accounts",
  "stage_4_office",
  "stage_5_headshots",
  "stage_6_payroll",
];

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  tasks: OnboardingTask[];
  onTasksUpdated: (tasks: OnboardingTask[]) => void;
  users: TeamUser[];
  teamId: string;
}

/* ── Helpers ───────────────────────────────────────────────────── */

async function saveOnboarding(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

/* ── Main Component ────────────────────────────────────────────── */

export default function OnboardingTasksTab({
  tasks,
  onTasksUpdated,
  users,
  teamId,
}: Props) {
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  // Group tasks by stage
  const tasksByStage = new Map<string, OnboardingTask[]>();
  for (const task of tasks) {
    const stage = task.stage ?? "uncategorized";
    if (!tasksByStage.has(stage)) tasksByStage.set(stage, []);
    tasksByStage.get(stage)!.push(task);
  }
  const stageKeys = STAGE_ORDER.filter((s) => tasksByStage.has(s));
  if (tasksByStage.has("uncategorized")) {
    stageKeys.push("uncategorized");
  }

  async function handleAssigneeChange(taskId: string, userId: string | null) {
    setSavingTaskId(taskId);
    const result = await saveOnboarding("update_task_assignment", {
      task_id: taskId,
      default_assignee_id: userId,
    });
    if (!result.error) {
      onTasksUpdated(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                default_assignee_id: userId,
                default_assignee: userId
                  ? { name: users.find((u) => u.id === userId)?.name ?? "" }
                  : null,
              }
            : t
        )
      );
    }
    setSavingTaskId(null);
  }

  async function handleOffsetChange(
    taskId: string,
    days: number | null,
    anchor: string
  ) {
    setSavingTaskId(taskId);
    const result = await saveOnboarding("update_task_assignment", {
      task_id: taskId,
      due_offset_days: days,
      due_offset_anchor: anchor,
    });
    if (!result.error) {
      onTasksUpdated(
        tasks.map((t) =>
          t.id === taskId
            ? { ...t, due_offset_days: days, due_offset_anchor: anchor }
            : t
        )
      );
    }
    setSavingTaskId(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#a59494]">
            {tasks.length} onboarding tasks configured
          </p>
        </div>
        <button
          onClick={() => setShowBulkReassign(true)}
          className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
        >
          Bulk Reassign
        </button>
      </div>

      {/* Tasks grouped by stage */}
      {stageKeys.map((stageKey) => {
        const stageTasks = tasksByStage.get(stageKey) ?? [];
        const stageLabel = STAGE_LABELS[stageKey] ?? "Other Tasks";

        return (
          <div
            key={stageKey}
            className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm"
          >
            <div className="px-5 py-3 border-b border-[#a59494]/10 bg-[#f5f0f0]/50">
              <h4 className="text-sm font-semibold text-[#272727]">
                {stageLabel}
              </h4>
            </div>

            <div className="divide-y divide-[#a59494]/5">
              {stageTasks.map((task) => (
                <div
                  key={task.id}
                  className="px-5 py-3 flex items-center gap-4"
                >
                  {/* Task name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#272727] truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.done_by && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f0f0] text-[#a59494] font-medium">
                          {task.done_by}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/5 text-brand font-medium">
                        {task.hire_type === "both"
                          ? "All"
                          : task.hire_type === "agent"
                          ? "Agent"
                          : "Employee"}
                      </span>
                    </div>
                  </div>

                  {/* Default Assignee */}
                  <div className="w-40">
                    <select
                      value={task.default_assignee_id ?? ""}
                      onChange={(e) =>
                        handleAssigneeChange(
                          task.id,
                          e.target.value || null
                        )
                      }
                      disabled={savingTaskId === task.id}
                      className="w-full px-2 py-1.5 rounded-lg border border-[#a59494]/30 text-xs text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Offset */}
                  <div className="flex items-center gap-2 w-48">
                    <input
                      type="number"
                      value={task.due_offset_days ?? ""}
                      onChange={(e) =>
                        handleOffsetChange(
                          task.id,
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                          task.due_offset_anchor ?? "start_date"
                        )
                      }
                      placeholder="—"
                      min={0}
                      max={365}
                      disabled={savingTaskId === task.id}
                      className="w-16 px-2 py-1.5 rounded-lg border border-[#a59494]/30 text-xs text-[#272727] text-center focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition disabled:opacity-50"
                    />
                    <span className="text-[10px] text-[#a59494] whitespace-nowrap">
                      days after
                    </span>
                    <select
                      value={task.due_offset_anchor ?? "start_date"}
                      onChange={(e) =>
                        handleOffsetChange(
                          task.id,
                          task.due_offset_days,
                          e.target.value
                        )
                      }
                      disabled={savingTaskId === task.id}
                      className="px-2 py-1.5 rounded-lg border border-[#a59494]/30 text-xs text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white disabled:opacity-50"
                    >
                      <option value="start_date">Start</option>
                      <option value="hire_date">Hire</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <p className="text-sm text-[#a59494]">
            No onboarding tasks configured yet
          </p>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {showBulkReassign && (
        <BulkReassignModal
          tasks={tasks}
          users={users}
          teamId={teamId}
          onClose={() => setShowBulkReassign(false)}
          onReassigned={(fromId, toId) => {
            const toUser = users.find((u) => u.id === toId);
            onTasksUpdated(
              tasks.map((t) =>
                t.default_assignee_id === fromId
                  ? {
                      ...t,
                      default_assignee_id: toId,
                      default_assignee: toUser
                        ? { name: toUser.name }
                        : null,
                    }
                  : t
              )
            );
            setShowBulkReassign(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Bulk Reassign Modal ──────────────────────────────────────── */

function BulkReassignModal({
  tasks,
  users,
  teamId,
  onClose,
  onReassigned,
}: {
  tasks: OnboardingTask[];
  users: TeamUser[];
  teamId: string;
  onClose: () => void;
  onReassigned: (fromId: string, toId: string) => void;
}) {
  const [fromUser, setFromUser] = useState("");
  const [toUser, setToUser] = useState("");
  const [saving, setSaving] = useState(false);

  const affectedCount = tasks.filter(
    (t) => t.default_assignee_id === fromUser
  ).length;

  async function handleReassign() {
    if (!fromUser || !toUser || fromUser === toUser) return;
    setSaving(true);
    const result = await saveOnboarding("bulk_reassign", {
      team_id: teamId,
      from_user_id: fromUser,
      to_user_id: toUser,
    });
    if (!result.error) {
      onReassigned(fromUser, toUser);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-lg font-bold text-[#272727]">
            Bulk Reassign Tasks
          </h3>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              From (current assignee)
            </label>
            <select
              value={fromUser}
              onChange={(e) => setFromUser(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              <option value="">Select team member...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              To (new assignee)
            </label>
            <select
              value={toUser}
              onChange={(e) => setToUser(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              <option value="">Select team member...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {fromUser && (
            <p className="text-sm text-[#a59494]">
              {affectedCount} task{affectedCount !== 1 ? "s" : ""} will be
              reassigned
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleReassign}
              disabled={
                saving ||
                !fromUser ||
                !toUser ||
                fromUser === toUser ||
                affectedCount === 0
              }
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? "Reassigning..." : "Reassign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
