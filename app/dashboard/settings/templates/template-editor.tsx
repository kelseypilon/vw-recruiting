"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { EmailTemplate } from "@/lib/types";

interface Props {
  templates: EmailTemplate[];
  teamId: string;
}

export default function TemplateEditor({
  templates: initialTemplates,
  teamId,
}: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selected, setSelected] = useState<EmailTemplate | null>(
    templates[0] ?? null
  );
  const [editSubject, setEditSubject] = useState(selected?.subject ?? "");
  const [editBody, setEditBody] = useState(selected?.body ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  function handleSelect(tmpl: EmailTemplate) {
    setSelected(tmpl);
    setEditSubject(tmpl.subject);
    setEditBody(tmpl.body);
    setSaveStatus("");
  }

  async function handleSave() {
    if (!selected) return;
    setIsSaving(true);
    setSaveStatus("");

    const supabase = createClient();
    const { error } = await supabase
      .from("email_templates")
      .update({ subject: editSubject, body: editBody })
      .eq("id", selected.id);

    if (error) {
      setSaveStatus(`Error: ${error.message}`);
    } else {
      setSaveStatus("Saved!");
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, subject: editSubject, body: editBody }
            : t
        )
      );
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setIsSaving(false);
  }

  async function handleToggleActive(tmpl: EmailTemplate) {
    const supabase = createClient();
    const newActive = !tmpl.is_active;
    const { error } = await supabase
      .from("email_templates")
      .update({ is_active: newActive })
      .eq("id", tmpl.id);

    if (!error) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === tmpl.id ? { ...t, is_active: newActive } : t
        )
      );
      if (selected?.id === tmpl.id) {
        setSelected((prev) => (prev ? { ...prev, is_active: newActive } : null));
      }
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/settings"
              className="text-sm text-[#a59494] hover:text-[#1c759e] transition"
            >
              Settings
            </Link>
            <span className="text-sm text-[#a59494]">/</span>
            <span className="text-sm text-[#272727] font-medium">
              Email Templates
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#272727]">Email Templates</h2>
          <p className="text-sm text-[#a59494] mt-0.5">
            {templates.length} templates configured
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template list */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
            <div className="p-4 border-b border-[#a59494]/10">
              <h3 className="text-sm font-semibold text-[#272727]">
                Templates
              </h3>
            </div>
            <div className="divide-y divide-[#a59494]/10">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelect(tmpl)}
                  className={`w-full text-left px-4 py-3 transition ${
                    selected?.id === tmpl.id
                      ? "bg-[#1c759e]/10"
                      : "hover:bg-[#f5f0f0]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          selected?.id === tmpl.id
                            ? "text-[#1c759e]"
                            : "text-[#272727]"
                        }`}
                      >
                        {tmpl.name}
                      </p>
                      <p className="text-xs text-[#a59494] truncate mt-0.5">
                        {tmpl.trigger ?? "Manual"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        tmpl.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {tmpl.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
              <div className="px-6 py-4 border-b border-[#a59494]/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#272727]">
                    {selected.name}
                  </h3>
                  <p className="text-xs text-[#a59494] mt-0.5">
                    Trigger: {selected.trigger ?? "Manual send"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleActive(selected)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                      selected.is_active
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-green-200 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {selected.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Merge tags */}
                <div>
                  <p className="text-xs font-medium text-[#a59494] mb-2">
                    Available Merge Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.merge_tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setEditBody((prev) => prev + `{{${tag}}}`);
                        }}
                        className="text-xs px-2 py-1 rounded bg-[#1c759e]/10 text-[#1c759e] hover:bg-[#1c759e]/20 transition font-mono"
                      >
                        {`{{${tag}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-[#272727] mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-[#272727] mb-1">
                    Email Body
                  </label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={14}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition resize-none"
                  />
                </div>

                {/* Save */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {saveStatus && (
                    <span
                      className={`text-sm ${
                        saveStatus.startsWith("Error")
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {saveStatus}
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
              <p className="text-[#a59494]">
                Select a template to edit
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
