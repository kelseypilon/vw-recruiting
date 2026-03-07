"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Candidate,
  Interview,
  TeamUser,
  EmailTemplate,
  Team,
} from "@/lib/types";
import EmailPreviewModal from "./email-preview-modal";
import type { EmailPreviewData } from "./email-preview-modal";

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
  const [interviewType, setInterviewType] = useState<"1on1" | "group">(
    "1on1"
  );
  const [candidateId, setCandidateId] = useState(
    preselectedCandidateId ?? ""
  );
  const [leaderId, setLeaderId] = useState("");
  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [creatingOnly, setCreatingOnly] = useState(false);
  const [previousInterviews, setPreviousInterviews] = useState<Interview[]>(
    []
  );

  // Email preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreviewData | null>(
    null
  );

  const selectedLeader = leaders.find((l) => l.id === leaderId);
  const selectedCandidate = eligibleCandidates.find(
    (c) => c.id === candidateId
  );

  const hasGroupInterview = !!(
    team?.group_interview_zoom_link && team?.group_interview_date
  );

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

  /* ── Create interview without sending email ─────────────────── */

  async function handleCreateOnly() {
    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    setCreatingOnly(true);
    setError("");

    try {
      const supabase = createClient();
      const interviewTypeLabel =
        interviewType === "1on1" ? "1on1 Interview" : "Group Interview";
      const scheduledAt =
        interviewType === "group" && team?.group_interview_date
          ? team.group_interview_date
          : null;
      const notes =
        interviewType === "1on1" && selectedLeader
          ? `Leader: ${selectedLeader.name}`
          : interviewType === "group"
            ? "Group interview"
            : "";

      const { data: created, error: dbError } = await supabase
        .from("interviews")
        .insert({
          team_id: teamId,
          candidate_id: candidateId,
          interview_type: interviewTypeLabel,
          status: "scheduled",
          scheduled_at: scheduledAt,
          notes,
        })
        .select(
          "*, candidate:candidates(first_name, last_name, role_applied, stage)"
        )
        .single();

      if (dbError || !created) {
        setError(dbError?.message ?? "Failed to create interview");
        setCreatingOnly(false);
        return;
      }

      // Insert interviewers
      const interviewerIds =
        selectedInterviewers.length > 0
          ? selectedInterviewers
          : leaderId
            ? [leaderId]
            : [];
      if (interviewerIds.length > 0) {
        await supabase.from("interview_interviewers").insert(
          interviewerIds.map((uid) => ({
            interview_id: created.id,
            user_id: uid,
          }))
        );
      }

      onScheduled(created as Interview);
    } catch {
      setError("Failed to create interview");
    } finally {
      setCreatingOnly(false);
    }
  }

  /* ── Build preview and open email modal ────────────────────── */

  function handlePreview(e: React.FormEvent) {
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
    } else {
      if (!team?.group_interview_zoom_link || !team?.group_interview_date) {
        setError(
          "Group interview Zoom link or date not configured. Update in Settings \u2192 Team."
        );
        return;
      }
    }

    setError("");

    const interviewTypeLabel =
      interviewType === "1on1" ? "1on1 Interview" : "Group Interview";
    const scheduledAt =
      interviewType === "group" ? team!.group_interview_date : null;

    let emailSubject: string;
    let emailBody: string;
    let fromEmail: string = "";
    let notes: string;

    if (interviewType === "1on1") {
      const bookingUrl = selectedLeader?.google_booking_url;
      notes = `Leader: ${selectedLeader!.name}`;

      // Build from template or fallback
      if (inviteTemplate) {
        emailSubject = inviteTemplate.subject
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Our Team")
          .replace(/\{\{leader_name\}\}/g, selectedLeader!.name)
          .replace(/\{\{interview_type\}\}/g, interviewTypeLabel);

        emailBody = inviteTemplate.body
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Our Team")
          .replace(/\{\{leader_name\}\}/g, selectedLeader!.name)
          .replace(/\{\{interview_type\}\}/g, interviewTypeLabel);

        // Handle booking link: replace or use fallback
        if (bookingUrl) {
          emailBody = emailBody.replace(
            /\{\{booking_link\}\}/g,
            bookingUrl
          );
        } else {
          emailBody = emailBody.replace(
            /.*\{\{booking_link\}\}.*/g,
            "Your interviewer will be in touch shortly to confirm a time."
          );
        }
      } else {
        // Hardcoded fallback (no template found)
        emailSubject = `Your Interview with ${team?.name ?? "Our Team"}`;

        if (bookingUrl) {
          emailBody = `Hi ${selectedCandidate.first_name},\n\nWe're excited to move forward with you! You've been selected for a ${interviewTypeLabel} interview with ${selectedLeader!.name}.\n\nPlease use the link below to book a time that works for you:\n${bookingUrl}\n\nIf you have any questions in the meantime, don't hesitate to reach out.\n\nLooking forward to connecting!\n\n${team?.name ?? "Our Team"}`;
        } else {
          emailBody = `Hi ${selectedCandidate.first_name},\n\nWe're excited to move forward with you! You've been selected for a ${interviewTypeLabel} interview with ${selectedLeader!.name}.\n\nYour interviewer will be in touch shortly to confirm a time.\n\nIf you have any questions in the meantime, don't hesitate to reach out.\n\nLooking forward to connecting!\n\n${team?.name ?? "Our Team"}`;
        }
      }

      fromEmail = selectedLeader!.from_email || "";
    } else {
      // Group interview
      const zoomLink = team!.group_interview_zoom_link!;
      const dateFormatted = new Date(
        team!.group_interview_date!
      ).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      notes = "Group interview via Zoom";

      if (groupTemplate) {
        emailSubject = groupTemplate.subject
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Our Team")
          .replace(/\{\{zoom_link\}\}/g, zoomLink)
          .replace(/\{\{interview_date\}\}/g, dateFormatted);
        emailBody = groupTemplate.body
          .replace(/\{\{first_name\}\}/g, selectedCandidate.first_name)
          .replace(/\{\{last_name\}\}/g, selectedCandidate.last_name)
          .replace(/\{\{team_name\}\}/g, team?.name ?? "Our Team")
          .replace(/\{\{zoom_link\}\}/g, zoomLink)
          .replace(/\{\{interview_date\}\}/g, dateFormatted);
      } else {
        emailSubject = `Group Interview Invitation \u2014 ${team?.name ?? "Our Team"}`;
        emailBody = `Hi ${selectedCandidate.first_name},\n\nYou're invited to our upcoming group interview at ${team?.name ?? "Our Team"}.\n\nDate & Time: ${dateFormatted}\nZoom Link: ${zoomLink}\n\nPlease join a few minutes early and be prepared to introduce yourself.\n\nWe look forward to meeting you!\n\nBest,\n${team?.name ?? "Our Team"}`;
      }
    }

    // Build admin CC if configured
    const cc =
      team?.admin_cc && team?.admin_email ? team.admin_email : undefined;

    setPreviewData({
      to: selectedCandidate.email,
      fromEmail,
      subject: emailSubject,
      body: emailBody,
      teamId,
      candidateId,
      interviewType: interviewTypeLabel,
      scheduledAt,
      notes,
      cc,
    });
    setShowPreview(true);
  }

  return (
    <>
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

          <form onSubmit={handlePreview} className="p-6 space-y-5">
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
                      ? "bg-brand text-white border-brand"
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
                      ? "bg-brand text-white border-brand"
                      : "text-[#272727] border-[#a59494]/40 hover:bg-[#f5f0f0]"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Group Interview
                </button>
              </div>
              {!hasGroupInterview && (
                <p className="text-xs text-[#a59494] mt-1.5">
                  Configure group interview settings in Settings &rarr; Team
                  to enable this option.
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
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                <option value="">Select a candidate...</option>
                {eligibleCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} &mdash; {c.stage}
                  </option>
                ))}
              </select>
            </div>

            {/* 1-on-1: Leader selector + Interviewers */}
            {interviewType === "1on1" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#272727] mb-1">
                    Primary Interviewer
                  </label>
                  <select
                    value={leaderId}
                    onChange={(e) => {
                      setLeaderId(e.target.value);
                      // Auto-add to interviewers
                      if (e.target.value && !selectedInterviewers.includes(e.target.value)) {
                        setSelectedInterviewers((prev) => [...prev, e.target.value]);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                  >
                    <option value="">Select a leader...</option>
                    {leaders.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Additional Interviewers */}
                {leaders.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-[#272727] mb-2">
                      Additional Interviewers
                      <span className="text-xs font-normal text-[#a59494] ml-1">(optional)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {leaders
                        .filter((l) => l.id !== leaderId)
                        .map((l) => (
                          <label
                            key={l.id}
                            className="flex items-center gap-2 text-sm text-[#272727] cursor-pointer rounded-lg px-2 py-1.5 hover:bg-[#f5f0f0] transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedInterviewers.includes(l.id)}
                              onChange={(e) => {
                                setSelectedInterviewers((prev) =>
                                  e.target.checked
                                    ? [...prev, l.id]
                                    : prev.filter((id) => id !== l.id)
                                );
                              }}
                              className="w-3.5 h-3.5 text-brand border-[#a59494]/30 rounded focus:ring-brand/30"
                            />
                            <span className="truncate">{l.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}

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
                        className="text-sm text-brand hover:text-brand-dark underline break-all transition"
                      >
                        {selectedLeader.google_booking_url}
                      </a>
                    ) : (
                      <p className="text-sm text-amber-600">
                        No booking URL configured. The email will use a
                        fallback message instead.{" "}
                        <span className="text-xs">
                          You can add a booking URL in Settings &rarr; Team
                          Members.
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-primary)"
                    strokeWidth="2"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                    />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-sm text-[#272727]">
                    {new Date(
                      team!.group_interview_date!
                    ).toLocaleString("en-US", {
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-primary)"
                    strokeWidth="2"
                    className="shrink-0 mt-0.5"
                  >
                    <path d="M15 10l5 5-5 5" />
                    <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                  </svg>
                  <a
                    href={team!.group_interview_zoom_link!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand hover:text-brand-dark underline break-all transition"
                  >
                    {team!.group_interview_zoom_link}
                  </a>
                </div>
              </div>
            )}

            {/* What happens when you click Preview & Send */}
            {selectedCandidate &&
              ((interviewType === "1on1" && leaderId) ||
                (interviewType === "group" && hasGroupInterview)) && (
                <div className="bg-brand/5 border border-brand/20 rounded-lg p-4">
                  <p className="text-xs font-semibold text-brand mb-1">
                    What happens next:
                  </p>
                  <ul className="text-xs text-[#272727]/70 space-y-1">
                    <li className="flex items-start gap-1.5">
                      <span className="text-brand mt-0.5">1.</span>
                      <span>
                        Preview the email to{" "}
                        <strong>{selectedCandidate.email}</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-brand mt-0.5">2.</span>
                      <span>
                        Edit subject or body if needed, then confirm
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-brand mt-0.5">3.</span>
                      <span>
                        Interview record created &amp; email sent
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
                      <span className="text-[#272727]">
                        {iv.interview_type}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#a59494]">
                          {iv.scheduled_at
                            ? new Date(
                                iv.scheduled_at
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : new Date(
                                iv.created_at
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
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

            {/* Error */}
            {error && <p className="text-sm text-red-600">{error}</p>}

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
                type="button"
                onClick={handleCreateOnly}
                disabled={
                  creatingOnly ||
                  !candidateId ||
                  (interviewType === "1on1" && !leaderId)
                }
                className="px-4 py-2 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition disabled:opacity-50"
              >
                {creatingOnly ? "Creating..." : "Create Only"}
              </button>
              <button
                type="submit"
                disabled={
                  !candidateId ||
                  (interviewType === "1on1" && !leaderId) ||
                  (interviewType === "group" && !hasGroupInterview)
                }
                className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                Preview &amp; Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Email Preview Modal (layered on top) */}
      {showPreview && previewData && (
        <EmailPreviewModal
          data={previewData}
          onClose={() => {
            setShowPreview(false);
            setPreviewData(null);
          }}
          onSent={(interview) => {
            setShowPreview(false);
            setPreviewData(null);
            onScheduled(interview);
          }}
        />
      )}
    </>
  );
}
