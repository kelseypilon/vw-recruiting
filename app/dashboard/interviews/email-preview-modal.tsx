"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Interview } from "@/lib/types";

/* ── Types ──────────────────────────────────────────────────────── */

export interface EmailPreviewData {
  to: string;
  fromEmail: string;
  subject: string;
  body: string;
  teamId: string;
  candidateId: string;
  interviewType: string; // "1on1 Interview" | "Group Interview"
  scheduledAt: string | null;
  notes: string;
  cc?: string;
  interviewId?: string; // If set, skip interview creation (already exists)
}

interface Props {
  data: EmailPreviewData;
  onClose: () => void;
  onSent: (interview: Interview) => void;
}

/* ── Component ──────────────────────────────────────────────────── */

export default function EmailPreviewModal({ data, onClose, onSent }: Props) {
  const [editSubject, setEditSubject] = useState(data.subject);
  const [editBody, setEditBody] = useState(data.body);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setIsSending(true);
    setError("");

    const supabase = createClient();

    let interviewData: Record<string, unknown> | null = null;

    if (data.interviewId) {
      // Interview already exists — fetch it for the callback
      const { data: existing, error: fetchErr } = await supabase
        .from("interviews")
        .select("*, candidate:candidates(first_name, last_name, role_applied, stage)")
        .eq("id", data.interviewId)
        .single();
      if (fetchErr || !existing) {
        setError(fetchErr?.message ?? "Failed to find existing interview");
        setIsSending(false);
        return;
      }
      interviewData = existing;
    } else {
      // Create new interview record in DB
      const { data: created, error: dbError } = await supabase
        .from("interviews")
        .insert({
          team_id: data.teamId,
          candidate_id: data.candidateId,
          interview_type: data.interviewType,
          status: "scheduled",
          scheduled_at: data.scheduledAt,
          notes: data.notes,
        })
        .select(
          "*, candidate:candidates(first_name, last_name, role_applied, stage)"
        )
        .single();

      if (dbError || !created) {
        setError(dbError?.message ?? "Failed to create interview record");
        setIsSending(false);
        return;
      }
      interviewData = created;
    }

    // Send email via Resend API
    try {
      const payload: Record<string, unknown> = {
        to: data.to,
        subject: editSubject,
        body: editBody,
        from_email: data.fromEmail || undefined,
      };
      if (data.cc) payload.cc = data.cc;

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.error) {
        setError(`${data.interviewId ? "Email" : "Interview created but email"} failed: ${result.error}`);
        setIsSending(false);
        onSent(interviewData as unknown as Interview);
        return;
      }
    } catch {
      setError(`${data.interviewId ? "Email" : "Interview created but email"} failed to send`);
      setIsSending(false);
      onSent(interviewData as unknown as Interview);
      return;
    }

    // Success — close both modals
    onSent(interviewData as unknown as Interview);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="text-lg font-bold text-[#272727]">Preview Email</h3>
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
          {/* To (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-1">
              To
            </label>
            <div className="px-3 py-2 rounded-lg border border-[#a59494]/20 bg-[#f5f0f0] text-sm text-[#272727]">
              {data.to}
            </div>
          </div>

          {/* From (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-1">
              From
            </label>
            <div className="px-3 py-2 rounded-lg border border-[#a59494]/20 bg-[#f5f0f0] text-sm text-[#272727]">
              {data.fromEmail || "noreply@recruiting.app"}
            </div>
          </div>

          {/* Subject (editable) */}
          <div>
            <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-1">
              Subject
            </label>
            <input
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>

          {/* Body (editable) */}
          <div>
            <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-1">
              Message
            </label>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-y min-h-[200px]"
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !editSubject.trim() || !editBody.trim()}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
