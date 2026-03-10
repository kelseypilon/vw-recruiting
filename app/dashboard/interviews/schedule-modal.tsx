"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Candidate,
  Interview,
  TeamUser,
  EmailTemplate,
  Team,
} from "@/lib/types";
import { generateIcs } from "@/lib/generate-ics";
import DateTimePicker from "@/components/date-time-picker";

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

type Step = "choose" | "send-link" | "confirmed";

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
  const [step, setStep] = useState<Step>("choose");
  const [candidateId, setCandidateId] = useState(
    preselectedCandidateId ?? ""
  );
  const [interviewerId, setInterviewerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Confirmed-step fields
  const [dateTimeValue, setDateTimeValue] = useState("");
  const [locationMode, setLocationMode] = useState<"office" | "virtual" | "other">("virtual");
  const [locationCustom, setLocationCustom] = useState("");

  // Template & email state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const selectedCandidate = eligibleCandidates.find((c) => c.id === candidateId);
  const selectedInterviewer = leaders.find((l) => l.id === interviewerId);
  const firstName = selectedCandidate
    ? selectedCandidate.first_name
    : "";

  // Booking URL for the send-link step
  const bookingUrl =
    selectedInterviewer?.virtual_booking_url ||
    selectedInterviewer?.google_booking_url ||
    "";

  // Resolved location string
  const resolvedLocation =
    locationMode === "office"
      ? team?.office_address || "(Office Address)"
      : locationMode === "virtual"
        ? selectedInterviewer?.virtual_meeting_link || selectedInterviewer?.meeting_link || ""
        : locationCustom;

  // Auto-select appropriate email template when step changes
  useEffect(() => {
    if (emailTemplates.length === 0) return;
    if (step === "send-link") {
      const t = emailTemplates.find(
        (t) =>
          t.is_active &&
          (t.trigger === "interview_scheduled" ||
            t.name.toLowerCase().includes("interview invitation") ||
            t.name.toLowerCase().includes("1on1") ||
            t.name.toLowerCase().includes("1-on-1"))
      );
      if (t) setSelectedTemplateId(t.id);
    } else if (step === "confirmed") {
      const t = emailTemplates.find(
        (t) =>
          t.is_active &&
          (t.trigger === "interview_confirmation" ||
            t.trigger === "interview_scheduled" ||
            t.name.toLowerCase().includes("interview"))
      );
      if (t) setSelectedTemplateId(t.id);
    }
  }, [step, emailTemplates]);

  // Resolve merge tags in template
  const resolveTemplate = useCallback(
    (template: EmailTemplate | undefined) => {
      if (!template) return { subject: "", body: "" };
      const dateStr = dateTimeValue
        ? new Date(dateTimeValue).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBD";

      const replacements: Record<string, string> = {
        "{{first_name}}": firstName,
        "{{last_name}}": selectedCandidate?.last_name || "",
        "{{candidate_name}}": selectedCandidate
          ? `${selectedCandidate.first_name} ${selectedCandidate.last_name}`
          : "",
        "{{team_name}}": team?.name || "Our Team",
        "{{interview_type}}": "1:1 Interview",
        "{{interview_date}}": dateStr,
        "{{leader_name}}": selectedInterviewer?.name || "",
        "{{booking_link}}": bookingUrl,
        "{{location}}": resolvedLocation,
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
    [firstName, selectedCandidate, selectedInterviewer, dateTimeValue, resolvedLocation, bookingUrl, team?.name]
  );

  // Update editable email fields when template or inputs change
  const selectedTemplate = emailTemplates.find((t) => t.id === selectedTemplateId);
  const resolved = resolveTemplate(selectedTemplate);

  useEffect(() => {
    if (resolved.subject) setEmailSubject(resolved.subject);
    if (resolved.body) setEmailBody(resolved.body);
  }, [selectedTemplateId, interviewerId, dateTimeValue, locationMode, locationCustom, candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Skip for Now (create record, no email) ─────────────────── */

  async function handleSkip() {
    if (!candidateId) {
      setError("Please select a candidate");
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
            scheduled_at: null,
            notes: interviewerId && selectedInterviewer
              ? `Leader: ${selectedInterviewer.name}`
              : "Interview created — details TBD",
            interviewer_ids: interviewerId ? [interviewerId] : [],
          },
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Failed to create interview");
        setLoading(false);
        return;
      }

      onScheduled(result.data as Interview);
    } catch {
      setError("Failed to create interview");
      setLoading(false);
    }
  }

  /* ── Send Booking Link ──────────────────────────────────────── */

  async function handleSendLink() {
    if (!candidateId || !selectedCandidate?.email) {
      setError("Please select a candidate with an email address");
      return;
    }
    if (!interviewerId) {
      setError("Please select an interviewer");
      return;
    }
    if (!bookingUrl) {
      setError(
        `No booking link configured for ${selectedInterviewer?.name}. Add one in their profile.`
      );
      return;
    }
    setLoading(true);
    setError("");

    try {
      // 1. Create interview record
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
            scheduled_at: null,
            notes: `Leader: ${selectedInterviewer!.name} | Booking link sent`,
            interviewer_ids: [interviewerId],
          },
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Failed to create interview");
        setLoading(false);
        return;
      }

      // 2. Send email
      const subject =
        emailSubject || `Your Interview with ${team?.name ?? "Our Team"}`;
      const body =
        emailBody ||
        `Hi ${firstName},\n\nYou've been selected for a 1:1 interview with ${selectedInterviewer!.name}.\n\nPlease use the link below to book a time that works for you:\n${bookingUrl}\n\nLooking forward to connecting!\n\n${team?.name ?? "Our Team"}`;

      const cc =
        team?.admin_cc && team?.admin_email ? team.admin_email : undefined;

      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedCandidate.email,
          subject,
          body: body.replace(/\n/g, "<br>"),
          candidate_id: candidateId,
          cc,
        }),
      });

      setToast(`Scheduling link sent to ${selectedCandidate.email}`);
      setTimeout(() => onScheduled(result.data as Interview), 1500);
    } catch {
      setError("Failed to send scheduling link");
      setLoading(false);
    }
  }

  /* ── Schedule & Send Confirmed Invite ───────────────────────── */

  async function handleScheduleAndSend() {
    if (!candidateId || !selectedCandidate?.email) {
      setError("Please select a candidate with an email address");
      return;
    }
    if (!interviewerId) {
      setError("Please select an interviewer");
      return;
    }
    if (!dateTimeValue) {
      setError("Please select a date and time");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const scheduledAtISO = new Date(dateTimeValue).toISOString();
      const dateStr = new Date(dateTimeValue).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // 1. Create interview record
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
            notes: `Leader: ${selectedInterviewer!.name} | ${resolvedLocation || "Location TBD"} | ${dateStr}`,
            interviewer_ids: [interviewerId],
            location: resolvedLocation || null,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Failed to create interview");
        setLoading(false);
        return;
      }

      // 2. Send confirmation email with .ics attachment
      const subject =
        emailSubject || `Interview Confirmation — ${dateStr}`;
      const body =
        emailBody ||
        `Hi ${firstName},\n\nYour interview with ${selectedInterviewer!.name} at ${team?.name ?? "Our Team"} has been scheduled.\n\nDate & Time: ${dateStr}\n${resolvedLocation ? `Location: ${resolvedLocation}\n` : ""}\nLooking forward to meeting you!\n\n${team?.name ?? "Our Team"}`;

      const cc =
        team?.admin_cc && team?.admin_email ? team.admin_email : undefined;

      const icsLocation = resolvedLocation || "TBD";
      const icsData = generateIcs({
        title: `Interview — ${team?.name ?? "Our Team"}`,
        description: `1:1 interview with ${selectedInterviewer!.name} at ${team?.name ?? "Our Team"}`,
        location: icsLocation,
        startDate: new Date(scheduledAtISO),
        durationMinutes: 60,
        organizerName: selectedInterviewer!.name,
        organizerEmail:
          selectedInterviewer!.from_email || selectedInterviewer!.email,
      });

      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedCandidate.email,
          subject,
          body: body.replace(/\n/g, "<br>"),
          candidate_id: candidateId,
          cc,
          icsData,
        }),
      });

      setToast("Interview scheduled and confirmation sent");
      setTimeout(() => onScheduled(result.data as Interview), 1500);
    } catch {
      setError("Failed to schedule interview");
      setLoading(false);
    }
  }

  /* ── Toast overlay ──────────────────────────────────────────── */

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* X close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a59494] hover:text-[#272727] transition z-10"
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

        <div className="p-6">
          {/* ─── STEP 1: Choose ──────────────────────────────── */}
          {step === "choose" && (
            <>
              <h3 className="text-base font-bold text-[#272727] mb-1">
                Schedule 1:1 Interview
              </h3>
              <p className="text-xs text-[#a59494] mb-5">
                Select a candidate and choose how to schedule the interview.
              </p>

              {/* Candidate selector */}
              <div className="mb-5">
                <label className={labelClasses}>Candidate</label>
                <select
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select a candidate...</option>
                  {eligibleCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} &mdash; {c.stage}
                    </option>
                  ))}
                </select>
              </div>

              {candidateId && (
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
                        Send the candidate a link to book a time that works for
                        them
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
                        You&apos;ve agreed on a time &mdash; send a calendar
                        invite and confirmation email
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
              )}

              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

              <div className="flex justify-end mt-5 pt-3 border-t border-[#a59494]/10">
                <button
                  onClick={onClose}
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
                Send {selectedCandidate?.first_name || "the candidate"} a link
                to book their interview.
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
                        {l.name}
                        {l.role ? ` \u2014 ${l.role}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Booking URL info */}
                {selectedInterviewer && bookingUrl && (
                  <div className="rounded-lg bg-brand/5 border border-brand/10 px-4 py-2.5">
                    <p className="text-xs text-[#a59494]">
                      Booking link:{" "}
                      <span className="text-brand break-all">{bookingUrl}</span>
                    </p>
                  </div>
                )}

                {selectedInterviewer && !bookingUrl && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    No booking link configured for {selectedInterviewer.name}.
                    Add one in Profile &rarr; Scheduling.
                  </p>
                )}

                {/* Email template */}
                {emailTemplates.length > 0 && (
                  <div>
                    <label className={labelClasses}>Email Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className={selectClasses}
                    >
                      <option value="">Select a template...</option>
                      {emailTemplates
                        .filter((t) => t.is_active)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Editable email preview */}
                {(emailSubject || emailBody) && (
                  <div>
                    <label className={labelClasses}>Email Preview</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className={`${inputClasses} text-xs font-medium mb-1`}
                      placeholder="Subject"
                    />
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={8}
                      className={`${inputClasses} resize-y text-xs leading-relaxed`}
                    />
                  </div>
                )}

                {selectedCandidate && !selectedCandidate.email && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    This candidate has no email address on file. Add one before
                    sending.
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

              <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#a59494]/10">
                <button
                  onClick={() => {
                    setStep("choose");
                    setError("");
                  }}
                  className="text-sm text-[#a59494] hover:text-[#272727] transition"
                >
                  &larr; Back
                </button>
                <button
                  onClick={handleSendLink}
                  disabled={
                    loading ||
                    !interviewerId ||
                    !bookingUrl ||
                    !selectedCandidate?.email
                  }
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
                Enter the confirmed details and send{" "}
                {selectedCandidate?.first_name || "the candidate"} a
                confirmation email.
              </p>

              <div className="space-y-4">
                {/* Date & Time */}
                <div>
                  <label className={labelClasses}>Date &amp; Time</label>
                  <DateTimePicker
                    value={dateTimeValue}
                    onChange={setDateTimeValue}
                    placeholder="Select date & time"
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
                        {l.name}
                        {l.role ? ` \u2014 ${l.role}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location / Link — Smart dropdown */}
                <div>
                  <label className={labelClasses}>Location / Link</label>
                  <select
                    value={locationMode}
                    onChange={(e) =>
                      setLocationMode(
                        e.target.value as "office" | "virtual" | "other"
                      )
                    }
                    className={selectClasses}
                  >
                    <option value="virtual">Virtual (meeting link)</option>
                    <option value="office">Office (in-person)</option>
                    <option value="other">Other</option>
                  </select>
                  {locationMode === "virtual" && resolvedLocation && (
                    <p className="text-xs text-brand mt-1 truncate">
                      {resolvedLocation}
                    </p>
                  )}
                  {locationMode === "office" && resolvedLocation && (
                    <p className="text-xs text-[#272727] mt-1">
                      {resolvedLocation}
                    </p>
                  )}
                  {locationMode === "other" && (
                    <input
                      type="text"
                      value={locationCustom}
                      onChange={(e) => setLocationCustom(e.target.value)}
                      placeholder="Enter address, link, or details..."
                      className={`${inputClasses} mt-2`}
                    />
                  )}
                </div>

                {/* Email template */}
                {emailTemplates.length > 0 && (
                  <div>
                    <label className={labelClasses}>Email Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className={selectClasses}
                    >
                      <option value="">Select a template...</option>
                      {emailTemplates
                        .filter((t) => t.is_active)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Editable email preview */}
                {(emailSubject || emailBody) && (
                  <div>
                    <label className={labelClasses}>Email Preview</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className={`${inputClasses} text-xs font-medium mb-1`}
                      placeholder="Subject"
                    />
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={8}
                      className={`${inputClasses} resize-y text-xs leading-relaxed`}
                    />
                  </div>
                )}

                {selectedCandidate && !selectedCandidate.email && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    This candidate has no email address on file. Add one before
                    sending.
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

              <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#a59494]/10">
                <button
                  onClick={() => {
                    setStep("choose");
                    setError("");
                  }}
                  className="text-sm text-[#a59494] hover:text-[#272727] transition"
                >
                  &larr; Back
                </button>
                <button
                  onClick={handleScheduleAndSend}
                  disabled={
                    loading ||
                    !interviewerId ||
                    !dateTimeValue ||
                    !selectedCandidate?.email
                  }
                  className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {loading ? "Scheduling..." : "Schedule & Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
