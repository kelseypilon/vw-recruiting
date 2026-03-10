"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CandidateCard, PipelineStage } from "@/lib/types";

interface Props {
  candidate: CandidateCard;
  stages: PipelineStage[];
  onStageChange: (candidateId: string, newStage: string) => void | Promise<void>;
  thresholdStuckDays?: number;
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

export default function CandidateCardComponent({
  candidate,
  stages,
  onStageChange,
  thresholdStuckDays = 7,
}: Props) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleMoveStage(newStageName: string) {
    setIsMoving(true);
    setShowMoveMenu(false);
    try {
      await onStageChange(candidate.id, newStageName);
    } finally {
      setIsMoving(false);
    }
  }

  const badge = scoreBadge(candidate.composite_score);
  const discTag =
    candidate.disc_primary
      ? `${candidate.disc_primary}${candidate.disc_secondary ? "/" + candidate.disc_secondary : ""}`
      : "--";

  // Visual flag logic
  const isOnHold = candidate.kanban_hold;
  const isStuckRed = candidate.daysInStage >= thresholdStuckDays + 7;
  const isStuckYellow = !isStuckRed && candidate.daysInStage >= thresholdStuckDays;
  const showRedBorder = isStuckRed;
  const showYellowBorder = isOnHold || isStuckYellow;

  let borderClass = "border-[#a59494]/10";
  if (showRedBorder) borderClass = "border-l-[3px] border-l-[#C0392B] border-t border-r border-b border-t-[#a59494]/10 border-r-[#a59494]/10 border-b-[#a59494]/10";
  else if (showYellowBorder) borderClass = "border-l-[3px] border-l-amber-400 border-t border-r border-b border-t-[#a59494]/10 border-r-[#a59494]/10 border-b-[#a59494]/10";
  else borderClass = "border border-[#a59494]/10";

  return (
    <Link
      href={`/dashboard/candidates/${candidate.id}`}
      className={`block bg-white rounded-xl shadow-sm p-4 hover:border-brand/30 hover:shadow-md transition relative ${borderClass}`}
    >
      {/* Hold warning icon */}
      {isOnHold && (
        <span className="absolute top-2 right-2 text-amber-500 text-sm" title={candidate.kanban_hold_reason ?? "On hold"}>
          ⚠️
        </span>
      )}

      {/* Name and phone */}
      <h4 className="text-sm font-semibold text-[#272727]">
        {candidate.first_name} {candidate.last_name}
      </h4>
      {isOnHold && candidate.kanban_hold_reason && (
        <p className="text-[10px] text-amber-600 mt-0.5 truncate">{candidate.kanban_hold_reason}</p>
      )}
      {candidate.phone && (
        <p className="text-xs text-[#a59494] mt-0.5">{candidate.phone}</p>
      )}

      {/* Role Applied pill */}
      {candidate.role_applied && (
        <p className="text-[10px] font-medium text-gray-500 mt-1 truncate">
          {(() => {
            try { const parsed = JSON.parse(candidate.role_applied); return Array.isArray(parsed) ? parsed.join(", ") : candidate.role_applied; } catch { return candidate.role_applied; }
          })()}
        </p>
      )}

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
        <div
          className="relative ml-auto"
          ref={menuRef}
          onMouseLeave={() => {
            if (showMoveMenu) {
              const timer = setTimeout(() => setShowMoveMenu(false), 150);
              menuRef.current?.addEventListener("mouseenter", () => clearTimeout(timer), { once: true });
            }
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMoveMenu(!showMoveMenu);
            }}
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleMoveStage(s.name);
                    }}
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
    </Link>
  );
}
