"use client";

import { useState } from "react";
import { useTeam } from "@/lib/team-context";

interface Props {
  onClose: () => void;
}

export default function SendAssessmentModal({ onClose }: Props) {
  const { teamId } = useTeam();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ url: string; copied: boolean; candidateId: string } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      // Check if candidate already exists by email, or create new one
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

      const candidateId = data.candidate_id;
      const assessmentUrl = `${window.location.origin}/apply/${candidateId}/assessments?team=${teamId}`;
      setResult({ url: assessmentUrl, copied: false, candidateId });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.url).then(() => {
      setResult((r) => r ? { ...r, copied: true } : null);
      setTimeout(() => setResult((r) => (r ? { ...r, copied: false } : null)), 2000);
    });
  }

  async function handleSendEmail() {
    if (!result || !email.trim()) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: "Complete Your Assessment",
          body: `Hi ${firstName},<br><br>Please complete your assessment using the link below:<br><br><a href="${result.url}">${result.url}</a><br><br>Thank you!`,
          candidate_id: result.candidateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send email");
        return;
      }

      onClose();
    } catch {
      setError("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#272727]">Send Assessment</h2>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-[#a59494] -mt-2 mb-1">
              Enter the candidate&apos;s info. A new candidate record will be created if one doesn&apos;t exist.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#272727] mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
            >
              {sending ? "Creating..." : "Generate Assessment Link"}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#a59494]">
              Assessment link generated for <strong className="text-[#272727]">{firstName} {lastName}</strong>:
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="bg-[#f5f0f0] rounded-lg p-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={result.url}
                className="flex-1 bg-transparent text-xs text-[#272727] outline-none"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 px-3 py-1.5 rounded-md bg-white border border-[#a59494]/30 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                {result.copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send via Email"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-[#a59494]/30 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
