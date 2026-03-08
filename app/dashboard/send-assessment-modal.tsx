"use client";

import { useState } from "react";
import { useTeam } from "@/lib/team-context";

type Step = "info" | "email" | "success";

interface Props {
  onClose: () => void;
}

export default function SendAssessmentModal({ onClose }: Props) {
  const { teamId } = useTeam();
  const [step, setStep] = useState<Step>("info");

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Step 2 fields (email editor)
  const [candidateId, setCandidateId] = useState("");
  const [assessmentUrl, setAssessmentUrl] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const inputClasses =
    "w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 transition";

  // Step 1: Find or create candidate → move to email editor
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/candidates/find-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          team_id: teamId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create candidate");
        return;
      }

      const cId = data.candidate_id;
      const url = `${window.location.origin}/apply/${cId}/assessments?team=${teamId}`;
      setCandidateId(cId);
      setAssessmentUrl(url);

      // Pre-fill email
      const name = firstName.trim() || "there";
      setEmailSubject(`Complete Your Assessment — Vantage West Realty`);
      setEmailBody(
        `Hi ${name},\n\nWe'd love to learn more about you! Please take a few minutes to complete our assessment:\n\nComplete Assessment → ${url}\n\nThe link above will take you through a short application form and two assessments. It should take about 15–20 minutes.\n\nLooking forward to connecting!\n\nVantage West Realty`
      );
      setStep("email");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  // Step 2: Send the email
  async function handleSendEmail() {
    setSending(true);
    setError("");

    try {
      // Build HTML body with embedded link
      const htmlBody = emailBody
        .replace(/\n/g, "<br>")
        .replace(
          `Complete Assessment → ${assessmentUrl}`,
          `<a href="${assessmentUrl}" style="display:inline-block;padding:10px 24px;background-color:#1c759e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;margin:8px 0;">Complete Assessment →</a>`
        );

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: emailSubject,
          body: htmlBody,
          candidate_id: candidateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send email");
        return;
      }

      setStep("success");
    } catch {
      setError("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(assessmentUrl);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#272727]">Send Assessment</h2>
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
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ─── Step 1: Candidate Info ─────────────────────── */}
        {step === "info" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-[#a59494] -mt-2 mb-1">
              Enter the candidate&apos;s info. A new candidate record will be
              created if one doesn&apos;t exist.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
            >
              {sending ? "Creating..." : "Next — Compose Email"}
            </button>
          </form>
        )}

        {/* ─── Step 2: Email Editor ───────────────────────── */}
        {step === "email" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#a59494] -mt-2 mb-1">
              Review the email below, then send it to{" "}
              <strong className="text-[#272727]">
                {firstName} {lastName}
              </strong>
              .
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* To (read-only) */}
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                To
              </label>
              <input
                type="text"
                readOnly
                value={email}
                className={`${inputClasses} bg-gray-50 text-[#a59494]`}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Subject
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Body
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
                className={`${inputClasses} resize-y`}
              />
            </div>

            {/* Fallback URL */}
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#a59494] truncate flex-1">
                Or copy this link:{" "}
                <span className="text-[#272727] break-all">{assessmentUrl}</span>
              </p>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="shrink-0 px-2.5 py-1 rounded-md border border-[#a59494]/30 text-xs font-medium text-[#272727] hover:bg-gray-50 transition"
              >
                Copy
              </button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#a59494]/10">
              <button
                onClick={() => {
                  setStep("info");
                  setError("");
                }}
                className="text-sm text-[#a59494] hover:text-[#272727] transition"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending || !emailSubject.trim()}
                className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Success ────────────────────────────── */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <span className="text-green-500 text-2xl">&#10003;</span>
            </div>
            <p className="text-sm font-medium text-[#272727] text-center">
              Assessment sent to{" "}
              <strong>{email}</strong>
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
