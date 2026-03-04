"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Interview, ScoringCriterion, InterviewScore } from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  interview: Interview;
  criteria: ScoringCriterion[];
  onClose: () => void;
  onScored: () => void;
}

/* ── Category grouping ─────────────────────────────────────────── */

const CATEGORIES = [
  { name: "Mindset & Drive", range: [1, 5] },
  { name: "Communication & People Skills", range: [6, 9] },
  { name: "Business Acumen & Real Estate Knowledge", range: [10, 13] },
  { name: "Culture & Team Fit", range: [14, 16] },
  { name: "Execution & Structure", range: [17, 19] },
];

function getCategoryForCriterion(orderIndex: number): string {
  for (const cat of CATEGORIES) {
    if (orderIndex >= cat.range[0] && orderIndex <= cat.range[1]) return cat.name;
  }
  return "Other";
}

/* ── Main Component ────────────────────────────────────────────── */

export default function ScorecardModal({
  interview,
  criteria,
  onClose,
  onScored,
}: Props) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notesByField, setNotesByField] = useState<Record<string, string>>({});
  const [existingScores, setExistingScores] = useState<InterviewScore[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load existing scores
  useEffect(() => {
    async function loadScores() {
      const supabase = createClient();
      const { data } = await supabase
        .from("interview_scores")
        .select("*, evaluator:users(name), criterion:scoring_criteria(name, weight_percent)")
        .eq("candidate_id", interview.candidate_id)
        .eq("interview_id", interview.id);

      if (data) {
        setExistingScores(data as InterviewScore[]);
        // Pre-fill if current user already scored
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const myScores = data.filter((s: InterviewScore) => s.evaluator_id === user.id);
          const scoreMap: Record<string, number> = {};
          const notesMap: Record<string, string> = {};
          myScores.forEach((s: InterviewScore) => {
            scoreMap[s.criterion_id] = s.score;
            if (s.notes) notesMap[s.criterion_id] = s.notes;
          });
          setScores(scoreMap);
          setNotesByField(notesMap);
        }
      }
      setIsLoading(false);
    }
    loadScores();
  }, [interview.candidate_id, interview.id]);

  // Grouped criteria
  const grouped = criteria.reduce(
    (acc, c) => {
      const cat = getCategoryForCriterion(c.order_index);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(c);
      return acc;
    },
    {} as Record<string, ScoringCriterion[]>
  );

  // Calculate weighted total
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight_percent, 0);
  const weightedScore = criteria.reduce((sum, c) => {
    const s = scores[c.id];
    if (s === undefined) return sum;
    return sum + (s / 10) * c.weight_percent;
  }, 0);
  const normalizedScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
  const scoredCount = Object.keys(scores).length;

  async function handleSave() {
    if (scoredCount === 0) {
      setError("Please score at least one criterion");
      return;
    }
    setIsSaving(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to submit scores");
      setIsSaving(false);
      return;
    }

    const upserts = Object.entries(scores).map(([criterionId, score]) => ({
      candidate_id: interview.candidate_id,
      evaluator_id: user.id,
      criterion_id: criterionId,
      interview_id: interview.id,
      score,
      notes: notesByField[criterionId] || null,
    }));

    const { error: dbError } = await supabase.from("interview_scores").upsert(upserts, {
      onConflict: "candidate_id,evaluator_id,criterion_id",
    });

    if (dbError) {
      setError(dbError.message);
      setIsSaving(false);
      return;
    }

    // Mark interview completed
    await supabase
      .from("interviews")
      .update({ status: "completed" })
      .eq("id", interview.id);

    onScored();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#272727]">Interview Scorecard</h3>
            <p className="text-sm text-[#a59494]">
              {interview.candidate?.first_name} {interview.candidate?.last_name} —{" "}
              {interview.interview_type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Score summary bar */}
        <div className="px-6 py-3 bg-[#f5f0f0]/50 border-b border-[#a59494]/10 flex items-center gap-6 shrink-0">
          <div>
            <span className="text-xs text-[#a59494]">Weighted Score</span>
            <p className="text-xl font-bold text-[#1c759e]">
              {scoredCount > 0 ? normalizedScore.toFixed(1) : "—"}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#a59494]">Criteria Scored</span>
            <p className="text-xl font-bold text-[#272727]">
              {scoredCount} / {criteria.length}
            </p>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-[#a59494]/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1c759e] rounded-full transition-all duration-300"
                style={{ width: `${(scoredCount / Math.max(criteria.length, 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-[#a59494]">Loading scores...</div>
          ) : (
            <div className="space-y-6">
              {CATEGORIES.map((cat) => {
                const catCriteria = grouped[cat.name] ?? [];
                if (catCriteria.length === 0) return null;
                const catWeight = catCriteria.reduce((s, c) => s + c.weight_percent, 0);

                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-[#272727]">{cat.name}</h4>
                      <span className="text-xs text-[#a59494]">{catWeight}% weight</span>
                    </div>
                    <div className="space-y-3">
                      {catCriteria.map((criterion) => (
                        <CriterionRow
                          key={criterion.id}
                          criterion={criterion}
                          score={scores[criterion.id]}
                          note={notesByField[criterion.id] ?? ""}
                          onScoreChange={(val) =>
                            setScores((prev) => ({ ...prev, [criterion.id]: val }))
                          }
                          onNoteChange={(val) =>
                            setNotesByField((prev) => ({ ...prev, [criterion.id]: val }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#a59494]/10 shrink-0">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || scoredCount === 0}
              className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSaving ? "Saving Scores..." : "Save Scorecard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Criterion Row ─────────────────────────────────────────────── */

function CriterionRow({
  criterion,
  score,
  note,
  onScoreChange,
  onNoteChange,
}: {
  criterion: ScoringCriterion;
  score: number | undefined;
  note: string;
  onScoreChange: (val: number) => void;
  onNoteChange: (val: string) => void;
}) {
  const [showNote, setShowNote] = useState(!!note);
  const belowThreshold =
    criterion.min_threshold !== null &&
    score !== undefined &&
    score < criterion.min_threshold;

  return (
    <div className="rounded-lg border border-[#a59494]/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#272727]">{criterion.name}</span>
            <span className="text-[10px] text-[#a59494]">{criterion.weight_percent}%</span>
            {criterion.min_threshold !== null && (
              <span className="text-[10px] text-[#a59494]">
                min: {criterion.min_threshold}
              </span>
            )}
          </div>
          {belowThreshold && (
            <p className="text-[10px] text-red-500 mt-0.5">Below minimum threshold</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Score buttons 1-10 */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
            <button
              key={val}
              onClick={() => onScoreChange(val)}
              className={`w-7 h-7 rounded text-xs font-medium transition ${
                score === val
                  ? belowThreshold
                    ? "bg-red-500 text-white"
                    : "bg-[#1c759e] text-white"
                  : "bg-[#f5f0f0] text-[#272727] hover:bg-[#1c759e]/10"
              }`}
            >
              {val}
            </button>
          ))}

          {/* Note toggle */}
          <button
            onClick={() => setShowNote(!showNote)}
            className={`ml-1 w-7 h-7 rounded flex items-center justify-center transition ${
              showNote ? "bg-[#1c759e]/10 text-[#1c759e]" : "bg-[#f5f0f0] text-[#a59494] hover:text-[#272727]"
            }`}
            title="Add note"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>

      {showNote && (
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a note..."
          className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-[#a59494]/30 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-1 focus:ring-[#1c759e] transition"
        />
      )}
    </div>
  );
}
