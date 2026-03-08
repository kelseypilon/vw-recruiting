"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { PipelineStage, TeamUser, GroupInterviewSession, EmailTemplate } from "@/lib/types";
import { isGroupInterviewStage } from "@/lib/stage-utils";

interface Props {
  candidateName: string;
  candidateId: string;
  candidateEmail: string | null;
  newStage: string;
  teamId: string;
  currentUserId: string;
  leaders: TeamUser[];
  upcomingSessions: GroupInterviewSession[];
  teamZoomLink: string | null;
  stages: PipelineStage[];
  onComplete: () => void;
  onCancel: () => void;
}

export default function InterviewStageModal({
  candidateName,
  candidateId,
  candidateEmail,
  newStage,
  teamId,
  currentUserId,
  leaders,
  upcomingSessions,
  teamZoomLink,
  stages,
  onComplete,
  onCancel,
}: Props) {
  const isGroup = isGroupInterviewStage(stages, newStage);

  if (isGroup) {
    return (
      <GroupInterviewFlow
        candidateName={candidateName}
        candidateId={candidateId}
        candidateEmail={candidateEmail}
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
      candidateEmail={candidateEmail}
      newStage={newStage}
      teamId={teamId}
      currentUserId={currentUserId}
      leaders={leaders}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

/* ── Group Interview Flow — session selector + email editor ──── */

type GroupStep = "select" | "email";

function GroupInterviewFlow({
  candidateName,
  candidateId,
  candidateEmail,
  teamId,
  currentUserId,
  upcomingSessions,
  teamZoomLink,
  onComplete,
  onCancel,
}: {
  candidateName: string;
  candidateId: string;
  candidateEmail: string | null;
  teamId: string;
  currentUserId: string;
  upcomingSessions: GroupInterviewSession[];
  teamZoomLink: string | null;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<GroupStep>("select");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    upcomingSessions.length === 1 ? upcomingSessions[0].id : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [toast, setToast] = useState("");

  // Email editor state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  const firstName = candidateName.split(" ")[0] || candidateName;
  const selectedSession = upcomingSessions.find((s) => s.id === selectedSessionId);

  // Fetch templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_email_templates", payload: { team_id: teamId } }),
        });
        const data = await res.json();
        if (data.templates) setTemplates(data.templates);
      } catch { /* templates unavailable */ }
    }
    fetchTemplates();
  }, [teamId]);

  // Resolve merge tags for group interview template
  function resolveGroupTemplate(session: GroupInterviewSession) {
    const groupTemplate = templates.find(
      (t) => t.is_active && (t.trigger === "group_interview" || t.name.toLowerCase().includes("group interview"))
    );

    const dateStr = session.session_date
      ? new Date(session.session_date).toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "TBD";
    const zoomLink = session.zoom_link || teamZoomLink || "";

    if (groupTemplate) {
      const replacements: Record<string, string> = {
        "{{first_name}}": firstName,
        "{{last_name}}": candidateName.split(" ").slice(1).join(" ") || "",
        "{{candidate_name}}": candidateName,
        "{{team_name}}": "Vantage West Realty",
        "{{group_interview_date}}": dateStr,
        "{{zoom_link}}": zoomLink,
        "{{sender_name}}": "",
        "{{session_title}}": session.title,
      };
      let subject = groupTemplate.subject;
      let body = groupTemplate.body;
      for (const [tag, value] of Object.entries(replacements)) {
        subject = subject.replaceAll(tag, value);
        body = body.replaceAll(tag, value);
      }
      return { subject, body };
    }

    // Fallback if no template found
    return {
      subject: `You're Invited to a Group Interview — Vantage West Realty`,
      body: `Hi ${firstName},\n\nWe're excited to invite you to our group interview session!\n\nDetails:\n- Date: ${dateStr}${zoomLink ? `\n- Zoom Link: ${zoomLink}` : ""}\n\nPlease join 5 minutes early and have your camera on. This is a great opportunity to learn about our team culture.\n\nSee you there!\n\nVantage West Realty`,
    };
  }

  async function handleAddToSession() {
    if (!selectedSessionId || !selectedSession) {
      setError("Please select a session");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // 1. Add candidate to session
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

      // 2. Create interview record
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
            scheduled_at: selectedSession.session_date || null,
            notes: "Added to group interview session",
            interviewer_ids: [currentUserId],
          },
        }),
      });

      setLoading(false);

      // 3. If email checkbox checked, show email editor
      if (sendEmail && candidateEmail) {
        const resolved = resolveGroupTemplate(selectedSession);
        setEmailSubject(resolved.subject);
        setEmailBody(resolved.body);
        setStep("email");
      } else {
        onComplete();
      }
    } catch {
      setError("Failed to add candidate to session");
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!candidateEmail) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: candidateEmail,
          subject: emailSubject,
          body: emailBody.replace(/\n/g, "<br>"),
          candidate_id: candidateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send email");
        setLoading(false);
        return;
      }

      setToast(`Invitation sent to ${candidateEmail}`);
      setTimeout(() => onComplete(), 1500);
    } catch {
      setError("Failed to send email");
      setLoading(false);
    }
  }

  // Toast overlay
  if (toast) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-3">
          <span className="text-green-500 text-xl">&#10003;</span>
          <span className="text-sm font-medium text-[#272727]">{toast}</span>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">

        {/* ─── Step 1: Select Session ──────────────────────── */}
        {step === "select" && (
          <>
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
                          : "border-[#a59494]/20 hover:border-brand/40 hover:bg-gray-50"
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
                onClick={onComplete}
                className="text-xs font-medium text-[#a59494] hover:text-[#272727] transition"
              >
                Skip for now
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-lg text-sm text-[#272727] hover:bg-gray-50 transition"
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
          </>
        )}

        {/* ─── Step 2: Email Editor ───────────────────────── */}
        {step === "email" && (
          <>
            <h3 className="text-base font-bold text-[#272727] mb-1">
              Send Interview Invitation to {firstName}
            </h3>
            <p className="text-xs text-[#a59494] mb-5">
              Review and send the invitation email.
            </p>

            <div className="space-y-4">
              {/* To */}
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">To</label>
                <input
                  type="text"
                  readOnly
                  value={candidateEmail || ""}
                  className={`${inputClasses} bg-gray-50 text-[#a59494]`}
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className={inputClasses}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">Body</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className={`${inputClasses} resize-y`}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#a59494]/10">
              <button
                onClick={onComplete}
                className="text-sm text-[#a59494] hover:text-[#272727] transition"
              >
                Skip — don&apos;t send
              </button>
              <button
                onClick={handleSendEmail}
                disabled={loading || !emailSubject.trim()}
                className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Email"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 1:1 Interview Flow — 2-step modal ────────────────────────── */

type Step = "choose" | "send-link" | "confirmed";

function OneOnOneFlow({
  candidateName,
  candidateId,
  candidateEmail,
  newStage,
  teamId,
  currentUserId,
  leaders,
  onComplete,
  onCancel,
}: {
  candidateName: string;
  candidateId: string;
  candidateEmail: string | null;
  newStage: string;
  teamId: string;
  currentUserId: string;
  leaders: TeamUser[];
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Shared fields
  const [interviewerId, setInterviewerId] = useState(currentUserId);

  // Step 2B fields
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [location, setLocation] = useState("");

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  const selectedInterviewer = leaders.find((l) => l.id === interviewerId);
  const firstName = candidateName.split(" ")[0] || candidateName;

  // Fetch email templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch(`/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_email_templates",
            payload: { team_id: teamId },
          }),
        });
        const data = await res.json();
        if (data.templates) {
          setTemplates(data.templates);
        }
      } catch {
        // Templates unavailable — user can still proceed
      } finally {
        setTemplatesLoaded(true);
      }
    }
    fetchTemplates();
  }, [teamId]);

  // Auto-select appropriate template when step changes
  useEffect(() => {
    if (!templatesLoaded || templates.length === 0) return;
    if (step === "send-link") {
      const inviteTemplate = templates.find(
        (t) => t.is_active && (t.trigger === "interview_scheduled" || t.name.toLowerCase().includes("interview invitation"))
      );
      if (inviteTemplate) setSelectedTemplateId(inviteTemplate.id);
    } else if (step === "confirmed") {
      // Use the same interview template for confirmation (can be customized later)
      const confirmTemplate = templates.find(
        (t) => t.is_active && (t.trigger === "interview_confirmation" || t.trigger === "interview_scheduled" || t.name.toLowerCase().includes("interview"))
      );
      if (confirmTemplate) setSelectedTemplateId(confirmTemplate.id);
    }
  }, [step, templatesLoaded, templates]);

  // Resolve merge tags in template body
  const resolveTemplate = useCallback(
    (template: EmailTemplate | undefined) => {
      if (!template) return { subject: "", body: "" };
      const bookingUrl = selectedInterviewer?.google_booking_url || selectedInterviewer?.virtual_booking_url || "";
      const dateStr = interviewDate
        ? new Date(interviewDate + (interviewTime ? `T${interviewTime}` : "")).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            ...(interviewTime ? { hour: "numeric", minute: "2-digit" } : {}),
          })
        : "TBD";

      const replacements: Record<string, string> = {
        "{{first_name}}": firstName,
        "{{last_name}}": candidateName.split(" ").slice(1).join(" ") || "",
        "{{candidate_name}}": candidateName,
        "{{team_name}}": "Vantage West Realty",
        "{{interview_type}}": "1:1 Interview",
        "{{interview_date}}": dateStr,
        "{{leader_name}}": selectedInterviewer?.name || "",
        "{{booking_link}}": bookingUrl,
        "{{location}}": location,
        "{{sender_name}}": selectedInterviewer?.name || "",
      };

      let subject = template.subject;
      let body = template.body;
      for (const [tag, value] of Object.entries(replacements)) {
        subject = subject.replaceAll(tag, value);
        body = body.replaceAll(tag, value);
      }
      return { subject, body };
    },
    [firstName, candidateName, selectedInterviewer, interviewDate, interviewTime, location]
  );

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const resolved = resolveTemplate(selectedTemplate);

  // ── Create interview record ──────────────────────────────────
  async function createInterviewRecord(scheduledAtISO: string | null) {
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
          scheduled_at: scheduledAtISO,
          notes: `Created when moved to ${newStage}`,
          interviewer_ids: interviewerId ? [interviewerId] : [],
          location: location || null,
        },
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  // ── Send email ──────────────────────────────────────────────
  async function sendEmail(subject: string, body: string) {
    if (!candidateEmail) return;
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: candidateEmail,
        subject,
        body: body.replace(/\n/g, "<br>"),
        candidate_id: candidateId,
      }),
    });
  }

  // ── Option C: Skip for Now ──────────────────────────────────
  async function handleSkip() {
    setLoading(true);
    setError("");
    try {
      await createInterviewRecord(null);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create interview");
      setLoading(false);
    }
  }

  // ── Option A: Send Scheduling Link ──────────────────────────
  async function handleSendLink() {
    if (!interviewerId) {
      setError("Please select an interviewer");
      return;
    }
    if (!candidateEmail) {
      setError("No email address on file for this candidate");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await createInterviewRecord(null);

      const subject = resolved.subject || `Your Interview with Vantage West Realty`;
      const body = resolved.body || `Hi ${firstName},\n\nYou've been selected for a 1:1 interview with ${selectedInterviewer?.name || "our team"}.\n\nPlease use the link below to book a time that works for you:\n${selectedInterviewer?.google_booking_url || selectedInterviewer?.virtual_booking_url || "(booking link)"}\n\nLooking forward to connecting!\n\nVantage West Realty`;
      await sendEmail(subject, body);

      setToast(`Scheduling link sent to ${candidateEmail}`);
      setTimeout(() => onComplete(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send scheduling link");
      setLoading(false);
    }
  }

  // ── Option B: Schedule & Send ───────────────────────────────
  async function handleScheduleAndSend() {
    if (!interviewerId) {
      setError("Please select an interviewer");
      return;
    }
    if (!interviewDate) {
      setError("Please select a date");
      return;
    }
    if (!candidateEmail) {
      setError("No email address on file for this candidate");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const scheduledAtISO = interviewTime
        ? new Date(`${interviewDate}T${interviewTime}`).toISOString()
        : new Date(`${interviewDate}T09:00`).toISOString();

      await createInterviewRecord(scheduledAtISO);

      const subject = resolved.subject || `Interview Confirmation — Vantage West Realty`;
      const body = resolved.body || `Hi ${firstName},\n\nYour interview has been confirmed!\n\nDate: ${interviewDate}\nTime: ${interviewTime || "TBD"}\n${location ? `Location: ${location}\n` : ""}\nLooking forward to meeting you!\n\nVantage West Realty`;
      await sendEmail(subject, body);

      setToast("Interview scheduled and confirmation sent");
      setTimeout(() => onComplete(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule interview");
      setLoading(false);
    }
  }

  // ── Toast overlay ───────────────────────────────────────────
  if (toast) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-3">
          <span className="text-green-500 text-xl">&#10003;</span>
          <span className="text-sm font-medium text-[#272727]">{toast}</span>
        </div>
      </div>
    );
  }

  const selectClasses =
    "w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white";
  const inputClasses = selectClasses;
  const labelClasses = "block text-sm font-medium text-[#272727] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* ─── STEP 1: Choose ──────────────────────────────── */}
        {step === "choose" && (
          <>
            <h3 className="text-base font-bold text-[#272727] mb-1">
              Schedule 1:1 Interview
            </h3>
            <p className="text-xs text-[#a59494] mb-5">
              How would you like to schedule this interview for{" "}
              <span className="font-medium text-[#272727]">{candidateName}</span>?
            </p>

            <div className="space-y-3">
              {/* Option A — Send Scheduling Link */}
              <button
                type="button"
                onClick={() => setStep("send-link")}
                className="w-full flex items-start gap-4 px-4 py-4 rounded-xl border border-[#a59494]/20 hover:border-brand/40 hover:bg-brand/5 transition text-left group"
              >
                <span className="text-2xl mt-0.5">&#128197;</span>
                <div>
                  <p className="text-sm font-semibold text-[#272727] group-hover:text-brand transition">
                    Send Scheduling Link
                  </p>
                  <p className="text-xs text-[#a59494] mt-0.5">
                    Send the candidate a link to book a time that works for them
                  </p>
                </div>
              </button>

              {/* Option B — Time Already Confirmed */}
              <button
                type="button"
                onClick={() => setStep("confirmed")}
                className="w-full flex items-start gap-4 px-4 py-4 rounded-xl border border-[#a59494]/20 hover:border-brand/40 hover:bg-brand/5 transition text-left group"
              >
                <span className="text-2xl mt-0.5">&#9993;&#65039;</span>
                <div>
                  <p className="text-sm font-semibold text-[#272727] group-hover:text-brand transition">
                    Time Already Confirmed
                  </p>
                  <p className="text-xs text-[#a59494] mt-0.5">
                    You&apos;ve agreed on a time &mdash; send a calendar invite and confirmation email
                  </p>
                </div>
              </button>

              {/* Option C — Skip for Now */}
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="w-full flex items-start gap-4 px-4 py-4 rounded-xl border border-[#a59494]/20 hover:border-[#a59494]/40 hover:bg-gray-50 transition text-left group"
              >
                <span className="text-2xl mt-0.5">&#9193;</span>
                <div>
                  <p className="text-sm font-semibold text-[#272727] group-hover:text-[#272727] transition">
                    Skip for Now
                  </p>
                  <p className="text-xs text-[#a59494] mt-0.5">
                    Create the interview record without sending anything
                  </p>
                </div>
              </button>
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex justify-end mt-5 pt-3 border-t border-[#a59494]/10">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm text-[#272727] hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ─── STEP 2A: Send Scheduling Link ──────────────── */}
        {step === "send-link" && (
          <>
            <h3 className="text-base font-bold text-[#272727] mb-1">
              Send Scheduling Link
            </h3>
            <p className="text-xs text-[#a59494] mb-5">
              Send {candidateName} a link to book their interview.
            </p>

            <div className="space-y-4">
              {/* Interviewer */}
              <div>
                <label className={labelClasses}>Interviewer</label>
                <select
                  value={interviewerId}
                  onChange={(e) => setInterviewerId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select an interviewer...</option>
                  {leaders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.role ? ` — ${l.role}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booking URL info */}
              {selectedInterviewer?.google_booking_url && (
                <div className="rounded-lg bg-brand/5 border border-brand/10 px-4 py-2.5">
                  <p className="text-xs text-[#a59494]">
                    Booking link:{" "}
                    <span className="text-brand break-all">
                      {selectedInterviewer.google_booking_url}
                    </span>
                  </p>
                </div>
              )}

              {/* Email template */}
              {templates.length > 0 && (
                <div>
                  <label className={labelClasses}>Email Template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">Select a template...</option>
                    {templates
                      .filter((t) => t.is_active)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Email preview */}
              {resolved.body && (
                <div>
                  <label className={labelClasses}>Email Preview</label>
                  <div className="rounded-lg border border-[#a59494]/20 p-3 bg-gray-50 max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium text-[#272727] mb-1">
                      Subject: {resolved.subject}
                    </p>
                    <div className="text-xs text-[#a59494] whitespace-pre-wrap leading-relaxed">
                      {resolved.body}
                    </div>
                  </div>
                </div>
              )}

              {!candidateEmail && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  This candidate has no email address on file. Add one before sending.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#a59494]/10">
              <button
                onClick={() => { setStep("choose"); setError(""); }}
                className="text-sm text-[#a59494] hover:text-[#272727] transition"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSendLink}
                disabled={loading || !interviewerId || !candidateEmail}
                className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Link"}
              </button>
            </div>
          </>
        )}

        {/* ─── STEP 2B: Time Already Confirmed ───────────── */}
        {step === "confirmed" && (
          <>
            <h3 className="text-base font-bold text-[#272727] mb-1">
              Confirm Interview Details
            </h3>
            <p className="text-xs text-[#a59494] mb-5">
              Enter the confirmed details and send {candidateName} a confirmation email.
            </p>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className={labelClasses}>Date</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className={inputClasses}
                />
              </div>

              {/* Time */}
              <div>
                <label className={labelClasses}>Time</label>
                <input
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className={inputClasses}
                />
              </div>

              {/* Interviewer */}
              <div>
                <label className={labelClasses}>Interviewer</label>
                <select
                  value={interviewerId}
                  onChange={(e) => setInterviewerId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select an interviewer...</option>
                  {leaders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.role ? ` — ${l.role}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location / Link */}
              <div>
                <label className={labelClasses}>
                  Location / Link{" "}
                  <span className="text-xs font-normal text-[#a59494]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Zoom link, office address, etc."
                  className={inputClasses}
                />
              </div>

              {/* Email template */}
              {templates.length > 0 && (
                <div>
                  <label className={labelClasses}>Email Template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">Select a template...</option>
                    {templates
                      .filter((t) => t.is_active)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Email preview */}
              {resolved.body && (
                <div>
                  <label className={labelClasses}>Email Preview</label>
                  <div className="rounded-lg border border-[#a59494]/20 p-3 bg-gray-50 max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium text-[#272727] mb-1">
                      Subject: {resolved.subject}
                    </p>
                    <div className="text-xs text-[#a59494] whitespace-pre-wrap leading-relaxed">
                      {resolved.body}
                    </div>
                  </div>
                </div>
              )}

              {!candidateEmail && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  This candidate has no email address on file. Add one before sending.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#a59494]/10">
              <button
                onClick={() => { setStep("choose"); setError(""); }}
                className="text-sm text-[#a59494] hover:text-[#272727] transition"
              >
                &larr; Back
              </button>
              <button
                onClick={handleScheduleAndSend}
                disabled={loading || !interviewerId || !interviewDate || !candidateEmail}
                className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? "Scheduling..." : "Schedule & Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
