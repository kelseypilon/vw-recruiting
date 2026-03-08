"use client";

import { useState } from "react";
import type { OnboardingTask, TeamUser } from "@/lib/types";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

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

const ACTION_TYPE_ICONS: Record<string, string> = {
  manual: "✋",
  email: "✉️",
  link: "🔗",
  automated: "⚡",
};

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  tasks: OnboardingTask[];
  onTasksUpdated: (tasks: OnboardingTask[]) => void;
  users: TeamUser[];
  teamId: string;
  businessUnits?: string[];
}

/* ── Helpers ───────────────────────────────────────────────────── */

async function saveOnboarding(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success?: boolean; data?: OnboardingTask; error?: string }> {
  const res = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    return { error: `Request failed (${res.status})` };
  }
  return res.json();
}

async function callSettings(
  action: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

/* ── Main Component ────────────────────────────────────────────── */

export default function OnboardingTasksTab({
  tasks,
  onTasksUpdated,
  users,
  teamId,
  businessUnits,
}: Props) {
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [addingToStage, setAddingToStage] = useState<string | null>(null);
  const [filterTrack, setFilterTrack] = useState<"all" | "agent" | "employee">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInStage(stageKey: string) {
    const stageTasks = tasksByStage.get(stageKey) ?? [];
    const allSelected = stageTasks.every((t) => selectedIds.has(t.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const t of stageTasks) {
        if (allSelected) next.delete(t.id); else next.add(t.id);
      }
      return next;
    });
  }

  async function handleBulkAssign() {
    if (!bulkAssignTo || selectedIds.size === 0) return;
    setBulkSaving(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await saveOnboarding("update_task_full", {
        task_id: id,
        default_assignee_id: bulkAssignTo || null,
      });
    }
    // Update local state
    const assignee = users.find((u) => u.id === bulkAssignTo);
    onTasksUpdated(
      tasks.map((t) =>
        selectedIds.has(t.id)
          ? { ...t, default_assignee_id: bulkAssignTo || null, default_assignee: assignee ? { name: assignee.name } : null }
          : t
      )
    );
    setSelectedIds(new Set());
    setBulkAssignTo("");
    setBulkSaving(false);
  }

  async function handleBulkCopyToTrack(targetTrack: string) {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    const toCopy = tasks.filter((t) => selectedIds.has(t.id));
    const newTasks: OnboardingTask[] = [];
    for (const task of toCopy) {
      const result = await saveOnboarding("create_task", {
        team_id: teamId,
        title: task.title,
        stage: task.stage,
        hire_type: targetTrack,
        hire_track: targetTrack,
        action_type: task.action_type,
        done_by: task.done_by,
        due_offset_days: task.due_offset_days,
        due_offset_anchor: task.due_offset_anchor,
        action_url: task.action_url,
        notes: task.notes,
        default_assignee_id: task.default_assignee_id,
      });
      if (!result.error && result.data) {
        newTasks.push(result.data as OnboardingTask);
      }
    }
    if (newTasks.length > 0) {
      onTasksUpdated([...tasks, ...newTasks]);
    }
    setSelectedIds(new Set());
    setBulkSaving(false);
  }

  // Filter tasks by hire_track
  const filteredTasks = filterTrack === "all"
    ? tasks
    : tasks.filter((t) => {
        const track = t.hire_track ?? t.hire_type;
        return track === filterTrack || track === "both" || track === "all";
      });

  // Group tasks by stage, sorted by order_index
  const tasksByStage = new Map<string, OnboardingTask[]>();
  for (const task of filteredTasks) {
    const stage = task.stage ?? "uncategorized";
    if (!tasksByStage.has(stage)) tasksByStage.set(stage, []);
    tasksByStage.get(stage)!.push(task);
  }
  // Sort each stage's tasks by order_index
  for (const [, stageTasks] of tasksByStage) {
    stageTasks.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }
  const stageKeys = STAGE_ORDER.filter((s) => tasksByStage.has(s) || true);
  if (tasksByStage.has("uncategorized")) {
    stageKeys.push("uncategorized");
  }

  function toggleStage(stageKey: string) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageKey)) next.delete(stageKey);
      else next.add(stageKey);
      return next;
    });
  }

  async function handleAddTask(stageKey: string, title: string) {
    const result = await saveOnboarding("create_task", {
      team_id: teamId,
      title,
      stage: stageKey === "uncategorized" ? null : stageKey,
      hire_type: filterTrack === "all" ? "both" : filterTrack,
      hire_track: filterTrack === "all" ? "both" : filterTrack,
      action_type: "manual",
    });
    if (!result.error && result.data) {
      onTasksUpdated([...tasks, result.data]);
      // Auto-expand the stage
      setExpandedStages((prev) => new Set([...prev, stageKey]));
    }
    setAddingToStage(null);
  }

  async function handleSaveTask(updatedTask: OnboardingTask) {
    const result = await saveOnboarding("update_task_full", {
      task_id: updatedTask.id,
      title: updatedTask.title,
      stage: updatedTask.stage,
      hire_type: updatedTask.hire_type,
      hire_track: updatedTask.hire_track,
      action_type: updatedTask.action_type,
      done_by: updatedTask.done_by,
      due_offset_days: updatedTask.due_offset_days,
      due_offset_anchor: updatedTask.due_offset_anchor,
      action_url: updatedTask.action_url,
      notes: updatedTask.notes,
      default_assignee_id: updatedTask.default_assignee_id,
      automation_key: updatedTask.automation_key,
    });
    if (!result.error && result.data) {
      onTasksUpdated(tasks.map((t) => (t.id === result.data!.id ? result.data! : t)));
    }
    setEditingTask(null);
  }

  async function handleDeleteTask(taskId: string) {
    const result = await saveOnboarding("delete_task", { task_id: taskId });
    if (!result.error) {
      onTasksUpdated(tasks.filter((t) => t.id !== taskId));
    }
    setEditingTask(null);
  }

  /* ── Drag & drop reorder within a stage ────────── */

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { source, destination } = result;
    // Only allow reorder within the same stage droppable
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    const stageKey = source.droppableId;
    const stageTasks = [...(tasksByStage.get(stageKey) ?? [])];

    // Reorder within the stage group
    const [moved] = stageTasks.splice(source.index, 1);
    stageTasks.splice(destination.index, 0, moved);

    // Assign new order_index values for this stage's tasks
    const reorderedWithIndex = stageTasks.map((t, i) => ({
      ...t,
      order_index: i,
    }));

    // Build a full updated tasks list (replace the reordered stage tasks)
    const reorderedIds = new Set(reorderedWithIndex.map((t) => t.id));
    const updatedTasks = tasks.map((t) => {
      if (reorderedIds.has(t.id)) {
        return reorderedWithIndex.find((rt) => rt.id === t.id)!;
      }
      return t;
    });

    // Optimistic update
    onTasksUpdated(updatedTasks);

    // Persist to API
    await callSettings("reorder_onboarding_tasks", {
      tasks: reorderedWithIndex.map((t, i) => ({ id: t.id, order_index: i })),
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#a59494]">
            {filteredTasks.length} of {tasks.length} tasks
          </p>
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value as "all" | "agent" | "employee")}
            className="px-2 py-1 rounded-lg border border-[#a59494]/40 text-xs text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
          >
            <option value="all">All Tracks</option>
            <option value="agent">Agent</option>
            <option value="employee">Employee</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-xs font-medium text-brand">{selectedIds.size} selected</span>
          )}
          <button
            onClick={() => setShowBulkReassign(true)}
            className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
          >
            Bulk Reassign
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-brand">{selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-2">
            <select
              value={bulkAssignTo}
              onChange={(e) => setBulkAssignTo(e.target.value)}
              className="px-2 py-1 rounded border border-[#a59494]/40 text-xs text-[#272727] bg-white"
            >
              <option value="">Assign to...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkAssignTo || bulkSaving}
              className="px-3 py-1 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-50"
            >
              {bulkSaving ? "Saving..." : "Assign"}
            </button>
          </div>
          <div className="flex items-center gap-2 border-l border-brand/20 pl-3">
            <span className="text-xs text-[#a59494]">Copy to:</span>
            <button
              onClick={() => handleBulkCopyToTrack("agent")}
              disabled={bulkSaving}
              className="px-2 py-1 rounded border border-[#a59494]/30 text-xs text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
            >
              Agent
            </button>
            <button
              onClick={() => handleBulkCopyToTrack("employee")}
              disabled={bulkSaving}
              className="px-2 py-1 rounded border border-[#a59494]/30 text-xs text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
            >
              Employee
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[#a59494] hover:text-[#272727] transition ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {/* Tasks grouped by stage — accordion */}
      <DragDropContext onDragEnd={handleDragEnd}>
        {stageKeys.map((stageKey) => {
          const stageTasks = tasksByStage.get(stageKey) ?? [];
          const stageLabel = STAGE_LABELS[stageKey] ?? "Other Tasks";
          const isExpanded = expandedStages.has(stageKey);

          return (
            <div
              key={stageKey}
              className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm"
            >
              <div
                className="w-full px-5 py-3 border-b border-[#a59494]/10 bg-[#f5f0f0]/50 flex items-center justify-between hover:bg-[#f5f0f0] transition rounded-t-xl"
              >
                <div className="flex items-center gap-2">
                  {showBulkReassign === false && (
                    <input
                      type="checkbox"
                      checked={stageTasks.length > 0 && stageTasks.every((t) => selectedIds.has(t.id))}
                      onChange={(e) => {
                        e.stopPropagation();
                        selectAllInStage(stageKey);
                      }}
                      className="w-3.5 h-3.5 rounded border-[#a59494]/40 text-brand focus:ring-brand/40 cursor-pointer shrink-0"
                    />
                  )}
                  <button
                    onClick={() => toggleStage(stageKey)}
                    className="flex items-center gap-2"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-[#a59494] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <h4 className="text-sm font-semibold text-[#272727]">
                      {stageLabel}
                    </h4>
                    <span className="text-xs text-[#a59494]">
                      ({stageTasks.length})
                    </span>
                  </button>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddingToStage(stageKey);
                    setExpandedStages((prev) => new Set([...prev, stageKey]));
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#a59494] hover:text-brand hover:bg-white transition"
                  title="Add task to this stage"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              </div>

              {isExpanded && (
                <Droppable droppableId={stageKey}>
                  {(droppableProvided) => (
                    <div
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="divide-y divide-[#a59494]/5"
                    >
                      {stageTasks.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(draggableProvided, snapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              className={`w-full text-left px-5 py-3 flex items-center gap-4 transition ${
                                snapshot.isDragging
                                  ? "bg-brand/5 shadow-lg rounded-lg"
                                  : "hover:bg-[#f5f0f0]/50"
                              }`}
                            >
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={selectedIds.has(task.id)}
                                onChange={() => toggleSelected(task.id)}
                                className="w-3.5 h-3.5 rounded border-[#a59494]/40 text-brand focus:ring-brand/40 cursor-pointer shrink-0"
                              />

                              {/* Drag handle */}
                              <div
                                {...draggableProvided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-[#a59494]/40 hover:text-[#a59494] transition shrink-0"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                  <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                                  <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                                  <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                                  <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                                  <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                                  <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                                </svg>
                              </div>

                              {/* Clickable row area — opens edit modal */}
                              <button
                                onClick={() => setEditingTask(task)}
                                className="flex-1 flex items-center gap-4 text-left min-w-0"
                              >
                                {/* Task info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[#272727] truncate">
                                    {task.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/5 text-brand font-medium">
                                      {(task.hire_track ?? task.hire_type) === "both"
                                        ? "All"
                                        : (task.hire_track ?? task.hire_type) === "agent"
                                        ? "Agent"
                                        : "Employee"}
                                    </span>
                                    {task.action_type && (
                                      <span className="text-[10px] text-[#a59494]" title={task.action_type}>
                                        {ACTION_TYPE_ICONS[task.action_type] ?? task.action_type}
                                      </span>
                                    )}
                                    {task.done_by && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f0f0] text-[#a59494] font-medium">
                                        {task.done_by}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Assignee */}
                                <span className="text-xs text-[#a59494] w-28 text-right truncate">
                                  {task.default_assignee?.name ?? "Unassigned"}
                                </span>

                                {/* Due offset */}
                                <span className="text-xs text-[#a59494] w-24 text-right">
                                  {task.due_offset_days != null
                                    ? `${task.due_offset_days}d after ${task.due_offset_anchor === "hire_date" ? "hire" : "start"}`
                                    : "---"}
                                </span>
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {droppableProvided.placeholder}

                      {stageTasks.length === 0 && !addingToStage && (
                        <div className="px-5 py-6 text-center">
                          <p className="text-xs text-[#a59494]">No tasks in this stage</p>
                        </div>
                      )}

                      {/* Inline Add Task */}
                      {addingToStage === stageKey && (
                        <InlineAddTask
                          onAdd={(title) => handleAddTask(stageKey, title)}
                          onCancel={() => setAddingToStage(null)}
                        />
                      )}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </DragDropContext>

      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <p className="text-sm text-[#a59494]">
            No onboarding tasks configured yet
          </p>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          users={users}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditingTask(null)}
        />
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

/* ── Inline Add Task ──────────────────────────────────────────── */

function InlineAddTask({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onAdd(title.trim());
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-3 flex items-center gap-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task title..."
        className="flex-1 px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
        autoFocus
      />
      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
      >
        {saving ? "Adding..." : "Add"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
      >
        Cancel
      </button>
    </form>
  );
}

/* ── Edit Task Modal ──────────────────────────────────────────── */

function EditTaskModal({
  task,
  users,
  onSave,
  onDelete,
  onClose,
}: {
  task: OnboardingTask;
  users: TeamUser[];
  onSave: (task: OnboardingTask) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    stage: task.stage ?? "stage_1_hiring",
    hire_type: task.hire_type ?? "both",
    hire_track: task.hire_track ?? task.hire_type ?? "both",
    action_type: task.action_type ?? "manual",
    done_by: task.done_by ?? "",
    due_offset_days: task.due_offset_days,
    due_offset_anchor: task.due_offset_anchor ?? "start_date",
    action_url: task.action_url ?? "",
    notes: task.notes ?? "",
    default_assignee_id: task.default_assignee_id ?? "",
    automation_key: task.automation_key ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function update(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({
      ...task,
      title: form.title,
      stage: form.stage,
      hire_type: form.hire_track,
      hire_track: form.hire_track,
      action_type: form.action_type,
      done_by: form.done_by || null,
      due_offset_days: form.due_offset_days,
      due_offset_anchor: form.due_offset_anchor,
      action_url: form.action_url || null,
      notes: form.notes || null,
      default_assignee_id: form.default_assignee_id || null,
      automation_key: form.automation_key || null,
    });
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    await onDelete(task.id);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 sticky top-0 bg-white rounded-t-xl">
          <h3 className="text-lg font-bold text-[#272727]">Edit Task</h3>
          <button onClick={onClose} className="text-[#a59494] hover:text-[#272727] transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>

          {/* Stage + Hire Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => update("stage", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Hire Track</label>
              <select
                value={form.hire_track}
                onChange={(e) => update("hire_track", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                <option value="both">Both (Agent + Employee)</option>
                <option value="agent">Agent</option>
                <option value="employee">Employee</option>
              </select>
            </div>
          </div>

          {/* Action Type + Done By row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Action Type</label>
              <select
                value={form.action_type}
                onChange={(e) => update("action_type", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                <option value="manual">✋ Manual</option>
                <option value="email">✉️ Email</option>
                <option value="link">🔗 Link / Form</option>
                <option value="automated">⚡ Automated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Done By / Assigned Role</label>
              <input
                type="text"
                value={form.done_by}
                onChange={(e) => update("done_by", e.target.value)}
                placeholder="e.g. Team Lead, Front Desk"
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Default Assignee */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">Default Assignee</label>
            <select
              value={form.default_assignee_id}
              onChange={(e) => update("default_assignee_id", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Due Offset */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Due Offset (days)</label>
              <input
                type="number"
                value={form.due_offset_days ?? ""}
                onChange={(e) => update("due_offset_days", e.target.value === "" ? null : Number(e.target.value))}
                min={0}
                max={365}
                placeholder="—"
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">After</label>
              <select
                value={form.due_offset_anchor}
                onChange={(e) => update("due_offset_anchor", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                <option value="start_date">Start Date</option>
                <option value="hire_date">Hire Date</option>
              </select>
            </div>
          </div>

          {/* Action URL */}
          {(form.action_type === "link" || form.action_type === "email") && (
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Document / Form URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.action_url}
                  onChange={(e) => update("action_url", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                />
                {form.action_url && (
                  <a
                    href={form.action_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-xs font-medium text-brand hover:bg-brand/5 transition"
                  >
                    Test Link
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Automation Key — only shown when action_type is automated */}
          {form.action_type === "automated" && (
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Automation Integration</label>
              <select
                value={form.automation_key}
                onChange={(e) => update("automation_key", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                <option value="">Select integration...</option>
                <option value="google_workspace">Google Workspace — Create account</option>
                <option value="teachable">Teachable — Enrol in course</option>
                <option value="slack">Slack — Send notification</option>
                <option value="follow_up_boss">Follow Up Boss — Create contact</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Additional instructions..."
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#a59494]/10">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Delete this task?</span>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-red-500 hover:text-red-700 transition"
              >
                Delete Task
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
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
