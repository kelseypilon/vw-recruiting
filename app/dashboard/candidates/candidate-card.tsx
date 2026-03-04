"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CandidateCard, PipelineStage } from "@/lib/types";

interface Props {
  candidate: CandidateCard;
  stages: PipelineStage[];
  onStageChange: (candidateId: string, newStage: string) => void;
}

function scoreBadge(score: number | null) {
  if (score === null || score === undefined)
    return { bg: "bg-gray-100", text: "text-gray-500", label: "--" };
  if (score >= 80)
    return {
      bg: "bg-green-100",
      text: "text-green-800",
      label: score.toFixed(0),
    };
  if (score >= 60)
    return {
      bg: "bg-blue-100",
      text: "text-blue-800",
      label: score.toFixed(0),
    };
  return {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: score.toFixed(0),
  };
}

export default function CandidateCardComponent({
  candidate,
  stages,
  onStageChange,
}: Props) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  async function handleMoveStage(newStageName: string) {
    setIsMoving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("candidates")
      .update({ stage: newStageName })
      .eq("id", candidate.id);

    if (!error) {
      onStageChange(candidate.id, newStageName);
    }
    setIsMoving(false);
    setShowMoveMenu(false);
  }

  const badge = scoreBadge(candidate.composite_score);
  const discTag =
    candidate.disc_primary
      ? `${candidate.disc_primary}${candidate.disc_secondary ? "/" + candidate.disc_secondary : ""}`
      : "--";

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-4">
      {/* Name and phone */}
      <h4 className="text-sm font-semibold text-[#272727]">
        {candidate.first_name} {candidate.last_name}
      </h4>
      {candidate.phone && (
        <p className="text-xs text-[#a59494] mt-0.5">{candidate.phone}</p>
      )}

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {/* Composite score badge */}
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>
        {/* DISC tag */}
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
          {discTag}
        </span>
        {/* AQ tier tag */}
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {candidate.aq_tier ?? "--"}
        </span>
        {/* Days in stage */}
        <span className="text-xs text-[#a59494] ml-auto whitespace-nowrap">
          Day {candidate.daysInStage}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#a59494]/10">
        <button className="text-xs font-medium text-[#1c759e] hover:text-[#155f82] transition">
          View Profile
        </button>
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
  );
}
