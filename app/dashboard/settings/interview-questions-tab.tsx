"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type {
  InterviewQuestion,
  InterviewerQuestionSelection,
  TeamUser,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  questions: InterviewQuestion[];
  onQuestionsUpdated: (questions: InterviewQuestion[]) => void;
  teamId: string;
  currentUserId: string;
  users: TeamUser[];
}

/* ── Category order (matches interview flow) ──────────────────── */

const CATEGORY_ORDER = [
  "Timeline & Rapport",
  "Values - Joy",
  "Values - Ownership",
  "Values - Grit",
  "Coachability",
  "Curiosity",
  "Work Ethic",
  "Intelligence",
  "Prior Success",
  "Passion",
  "Adaptability",
  "Emotional Intelligence",
  "Resilience",
  "Confidence",
  "Closing",
];

/* ── Helpers ──────────────────────────────────────────────────── */

async function callApi(
  url: string,
  action: string,
  payload: Record<string, unknown>
): Promise<{ data?: unknown; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

/* ── Main Component ──────────────────────────────────────────── */

export default function InterviewQuestionsTab({
  questions,
  onQuestionsUpdated,
  teamId,
  currentUserId,
  users,
}: Props) {
  const [subTab, setSubTab] = useState<"bank" | "personal">("bank");
  const [usageCounts, setUsageCounts] = useState<
    Record<string, { count: number; users: string[] }>
  >({});
  const [mySelections, setMySelections] = useState<
    InterviewerQuestionSelection[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  // Add/edit form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formText, setFormText] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORY_ORDER[0]);
  const [formNote, setFormNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load usage counts
  const loadUsage = useCallback(async () => {
    const result = await callApi("/api/interview-questions", "list", {
      team_id: teamId,
    });
    if (result.data) {
      onQuestionsUpdated(result.data as InterviewQuestion[]);
    }
    if ((result as Record<string, unknown>).usage) {
      setUsageCounts(
        (result as Record<string, unknown>).usage as Record<
          string,
          { count: number; users: string[] }
        >
      );
    }
  }, [teamId, onQuestionsUpdated]);

  // Load personal selections
  const loadSelections = useCallback(async () => {
    const result = await callApi("/api/interview-questions/my-set", "get", {
      user_id: currentUserId,
      team_id: teamId,
    });
    if (result.data) {
      setMySelections(result.data as InterviewerQuestionSelection[]);
    }
  }, [currentUserId, teamId]);

  useEffect(() => {
    loadUsage();
    loadSelections();
  }, [loadUsage, loadSelections]);

  // Filter questions
  const activeQuestions = questions.filter((q) =>
    showArchived ? true : q.is_active
  );
  const filteredQuestions =
    categoryFilter === "all"
      ? activeQuestions
      : activeQuestions.filter((q) => q.category === categoryFilter);

  // Group by category
  const grouped = new Map<string, InterviewQuestion[]>();
  for (const cat of CATEGORY_ORDER) {
    const catQuestions = filteredQuestions
      .filter((q) => q.category === cat)
      .sort((a, b) => a.sort_order - b.sort_order || a.order_index - b.order_index);
    if (catQuestions.length > 0) grouped.set(cat, catQuestions);
  }
  // Add uncategorized
  const uncategorized = filteredQuestions.filter(
    (q) => !CATEGORY_ORDER.includes(q.category)
  );
  if (uncategorized.length > 0) grouped.set("Other", uncategorized);

  // Get categories that exist
  const existingCategories = [
    ...new Set(questions.map((q) => q.category)),
  ].sort();

  /* ── Add question ──────────────────────────────────────────── */
  async function handleAdd() {
    if (!formText.trim() || !formCategory) return;
    setIsSaving(true);
    const result = await callApi("/api/interview-questions", "create", {
      team_id: teamId,
      question_text: formText.trim(),
      category: formCategory,
      interviewer_note: formNote.trim() || null,
    });
    if (result.data) {
      onQuestionsUpdated([
        ...questions,
        result.data as InterviewQuestion,
      ]);
      setFormText("");
      setFormNote("");
      setIsAdding(false);
    }
    setIsSaving(false);
  }

  /* ── Edit question ─────────────────────────────────────────── */
  async function handleSaveEdit() {
    if (!editingId || !formText.trim()) return;
    setIsSaving(true);
    const result = await callApi("/api/interview-questions", "update", {
      id: editingId,
      question_text: formText.trim(),
      category: formCategory,
      interviewer_note: formNote.trim() || null,
    });
    if (result.data) {
      const updated = result.data as InterviewQuestion;
      onQuestionsUpdated(
        questions.map((q) => (q.id === updated.id ? updated : q))
      );
      setEditingId(null);
      setFormText("");
      setFormNote("");
    }
    setIsSaving(false);
  }

  /* ── Archive / Restore ─────────────────────────────────────── */
  async function handleToggleArchive(q: InterviewQuestion) {
    const result = await callApi("/api/interview-questions", "update", {
      id: q.id,
      is_active: !q.is_active,
    });
    if (result.data) {
      const updated = result.data as InterviewQuestion;
      onQuestionsUpdated(
        questions.map((qo) => (qo.id === updated.id ? updated : qo))
      );
    }
  }

  /* ── Toggle personal selection ─────────────────────────────── */
  async function handleToggleSelection(
    questionId: string,
    currentActive: boolean
  ) {
    setIsLoading(true);
    await callApi("/api/interview-questions/my-set", "toggle", {
      user_id: currentUserId,
      question_id: questionId,
      team_id: teamId,
      is_active: !currentActive,
    });
    await loadSelections();
    await loadUsage();
    setIsLoading(false);
  }

  /* ── Init personal set ─────────────────────────────────────── */
  async function handleInitMySet() {
    setIsLoading(true);
    await callApi("/api/interview-questions/my-set", "init", {
      user_id: currentUserId,
      team_id: teamId,
    });
    await loadSelections();
    await loadUsage();
    setIsLoading(false);
  }

  function startEdit(q: InterviewQuestion) {
    setEditingId(q.id);
    setFormText(q.question_text);
    setFormCategory(q.category);
    setFormNote(q.interviewer_note ?? "");
  }

  /* ── Drag and drop reorder (within a category) ───────────────── */
  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { droppableId } = result.source;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;

    // droppableId is the category name
    const category = droppableId;
    const catQuestions = questions
      .filter((q) => q.category === category && (showArchived ? true : q.is_active))
      .sort((a, b) => a.sort_order - b.sort_order || a.order_index - b.order_index);

    const reordered = [...catQuestions];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(destIdx, 0, moved);

    // Build the update items with new sort_order values
    const items = reordered.map((q, idx) => ({
      id: q.id,
      sort_order: idx,
    }));

    // Optimistic update: apply new sort_order to local state
    const sortMap = new Map(items.map((item) => [item.id, item.sort_order]));
    const updatedQuestions = questions.map((q) =>
      sortMap.has(q.id) ? { ...q, sort_order: sortMap.get(q.id)! } : q
    );
    onQuestionsUpdated(updatedQuestions);

    // Persist to server
    await callApi("/api/interview-questions", "reorder", { items });
  }

  // Build selection lookup
  const selectionMap = new Map<string, InterviewerQuestionSelection>();
  mySelections.forEach((s) => selectionMap.set(s.question_id, s));

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSubTab("bank")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            subTab === "bank"
              ? "bg-brand/10 text-brand border border-brand/30"
              : "text-[#272727] hover:bg-[#f5f0f0] border border-transparent"
          }`}
        >
          Team Question Bank
        </button>
        <button
          onClick={() => setSubTab("personal")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            subTab === "personal"
              ? "bg-brand/10 text-brand border border-brand/30"
              : "text-[#272727] hover:bg-[#f5f0f0] border border-transparent"
          }`}
        >
          My Question Set
        </button>
      </div>

      {/* ════════════ BANK TAB ════════════ */}
      {subTab === "bank" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-[#a59494]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded"
              />
              Show archived
            </label>

            <button
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
                setFormText("");
                setFormNote("");
                setFormCategory(CATEGORY_ORDER[0]);
              }}
              className="ml-auto px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition"
            >
              + Add Question
            </button>
          </div>

          {/* Add form */}
          {isAdding && (
            <div className="bg-white rounded-xl border border-brand/30 shadow-sm p-4 space-y-3">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-white"
              >
                {CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Question text..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              />
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Interviewer note (optional — e.g. 'Listen for...')"
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isSaving || !formText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Add Question"}
                </button>
              </div>
            </div>
          )}

          {/* Questions grouped by category (with drag-and-drop reorder) */}
          <DragDropContext onDragEnd={onDragEnd}>
            {[...grouped.entries()].map(([category, catQuestions]) => (
              <div
                key={category}
                className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm"
              >
                <div className="px-4 py-3 border-b border-[#a59494]/10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#272727]">
                      {category}
                    </h4>
                    <span className="text-xs text-[#a59494]">
                      {catQuestions.length} question
                      {catQuestions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <Droppable droppableId={category}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="divide-y divide-[#a59494]/10"
                    >
                      {catQuestions.map((q, idx) => {
                        const usage = usageCounts[q.id];

                        if (editingId === q.id) {
                          return (
                            <Draggable key={q.id} draggableId={q.id} index={idx} isDragDisabled>
                              {(dragProvided) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className="p-4 bg-[#f5f0f0]/50 space-y-3"
                                >
                                  <textarea
                                    value={formText}
                                    onChange={(e) => setFormText(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                                  />
                                  <div className="flex gap-3">
                                    <select
                                      value={formCategory}
                                      onChange={(e) =>
                                        setFormCategory(e.target.value)
                                      }
                                      className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-white"
                                    >
                                      {CATEGORY_ORDER.map((cat) => (
                                        <option key={cat} value={cat}>
                                          {cat}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      value={formNote}
                                      onChange={(e) => setFormNote(e.target.value)}
                                      placeholder="Interviewer note..."
                                      className="flex-1 px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494]"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveEdit}
                                      disabled={isSaving || !formText.trim()}
                                      className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
                                    >
                                      {isSaving ? "..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        }

                        return (
                          <Draggable key={q.id} draggableId={q.id} index={idx}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`px-4 py-3 flex items-start gap-3 group ${
                                  !q.is_active ? "opacity-50" : ""
                                } ${
                                  snapshot.isDragging
                                    ? "bg-brand/5 border border-brand/30 rounded-lg shadow-lg"
                                    : ""
                                }`}
                              >
                                {/* Drag handle */}
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="mt-0.5 cursor-grab active:cursor-grabbing text-[#a59494] hover:text-[#272727] transition shrink-0"
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
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[#272727]">
                                    {q.question_text}
                                  </p>
                                  {q.interviewer_note && (
                                    <p className="text-xs text-[#a59494] mt-1 italic">
                                      Tip: {q.interviewer_note}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {usage && usage.count > 0 && (
                                    <span
                                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand cursor-help"
                                      title={usage.users.join(", ")}
                                    >
                                      Used by {usage.count}
                                    </span>
                                  )}
                                  {!q.is_active && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#a59494]/10 text-[#a59494]">
                                      Archived
                                    </span>
                                  )}
                                  <button
                                    onClick={() => startEdit(q)}
                                    className="text-xs font-medium text-brand hover:text-brand-dark transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleToggleArchive(q)}
                                    className="text-xs font-medium text-[#a59494] hover:text-[#272727] transition"
                                  >
                                    {q.is_active ? "Archive" : "Restore"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </DragDropContext>

          {grouped.size === 0 && (
            <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-8 text-center">
              <p className="text-sm text-[#a59494]">
                No interview questions yet. Add questions or run the seed
                migration.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════ PERSONAL SET TAB ════════════ */}
      {subTab === "personal" && (
        <PersonalSetSection
          questions={questions}
          mySelections={mySelections}
          selectionMap={selectionMap}
          usageCounts={usageCounts}
          isLoading={isLoading}
          onToggleSelection={handleToggleSelection}
          onInitMySet={handleInitMySet}
        />
      )}
    </div>
  );
}

/* ── Personal Set Section ────────────────────────────────────────── */

function PersonalSetSection({
  questions,
  mySelections,
  selectionMap,
  usageCounts,
  isLoading,
  onToggleSelection,
  onInitMySet,
}: {
  questions: InterviewQuestion[];
  mySelections: InterviewerQuestionSelection[];
  selectionMap: Map<string, InterviewerQuestionSelection>;
  usageCounts: Record<string, { count: number; users: string[] }>;
  isLoading: boolean;
  onToggleSelection: (questionId: string, currentActive: boolean) => void;
  onInitMySet: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const selectedQuestionIds = new Set(
    mySelections.filter((s) => s.is_active).map((s) => s.question_id)
  );

  const hasSelectedQuestions = selectedQuestionIds.size > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#a59494]">
          {showAll
            ? "Toggle questions on/off to customize your interview set."
            : "Your selected questions that appear on your scorecards."}
        </p>
        <div className="flex items-center gap-2">
          {hasSelectedQuestions && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              {showAll ? "Show Selected Only" : "Edit Selection"}
            </button>
          )}
          {mySelections.length === 0 && (
            <button
              onClick={onInitMySet}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isLoading ? "Setting up..." : "Activate All Questions"}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasSelectedQuestions && mySelections.length > 0 && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-6 text-center">
          <p className="text-sm text-[#272727] mb-3">
            You haven&apos;t selected any questions for your personal set yet.
          </p>
          <button
            onClick={() => setShowAll(true)}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition"
          >
            Browse &amp; Select Questions
          </button>
        </div>
      )}

      {/* Questions grouped by category */}
      {CATEGORY_ORDER.map((category) => {
        const catQuestions = questions
          .filter((q) => q.category === category && q.is_active)
          .sort(
            (a, b) =>
              a.sort_order - b.sort_order || a.order_index - b.order_index
          );

        // In selected-only mode, filter to only selected questions
        const displayQuestions = showAll
          ? catQuestions
          : catQuestions.filter((q) => selectedQuestionIds.has(q.id));

        if (displayQuestions.length === 0) return null;

        const activeCount = catQuestions.filter((q) =>
          selectedQuestionIds.has(q.id)
        ).length;

        return (
          <div
            key={category}
            className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm"
          >
            <div className="px-4 py-3 border-b border-[#a59494]/10">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#272727]">
                  {category}
                </h4>
                <span className="text-xs text-[#a59494]">
                  {activeCount}/{catQuestions.length} active
                </span>
              </div>
            </div>
            <div className="divide-y divide-[#a59494]/10">
              {displayQuestions.map((q) => {
                const sel = selectionMap.get(q.id);
                const isActive = sel?.is_active ?? false;
                const usage = usageCounts[q.id];

                return (
                  <div
                    key={q.id}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <button
                      onClick={() => onToggleSelection(q.id, isActive)}
                      disabled={isLoading}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                        isActive
                          ? "bg-brand border-brand"
                          : "border-[#a59494]/40 hover:border-brand"
                      }`}
                    >
                      {isActive && (
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
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          isActive ? "text-[#272727]" : "text-[#a59494]"
                        }`}
                      >
                        {q.question_text}
                      </p>
                      {q.interviewer_note && (
                        <p className="text-xs text-[#a59494] mt-0.5 italic">
                          {q.interviewer_note}
                        </p>
                      )}
                    </div>
                    {usage && usage.count > 0 && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand cursor-help shrink-0"
                        title={usage.users.join(", ")}
                      >
                        {usage.count} using
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
