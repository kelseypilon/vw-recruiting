"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Interview,
  InterviewQuestion,
  InterviewScorecard,
  ScorecardAnswer,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  interview: Interview;
  questions: InterviewQuestion[];
  existingScorecard?: InterviewScorecard | null;
  currentUserId: string;
  teamId: string;
  tips?: string[];
  stages?: { id: string; name: string; order_index: number }[];
  leaders?: { id: string; name: string; email: string; from_email?: string | null }[];
  escalationContact?: { id: string; name: string; email: string; from_email?: string | null } | null;
  onClose: () => void;
  onSaved: (scorecard: InterviewScorecard) => void;
}

/* ── Category ordering ─────────────────────────────────────────── */

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

function categoryIndex(cat: string) {
  const idx = CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

/* ── Recommendation labels ─────────────────────────────────────── */

const RECOMMENDATIONS = [
  { value: "strong_yes", label: "Strong Yes", color: "bg-green-600" },
  { value: "yes", label: "Yes", color: "bg-green-500" },
  { value: "hold", label: "Hold", color: "bg-amber-500" },
  { value: "no", label: "No", color: "bg-red-500" },
] as const;

/* ── Helpers ───────────────────────────────────────────────────── */

async function callApi(
  url: string,
  action: string,
  payload: Record<string, unknown>
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

function computeCategoryScores(answers: ScorecardAnswer[]) {
  const groups: Record<string, number[]> = {};
  for (const a of answers) {
    if (a.score !== null && a.score > 0) {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a.score);
    }
  }
  const result: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(groups)) {
    result[cat] = Number(
      (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)
    );
  }
  return result;
}

function computeOverallScore(answers: ScorecardAnswer[]) {
  const scored = answers.filter((a) => a.score !== null && a.score > 0);
  if (scored.length === 0) return null;
  return Number(
    (
      scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length
    ).toFixed(2)
  );
}

/* ── Star Rating Component ─────────────────────────────────────── */

function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number | null;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hover || (value ?? 0));
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            className="transition-transform hover:scale-110"
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={filled ? "#f59e0b" : "none"}
              stroke={filled ? "#f59e0b" : "#d1d5db"}
              strokeWidth="1.5"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

