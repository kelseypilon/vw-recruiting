"use client";

import { useState, useEffect } from "react";
import { useTeam } from "@/lib/team-context";

type LinkType = "personal" | "general";

interface Props {
  onClose: () => void;
}

export default function SendAssessmentModal({ onClose }: Props) {
  const { teamId, branding } = useTeam();
  const [linkType, setLinkType] = useState<LinkType>("personal");

  // Team slug (fetched on mount for general link)
  const [teamSlug, setTeamSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/teams/by-id?id=${teamId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.slug) setTeamSlug(d.slug);
      })
      .catch(() => {});
  }, [teamId]);

  // ─── Tab 1: Application Link (copy-only) ─────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // ─── Tab 2: General Application Link (email compose) ──
  const [emailStep, setEmailStep] = useState<"compose" | "success">("compose");
  const [emailTo, setEmailTo] = useState("");
  const [emailFirstName, setEmailFirstName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Pre-fill general email when slug loads
  useEffect(() => {
    if (teamSlug) {
      const url = `${window.location.origin}/apply/${teamSlug}`;
      setEmailSubject(`Apply Now — ${branding.name}`);
      setEmailBody(
        `Hi there,\n\nWe'd love to learn more about you! Please take a few minutes to complete our application:\n\nApply Now → ${url}\n\nThe link above will take you through a short application form and two assessments. It should take about 15–20 minutes.\n\nLooking forward to connecting!\n\n${branding.name}`
      );
    }
  }, [teamSlug, branding.name]);

  const inputClasses =
    "w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 transition";

  // Tab 1: Generate personal assessment link
  async function handleGenerateLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGenerating(true);
    setCopied(false);

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
      setGeneratedUrl(url);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Tab 2: Send email with general link
  async function handleSendEmail() {
    setSending(true);
    setEmailError("");

    try {
      const generalUrl = `${window.location.origin}/apply/${teamSlug}`;
      const ctaPattern = `Apply Now → ${generalUrl}`;
      const htmlBody = emailBody
        .replace(/\n/g, "<br>")
        .replace(
          ctaPattern,
          `<a href="${generalUrl}" style="display:inline-block;padding:10px 24px;background-color:${branding.primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;margin:8px 0;">Apply Now →</a>`
        );

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject,
          body: htmlBody,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEmailError(data.error || "Failed to send email");
        return;
      }

      setEmailStep("success");
    } catch {
      setEmailError("Failed to send email");
    } finally {
      setSending(false);
    }
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

        {/* Tab toggle */}
        {teamSlug && (
          <div className="flex gap-2 p-1 bg-[#a59494]/10 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => setLinkType("personal")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                linkType === "personal"
                  ? "bg-white text-[#272727] shadow-sm"
                  : "text-[#a59494] hover:text-[#272727]"
              }`}
            >
              Application Link
            </button>
            <button
              type="button"
              onClick={() => setLinkType("general")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                linkType === "general"
                  ? "bg-white text-[#272727] shadow-sm"
                  : "text-[#a59494] hover:text-[#272727]"
              }`}
            >
              General Application Link
            </button>
          </div>
        )}

        {/* ─── Tab 1: Application Link (copy-only) ──────────── */}
        {linkType === "personal" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#a59494] -mt-2 mb-1">
              Enter the candidate&apos;s info to generate a personal assessment link.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {!generatedUrl ? (
              <form onSubmit={handleGenerateLink} className="flex flex-col gap-4">
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
                  disabled={generating}
                  className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate Link"}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="bg-[#f5f0f0] rounded-lg p-4">
                  <p className="text-xs font-semibold text-[#a59494] uppercase tracking-wide mb-2">
                    Assessment Link for {firstName} {lastName}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedUrl}
                      className={`${inputClasses} bg-white text-[#272727] text-xs flex-1`}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(generatedUrl)}
                      className="shrink-0 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white font-semibold text-sm transition"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedUrl("");
                    setFirstName("");
                    setLastName("");
                    setEmail("");
                    setCopied(false);
                  }}
                  className="text-sm text-[#a59494] hover:text-[#272727] transition self-start"
                >
                  &larr; Generate another link
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab 2: General Application Link (email compose) ── */}
        {linkType === "general" && (
          <div className="flex flex-col gap-4">
            {emailStep === "compose" && (
              <>
                <p className="text-sm text-[#a59494] -mt-2 mb-1">
                  Send the team&apos;s public application link via email.
                </p>

                {emailError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {emailError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#272727] mb-1">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={emailFirstName}
                      onChange={(e) => setEmailFirstName(e.target.value)}
                      placeholder="Optional"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#272727] mb-1">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      required
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className={inputClasses}
                    />
                  </div>
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-[#272727] mb-1">
                    Body
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={8}
                    className={`${inputClasses} resize-y`}
                  />
                </div>

                <button
                  onClick={handleSendEmail}
                  disabled={sending || !emailTo.trim() || !emailSubject.trim()}
                  className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Email"}
                </button>
              </>
            )}

            {emailStep === "success" && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <span className="text-green-500 text-2xl">&#10003;</span>
                </div>
                <p className="text-sm font-medium text-[#272727] text-center">
                  Assessment sent to <strong>{emailTo}</strong>
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
        )}
      </div>
    </div>
  );
}
