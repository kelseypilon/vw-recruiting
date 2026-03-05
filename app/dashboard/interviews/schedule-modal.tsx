"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Candidate, Interview, TeamUser, EmailTemplate, Team } from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  eligibleCandidates: Candidate[];
  leaders: TeamUser[];
  emailTemplates: EmailTemplate[];
  teamId: string;
  team?: Team | null;
  onClose: () => void;
  onScheduled: (interview: Interview) => void;
  preselectedCandidateId?: string;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function ScheduleModal({
  eligibleCandidates,
  leaders,
  emailTemplates,
  teamId,
  team,
  onClose,
  onScheduled,
  preselectedCandidateId,
}: Props) {
  const [interviewType, setInterviewType] = useState<"1on1" | "group">("1on1");
  const [candidateId, setCandidateId] = useState(preselectedCandidateId ?? "");
  const [leaderId, setLeaderId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [previousInterviews, setPreviousInterviews] = useState<Interview[]>([]);

  const selectedLeader = leaders.find((l) => l.id === leaderId);
  const selectedCandidate = eligibleCandidates.find((c) => c.id === candidateId);

  const hasGroupInterview = !!(team?.group_interview_zoom_link && team?.group_interview_date);

  // Find the relevant email template
  const inviteTemplate = emailTemplates.find(
    (t) =>
      t.is_active &&
      (t.name.toLowerCase().includes("interview invitation") ||
        t.name.toLowerCase().includes("1on1") ||
        t.name.toLowerCase().includes("1-on-1"))
  );

  const groupTemplate = emailTemplates.find(
    (t) =>
      t.is_active &&
      (t.name.toLowerCase().includes("group interview") ||
        t.name.toLowerCase().includes("group_interview"))
  );

  // Fetch previous interviews when candidate changes
  useEffect(() => {
    if (!candidateId) {
      setPreviousInterviews([]);
      return;
    }
    async function fetchPrevious() {
      const supabase = createClient();
      const { data } = await supabase
        .from("interviews")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      setPreviousInterviews((data ?? []) as Interview[]);
    }
    fetchPrevious();
  }, [candidateId]);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();

    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    if (!selectedCandidate?.email) {
      setError("Selected candidate has no email address");
      return;
    }

    if (interviewType === "1on1") {
      if (!leaderId) {
        setError("Please select a leader");
        return;
      }
      if (!selectedLeader?.google_booking_url) {
        setError(
          "Selected leader has no booking URL configured. Update it in Settings → Team Members."
        );
        return;
      }
    } else {
      if (!team?.group_interview_zoom_link || !team?.group_interview_date) {
        setError(
          "Group interview Zoom link or date not configured. Update in Settings → Team."
        );
        return;
      }
    }

    setIsSending(true);
    setError("");
    setSuccessMessage("");

    const supabase = createClient();

    const interviewTypeLabel =
      interviewType === "1on1" ? "1on1 Interview" : "Group Interview";
    const scheduledAt =
      interviewType === "group" ? team!.group_interview_date : null;

    // 1. Create interview record in DB
    const { data: interviewData, error: dbError } = await supabase
      .from("interviews")
      .insert({
        team_id: teamId,
        candidate_id: candidateId,
        interview_type: interviewTypeLabel,
        status: "scheduled",
        scheduled_at: scheduledAt,
        notes:
          interviewType === "1on1"
            ? `Leader: ${selectedLeader!.name}`
            : `Group interview via Zoom`,
      })
      .select(
        "*, candidate:candidates(first_name, last_name, role_applied, stage)"
      )
      .single();

    if (dbError || !interviewData) {
      setError(dbError?.message ?? "Failed to create interview record");
      setIsSending(false);
      return;
    }

    // 2. Build email
    let emailSubject: string;
    let emailBody: string;
    let fromEmail: string | undefined;

    if (interviewType === "1on1") {
      const bookingUrl = selectedLeader!.google_booking_url!;
      emailSubject = `1-on-1 Interview Invitation — Vantage West`;
      emailBody = `Hi ${selectedCandidate.first_name},\n\nYou're invited to schedule your 1-on-1 interview with ${selectedLeader!.name} at Vantage West Real Estate.\n\nClick the link below to choose a time that works for you:\n${bookingUrl}\n\nWe look forward to speaking with you!\n\nBest,\nVantage West Recruiting`;

      if (inviteTemplate) {
        emailSubject = inviteTemplate.subject
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Vantage West")
          .replace(/\{\{sender_name\}\}/g, selectedLeader!.name)
          .replace(/\{\{booking_link\}\}/g, bookingUrl);
        emailBody = inviteTemplate.body
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Vantage West")
          .replace(/\{\{sender_name\}\}/g, selectedLeader!.name)
          .replace(/\{\{booking_link\}\}/g, bookingUrl);
      }
      fromEmail = selectedLeader!.from_email || undefined;
    } else {
      const zoomLink = team!.group_interview_zoom_link!;
      const dateFormatted = new Date(team!.group_interview_date!).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      emailSubject = `Group Interview Invitation — Vantage West`;
      emailBody = `Hi ${selectedCandidate.first_name},\n\nYou're invited to our upcoming group interview at Vantage West Real Estate.\n\nDate & Time: ${dateFormatted}\nZoom Link: ${zoomLink}\n\nPlease join a few minutes early and be prepared to introduce yourself.\n\nWe look forward to meeting you!\n\nBest,\nVantage West Recruiting`;

      if (groupTemplate) {
        emailSubject = groupTemplate.subject
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Vantage West")
          .replace(/\{\{zoom_link\}\}/g, zoomLink)
          .replace(/\{\{interview_date\}\}/g, dateFormatted);
        emailBody = groupTemplate.body
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Vantage West")
          .replace(/\{\{zoom_link\}\}/g, zoomLink)
          .replace(/\{\{interview_date\}\}/g, dateFormatted);
      }
    }

    // 3. Send email via API
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedCandidate.email,
          subject: emailSubject,
          body: emailBody,
          from_email: fromEmail,
        }),
      });
      const result = await res.json();
      if (result.error) {
        setError(`Interview created but email failed: ${result.error}`);
        setIsSending(false);
        onScheduled(interviewData as Interview);
        return;
      }
    } catch {
      setError("Interview created but email failed to send");
      setIsSending(false);
      onScheduled(interviewData as Interview);
      return;
    }

    setSuccessMessage("Interview scheduled & invite sent!");
    setIsSending(false);

    setTimeout(() => {
      onScheduled(interviewData as Interview);
    }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="text-lg font-bold text-[#272727]">
            Schedule Interview
          </h3>
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

        <form onSubmit={handleSendInvite} className="p-6 space-y-5">
          {/* Interview Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-2">
              Interview Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInterviewType("1on1")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
                  interviewType === "1on1"
                    ? "bg-[#1c759e] text-white border-[#1c759e]"
                    : "text-[#272727] border-[#a59494]/40 hover:bg-[#f5f0f0]"
                }`}
              >
                1-on-1 Interview
              </button>
              <button
                type="button"
                onClick={() => setInterviewType("group")}
                disabled={!hasGroupInterview}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
                  interviewType === "group"
                    ? "bg-[#1c759e] text-white border-[#1c759e]"
                    : "text-[#272727] border-[#a59494]/40 hover:bg-[#f5f0f0]"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Group Interview
              </button>
            </div>
            {!hasGroupInterview && (
              <p className="text-xs text-[#a59494] mt-1.5">
                Configure group interview settings in Settings → Team to enable this option.
              </p>
            )}
          </div>

          {/* Candidate selector */}
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

          {/* 1-on-1: Leader selector */}
          {interviewType === "1on1" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">
                  Interview Leader
                </label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition bg-white"
                >
                  <option value="">Select a leader...</option>
                  {leaders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Booking URL display */}
              {selectedLeader && (
                <div className="bg-[#f5f0f0] rounded-lg p-4">
                  <p className="text-xs font-medium text-[#a59494] mb-1.5">
                    {selectedLeader.name}&apos;s Booking Page
                  </p>
                  {selectedLeader.google_booking_url ? (
                    <a
                      href={selectedLeader.google_booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#1c759e] hover:text-[#155f82] underline break-all transition"
                    >
                      {selectedLeader.google_booking_url}
                    </a>
                  ) : (
                    <p className="text-sm text-amber-600">
                      No booking URL configured.{" "}
                      <span className="text-xs">
                        Go to Settings → Team Members to add one.
                      </span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Group Interview details */}
          {interviewType === "group" && hasGroupInterview && (
            <div className="bg-[#f5f0f0] rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-[#a59494]">
                Group Interview Details
              </p>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1c759e" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="text-sm text-[#272727]">
                  {new Date(team!.group_interview_date!).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1c759e" strokeWidth="2" className="shrink-0 mt-0.5">
                  <path d="M15 10l5 5-5 5" />
                  <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                </svg>
                <a
                  href={team!.group_interview_zoom_link!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#1c759e] hover:text-[#155f82] underline break-all transition"
                >
                  {team!.group_interview_zoom_link}
                </a>
              </div>
            </div>
          )}

          {/* What happens when you click Send */}
          {selectedCandidate && (
            (interviewType === "1on1" && selectedLeader?.google_booking_url) ||
            (interviewType === "group" && hasGroupInterview)
          ) && (
            <div className="bg-[#1c759e]/5 border border-[#1c759e]/20 rounded-lg p-4">
              <p className="text-xs font-semibold text-[#1c759e] mb-1">
                What happens when you send:
              </p>
              <ul className="text-xs text-[#272727]/70 space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#1c759e] mt-0.5">1.</span>
                  <span>
                    Interview record created for{" "}
                    <strong>
                      {selectedCandidate.first_name}{" "}
                      {selectedCandidate.last_name}
                    </strong>
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#1c759e] mt-0.5">2.</span>
                  <span>
                    Email sent to{" "}
                    <strong>{selectedCandidate.email}</strong> with{" "}
                    {interviewType === "1on1"
                      ? `${selectedLeader!.name}'s booking link`
                      : "group interview Zoom link & date"}
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#1c759e] mt-0.5">3.</span>
                  <span>
                    {interviewType === "1on1"
                      ? `Candidate books a time directly on ${selectedLeader!.name}'s Google Calendar`
                      : "Candidate joins the group Zoom call at the scheduled time"}
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* Previous interviews for candidate */}
          {candidateId && previousInterviews.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-2">
                Previous Interviews
              </p>
              <div className="space-y-2">
                {previousInterviews.map((iv) => (
                  <div
                    key={iv.id}
                    className="flex items-center justify-between text-xs bg-[#f5f0f0] rounded-lg px-3 py-2"
                  >
                    <span className="text-[#272727]">{iv.interview_type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#a59494]">
                        {iv.scheduled_at
                          ? new Date(iv.scheduled_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )
                          : new Date(iv.created_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          iv.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : iv.status === "scheduled"
                            ? "bg-blue-100 text-blue-800"
                            : iv.status === "cancelled"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {iv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error / success messages */}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && (
            <p className="text-sm text-green-600 font-medium">
              {successMessage}
            </p>
          )}

          {/* Actions */}
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
              disabled={
                isSending ||
                !candidateId ||
                (interviewType === "1on1" && (!leaderId || !selectedLeader?.google_booking_url)) ||
                (interviewType === "group" && !hasGroupInterview) ||
                !!successMessage
              }
              className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send Interview Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
