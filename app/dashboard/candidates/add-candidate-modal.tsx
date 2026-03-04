"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CandidateCard } from "@/lib/types";

interface Props {
  teamId: string;
  onClose: () => void;
  onAdded: (candidate: CandidateCard) => void;
}

export default function AddCandidateModal({ teamId, onClose, onAdded }: Props) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role_applied: "",
    is_licensed: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("candidates")
      .insert({
        team_id: teamId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role_applied: formData.role_applied || null,
        is_licensed: formData.is_licensed,
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
    "w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <h3 className="text-lg font-bold text-[#272727] mb-4">
          Add Candidate
        </h3>

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

          {/* Role Applied */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#272727]">
              Role Applied
            </label>
            <input
              type="text"
              value={formData.role_applied}
              onChange={(e) => updateField("role_applied", e.target.value)}
              placeholder="Buyer Agent"
              className={inputClass}
            />
          </div>

          {/* Licensed checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_licensed}
              onChange={(e) => updateField("is_licensed", e.target.checked)}
              className="w-4 h-4 rounded border-[#a59494]/40 text-[#1c759e] focus:ring-[#1c759e]"
            />
            <span className="text-sm text-[#272727]">Licensed agent</span>
          </label>

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
              className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Add Candidate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
