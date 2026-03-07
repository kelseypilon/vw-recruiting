"use client";

import { useState, useEffect, useCallback } from "react";

interface TeamRow {
  id: string;
  name: string;
  slug: string | null;
  branding_mode: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  brand_show_powered_by: boolean;
  admin_email: string | null;
  created_at: string;
  user_count: number;
}

export default function SuperAdminDashboard() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [runningNotifications, setRunningNotifications] = useState<string | null>(null);
  const [notificationResult, setNotificationResult] = useState("");

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin");
      const json = await res.json();
      if (json.data) setTeams(json.data);
    } catch {
      setError("Failed to fetch teams");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-[#272727] mb-6">Super Admin</h1>
        <div className="text-[#a59494]">Loading teams…</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#272727]">Super Admin</h1>
          <p className="text-[#a59494] text-sm mt-1">
            Manage teams and branding across the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition"
          >
            + Add Team
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {notificationResult && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center justify-between">
          <span>Notifications: {notificationResult}</span>
          <button onClick={() => setNotificationResult("")} className="text-green-500 hover:text-green-700 text-xs">Dismiss</button>
        </div>
      )}

      {/* Teams table */}
      <div className="bg-white rounded-xl border border-[#a59494]/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#a59494]/20 bg-[#f5f0f0]">
              <th className="text-left px-4 py-3 font-semibold text-[#272727]">Team</th>
              <th className="text-left px-4 py-3 font-semibold text-[#272727]">Slug</th>
              <th className="text-left px-4 py-3 font-semibold text-[#272727]">Mode</th>
              <th className="text-left px-4 py-3 font-semibold text-[#272727]">Color</th>
              <th className="text-left px-4 py-3 font-semibold text-[#272727]">Users</th>
              <th className="text-left px-4 py-3 font-semibold text-[#272727]">Created</th>
              <th className="text-right px-4 py-3 font-semibold text-[#272727]"></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr
                key={team.id}
                className="border-b border-[#a59494]/10 hover:bg-[#f5f0f0]/50 transition cursor-pointer"
                onClick={() => setEditTeam(team)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: team.brand_primary_color }}
                    >
                      {(team.brand_name || team.name || "?")
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </div>
                    <span className="font-medium text-[#272727]">
                      {team.brand_name || team.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#a59494]">{team.slug || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      team.branding_mode === "vantage"
                        ? "bg-blue-100 text-blue-700"
                        : team.branding_mode === "white_label"
                        ? "bg-gray-100 text-gray-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {team.branding_mode}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-[#a59494]/30"
                      style={{ backgroundColor: team.brand_primary_color }}
                    />
                    <span className="text-[#a59494] text-xs font-mono">
                      {team.brand_primary_color}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#272727]">{team.user_count}</td>
                <td className="px-4 py-3 text-[#a59494]">
                  {new Date(team.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setRunningNotifications(team.id);
                        setNotificationResult("");
                        try {
                          const res = await fetch("/api/notifications", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ team_id: team.id }),
                          });
                          const json = await res.json();
                          if (json.success) {
                            const summary = json.results
                              .map((r: { trigger: string; sent: number; skipped: number }) =>
                                `${r.trigger}: ${r.sent} sent, ${r.skipped} skipped`
                              )
                              .join("; ");
                            setNotificationResult(summary);
                          } else {
                            setNotificationResult(`Error: ${json.error}`);
                          }
                        } catch {
                          setNotificationResult("Failed to run");
                        }
                        setRunningNotifications(null);
                      }}
                      disabled={runningNotifications === team.id}
                      className="text-amber-600 hover:text-amber-700 text-xs font-medium transition disabled:opacity-50"
                    >
                      {runningNotifications === team.id ? "Running..." : "Run Notifications"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTeam(team);
                      }}
                      className="text-brand hover:text-brand-dark text-sm font-medium transition"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editTeam && (
        <EditBrandingModal
          team={editTeam}
          saving={saving}
          onSave={async (updates) => {
            setSaving(true);
            setError("");
            try {
              const res = await fetch("/api/super-admin", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ team_id: editTeam.id, ...updates }),
              });
              const json = await res.json();
              if (json.error) {
                setError(json.error);
              } else {
                setEditTeam(null);
                fetchTeams();
              }
            } catch {
              setError("Failed to save");
            }
            setSaving(false);
          }}
          onClose={() => setEditTeam(null)}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateTeamModal
          saving={saving}
          onCreate={async (payload) => {
            setSaving(true);
            setError("");
            try {
              const res = await fetch("/api/super-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await res.json();
              if (json.error) {
                setError(json.error);
              } else {
                setShowCreateModal(false);
                fetchTeams();
              }
            } catch {
              setError("Failed to create team");
            }
            setSaving(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

/* ── Edit Branding Modal ──────────────────────────────────────────── */

function EditBrandingModal({
  team,
  saving,
  onSave,
  onClose,
}: {
  team: TeamRow;
  saving: boolean;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState(team.branding_mode);
  const [brandName, setBrandName] = useState(team.brand_name || "");
  const [logoUrl, setLogoUrl] = useState(team.brand_logo_url || "");
  const [primary, setPrimary] = useState(team.brand_primary_color);
  const [secondary, setSecondary] = useState(team.brand_secondary_color);
  const [powered, setPowered] = useState(team.brand_show_powered_by);
  const [slug, setSlug] = useState(team.slug || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-bold text-[#272727] mb-4">
          Edit Branding — {team.name}
        </h2>

        <div className="space-y-4">
          {/* Branding Mode */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Branding Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="vantage">Vantage (Full VW Branding)</option>
              <option value="white_label">White Label (No VW Mention)</option>
              <option value="custom">Custom (Powered by VW)</option>
            </select>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Slug (URL identifier)
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-team"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Brand Name */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Brand Name
            </label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Team display name"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Logo URL
            </label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Colors */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-[#272727] mb-1">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="w-10 h-10 rounded border border-[#a59494]/30 cursor-pointer"
                />
                <input
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-[#272727] mb-1">
                Secondary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="w-10 h-10 rounded border border-[#a59494]/30 cursor-pointer"
                />
                <input
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          {/* Show Powered By */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={powered}
              onChange={(e) => setPowered(e.target.checked)}
              className="w-4 h-4 rounded border-[#a59494]/40 text-brand focus:ring-brand"
            />
            <span className="text-sm text-[#272727]">
              Show &quot;Powered by Vantage West&quot; footer
            </span>
          </label>
        </div>

        {/* Invite Section */}
        <div className="mt-6 pt-4 border-t border-[#a59494]/20">
          <h3 className="text-sm font-bold text-[#272727] mb-2">Invite Team Member</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="admin@team.com"
              className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <button
              disabled={inviting || !inviteEmail}
              onClick={async () => {
                setInviting(true);
                setInviteResult(null);
                try {
                  const res = await fetch("/api/invites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "create_invite",
                      team_id: team.id,
                      email: inviteEmail,
                      role: inviteRole,
                    }),
                  });
                  const json = await res.json();
                  if (json.success) {
                    setInviteResult({ success: true, message: `Invite sent! Setup URL: ${json.setup_url}` });
                    setInviteEmail("");
                  } else {
                    setInviteResult({ success: false, message: json.error });
                  }
                } catch {
                  setInviteResult({ success: false, message: "Failed to send invite" });
                }
                setInviting(false);
              }}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50 whitespace-nowrap"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </div>
          {inviteResult && (
            <p className={`mt-2 text-xs ${inviteResult.success ? "text-green-600" : "text-red-600"}`}>
              {inviteResult.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={() =>
              onSave({
                branding_mode: mode,
                brand_name: brandName || null,
                brand_logo_url: logoUrl || null,
                brand_primary_color: primary,
                brand_secondary_color: secondary,
                brand_show_powered_by: powered,
                slug: slug || null,
              })
            }
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create Team Modal ────────────────────────────────────────────── */

function CreateTeamModal({
  saving,
  onCreate,
  onClose,
}: {
  saving: boolean;
  onCreate: (payload: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [mode, setMode] = useState("custom");

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-[#272727] mb-4">Add New Team</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Team Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Realty"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {slug && (
              <p className="text-xs text-[#a59494] mt-1">
                Slug: <span className="font-mono">{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Admin Email
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@acmerealty.com"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">
              Branding Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="vantage">Vantage (Full VW Branding)</option>
              <option value="white_label">White Label (No VW Mention)</option>
              <option value="custom">Custom (Powered by VW)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
          >
            Cancel
          </button>
          <button
            disabled={saving || !name || !adminEmail}
            onClick={() =>
              onCreate({
                name,
                slug,
                admin_email: adminEmail,
                branding_mode: mode,
              })
            }
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
