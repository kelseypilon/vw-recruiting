"use client";

import { useState } from "react";
import Link from "next/link";
import type { TeamUser, GroupInterviewSession } from "@/lib/types";
import DateTimePicker from "@/components/date-time-picker";

interface Props {
  candidateName: string;
  candidateId: string;
  newStage: string;
  teamId: string;
  currentUserId: string;
  leaders: TeamUser[];
  upcomingSessions: GroupInterviewSession[];
  teamZoomLink: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

export default function InterviewStageModal({
  candidateName,
  candidateId,
  newStage,
  teamId,
  currentUserId,
  leaders,
  upcomingSessions,
  teamZoomLink,
  onComplete,
  onCancel,
}: Props) {
  const isGroup = newStage === "Group Interview";

  if (isGroup) {
    return (
      <GroupInterviewFlow
        candidateName={candidateName}
        candidateId={candidateId}
        teamId={teamId}
        currentUserId={currentUserId}
        upcomingSessions={upcomingSessions}
        teamZoomLink={teamZoomLink}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }

  return (
    <OneOnOneFlow
      candidateName={candidateName}
      candidateId={candidateId}
      newStage={newStage}
      teamId={teamId}
      currentUserId={currentUserId}
      leaders={leaders}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

/* ── Group Interview Flow ─────────────────────────────────────── */

function GroupInterviewFlow({
  candidateName,
  candidateId,
  teamId,
  currentUserId,
  upcomingSessions,
  teamZoomLink,
  onComplete,
  onCancel,
}: {
  candidateName: string;
  candidateId: string;
  teamId: string;
  currentUserId: string;
  upcomingSessions: GroupInterviewSession[];
  teamZoomLink: string | null;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    upcomingSessions.length === 1 ? upcomingSessions[0].id : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  async function handleAddToSession() {
    if (!selectedSessionId) {
      setError("Please select a session");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Add candidate to group interview session
      const addRes = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_candidate",
          payload: { session_id: selectedSessionId, candidate_id: candidateId },
        }),
      });
      const addJson = await addRes.json();
      if (addJson.error) {
        setError(addJson.error);
        setLoading(false);
        return;
      }

      const selectedSession = upcomingSessions.find((s) => s.id === selectedSessionId);

      // Also create an interview record for tracking
      await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_interview",
          payload: {
            team_id: teamId,
            candidate_id: candidateId,
            interview_type: "Group Interview",
            status: "scheduled",
            scheduled_at: selectedSession?.session_date || null,
            notes: `Added to group interview session`,
            interviewer_ids: [currentUserId],
          },
        }),
      });

      // Send invitation email if opted-in
      if (sendEmail && selectedSession) {
        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidate_id: candidateId,
              team_id: teamId,
              trigger: "group_interview_invite",
              context: {
                session_title: selectedSession.title,
                interview_date: selectedSession.session_date,
                zoom_link: selectedSession.zoom_link || teamZoomLink || "",
              },
            }),
          });
        } catch {
          // Email failure shouldn't block the flow
        }
      }

      setLoading(false);
      onComplete();
    } catch {
      setError("Failed to add candidate to session");
      setLoading(false);
    }
  }

  function handleSkip() {
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-[#272727] mb-1">
          Add to Group Interview
        </h3>
        <p className="text-xs text-[#a59494] mb-5">
          Select an upcoming group interview session for {candidateName}.
        </p>

        {upcomingSessions.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#a59494]/20 p-6 text-center mb-4">
            <p className="text-sm text-[#a59494] mb-2">
              No upcoming group interview sessions
            </p>
            <Link
              href="/dashboard/group-interviews"
              className="text-xs font-medium text-brand hover:text-brand-dark transition"
            >
              Create one on the Group Interviews page &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {upcomingSessions.map((session) => {
              const isSelected = selectedSessionId === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition text-left ${
                    isSelected
                      ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                      : "border-[#a59494]/20 hover:border-brand/40 hover:bg-[#f5f0f0]/50"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      isSelected ? "border-brand" : "border-[#a59494]/40"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-brand" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#272727] truncate">
                      {session.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {session.session_date && (
                        <span className="text-xs text-[#a59494]">
                          {new Date(session.session_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {(session.zoom_link || teamZoomLink) && (
                        <span className="text-xs text-brand">Zoom link set</span>
                      )}
                    </div>
                    {session._candidate_count != null && (
                      <p className="text-[11px] text-[#a59494] mt-0.5">
                        {session._candidate_count} candidate{session._candidate_count !== 1 ? "s" : ""} added
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Send email checkbox */}
        {upcomingSessions.length > 0 && selectedSessionId && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#a59494]/40 text-brand focus:ring-brand/40"
            />
            <span className="text-xs text-[#272727]">
              Send interview invitation email to candidate
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-[#a59494] hover:text-[#272727] transition"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            {upcomingSessions.length > 0 && (
              <button
                onClick={handleAddToSession}
                disabled={loading || !selectedSessionId}
                className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add to Session"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 1:1 Interview Flow ───────────────────────────────────────── */

function OneOnOneFlow({
  candidateName,
  candidateId,
  newStage,
  teamId,
  currentUserId,
  leaders,
  onComplete,
  onCancel,
}: {
  candidateName: string;
  candidateId: string;
  newStage: string;
  teamId: string;
  currentUserId: string;
  leaders: TeamUser[];
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [interviewerId, setInterviewerId] = useState(currentUserId);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedInterviewer = leaders.find((l) => l.id === interviewerId);
  const bookingUrl = selectedInterviewer?.google_booking_url;

  async function handleCreate() {
    if (!interviewerId) {
      setError("Please select an interviewer");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_interview",
          payload: {
            team_id: teamId,
            candidate_id: candidateId,
            interview_type: "1on1 Interview",
            status: "scheduled",
            scheduled_at: scheduledAt || null,
            notes: `Created when moved to ${newStage}`,
            interviewer_ids: [interviewerId],
          },
        }),
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setLoading(false);
        return;
      }

      setLoading(false);
      onComplete();
    } catch {
      setError("Failed to create interview");
      setLoading(false);
    }
  }

  function handleSkip() {
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-[#272727] mb-1">
          Schedule 1:1 Interview
        </h3>
        <p className="text-xs text-[#a59494] mb-5">
          Set up a 1:1 interview for {candidateName}.
        </p>

        <div className="space-y-4">
          {/* Interviewer */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Interviewer
            </label>
            <select
              value={interviewerId}
              onChange={(e) => setInterviewerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              <option value="">Select an interviewer...</option>
              {leaders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.role ? ` — ${l.role}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Date & Time <span className="text-xs font-normal text-[#a59494]">(optional)</span>
            </label>
            <DateTimePicker
              value={scheduledAt}
              onChange={setScheduledAt}
            />
          </div>

          {/* Booking URL */}
          {bookingUrl && (
            <div className="rounded-lg bg-brand/5 border border-brand/10 px-4 py-3">
              <p className="text-xs font-medium text-[#272727] mb-1">
                Or send the booking link to the candidate:
              </p>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:underline break-all"
              >
                {bookingUrl}
              </a>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#a59494]/10">
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-[#a59494] hover:text-[#272727] transition"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !interviewerId}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Interview"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
