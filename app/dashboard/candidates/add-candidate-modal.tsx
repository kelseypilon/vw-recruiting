"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CandidateCard } from "@/lib/types";

interface Props {
  teamId: string;
  onClose: () => void;
  onAdded: (candidate: CandidateCard) => void;
}

const ROLE_OPTIONS = ["Agent", "ISA", "Showing Partner", "Intern", "Admin", "Other"];
const LICENSED_OPTIONS = ["Yes", "No", "In Course"];

export default function AddCandidateModal({ teamId, onClose, onAdded }: Props) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role_applied: "",
    role_applied_other: "",
    licensed_status: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const roleValue =
      formData.role_applied === "Other" && formData.role_applied_other.trim()
        ? formData.role_applied_other.trim()
        : formData.role_applied || null;

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("candidates")
      .insert({
        team_id: teamId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role_applied: roleValue,
        is_licensed: formData.licensed_status === "Yes",
        licensed_status: formData.licensed_status || null,
        stage: "New Lead",
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    onAdded({ ...data, daysInStage: 1 });
    onClose();
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        {/* Header with X close */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#272727]">Add Candidate</h3>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#272727]">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
                placeholder="Sarah"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#272727]">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
                placeholder="Martinez"
                className={inputClass}
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#272727]">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="sarah@example.com"
              className={inputClass}
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#272727]">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="(480) 555-0101"
              className={inputClass}
            />
          </div>

          {/* Role Applied (dropdown) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#272727]">
              Role Applied
            </label>
            <select
              value={formData.role_applied}
              onChange={(e) => updateField("role_applied", e.target.value)}
              className={inputClass}
            >
              <option value="">Select a role...</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {formData.role_applied === "Other" && (
              <input
                type="text"
                value={formData.role_applied_other}
                onChange={(e) => updateField("role_applied_other", e.target.value)}
                placeholder="Specify role..."
                className={`${inputClass} mt-1`}
              />
            )}
          </div>

          {/* Licensed (dropdown) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#272727]">
              Licensed
            </label>
            <select
              value={formData.licensed_status}
              onChange={(e) => updateField("licensed_status", e.target.value)}
              className={inputClass}
            >
              <option value="">Select...</option>
              {LICENSED_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#a59494] hover:text-[#272727] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Add Candidate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
