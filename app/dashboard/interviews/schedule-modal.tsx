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
import { generateIcs } from "@/lib/generate-ics";

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
  const [meetingMode, setMeetingMode] = useState<"virtual" | "inperson">("virtual");
  const [error, setError] = useState("");
  const [creatingOnly, setCreatingOnly] = useState(false);
  const [previousInterviews, setPreviousInterviews] = useState<Interview[]>(
    []
  );

  // Scheduled invite inline date/time
  const [showScheduledPicker, setShowScheduledPicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledHour, setScheduledHour] = useState("10");
  const [scheduledMinute, setScheduledMinute] = useState("00");
  const [scheduledAmPm, setScheduledAmPm] = useState<"AM" | "PM">("AM");

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

  // Current booking URL based on mode
  const currentBookingUrl =
    meetingMode === "virtual"
      ? selectedLeader?.virtual_booking_url || selectedLeader?.google_booking_url
      : selectedLeader?.inperson_booking_url || selectedLeader?.google_booking_url;

  // Find the relevant email templates
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

  /* ── Helper: build scheduled datetime string ────────────────── */

  function getScheduledAt(): string | null {
    if (!scheduledDate) return null;
    let hour = parseInt(scheduledHour, 10);
    if (scheduledAmPm === "PM" && hour !== 12) hour += 12;
    if (scheduledAmPm === "AM" && hour === 12) hour = 0;
    const min = parseInt(scheduledMinute, 10);
    const dt = new Date(scheduledDate + "T12:00:00");
    dt.setHours(hour, min, 0, 0);
    return dt.toISOString();
  }

  /* ── Skip for Now (create record, no email) ─────────────────── */

  async function handleSkipForNow() {
    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    setCreatingOnly(true);
    setError("");

    try {
      const interviewTypeLabel =
        interviewType === "1on1" ? "1on1 Interview" : "Group Interview";
      const scheduledAt =
        interviewType === "group" && team?.group_interview_date
          ? team.group_interview_date
          : null;
      const notes =
        interviewType === "1on1" && selectedLeader
          ? `Leader: ${selectedLeader.name} | ${meetingMode === "virtual" ? "Virtual" : "In-Person"}`
          : interviewType === "group"
            ? "Group interview"
            : "";

      const interviewerIds = leaderId ? [leaderId] : [];

      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_interview",
          payload: {
            team_id: teamId,
            candidate_id: candidateId,
            interview_type: interviewTypeLabel,
            status: "scheduled",
            scheduled_at: scheduledAt,
            notes,
            interviewer_ids: interviewerIds.length > 0 ? interviewerIds : undefined,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Failed to create interview");
        setCreatingOnly(false);
        return;
      }

      onScheduled(result.data as Interview);
    } catch {
      setError("Failed to create interview");
    } finally {
      setCreatingOnly(false);
    }
  }

  /* ── Send Booking Link ──────────────────────────────────────── */

  function handleSendBookingLink() {
    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    if (!selectedCandidate?.email) {
      setError("Selected candidate has no email address");
      return;
    }
    if (!leaderId) {
      setError("Please select an interviewer");
      return;
    }
    if (!currentBookingUrl) {
      setError(`No ${meetingMode} booking link configured for ${selectedLeader?.name}. Add one in their profile.`);
      return;
    }

    setError("");

    const interviewTypeLabel = "1on1 Interview";
    const modeLabel = meetingMode === "virtual" ? "virtual" : "in-person";
    const notes = `Leader: ${selectedLeader!.name} | ${modeLabel} | Booking link sent`;

    let emailSubject: string;
    let emailBody: string;

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
        .replace(/\{\{interview_type\}\}/g, interviewTypeLabel)
        .replace(/\{\{booking_link\}\}/g, currentBookingUrl);
    } else {
      emailSubject = `Your Interview with ${team?.name ?? "Our Team"}`;
      emailBody = `Hi ${selectedCandidate.first_name},\n\nWe're excited to move forward with you! You've been selected for a ${modeLabel} interview with ${selectedLeader!.name}.\n\nPlease use the link below to book a time that works for you:\n${currentBookingUrl}\n\nIf you have any questions in the meantime, don't hesitate to reach out.\n\nLooking forward to connecting!\n\n${team?.name ?? "Our Team"}`;
    }

    const cc = team?.admin_cc && team?.admin_email ? team.admin_email : undefined;

    setPreviewData({
      to: selectedCandidate.email,
      fromEmail: selectedLeader!.from_email || "",
      subject: emailSubject,
      body: emailBody,
      teamId,
      candidateId,
      interviewType: interviewTypeLabel,
      scheduledAt: null,
      notes,
      cc,
    });
    setShowPreview(true);
  }

  /* ── Send Scheduled Invite ──────────────────────────────────── */

  function handleSendScheduledInvite() {
    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    if (!selectedCandidate?.email) {
      setError("Selected candidate has no email address");
      return;
    }
    if (!leaderId) {
      setError("Please select an interviewer");
      return;
    }

    const scheduledAt = getScheduledAt();
    if (!scheduledAt) {
      setError("Please select a date and time");
      return;
    }

    setError("");

    const interviewTypeLabel = "1on1 Interview";
    const modeLabel = meetingMode === "virtual" ? "Virtual" : "In-Person";
    const meetingLink = meetingMode === "virtual" ? (selectedLeader?.virtual_meeting_link || "") : "";
    const officeAddr = meetingMode === "inperson" ? (team?.office_address || "") : "";

    const dateFormatted = new Date(scheduledAt).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const notes = `Leader: ${selectedLeader!.name} | ${modeLabel} | Scheduled: ${dateFormatted}`;

    let emailSubject: string;
    let emailBody: string;

    emailSubject = `Your ${modeLabel} Interview — ${dateFormatted}`;

    const locationLine = meetingMode === "virtual"
      ? (meetingLink ? `\nMeeting Link: ${meetingLink}` : "\nYour interviewer will share the meeting link before the call.")
      : (officeAddr ? `\nLocation: ${officeAddr}` : "\nYour interviewer will confirm the office location.");

    emailBody = `Hi ${selectedCandidate.first_name},\n\nYour ${modeLabel.toLowerCase()} interview with ${selectedLeader!.name} at ${team?.name ?? "Our Team"} has been scheduled.\n\nDate & Time: ${dateFormatted}${locationLine}\n\nPlease arrive a few minutes early. If you need to reschedule, let us know as soon as possible.\n\nLooking forward to meeting you!\n\n${team?.name ?? "Our Team"}`;

    const cc = team?.admin_cc && team?.admin_email ? team.admin_email : undefined;

    // Generate .ics calendar attachment for the scheduled interview
    const icsLocation = meetingMode === "virtual"
      ? (meetingLink || "Virtual Meeting")
      : (officeAddr || "Office");
    const icsData = generateIcs({
      title: `${modeLabel} Interview — ${team?.name ?? "Our Team"}`,
      description: `${modeLabel} interview with ${selectedLeader!.name} at ${team?.name ?? "Our Team"}`,
      location: icsLocation,
      startDate: new Date(scheduledAt),
      durationMinutes: 60,
      organizerName: selectedLeader!.name,
      organizerEmail: selectedLeader!.from_email || selectedLeader!.email,
    });

    setPreviewData({
      to: selectedCandidate.email,
      fromEmail: selectedLeader!.from_email || "",
      subject: emailSubject,
      body: emailBody,
      teamId,
      candidateId,
      interviewType: interviewTypeLabel,
      scheduledAt,
      notes,
      cc,
      icsData,
    });
    setShowPreview(true);
  }

  /* ── Group Interview Preview ────────────────────────────────── */

  function handleGroupPreview(e: React.FormEvent) {
    e.preventDefault();

    if (!candidateId) {
      setError("Please select a candidate");
      return;
    }
    if (!selectedCandidate?.email) {
      setError("Selected candidate has no email address");
      return;
    }
    if (!team?.group_interview_zoom_link || !team?.group_interview_date) {
      setError("Group interview Zoom link or date not configured. Update in Settings → Team.");
      return;
    }

    setError("");

    const interviewTypeLabel = "Group Interview";
    const scheduledAt = team.group_interview_date;
    const zoomLink = team.group_interview_zoom_link;
    const dateFormatted = new Date(scheduledAt).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const notes = "Group interview via Zoom";
    let emailSubject: string;
    let emailBody: string;

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
      emailSubject = `Group Interview Invitation — ${team?.name ?? "Our Team"}`;
      emailBody = `Hi ${selectedCandidate.first_name},\n\nYou're invited to our upcoming group interview at ${team?.name ?? "Our Team"}.\n\nDate & Time: ${dateFormatted}\nZoom Link: ${zoomLink}\n\nPlease join a few minutes early and be prepared to introduce yourself.\n\nWe look forward to meeting you!\n\nBest,\n${team?.name ?? "Our Team"}`;
    }

    const cc = team?.admin_cc && team?.admin_email ? team.admin_email : undefined;

    // Generate .ics calendar attachment
    const icsData = generateIcs({
      title: `Group Interview — ${team?.name ?? "Our Team"}`,
      description: `Group interview with ${team?.name ?? "Our Team"}. Zoom link: ${zoomLink}`,
      location: zoomLink,
      startDate: new Date(scheduledAt),
      durationMinutes: 60,
      organizerName: team?.name ?? "Recruiting Team",
    });

    setPreviewData({
      to: selectedCandidate.email,
      fromEmail: "",
      subject: emailSubject,
      body: emailBody,
      teamId,
      candidateId,
      interviewType: interviewTypeLabel,
      scheduledAt,
      notes,
      cc,
      icsData,
    });
    setShowPreview(true);
  }

  // Generate 15-minute increment options
  const minuteOptions = ["00", "15", "30", "45"];
  const hourOptions = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i));

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

          <div className="p-6 space-y-5">
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

            {/* ── 1-on-1 Interview Section ─────────────────────── */}
            {interviewType === "1on1" && (
              <>
                {/* Interviewer selector */}
                <div>
                  <label className="block text-sm font-medium text-[#272727] mb-1">
                    Interviewer
                  </label>
                  <select
                    value={leaderId}
                    onChange={(e) => setLeaderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                  >
                    <option value="">Select an interviewer...</option>
                    {leaders.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Virtual / In-Person Toggle */}
                {selectedLeader && (
                  <div>
                    <label className="block text-sm font-medium text-[#272727] mb-2">
                      Meeting Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMeetingMode("virtual")}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                          meetingMode === "virtual"
                            ? "bg-brand/10 text-brand border-brand"
                            : "text-[#272727] border-[#a59494]/40 hover:bg-[#f5f0f0]"
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        Virtual
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetingMode("inperson")}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                          meetingMode === "inperson"
                            ? "bg-brand/10 text-brand border-brand"
                            : "text-[#272727] border-[#a59494]/40 hover:bg-[#f5f0f0]"
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        In-Person
                      </button>
                    </div>
                  </div>
                )}

                {/* Booking Link Display */}
                {selectedLeader && (
                  <div className="bg-[#f5f0f0] rounded-lg p-4 space-y-2">
                    <p className="text-xs font-medium text-[#a59494]">
                      {selectedLeader.name}&apos;s {meetingMode === "virtual" ? "Virtual" : "In-Person"} Booking Link
                    </p>
                    {currentBookingUrl ? (
                      <a
                        href={currentBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand hover:text-brand-dark underline break-all transition"
                      >
                        {currentBookingUrl}
                      </a>
                    ) : (
                      <p className="text-sm text-amber-600">
                        No {meetingMode} booking link configured.{" "}
                        <span className="text-xs">
                          Add one in Profile &rarr; Scheduling.
                        </span>
                      </p>
                    )}
                    {meetingMode === "virtual" && selectedLeader.virtual_meeting_link && (
                      <div className="pt-1 border-t border-[#a59494]/10 mt-2">
                        <p className="text-xs font-medium text-[#a59494]">Meeting Link</p>
                        <a
                          href={selectedLeader.virtual_meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand hover:text-brand-dark underline break-all"
                        >
                          {selectedLeader.virtual_meeting_link}
                        </a>
                      </div>
                    )}
                    {meetingMode === "inperson" && team?.office_address && (
                      <div className="pt-1 border-t border-[#a59494]/10 mt-2">
                        <p className="text-xs font-medium text-[#a59494]">Office Address</p>
                        <p className="text-xs text-[#272727]">{team.office_address}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Scheduled Picker */}
                {showScheduledPicker && (
                  <div className="border border-brand/20 bg-brand/5 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-brand">
                      Select Date &amp; Time
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-[#272727] mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[#272727] mb-1">Hour</label>
                        <select
                          value={scheduledHour}
                          onChange={(e) => setScheduledHour(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                        >
                          {hourOptions.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[#272727] mb-1">Min</label>
                        <select
                          value={scheduledMinute}
                          onChange={(e) => setScheduledMinute(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                        >
                          {minuteOptions.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[#272727] mb-1">AM/PM</label>
                        <select
                          value={scheduledAmPm}
                          onChange={(e) => setScheduledAmPm(e.target.value as "AM" | "PM")}
                          className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Group Interview Section ──────────────────────── */}
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
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-sm text-[#272727]">
                    {new Date(team!.group_interview_date!).toLocaleString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    )}
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

            {/* Error */}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* ── Action Buttons ───────────────────────────────── */}
            {interviewType === "1on1" ? (
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSkipForNow}
                    disabled={creatingOnly || !candidateId || !leaderId}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
                  >
                    {creatingOnly ? "Creating..." : "Skip for Now"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBookingLink}
                    disabled={!candidateId || !leaderId || !currentBookingUrl}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition disabled:opacity-50"
                  >
                    Send Booking Link
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (showScheduledPicker) {
                      handleSendScheduledInvite();
                    } else {
                      setShowScheduledPicker(true);
                    }
                  }}
                  disabled={!candidateId || !leaderId || (showScheduledPicker && !scheduledDate)}
                  className="w-full px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {showScheduledPicker ? "Send Scheduled Invite" : "Send Scheduled Invite →"}
                </button>
              </div>
            ) : (
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
                  onClick={handleSkipForNow}
                  disabled={creatingOnly || !candidateId}
                  className="px-4 py-2 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition disabled:opacity-50"
                >
                  {creatingOnly ? "Creating..." : "Create Only"}
                </button>
                <button
                  type="button"
                  onClick={handleGroupPreview}
                  disabled={!candidateId || !hasGroupInterview}
                  className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  Preview &amp; Send
                </button>
              </div>
            )}
          </div>
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