export default function ScorecardModal({
  interview,
  questions,
  existingScorecard,
  currentUserId,
  teamId,
  tips,
  stages,
  leaders,
  escalationContact,
  onClose,
  onSaved,
}: Props) {
  // ── State ────────────────────────────────────────────
  const [answers, setAnswers] = useState<ScorecardAnswer[]>([]);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [summaryNotes, setSummaryNotes] = useState("");
  const [viewMode, setViewMode] = useState<"category" | "full">("category");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Next Step state ──
  const [nextStepView, setNextStepView] = useState<"choose" | "advance" | "hold" | "not_a_fit" | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [holdFollowUpDate, setHoldFollowUpDate] = useState("");
  const [isProcessingNextStep, setIsProcessingNextStep] = useState(false);
  const [nextStepError, setNextStepError] = useState("");

  // ── Initialize answers from questions or existing scorecard ──
  useEffect(() => {
    async function load() {
      if (existingScorecard) {
        setAnswers(existingScorecard.answers);
        setRecommendation(existingScorecard.recommendation);
        setSummaryNotes(existingScorecard.summary_notes ?? "");
        setIsSubmitted(!!existingScorecard.submitted_at);
      } else {
        // Try to fetch existing draft/scorecard for this user + interview
        const result = await callApi(
          "/api/interview-scorecards",
          "get",
          {
            interview_id: interview.id,
            interviewer_user_id: currentUserId,
          }
        );

        if (result.data) {
          const sc = result.data as InterviewScorecard;
          setAnswers(sc.answers);
          setRecommendation(sc.recommendation);
          setSummaryNotes(sc.summary_notes ?? "");
          setIsSubmitted(!!sc.submitted_at);
        } else {
          // Build fresh answers from questions
          const fresh: ScorecardAnswer[] = questions.map((q) => ({
            question_id: q.id,
            question_text: q.question_text,
            category: q.category,
            score: null,
            notes: "",
          }));
          setAnswers(fresh);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [interview.id, currentUserId, existingScorecard, questions]);

  // ── Auto-save draft every 30s if dirty ──
  const saveDraft = useCallback(
    async (ans: ScorecardAnswer[], rec: string | null, notes: string) => {
      const categoryScores = computeCategoryScores(ans);
      const overallScore = computeOverallScore(ans);

      const result = await callApi(
        "/api/interview-scorecards",
        "save_draft",
        {
          interview_id: interview.id,
          interviewer_user_id: currentUserId,
          candidate_id: interview.candidate_id,
          team_id: teamId,
          answers: ans,
          category_scores: categoryScores,
          overall_score: overallScore,
          recommendation: rec,
          summary_notes: notes,
        }
      );

      if (!result.error) {
        setLastSaved(new Date().toLocaleTimeString());
        setIsDirty(false);
      }
      return result;
    },
    [interview.id, interview.candidate_id, currentUserId, teamId]
  );

  useEffect(() => {
    if (!isDirty || isSubmitted) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft(answers, recommendation, summaryNotes);
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, answers, recommendation, summaryNotes, saveDraft, isSubmitted]);

  // ── Answer update helpers ──
  function updateScore(questionId: string, score: number) {
    setAnswers((prev) =>
      prev.map((a) => (a.question_id === questionId ? { ...a, score } : a))
    );
    setIsDirty(true);
  }

  function updateNotes(questionId: string, notes: string) {
    setAnswers((prev) =>
      prev.map((a) => (a.question_id === questionId ? { ...a, notes } : a))
    );
    setIsDirty(true);
  }

  // ── Save / Submit ──
  async function handleSaveDraft() {
    setIsSaving(true);
    setError("");
    const result = await saveDraft(answers, recommendation, summaryNotes);
    if (result.error) {
      setError(result.error);
    } else {
      setLastSaved(new Date().toLocaleTimeString());
    }
    setIsSaving(false);
  }

  async function handleSubmit() {
    const scoredCount = answers.filter((a) => a.score !== null && a.score > 0).length;
    if (scoredCount === 0) {
      setError("Please score at least one question before submitting");
      return;
    }
    setIsSaving(true);
    setError("");

    const categoryScores = computeCategoryScores(answers);
    const overallScore = computeOverallScore(answers);

    const result = await callApi(
      "/api/interview-scorecards",
      "submit",
      {
        interview_id: interview.id,
        interviewer_user_id: currentUserId,
        candidate_id: interview.candidate_id,
        team_id: teamId,
        answers,
        category_scores: categoryScores,
        overall_score: overallScore,
        recommendation,
        summary_notes: summaryNotes,
      }
    );

    if (result.error) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    setIsSubmitted(true);
    setIsSaving(false);
    onSaved(result.data as InterviewScorecard);
    // Show next step flow
    setNextStepView("choose");
  }

  // ── Next step handlers ──
  const candidateName = `${interview.candidate?.first_name ?? ""} ${interview.candidate?.last_name ?? ""}`.trim();

  async function handleAdvance() {
    setIsProcessingNextStep(true);
    setNextStepError("");
    try {
      const supabase = createClient();
      const currentStage = interview.candidate?.stage;
      const sortedStages = [...(stages ?? [])].sort((a, b) => a.order_index - b.order_index);
      const currentIdx = sortedStages.findIndex((s) => s.name === currentStage);
      const nextStage = currentIdx >= 0 && currentIdx < sortedStages.length - 1
        ? sortedStages[currentIdx + 1]
        : null;

      if (!nextStage) {
        setNextStepError("No next stage available");
        setIsProcessingNextStep(false);
        return;
      }

      // Move candidate to next stage
      await supabase.from("candidates").update({ stage: nextStage.name }).eq("id", interview.candidate_id);

      // Record stage history
      await supabase.from("stage_history").insert({
        candidate_id: interview.candidate_id,
        from_stage: currentStage,
        to_stage: nextStage.name,
        changed_by: currentUserId,
      });

      // Mark interview as completed
      await supabase.from("interviews").update({ status: "completed" }).eq("id", interview.id);

      // Create next interview
      const { data: newInt } = await supabase.from("interviews").insert({
        team_id: teamId,
        candidate_id: interview.candidate_id,
        interview_type: "1on1 Interview",
        status: "scheduled",
        notes: `Advanced from ${currentStage}`,
      }).select("id").single();

      if (newInt) {
        await supabase.from("interview_interviewers").insert({
          interview_id: newInt.id,
          user_id: currentUserId,
          role: "lead",
        });
      }

      onClose();
    } catch {
      setNextStepError("Failed to advance candidate");
    }
    setIsProcessingNextStep(false);
  }

  async function handleHold() {
    if (!holdReason.trim()) {
      setNextStepError("Hold reason is required");
      return;
    }
    if (!holdFollowUpDate) {
      setNextStepError("Follow-up date is required");
      return;
    }
    setIsProcessingNextStep(true);
    setNextStepError("");
    try {
      const supabase = createClient();

      // Update interview to hold status
      await supabase.from("interviews").update({
        status: "hold",
        hold_reason: holdReason,
        hold_follow_up_date: holdFollowUpDate,
        hold_set_at: new Date().toISOString(),
      }).eq("id", interview.id);

      // Set candidate kanban hold
      await supabase.from("candidates").update({
        kanban_hold: true,
        kanban_hold_reason: holdReason,
      }).eq("id", interview.candidate_id);

      onClose();
    } catch {
      setNextStepError("Failed to put candidate on hold");
    }
    setIsProcessingNextStep(false);
  }

  async function handleNotAFit() {
    setIsProcessingNextStep(true);
    setNextStepError("");
    try {
      const supabase = createClient();

      // Move candidate to "Not a Fit" stage
      const currentStage = interview.candidate?.stage;
      await supabase.from("candidates").update({ stage: "Not a Fit" }).eq("id", interview.candidate_id);

      // Record stage history
      await supabase.from("stage_history").insert({
        candidate_id: interview.candidate_id,
        from_stage: currentStage,
        to_stage: "Not a Fit",
        changed_by: currentUserId,
      });

      // Mark interview as completed
      await supabase.from("interviews").update({ status: "completed" }).eq("id", interview.id);

      onClose();
    } catch {
      setNextStepError("Failed to update candidate");
    }
    setIsProcessingNextStep(false);
  }

  // ── Grouped & sorted data ──
  const grouped = answers.reduce(
    (acc, a) => {
      if (!acc[a.category]) acc[a.category] = [];
      acc[a.category].push(a);
      return acc;
    },
    {} as Record<string, ScorecardAnswer[]>
  );

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryIndex(a) - categoryIndex(b)
  );

  // Full interview view: sorted by original question order
  const questionOrder = new Map(questions.map((q, i) => [q.id, i]));
  const sortedAnswers = [...answers].sort(
    (a, b) => (questionOrder.get(a.question_id) ?? 0) - (questionOrder.get(b.question_id) ?? 0)
  );

  // Question note lookup
  const questionNoteMap = new Map(
    questions.map((q) => [q.id, q.interviewer_note])
  );

  const categoryScores = computeCategoryScores(answers);
  const overallScore = computeOverallScore(answers);
  const scoredCount = answers.filter((a) => a.score !== null && a.score > 0).length;

  // ── Render ──
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#272727]">
                Interview Scorecard
              </h3>
              {isSubmitted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Submitted
                </span>
              )}
              {!isSubmitted && lastSaved && (
                <span className="text-[10px] text-[#a59494]">
                  Draft saved {lastSaved}
                </span>
              )}
            </div>
            <p className="text-sm text-[#a59494]">
              {interview.candidate?.first_name} {interview.candidate?.last_name}{" "}
              — {interview.interview_type}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-[#a59494]/30 overflow-hidden">
              <button
                onClick={() => setViewMode("category")}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "category"
                    ? "bg-brand text-white"
                    : "bg-white text-[#a59494] hover:text-[#272727]"
                }`}
              >
                By Category
              </button>
              <button
                onClick={() => setViewMode("full")}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "full"
                    ? "bg-brand text-white"
                    : "bg-white text-[#a59494] hover:text-[#272727]"
                }`}
              >
                Full Interview
              </button>
            </div>
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
        </div>

        {/* ── Score summary bar ── */}
        <div className="px-6 py-3 bg-[#f5f0f0]/50 border-b border-[#a59494]/10 flex items-center gap-6 shrink-0">
          <div>
            <span className="text-xs text-[#a59494]">Overall</span>
            <p className="text-xl font-bold text-brand">
              {overallScore !== null ? `${overallScore}/5` : "—"}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#a59494]">Questions Scored</span>
            <p className="text-xl font-bold text-[#272727]">
              {scoredCount} / {answers.length}
            </p>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-[#a59494]/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-300"
                style={{
                  width: `${(scoredCount / Math.max(answers.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Interview Tips ── */}
        {tips && tips.length > 0 && (
          <div className="px-6 py-2 border-b border-[#a59494]/10 shrink-0">
            <button
              onClick={() => setShowTips((prev) => !prev)}
              className="flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark transition"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${showTips ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Interview Tips
            </button>
            {showTips && (
              <div className="mt-2 p-3 bg-brand/5 rounded-lg">
                <ol className="space-y-1.5 text-xs text-[#272727] list-decimal list-inside">
                  {tips.map((tip, i) => (
                    <li key={i} className="leading-relaxed">{tip}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-[#a59494]">
              Loading scorecard...
            </div>
          ) : viewMode === "category" ? (
            /* ── Category View ── */
            <div className="space-y-6">
              {sortedCategories.map((cat) => {
                const catAnswers = grouped[cat];
                const catScore = categoryScores[cat];
                const catScored = catAnswers.filter(
                  (a) => a.score !== null && a.score > 0
                ).length;

                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-[#272727]">
                        {cat}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#a59494]">
                          {catScored}/{catAnswers.length} scored
                        </span>
                        {catScore !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-[#a59494]/20 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(catScore / 5) * 100}%`,
                                  backgroundColor:
                                    catScore >= 4
                                      ? "#10B981"
                                      : catScore >= 3
                                        ? "#F59E0B"
                                        : "#EF4444",
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-[#272727]">
                              {catScore.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {catAnswers.map((answer) => (
                        <QuestionRow
                          key={answer.question_id}
                          answer={answer}
                          interviewerNote={questionNoteMap.get(
                            answer.question_id
                          )}
                          disabled={isSubmitted}
                          onScoreChange={(s) =>
                            updateScore(answer.question_id, s)
                          }
                          onNotesChange={(n) =>
                            updateNotes(answer.question_id, n)
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Full Interview View ── */
            <div className="space-y-2">
              {sortedAnswers.map((answer) => (
                <QuestionRow
                  key={answer.question_id}
                  answer={answer}
                  interviewerNote={questionNoteMap.get(answer.question_id)}
                  showCategory
                  disabled={isSubmitted}
                  onScoreChange={(s) => updateScore(answer.question_id, s)}
                  onNotesChange={(n) => updateNotes(answer.question_id, n)}
                />
              ))}
            </div>
          )}

          {/* ── Recommendation + Summary ── */}
          <div className="mt-6 pt-6 border-t border-[#a59494]/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recommendation */}
              <div>
                <label className="block text-sm font-semibold text-[#272727] mb-2">
                  Recommendation
                </label>
                <div className="flex gap-2">
                  {RECOMMENDATIONS.map((rec) => (
                    <button
                      key={rec.value}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => {
                        setRecommendation(
                          recommendation === rec.value ? null : rec.value
                        );
                        setIsDirty(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        recommendation === rec.value
                          ? `${rec.color} text-white`
                          : "bg-[#f5f0f0] text-[#272727] hover:bg-[#a59494]/20"
                      } ${isSubmitted ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Notes */}
              <div>
                <label className="block text-sm font-semibold text-[#272727] mb-2">
                  Summary Notes
                </label>
                <textarea
                  value={summaryNotes}
                  onChange={(e) => {
                    setSummaryNotes(e.target.value);
                    setIsDirty(true);
                  }}
                  disabled={isSubmitted}
                  placeholder="Overall impressions, key takeaways..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#a59494]/30 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-1 focus:ring-brand transition resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Next Step View (after submission) ── */}
        {isSubmitted && nextStepView && (
          <div className="px-6 py-6 border-t border-[#a59494]/10 shrink-0 bg-[#f5f0f0]/30">
            {nextStepView === "choose" && (
              <div>
                <h4 className="text-base font-bold text-[#272727] mb-1">
                  What&apos;s next for {candidateName}?
                </h4>
                <p className="text-xs text-[#a59494] mb-4">
                  Scorecard submitted. Choose the next step for this candidate.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Advance */}
                  <button
                    onClick={() => setNextStepView("advance")}
                    className="p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 transition text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2 group-hover:bg-green-200 transition">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                        <polyline points="7 17 17 7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-green-800">Advance</p>
                    <p className="text-xs text-green-600 mt-0.5">Move to next stage</p>
                  </button>

                  {/* Hold */}
                  <button
                    onClick={() => setNextStepView("hold")}
                    className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:border-amber-400 transition text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2 group-hover:bg-amber-200 transition">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-amber-800">Hold</p>
                    <p className="text-xs text-amber-600 mt-0.5">Pause with follow-up</p>
                  </button>

                  {/* Not a Fit */}
                  <button
                    onClick={() => setNextStepView("not_a_fit")}
                    className="p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:border-red-400 transition text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2 group-hover:bg-red-200 transition">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-red-800">Not a Fit</p>
                    <p className="text-xs text-red-600 mt-0.5">Decline candidate</p>
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="mt-3 text-xs text-[#a59494] hover:text-[#272727] transition"
                >
                  Skip — decide later
                </button>
              </div>
            )}

            {nextStepView === "advance" && (
              <div>
                <button onClick={() => setNextStepView("choose")} className="text-xs text-brand hover:text-brand-dark mb-3 flex items-center gap-1 transition">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
                <h4 className="text-base font-bold text-[#272727] mb-1">Advance {candidateName}</h4>
                <p className="text-xs text-[#a59494] mb-4">
                  Candidate will be moved to the next pipeline stage and a new interview will be created.
                </p>
                {nextStepError && <p className="text-sm text-red-600 mb-2">{nextStepError}</p>}
                <button
                  onClick={handleAdvance}
                  disabled={isProcessingNextStep}
                  className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isProcessingNextStep ? "Advancing..." : "Confirm Advance"}
                </button>
              </div>
            )}

            {nextStepView === "hold" && (
              <div>
                <button onClick={() => setNextStepView("choose")} className="text-xs text-brand hover:text-brand-dark mb-3 flex items-center gap-1 transition">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
                <h4 className="text-base font-bold text-[#272727] mb-1">Hold {candidateName}</h4>
                <p className="text-xs text-[#a59494] mb-3">Candidate will be flagged on the kanban board. You&apos;ll be reminded on the follow-up date.</p>
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-[#272727] mb-1">Hold Reason *</label>
                    <textarea
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="Why is this candidate on hold?"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#a59494]/30 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-1 focus:ring-amber-400 transition resize-none"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#272727] mb-1">Follow-up Date *</label>
                    <input
                      type="date"
                      value={holdFollowUpDate}
                      onChange={(e) => setHoldFollowUpDate(e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg border border-[#a59494]/30 text-[#272727] focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                    />
                  </div>
                </div>
                {nextStepError && <p className="text-sm text-red-600 mt-2">{nextStepError}</p>}
                <button
                  onClick={handleHold}
                  disabled={isProcessingNextStep}
                  className="mt-3 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isProcessingNextStep ? "Processing..." : "Confirm Hold"}
                </button>
              </div>
            )}

            {nextStepView === "not_a_fit" && (
              <div>
                <button onClick={() => setNextStepView("choose")} className="text-xs text-brand hover:text-brand-dark mb-3 flex items-center gap-1 transition">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
                <h4 className="text-base font-bold text-[#272727] mb-1">Not a Fit — {candidateName}</h4>
                <p className="text-xs text-[#a59494] mb-4">
                  Candidate will be moved to &quot;Not a Fit&quot; stage. This action is final.
                </p>
                {nextStepError && <p className="text-sm text-red-600 mb-2">{nextStepError}</p>}
                <button
                  onClick={handleNotAFit}
                  disabled={isProcessingNextStep}
                  className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isProcessingNextStep ? "Processing..." : "Confirm Not a Fit"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-[#a59494]/10 shrink-0">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="text-xs text-[#a59494]">
              {isDirty && !isSubmitted && "Unsaved changes"}
            </div>
            <div className="flex gap-3">
              {isSubmitted && !nextStepView && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                >
                  Close
                </button>
              )}
              {!isSubmitted && (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg border border-brand text-sm font-semibold text-brand hover:bg-brand/5 transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSaving || scoredCount === 0}
                    className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {isSaving ? "Submitting..." : "Submit Scorecard"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Question Row ──────────────────────────────────────────────── */

function QuestionRow({
  answer,
  interviewerNote,
  showCategory,
  disabled,
  onScoreChange,
  onNotesChange,
}: {
  answer: ScorecardAnswer;
  interviewerNote?: string | null;
  showCategory?: boolean;
  disabled?: boolean;
  onScoreChange: (score: number) => void;
  onNotesChange: (notes: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(!!answer.notes);
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="rounded-lg border border-[#a59494]/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm text-[#272727] leading-snug">
              {answer.question_text}
            </p>
            {interviewerNote && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onMouseEnter={() => setShowTip(true)}
                  onMouseLeave={() => setShowTip(false)}
                  className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
                {showTip && (
                  <div className="absolute right-0 top-6 z-10 w-64 p-2 rounded-lg bg-amber-50 border border-amber-200 shadow-lg">
                    <p className="text-xs text-amber-800">{interviewerNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          {showCategory && (
            <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
              {answer.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StarRating
            value={answer.score}
            onChange={(s) => !disabled && onScoreChange(s)}
            size={18}
          />
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className={`w-7 h-7 rounded flex items-center justify-center transition ${
              showNotes || answer.notes
                ? "bg-brand/10 text-brand"
                : "bg-[#f5f0f0] text-[#a59494] hover:text-[#272727]"
            }`}
            title="Add note"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>

      {showNotes && (
        <textarea
          value={answer.notes}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={disabled}
          placeholder="Notes for this question..."
          className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-[#a59494]/30 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-1 focus:ring-brand transition resize-none disabled:opacity-60"
          rows={2}
        />
      )}
    </div>
  );
}
