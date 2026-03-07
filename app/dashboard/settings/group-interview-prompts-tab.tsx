"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { GroupInterviewPrompt } from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  prompts: GroupInterviewPrompt[];
  teamId: string;
}

/* ── API helper ────────────────────────────────────────────────── */

async function callApi(
  action: string,
  payload: Record<string, unknown>
): Promise<{ data?: unknown; success?: boolean; error?: string }> {
  const res = await fetch("/api/group-interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

/* ── Default prompts (seeded if none exist) ────────────────────── */

const DEFAULT_PROMPTS = [
  "What was your first impression of this candidate?",
  "How did they interact with the group?",
  "Did they come across as authentic and genuine?",
  "What made this candidate stand out (positive or negative)?",
  "How did they contribute to the group dynamic?",
  "What's your gut feeling — would you want to work with this person?",
];

/* ── Component ─────────────────────────────────────────────────── */

export default function GroupInterviewPromptsTab({ prompts: initialPrompts, teamId }: Props) {
  const [prompts, setPrompts] = useState<GroupInterviewPrompt[]>(initialPrompts);
  const [newPromptText, setNewPromptText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  /* ── Seed defaults ──────────────────────────────────────────── */

  async function seedDefaults() {
    setSeeding(true);
    try {
      const results: GroupInterviewPrompt[] = [];
      for (let i = 0; i < DEFAULT_PROMPTS.length; i++) {
        const res = await callApi("create_prompt", {
          team_id: teamId,
          prompt_text: DEFAULT_PROMPTS[i],
          order_index: i,
        });
        if (res.data) results.push(res.data as GroupInterviewPrompt);
      }
      setPrompts(results);
    } finally {
      setSeeding(false);
    }
  }

  /* ── Add new prompt ─────────────────────────────────────────── */

  async function addPrompt() {
    if (!newPromptText.trim()) return;
    setSaving(true);
    try {
      const res = await callApi("create_prompt", {
        team_id: teamId,
        prompt_text: newPromptText.trim(),
      });
      if (res.data) {
        setPrompts((prev) => [...prev, res.data as GroupInterviewPrompt]);
        setNewPromptText("");
      }
    } finally {
      setSaving(false);
    }
  }

  /* ── Update prompt text ─────────────────────────────────────── */

  async function saveEdit(promptId: string) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const res = await callApi("update_prompt", {
        prompt_id: promptId,
        prompt_text: editText.trim(),
      });
      if (res.data) {
        setPrompts((prev) =>
          prev.map((p) => (p.id === promptId ? (res.data as GroupInterviewPrompt) : p))
        );
      }
      setEditingId(null);
      setEditText("");
    } finally {
      setSaving(false);
    }
  }

  /* ── Toggle active ──────────────────────────────────────────── */

  async function toggleActive(prompt: GroupInterviewPrompt) {
    const res = await callApi("update_prompt", {
      prompt_id: prompt.id,
      is_active: !prompt.is_active,
    });
    if (res.data) {
      setPrompts((prev) =>
        prev.map((p) => (p.id === prompt.id ? (res.data as GroupInterviewPrompt) : p))
      );
    }
  }

  /* ── Delete prompt ──────────────────────────────────────────── */

  async function deletePrompt(promptId: string) {
    const res = await callApi("delete_prompt", { prompt_id: promptId });
    if (res.success) {
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
    }
  }

  /* ── Drag and drop reorder ──────────────────────────────────── */

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;

    const activeList = prompts.filter((p) => p.is_active);
    const inactiveList = prompts.filter((p) => !p.is_active);

    const reordered = [...activeList];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(destIdx, 0, moved);

    // Merge active (reordered) + inactive back
    setPrompts([...reordered, ...inactiveList]);

    // Persist reorder
    await callApi("reorder_prompts", {
      team_id: teamId,
      ordered_ids: reordered.map((p) => p.id),
    });
  }

  /* ── Render ─────────────────────────────────────────────────── */

  const activePrompts = prompts.filter((p) => p.is_active);
  const inactivePrompts = prompts.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[#272727]">Group Interview Prompts</h3>
        <p className="text-sm text-[#a59494] mt-1">
          These conversation prompts are shown to interviewers during group sessions.
          They are not scored — just guides for discussion.
        </p>
      </div>

      {/* Seed defaults if empty */}
      {prompts.length === 0 && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-6 text-center">
          <p className="text-sm text-[#272727] mb-3">
            No prompts configured yet. Would you like to start with our recommended defaults?
          </p>
          <button
            onClick={seedDefaults}
            disabled={seeding}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
          >
            {seeding ? "Adding Defaults..." : "Add Default Prompts"}
          </button>
        </div>
      )}

      {/* Active prompts with DnD */}
      {activePrompts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[#272727]">Active Prompts</h4>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="active-prompts">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-1"
                >
                  {activePrompts.map((prompt, idx) => (
                    <Draggable key={prompt.id} draggableId={prompt.id} index={idx}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`flex items-start gap-3 bg-white border rounded-lg px-4 py-3 group ${
                            snapshot.isDragging
                              ? "border-brand shadow-lg"
                              : "border-[#a59494]/20"
                          }`}
                        >
                          {/* Drag handle */}
                          <div
                            {...dragProvided.dragHandleProps}
                            className="mt-1 cursor-grab active:cursor-grabbing text-[#a59494] hover:text-[#272727] transition"
                            title="Drag to reorder"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="9" cy="5" r="1.5" />
                              <circle cx="15" cy="5" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="19" r="1.5" />
                              <circle cx="15" cy="19" r="1.5" />
                            </svg>
                          </div>

                          {/* Prompt text (editable) */}
                          <div className="flex-1 min-w-0">
                            {editingId === prompt.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEdit(prompt.id);
                                    if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                                  }}
                                  className="flex-1 border border-[#a59494]/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEdit(prompt.id)}
                                  disabled={saving}
                                  className="text-sm text-brand font-medium hover:text-brand-dark"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingId(null); setEditText(""); }}
                                  className="text-sm text-[#a59494] hover:text-[#272727]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <p
                                className="text-sm text-[#272727] cursor-pointer hover:text-brand transition"
                                onClick={() => { setEditingId(prompt.id); setEditText(prompt.prompt_text); }}
                                title="Click to edit"
                              >
                                {prompt.prompt_text}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button
                              onClick={() => toggleActive(prompt)}
                              className="p-1 text-[#a59494] hover:text-orange-500 transition"
                              title="Deactivate"
                            >
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deletePrompt(prompt.id)}
                              className="p-1 text-[#a59494] hover:text-red-500 transition"
                              title="Delete"
                            >
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {/* Add new prompt */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add a new prompt..."
          value={newPromptText}
          onChange={(e) => setNewPromptText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addPrompt();
          }}
          className="flex-1 border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
        />
        <button
          onClick={addPrompt}
          disabled={!newPromptText.trim() || saving}
          className="px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Inactive prompts */}
      {inactivePrompts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[#a59494]">
            Inactive Prompts ({inactivePrompts.length})
          </h4>
          <div className="space-y-1">
            {inactivePrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="flex items-center gap-3 bg-[#f5f0f0] border border-[#a59494]/10 rounded-lg px-4 py-3 opacity-60 group"
              >
                <p className="flex-1 text-sm text-[#272727] line-through">
                  {prompt.prompt_text}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => toggleActive(prompt)}
                    className="p-1 text-[#a59494] hover:text-green-600 transition"
                    title="Reactivate"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deletePrompt(prompt.id)}
                    className="p-1 text-[#a59494] hover:text-red-500 transition"
                    title="Delete permanently"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
