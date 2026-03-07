"use client";

import { useState, useRef } from "react";
import type { PipelineStage } from "@/lib/types";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

/* ── Constants ────────────────────────────────────────────────── */

const PROTECTED_STAGES = new Set(["New Lead", "Onboarding", "Not a Fit"]);

const DEFAULT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#6B7280", "#2D9E6B", "#1c759e",
];

/* ── Props ────────────────────────────────────────────────────── */

interface Props {
  stages: PipelineStage[];
  onStagesUpdated: (stages: PipelineStage[]) => void;
  teamId: string;
}

/* ── API helper ───────────────────────────────────────────────── */

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

/* ── Main Component ───────────────────────────────────────────── */

export default function PipelineStagesTab({
  stages: initialStages,
  onStagesUpdated,
  teamId,
}: Props) {
  const [stages, setStages] = useState(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [orderChanged, setOrderChanged] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3B82F6");
  const [deleteTarget, setDeleteTarget] = useState<PipelineStage | null>(null);
  const [deleteCandidateCount, setDeleteCandidateCount] = useState(0);
  const [moveToStage, setMoveToStage] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const colorInputRef = useRef<HTMLInputElement>(null);
  const [colorEditId, setColorEditId] = useState<string | null>(null);
  const [pendingColorChanges, setPendingColorChanges] = useState<Record<string, string>>({});

  function flash(msg: string) {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(""), 2500);
  }

  /* ── Drag & drop ─────────────────────────────────── */

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const reordered = [...stages];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    // Update order_index
    const withNewOrder = reordered.map((s, i) => ({
      ...s,
      order_index: i,
    }));
    setStages(withNewOrder);
    setOrderChanged(true);
  }

  async function handleSaveOrder() {
    setIsSaving(true);
    const ordered_ids = stages.map((s) => s.id);
    const result = await callSettings("reorder_stages", {
      team_id: teamId,
      ordered_ids,
    });
    if ((result as { error?: string }).error) {
      flash(`Error: ${(result as { error: string }).error}`);
    } else {
      onStagesUpdated(stages);
      setOrderChanged(false);
      flash("Order saved!");
    }
    setIsSaving(false);
  }

  /* ── Inline name edit ────────────────────────────── */

  function startEditName(stage: PipelineStage) {
    if (PROTECTED_STAGES.has(stage.name)) return;
    setEditingId(stage.id);
    setEditName(stage.name);
  }

  async function saveEditName() {
    if (!editingId || !editName.trim()) return;
    setIsSaving(true);
    const result = await callSettings("update_stage", {
      id: editingId,
      name: editName.trim(),
    });
    if (!(result as { error?: string }).error) {
      const updated = stages.map((s) =>
        s.id === editingId ? { ...s, name: editName.trim() } : s
      );
      setStages(updated);
      onStagesUpdated(updated);
      flash("Saved!");
    }
    setEditingId(null);
    setIsSaving(false);
  }

  /* ── Color picker ────────────────────────────────── */

  function handleColorClick(stage: PipelineStage) {
    setColorEditId(stage.id);
    // Wait for ref to be assigned, then trigger
    setTimeout(() => colorInputRef.current?.click(), 0);
  }

  function handleColorChange(stageId: string, color: string) {
    const updated = stages.map((s) =>
      s.id === stageId ? { ...s, color } : s
    );
    setStages(updated);
    setColorEditId(null);
    setPendingColorChanges((prev) => ({ ...prev, [stageId]: color }));
  }

  async function handleSaveColors() {
    setIsSaving(true);
    const entries = Object.entries(pendingColorChanges);
    for (const [stageId, color] of entries) {
      await callSettings("update_stage", { id: stageId, color });
    }
    onStagesUpdated(stages);
    setPendingColorChanges({});
    flash("Colors saved!");
    setIsSaving(false);
  }

  /* ── Add stage ───────────────────────────────────── */

  async function handleAddStage() {
    if (!newStageName.trim()) return;
    setIsSaving(true);
    const result = await callSettings("create_stage", {
      team_id: teamId,
      name: newStageName.trim(),
      color: newStageColor,
      order_index: stages.length,
    });
    if ((result as { error?: string }).error) {
      flash(`Error: ${(result as { error: string }).error}`);
    } else {
      const newStage = (result as { data: PipelineStage }).data;
      const updated = [...stages, newStage];
      setStages(updated);
      onStagesUpdated(updated);
      setNewStageName("");
      setShowAddForm(false);
      flash("Stage added!");
    }
    setIsSaving(false);
  }

  /* ── Delete stage ────────────────────────────────── */

  async function handleDeleteClick(stage: PipelineStage) {
    // Fetch candidate count for this stage
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_stage_candidate_count",
        payload: { team_id: teamId, stage_name: stage.name },
      }),
    });
    const data = await res.json();
    const count = (data as { count?: number }).count ?? 0;
    setDeleteCandidateCount(count);
    setDeleteTarget(stage);
    // Default move_to: first stage that isn't this one
    const defaultMove = stages.find(
      (s) => s.id !== stage.id && s.name !== stage.name
    );
    setMoveToStage(defaultMove?.name ?? "");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const result = await callSettings("delete_stage", {
      id: deleteTarget.id,
      team_id: teamId,
      stage_name: deleteTarget.name,
      move_candidates_to: deleteCandidateCount > 0 ? moveToStage : undefined,
    });

    if ((result as { error?: string }).error) {
      flash(`Error: ${(result as { error: string }).error}`);
    } else {
      const updated = stages.filter((s) => s.id !== deleteTarget.id);
      setStages(updated);
      onStagesUpdated(updated);
      flash("Stage deleted!");
    }
    setDeleteTarget(null);
    setDeleteLoading(false);
  }

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#272727]">
              Pipeline Stages
            </h3>
            <p className="text-xs text-[#a59494] mt-0.5">
              {stages.length} stages · Drag to reorder
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus && (
              <span
                className={`text-xs ${
                  saveStatus.startsWith("Error")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {saveStatus}
              </span>
            )}
            {Object.keys(pendingColorChanges).length > 0 && (
              <button
                onClick={handleSaveColors}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : `Save Colors (${Object.keys(pendingColorChanges).length})`}
              </button>
            )}
            {orderChanged && (
              <button
                onClick={handleSaveOrder}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Order"}
              </button>
            )}
          </div>
        </div>

        {/* Hidden color input */}
        <input
          ref={colorInputRef}
          type="color"
          className="absolute opacity-0 w-0 h-0"
          onChange={(e) => {
            if (colorEditId) handleColorChange(colorEditId, e.target.value);
          }}
        />

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="stages">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="divide-y divide-[#a59494]/10"
              >
                {stages.map((stage, index) => {
                  const isProtected = PROTECTED_STAGES.has(stage.name);

                  return (
                    <Draggable
                      key={stage.id}
                      draggableId={stage.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`px-6 py-3 flex items-center gap-3 ${
                            snapshot.isDragging
                              ? "bg-brand/5 shadow-lg rounded-lg"
                              : ""
                          }`}
                        >
                          {/* Drag handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-[#a59494] hover:text-[#272727] transition"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <circle cx="9" cy="6" r="1.5" />
                              <circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" />
                              <circle cx="15" cy="18" r="1.5" />
                            </svg>
                          </div>

                          {/* Color dot (clickable) */}
                          <button
                            type="button"
                            onClick={() => handleColorClick(stage)}
                            className="w-4 h-4 rounded-full shrink-0 border border-black/10 hover:scale-125 transition-transform cursor-pointer"
                            style={{
                              backgroundColor: stage.color ?? "#6B7280",
                            }}
                            title="Change color"
                          />

                          {/* Name (inline edit or display) */}
                          {editingId === stage.id ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onBlur={saveEditName}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditName();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 px-2 py-1 rounded border border-brand/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`text-sm flex-1 ${
                                isProtected
                                  ? "text-[#272727]"
                                  : "text-[#272727] cursor-pointer hover:text-brand"
                              }`}
                              onClick={() => startEditName(stage)}
                              title={
                                isProtected
                                  ? "Protected stage"
                                  : "Click to rename"
                              }
                            >
                              {stage.name}
                              {isProtected && (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#a59494"
                                  strokeWidth="2"
                                  className="inline ml-1.5 -mt-0.5"
                                >
                                  <rect
                                    x="3"
                                    y="11"
                                    width="18"
                                    height="11"
                                    rx="2"
                                    ry="2"
                                  />
                                  <path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                              )}
                            </span>
                          )}

                          {/* GHL tag */}
                          {stage.ghl_tag && (
                            <span className="text-[10px] text-[#a59494] font-mono">
                              {stage.ghl_tag}
                            </span>
                          )}

                          {/* Delete button */}
                          {!isProtected && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(stage)}
                              className="text-[#a59494] hover:text-red-500 transition p-1"
                              title="Delete stage"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add Stage */}
        <div className="px-6 py-3 border-t border-[#a59494]/10">
          {showAddForm ? (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddStage();
                  if (e.key === "Escape") {
                    setShowAddForm(false);
                    setNewStageName("");
                  }
                }}
                placeholder="Stage name..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                autoFocus
              />
              <button
                onClick={handleAddStage}
                disabled={isSaving || !newStageName.trim()}
                className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewStageName("");
                }}
                className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNewStageColor(
                  DEFAULT_COLORS[stages.length % DEFAULT_COLORS.length]
                );
                setShowAddForm(true);
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Stage
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10">
              <h3 className="text-lg font-bold text-[#272727]">
                Delete &ldquo;{deleteTarget.name}&rdquo;?
              </h3>
              <button
                onClick={() => setDeleteTarget(null)}
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
              {deleteCandidateCount > 0 ? (
                <>
                  <p className="text-sm text-[#272727]">
                    <span className="font-semibold text-amber-600">
                      {deleteCandidateCount} candidate
                      {deleteCandidateCount !== 1 ? "s are" : " is"}
                    </span>{" "}
                    in this stage. Move them to:
                  </p>
                  <select
                    value={moveToStage}
                    onChange={(e) => setMoveToStage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                  >
                    {stages
                      .filter((s) => s.id !== deleteTarget.id)
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <p className="text-sm text-[#a59494]">
                  No candidates are in this stage. It can be safely deleted.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={
                    deleteLoading ||
                    (deleteCandidateCount > 0 && !moveToStage)
                  }
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {deleteLoading ? "Deleting..." : "Delete Stage"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
