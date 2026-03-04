"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Candidate, Interview } from "@/lib/types";

interface Props {
  eligibleCandidates: Candidate[];
  teamId: string;
  onClose: () => void;
  onScheduled: (interview: Interview) => void;
}

export default function ScheduleModal({
  eligibleCandidates,
  teamId,
  onClose,
  onScheduled,
}: Props) {
  const [candidateId, setCandidateId] = useState("");
  const [interviewType, setInterviewType] = useState("Group Interview");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    setIsSaving(true);
    setError("");

    const scheduledAt =
      scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null;

    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("interviews")
      .insert({
        team_id: teamId,
        candidate_id: candidateId,
        interview_type: interviewType,
        scheduled_at: scheduledAt,
        status: "scheduled",
      })
      .select("*, candidate:candidates(first_name, last_name, role_applied, stage)")
      .single();

    if (dbError || !data) {
      setError(dbError?.message ?? "Failed to schedule interview");
      setIsSaving(false);
      return;
    }

    onScheduled(data as Interview);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-lg font-bold text-[#272727]">Schedule Interview</h3>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Candidate */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Candidate
            </label>
            <select
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition bg-white"
            >
              <option value="">Select a candidate...</option>
              {eligibleCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.stage}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Interview Type
            </label>
            <select
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition bg-white"
            >
              <option value="Group Interview">Group Interview</option>
              <option value="1on1 Interview">1-on-1 Interview</option>
              <option value="Culture Fit">Culture Fit</option>
              <option value="Technical">Technical</option>
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSaving ? "Scheduling..." : "Schedule Interview"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
