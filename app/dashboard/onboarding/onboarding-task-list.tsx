"use client";

import { useState } from "react";
import type {
  OnboardingTask,
  CandidateOnboarding,
  Candidate,
} from "@/lib/types";

/* ── Stage constants ──────────────────────────────────────────── */

const STAGE_ORDER = [
  "stage_1_hiring",
  "stage_2_leadership",
  "stage_3_accounts",
  "stage_4_office",
  "stage_5_headshots",
  "stage_6_payroll",
] as const;

const STAGE_LABELS: Record<string, string> = {
  stage_1_hiring: "Stage 1 — Hiring",
  stage_2_leadership: "Stage 2 — Leadership Pre-Onboarding",
  stage_3_accounts: "Stage 3 — Account Set Up",
  stage_4_office: "Stage 4 — Office Onboarding",
  stage_5_headshots: "Stage 5 — After Headshots",
  stage_6_payroll: "Stage 6 — Payroll",
};

/* ── Action-type icons ────────────────────────────────────────── */

function ManualIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#a59494]">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#1c759e]">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6366F1]">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  tasks: OnboardingTask[];
  progress: CandidateOnboarding[];
  candidate: Candidate;
  onToggle: (taskId: string) => void;
  onEmailTask: (task: OnboardingTask) => void;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function OnboardingTaskList({
  tasks,
  progress,
  candidate,
  onToggle,
  onEmailTask,
}: Props) {
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(
    new Set()
  );

  // Build progress map
  const progressMap = new Map<string, CandidateOnboarding>();
  progress
    .filter((p) => p.candidate_id === candidate.id)
    .forEach((p) => progressMap.set(p.task_id, p));

  // Group tasks by stage
  const tasksByStage = new Map<string, OnboardingTask[]>();
  for (const task of tasks) {
    const stage = task.stage ?? "uncategorized";
    if (!tasksByStage.has(stage)) {
      tasksByStage.set(stage, []);
    }
    tasksByStage.get(stage)!.push(task);
  }

  // Ordered stages (only include stages that have tasks)
  const stageKeys = STAGE_ORDER.filter((s) => tasksByStage.has(s));
  // Also include any uncategorized tasks
  if (tasksByStage.has("uncategorized")) {
    stageKeys.push("uncategorized" as (typeof STAGE_ORDER)[number]);
  }

  function toggleStage(stage: string) {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }

  function handleTaskAction(task: OnboardingTask) {
    if (task.action_type === "email") {
      onEmailTask(task);
    } else if (task.action_type === "external_link" && task.action_url) {
      window.open(task.action_url, "_blank", "noopener");
      onToggle(task.id);
    } else {
      onToggle(task.id);
    }
  }

  return (
    <div className="space-y-3">
      {stageKeys.map((stageKey) => {
        const stageTasks = tasksByStage.get(stageKey) ?? [];
        const isCollapsed = collapsedStages.has(stageKey);
        const stageLabel =
          STAGE_LABELS[stageKey] ?? "Other Tasks";

        // Stage progress
        const stageCompleted = stageTasks.filter(
          (t) => !!progressMap.get(t.id)?.completed_at
        ).length;
        const stageTotal = stageTasks.length;
        const allDone = stageCompleted === stageTotal && stageTotal > 0;

        return (
          <div
            key={stageKey}
            className="border border-[#a59494]/10 rounded-xl overflow-hidden"
          >
            {/* Stage header */}
            <button
              onClick={() => toggleStage(stageKey)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#f5f0f0]/50 hover:bg-[#f5f0f0] transition text-left"
            >
              {/* Chevron */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a59494"
                strokeWidth="2"
                className={`shrink-0 transition-transform duration-200 ${
                  isCollapsed ? "" : "rotate-90"
                }`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>

              <span className="text-sm font-semibold text-[#272727] flex-1">
                {stageLabel}
              </span>

              {/* Progress count */}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  allDone
                    ? "bg-[#10B981]/10 text-[#10B981]"
                    : "bg-[#a59494]/10 text-[#a59494]"
                }`}
              >
                {stageCompleted}/{stageTotal}
              </span>
            </button>

            {/* Task rows */}
            {!isCollapsed && (
              <div className="divide-y divide-[#a59494]/5">
                {stageTasks.map((task) => {
                  const entry = progressMap.get(task.id);
                  const isCompleted = !!entry?.completed_at;

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 px-4 py-2.5 transition ${
                        isCompleted
                          ? "bg-green-50/30"
                          : "hover:bg-[#f5f0f0]/30"
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleTaskAction(task)}
                        disabled={!entry}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                          isCompleted
                            ? "bg-[#10B981] border-[#10B981]"
                            : "border-[#a59494]/40 hover:border-[#1c759e]"
                        } disabled:opacity-40`}
                      >
                        {isCompleted && (
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

                      {/* Action-type icon */}
                      <div className="shrink-0" title={task.action_type}>
                        {task.action_type === "email" ? (
                          <EmailIcon />
                        ) : task.action_type === "external_link" ? (
                          <LinkIcon />
                        ) : (
                          <ManualIcon />
                        )}
                      </div>

                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            isCompleted
                              ? "text-[#a59494] line-through"
                              : "text-[#272727]"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.done_by && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f0f0] text-[#a59494] font-medium">
                              {task.done_by}
                            </span>
                          )}
                          {task.notes && (
                            <span
                              className="text-[10px] text-[#a59494] truncate max-w-[200px]"
                              title={task.notes}
                            >
                              {task.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* External link indicator */}
                      {task.action_type === "external_link" &&
                        task.action_url &&
                        !isCompleted && (
                          <a
                            href={task.action_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="text-[10px] text-[#6366F1] hover:underline shrink-0"
                          >
                            Open
                          </a>
                        )}

                      {/* Email indicator */}
                      {task.action_type === "email" && !isCompleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEmailTask(task);
                          }}
                          className="text-[10px] text-[#1c759e] hover:underline shrink-0"
                        >
                          Send
                        </button>
                      )}

                      {/* Completed date */}
                      {isCompleted && entry?.completed_at && (
                        <span className="text-xs text-[#10B981] whitespace-nowrap shrink-0">
                          {new Date(entry.completed_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
