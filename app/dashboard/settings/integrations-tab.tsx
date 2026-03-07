"use client";

import { useState } from "react";
import type { TeamIntegrations } from "@/lib/types";

/* ── Integration definitions ─────────────────────────────────── */

interface IntegrationDef {
  key: keyof TeamIntegrations;
  label: string;
  icon: string;
  description: string;
  fields: { key: string; label: string; type: "text" | "password" | "url"; placeholder: string }[];
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "google_workspace",
    label: "Google Workspace",
    icon: "🔵",
    description: "Auto-create email accounts and groups for new hires",
    fields: [
      { key: "domain", label: "Domain", type: "text", placeholder: "yourcompany.com" },
      { key: "admin_email", label: "Admin Email", type: "text", placeholder: "admin@yourcompany.com" },
    ],
  },
  {
    key: "teachable",
    label: "Teachable",
    icon: "📚",
    description: "Enroll new hires in training courses automatically",
    fields: [
      { key: "school_url", label: "School URL", type: "url", placeholder: "https://yourschool.teachable.com" },
      { key: "api_key", label: "API Key", type: "password", placeholder: "Enter Teachable API key" },
    ],
  },
  {
    key: "slack",
    label: "Slack",
    icon: "💬",
    description: "Send notifications and invite new hires to Slack channels",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/..." },
      { key: "channel", label: "Default Channel", type: "text", placeholder: "#new-hires" },
    ],
  },
  {
    key: "follow_up_boss",
    label: "Follow Up Boss",
    icon: "📞",
    description: "Sync new agent contacts to Follow Up Boss CRM",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "Enter Follow Up Boss API key" },
    ],
  },
  {
    key: "docusign",
    label: "DocuSign",
    icon: "✍️",
    description: "Send contracts and agreements for e-signature",
    fields: [
      { key: "api_key", label: "Integration Key", type: "password", placeholder: "Enter DocuSign integration key" },
      { key: "account_id", label: "Account ID", type: "text", placeholder: "Enter DocuSign account ID" },
    ],
  },
  {
    key: "ghl",
    label: "GoHighLevel (GHL)",
    icon: "🚀",
    description: "Sync candidate stage changes and trigger GHL workflows",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "Enter GHL API key" },
      { key: "location_id", label: "Location ID", type: "text", placeholder: "Enter GHL location ID" },
    ],
  },
];

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  integrations: TeamIntegrations;
  teamId: string;
}

/* ── Helpers ───────────────────────────────────────────────────── */

function maskValue(val: string | undefined): string {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••" + val.slice(-4);
}

/* ── Main Component ────────────────────────────────────────────── */

