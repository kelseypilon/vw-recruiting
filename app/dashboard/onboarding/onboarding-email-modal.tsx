"use client";

import { useState, useEffect } from "react";
import type {
  OnboardingTask,
  Candidate,
  EmailTemplate,
  TeamUser,
  Team,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  task: OnboardingTask;
  candidate: Candidate;
  templates: EmailTemplate[];
  leaders: TeamUser[];
  team: Team | null;
  onSent: () => void;
  onClose: () => void;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function OnboardingEmailModal({
  task,
  candidate,
  templates,
  leaders,
  team,
  onSent,
  onClose,
}: Props) {
  const senders = leaders.filter((l) => l.from_email || l.email);
  const [fromUserId, setFromUserId] = useState(senders[0]?.id ?? "");
  const [ccEmail, setCcEmail] = useState(
    team?.admin_cc && team?.admin_email ? team.admin_email : ""
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  const selectedSender = leaders.find((l) => l.id === fromUserId);

  function replaceMergeTags(text: string) {
    return text
      .replace(/\{\{first_name\}\}/g, candidate.first_name)
      .replace(/\{\{last_name\}\}/g, candidate.last_name)
      .replace(/\{\{team_name\}\}/g, team?.name ?? "Our Team")
      .replace(
        /\{\{sender_name\}\}/g,
        selectedSender?.name ?? "Recruiting Team"
      );
  }

  // Auto-select template matching this task's email_template_key
  useEffect(() => {
    if (task.email_template_key) {
      const tmpl = templates.find(
        (t) => t.trigger === task.email_template_key && t.is_active
      );
      if (tmpl) {
        setSubject(replaceMergeTags(tmpl.subject));
        setBody(replaceMergeTags(tmpl.body));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.email_template_key]);

  function handleTemplateChange(templateId: string) {
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setSubject(replaceMergeTags(tmpl.subject));
      setBody(replaceMergeTags(tmpl.body));
    } else {
      setSubject("");
      setBody("");
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setSendStatus("Please fill in subject and body");
      return;
    }
    setIsSending(true);
    setSendStatus("");

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: candidate.email,
          subject,
          body,
          from_email:
            selectedSender?.from_email ?? selectedSender?.email ?? undefined,
          cc: ccEmail || undefined,
          candidate_id: candidate.id,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setSendStatus(`Error: ${data.error}`);
      } else {
        setSendStatus("Email sent!");
        setTimeout(() => onSent(), 1000);
      }
    } catch {
      setSendStatus("Failed to send email");
    }
    setIsSending(false);
  }

  // Find the auto-selected template for the dropdown default
  const matchedTemplate = task.email_template_key
    ? templates.find(
        (t) => t.trigger === task.email_template_key && t.is_active
      )
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 sticky top-0 bg-white rounded-t-xl z-10">
          <div>
            <h3 className="text-lg font-bold text-[#272727]">Send Email</h3>
            <p className="text-xs text-[#a59494] mt-0.5">{task.title}</p>
          </div>
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

        <div className="p-6 space-y-4">
          {/* From */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              From
            </label>
            {senders.length > 0 ? (
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} &lt;{s.from_email ?? s.email}&gt;
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#a59494] bg-[#f5f0f0]">
                No sending addresses configured.{" "}
                <span className="text-xs">
                  Go to Settings &rarr; Team Members to add a &quot;From
                  Email&quot;.
                </span>
              </div>
            )}
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              To
            </label>
            <div className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-[#f5f0f0]/50">
              {candidate.first_name} {candidate.last_name} &lt;
              {candidate.email}&gt;
            </div>
          </div>

          {/* CC */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              CC
            </label>
            <input
              type="email"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="cc@team.com"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>

          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Template
            </label>
            <select
              defaultValue={matchedTemplate?.id ?? ""}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              <option value="">Blank email (no template)</option>
              {templates
                .filter((t) => t.is_active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
            />
          </div>

          {sendStatus && (
            <p
              className={`text-sm ${
                sendStatus.startsWith("Error") ||
                sendStatus.startsWith("Failed")
                  ? "text-red-600"
                  : sendStatus.includes("sent")
                  ? "text-green-600"
                  : "text-[#a59494]"
              }`}
            >
              {sendStatus}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !subject.trim() || !body.trim()}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
