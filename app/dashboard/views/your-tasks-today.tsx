"use client";

import Link from "next/link";

interface TaskItem {
  candidateId: string;
  candidateName: string;
  type?: string;
  taskTitle?: string;
}

interface Props {
  tasks: {
    interviews: TaskItem[];
    onboarding: TaskItem[];
    scorecards: TaskItem[];
  };
}

export default function YourTasksToday({ tasks }: Props) {
  const allTasks = [
    ...tasks.interviews.map((t) => ({
      ...t,
      label: t.type ?? "Interview",
      icon: "🎙️",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    })),
    ...tasks.onboarding.map((t) => ({
      ...t,
      label: t.taskTitle ?? "Onboarding",
      icon: "📋",
      color: "bg-amber-50 text-amber-700 border-amber-200",
    })),
    ...tasks.scorecards.map((t) => ({
      ...t,
      label: `Scorecard — ${t.type ?? "Interview"}`,
      icon: "📝",
      color: "bg-rose-50 text-rose-700 border-rose-200",
    })),
  ];

  const isEmpty = allTasks.length === 0;

  return (
    <div className="mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📌</span>
          <h3 className="text-sm font-semibold text-velvet">Your Tasks Today</h3>
        </div>

        {isEmpty ? (
          <p className="text-sm text-emerald-600 font-medium py-1">
            You&apos;re all caught up today ✓
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTasks.map((task, idx) => (
              <Link
                key={`${task.candidateId}-${idx}`}
                href={`/dashboard/candidates/${task.candidateId}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition hover:shadow-sm ${task.color}`}
              >
                <span>{task.icon}</span>
                <span className="truncate max-w-[140px]">{task.candidateName}</span>
                <span className="opacity-70">·</span>
                <span className="truncate max-w-[120px] opacity-80">{task.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