export default function IntegrationsTab({ integrations: initial, teamId }: Props) {
  const [integrations, setIntegrations] = useState<TeamIntegrations>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ key: string; success: boolean; message: string } | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  function startEdit(intKey: string) {
    const current = integrations[intKey as keyof TeamIntegrations] as Record<string, string> | undefined;
    const def = INTEGRATIONS.find((i) => i.key === intKey);
    if (!def) return;
    const vals: Record<string, string> = {};
    for (const f of def.fields) {
      vals[f.key] = current?.[f.key] ?? "";
    }
    vals.enabled = String(current?.enabled ?? false);
    setEditValues(vals);
    setEditing(intKey);
    setTestResult(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);

    const updated = { ...integrations };
    const def = INTEGRATIONS.find((i) => i.key === editing);
    if (!def) return;

    const entry: Record<string, unknown> = { enabled: editValues.enabled === "true" };
    for (const f of def.fields) {
      entry[f.key] = editValues[f.key] || undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated as any)[editing] = entry;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_integrations",
          payload: { team_id: teamId, integrations: updated },
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIntegrations(updated);
      setEditing(null);
    } catch (err) {
      console.error("Failed to save integrations:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(intKey: string) {
    setTesting(intKey);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_integration",
          payload: { team_id: teamId, integration_key: intKey },
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setTestResult({
        key: intKey,
        success: !data.error,
        message: data.error || "Connection successful!",
      });
    } catch {
      setTestResult({ key: intKey, success: false, message: "Connection failed" });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#a59494] mb-4">
        Connect external services to automate onboarding tasks. Credentials are encrypted and stored securely.
      </p>

      {INTEGRATIONS.map((def) => {
        const config = integrations[def.key] as Record<string, unknown> | undefined;
        const isEnabled = config?.enabled === true;
        const isEditing = editing === def.key;
        const hasConfig = config && Object.keys(config).some((k) => k !== "enabled" && config[k]);

        return (
          <div
            key={def.key}
            className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm overflow-hidden"
          >
            {/* Header row */}
            <div className="flex items-center gap-3 p-4">
              <span className="text-xl">{def.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#272727]">{def.label}</h4>
                  {isEnabled && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                  {hasConfig && !isEnabled && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Configured
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#a59494] mt-0.5">{def.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasConfig && (
                  <button
                    onClick={() => handleTest(def.key)}
                    disabled={testing === def.key}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#a59494]/30 text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
                  >
                    {testing === def.key ? "Testing..." : "Test"}
                  </button>
                )}
                <button
                  onClick={() => isEditing ? setEditing(null) : startEdit(def.key)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:bg-brand-dark transition"
                >
                  {isEditing ? "Cancel" : "Configure"}
                </button>
              </div>
            </div>

            {/* Test result */}
            {testResult && testResult.key === def.key && (
              <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs font-medium ${
                testResult.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {testResult.success ? "✓" : "✗"} {testResult.message}
              </div>
            )}

            {/* Edit panel */}
            {isEditing && (
              <div className="border-t border-[#a59494]/10 px-4 py-4 bg-[#f5f0f0]/30">
                <div className="space-y-3">
                  {def.fields.map((field) => {
                    const fieldId = `${def.key}-${field.key}`;
                    const isPasswordField = field.type === "password";
                    const isVisible = visiblePasswords.has(fieldId);
                    return (
                    <div key={field.key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-[#272727]">
                        {field.label}
                      </label>
                      <div className="relative">
                        <input
                          type={isPasswordField && !isVisible ? "password" : field.type === "password" ? "text" : field.type}
                          value={editValues[field.key] ?? ""}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition pr-10"
                        />
                        {isPasswordField && (
                          <button
                            type="button"
                            onClick={() => setVisiblePasswords((prev) => {
                              const next = new Set(prev);
                              if (next.has(fieldId)) next.delete(fieldId);
                              else next.add(fieldId);
                              return next;
                            })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a59494] hover:text-[#272727] transition"
                            tabIndex={-1}
                          >
                            {isVisible ? (
                              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0012 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      {/* Show masked current value if exists and field is password */}
                      {field.type === "password" && Boolean(config?.[field.key]) && !editValues[field.key] && (
                        <p className="text-[10px] text-[#a59494]">
                          Current: {maskValue(String(config?.[field.key] ?? ""))}
                        </p>
                      )}
                    </div>
                    );
                  })}

                  {/* Enabled toggle */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={editValues.enabled === "true"}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, enabled: String(e.target.checked) }))
                      }
                      className="w-4 h-4 rounded border-[#a59494]/40 text-brand focus:ring-brand"
                    />
                    <span className="text-sm text-[#272727]">Enable this integration</span>
                  </label>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-xs font-medium text-[#a59494] hover:text-[#272727] transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current config summary (when not editing) */}
            {!isEditing && hasConfig && (
              <div className="border-t border-[#a59494]/10 px-4 py-2.5 bg-[#f5f0f0]/20">
                <div className="flex flex-wrap gap-3">
                  {def.fields.map((field) => {
                    const val = config?.[field.key] as string | undefined;
                    if (!val) return null;
                    return (
                      <span key={field.key} className="text-[10px] text-[#a59494]">
                        {field.label}: {field.type === "password" ? maskValue(val) : val}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
