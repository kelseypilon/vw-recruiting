"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CandidateCard, PipelineStage } from "@/lib/types";

interface Props {
  candidate: CandidateCard;
  stages: PipelineStage[];
  onStageChange: (candidateId: string, newStage: string) => void;
}

interface QuickViewData {
  scorecardAvg: number | null;
  notes: { note_text: string; author?: { name: string } }[];
  loading: boolean;
}

function scoreBadge(score: number | null) {
  if (score === null || score === undefined)
    return { bg: "bg-gray-100", text: "text-gray-500", label: "--" };
  if (score >= 80)
    return { bg: "bg-green-100", text: "text-green-800", label: score.toFixed(0) };
  if (score >= 60)
    return { bg: "bg-blue-100", text: "text-blue-800", label: score.toFixed(0) };
  return { bg: "bg-gray-100", text: "text-gray-600", label: score.toFixed(0) };
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function CandidateCardComponent({
  candidate,
  stages,
  onStageChange,
}: Props) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewData, setQuickViewData] = useState<QuickViewData>({
    scorecardAvg: null,
    notes: [],
    loading: true,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const quickViewRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showMoveMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMoveMenu]);

  // Close quick view on outside click or Escape
  useEffect(() => {
    if (!showQuickView) return;
    function handleClick(e: MouseEvent) {
      if (
        quickViewRef.current &&
        !quickViewRef.current.contains(e.target as Node)
      ) {
        setShowQuickView(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowQuickView(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showQuickView]);

  // Fetch extra data for quick view
  const fetchQuickViewData = useCallback(async () => {
    setQuickViewData((d) => ({ ...d, loading: true }));
    const supabase = createClient();

    const [scoresRes, notesRes] = await Promise.all([
      supabase
        .from("interview_scorecards")
        .select("overall_score")
        .eq("candidate_id", candidate.id),
      supabase
        .from("candidate_notes")
        .select("note_text, author:users!candidate_notes_author_id_fkey(name)")
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    const scores = (scoresRes.data ?? [])
      .map((s) => s.overall_score)
      .filter((s): s is number => s !== null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const rawNotes = (notesRes.data ?? []).map((n: Record<string, unknown>) => ({
      note_text: n.note_text as string,
      author: Array.isArray(n.author) ? (n.author[0] as { name: string } | undefined) : (n.author as { name: string } | undefined),
    }));

    setQuickViewData({
      scorecardAvg: avg,
      notes: rawNotes,
      loading: false,
    });
  }, [candidate.id]);

  function handleCardClick(e: React.MouseEvent) {
    // Don't open quick view when clicking interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    setShowQuickView(true);
    fetchQuickViewData();
  }

  function handleMoveStage(newStageName: string) {
    setIsMoving(true);
    // Delegate to parent — the parent handles DB persistence + interview modal
    onStageChange(candidate.id, newStageName);
    setIsMoving(false);
    setShowMoveMenu(false);
  }

  const badge = scoreBadge(candidate.composite_score);
  const discTag =
    candidate.disc_primary
      ? `${candidate.disc_primary}${candidate.disc_secondary ? "/" + candidate.disc_secondary : ""}`
      : "--";
  const discLabelMap: Record<string, string> = {
    D: "Dominant",
    I: "Influential",
    S: "Steady",
    C: "Conscientious",
  };
  const discLabel = candidate.disc_primary
    ? `High ${candidate.disc_primary} — ${discLabelMap[candidate.disc_primary] ?? candidate.disc_primary}`
    : null;

  return (
    <>
      <div
        className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-4 cursor-pointer hover:border-brand/30 hover:shadow-md transition"
        onClick={handleCardClick}
      >
        {/* Name and phone */}
        <h4 className="text-sm font-semibold text-[#272727]">
          {candidate.first_name} {candidate.last_name}
        </h4>
        {candidate.phone && (
          <p className="text-xs text-[#a59494] mt-0.5">{candidate.phone}</p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            {discTag}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {candidate.aq_tier ?? "--"}
          </span>
          <span className="text-xs text-[#a59494] ml-auto whitespace-nowrap">
            Day {candidate.daysInStage}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#a59494]/10">
          <Link
            href={`/dashboard/candidates/${candidate.id}`}
            className="text-xs font-medium text-brand hover:text-brand-dark transition"
          >
            View Profile
          </Link>
          <div className="relative ml-auto" ref={menuRef}>
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              disabled={isMoving}
              className="text-xs font-medium text-[#a59494] hover:text-[#272727] transition disabled:opacity-50"
            >
              {isMoving ? "Moving..." : "Move Stage"}{" "}
              {!isMoving && (showMoveMenu ? "\u25B4" : "\u25BE")}
            </button>
            {showMoveMenu && (
              <div className="absolute right-0 top-6 z-20 w-44 bg-white border border-[#a59494]/20 rounded-lg shadow-lg py-1">
                {stages
                  .filter((s) => s.name !== candidate.stage)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleMoveStage(s.name)}
                      disabled={isMoving}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f5f0f0] transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color ?? "#6B7280" }}
                      />
                      {s.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick-View Popup Overlay */}
      {showQuickView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div
            ref={quickViewRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-5 pb-4 border-b border-[#a59494]/10">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {initials(candidate.first_name, candidate.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#272727] leading-tight">
                    {candidate.first_name} {candidate.last_name}
                  </h3>
                  {candidate.role_applied && (
                    <p className="text-xs text-[#a59494] mt-0.5">
                      {candidate.role_applied}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowQuickView(false)}
                  className="text-[#a59494] hover:text-[#272727] transition p-0.5"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Stage + Days */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand/10 text-brand">
                  {candidate.stage}
                </span>
                <span className="text-xs text-[#a59494]">
                  Day {candidate.daysInStage}
                </span>
              </div>
            </div>

            {/* Contact & Source */}
            <div className="px-5 py-3 border-b border-[#a59494]/10 space-y-1.5">
              {candidate.email && (
                <div className="flex items-center gap-2 text-xs text-[#272727]">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-[#a59494] shrink-0">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span className="truncate">{candidate.email}</span>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-2 text-xs text-[#272727]">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-[#a59494] shrink-0">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>{candidate.phone}</span>
                </div>
              )}
              {candidate.heard_about && (
                <div className="flex items-center gap-2 text-xs text-[#272727]">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-[#a59494] shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Source: {candidate.heard_about}</span>
                </div>
              )}
            </div>

            {/* Scores Grid */}
            <div className="px-5 py-3 border-b border-[#a59494]/10">
              <div className="grid grid-cols-3 gap-3">
                {/* DISC */}
                <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">DISC</p>
                  <p className="text-lg font-bold text-purple-700 mt-0.5">
                    {discTag}
                  </p>
                  {discLabel && (
                    <p className="text-[9px] font-medium text-purple-500 mt-0.5">
                      {discLabel}
                    </p>
                  )}
                  {candidate.disc_d !== null && (
                    <div className="text-[9px] text-purple-500 mt-1 leading-tight">
                      D:{candidate.disc_d} I:{candidate.disc_i} S:{candidate.disc_s} C:{candidate.disc_c}
                    </div>
                  )}
                </div>
                {/* AQ */}
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">AQ</p>
                  <p className="text-lg font-bold text-amber-700 mt-0.5">
                    {candidate.aq_normalized !== null ? `${candidate.aq_normalized}/100` : "--"}
                  </p>
                  <p className="text-[9px] text-amber-500 mt-1">
                    {candidate.aq_tier ?? "No tier"}
                  </p>
                </div>
                {/* Scorecard */}
                <div className="bg-brand/5 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] font-semibold text-brand uppercase tracking-wider">Scorecard</p>
                  {quickViewData.loading ? (
                    <div className="flex justify-center mt-2">
                      <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-brand mt-0.5">
                      {quickViewData.scorecardAvg !== null
                        ? quickViewData.scorecardAvg.toFixed(1)
                        : "--"}
                    </p>
                  )}
                  <p className="text-[9px] text-brand/60 mt-1">Avg</p>
                </div>
              </div>

              {/* Composite Score */}
              <div className="mt-3 flex items-center justify-between px-1">
                <span className="text-xs text-[#a59494]">Composite Score</span>
                <span className={`text-sm font-bold ${badge.text}`}>
                  {badge.label}
                  {candidate.composite_verdict && (
                    <span className="text-[10px] font-normal text-[#a59494] ml-1">
                      ({candidate.composite_verdict})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Recent Notes */}
            <div className="px-5 py-3 border-b border-[#a59494]/10">
              <p className="text-[10px] font-semibold text-[#a59494] uppercase tracking-wider mb-2">
                Recent Notes
              </p>
              {quickViewData.loading ? (
                <div className="flex justify-center py-2">
                  <div className="w-4 h-4 border-2 border-[#a59494]/30 border-t-[#a59494] rounded-full animate-spin" />
                </div>
              ) : quickViewData.notes.length === 0 ? (
                <p className="text-xs text-[#a59494] italic">No coaching notes yet</p>
              ) : (
                <div className="space-y-2">
                  {quickViewData.notes.map((note, i) => (
                    <div key={i} className="bg-[#f5f0f0]/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-[#272727] line-clamp-2">
                        {note.note_text}
                      </p>
                      {note.author?.name && (
                        <p className="text-[10px] text-[#a59494] mt-1">
                          — {note.author.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 flex justify-center">
              <Link
                href={`/dashboard/candidates/${candidate.id}`}
                className="text-sm font-semibold text-brand hover:text-brand-dark transition flex items-center gap-1"
                onClick={() => setShowQuickView(false)}
              >
                Open Full Profile
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
