"use client";

import { useState } from "react";
import type {
  Team,
  TeamUser,
  PipelineStage,
  EmailTemplate,
  ScoringCriterion,
} from "@/lib/types";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  DEFAULT_ROLES,
  resolveRolePermissions,
  type TeamRolePermissions,
  type PermissionKey,
} from "@/lib/permissions";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  team: Team | null;
  users: TeamUser[];
  stages: PipelineStage[];
  templates: EmailTemplate[];
  criteria: ScoringCriterion[];
  teamId: string;
}

/* ── Tabs ──────────────────────────────────────────────────────── */

const TABS = [
  { id: "team", label: "Team" },
  { id: "members", label: "Team Members" },
  { id: "roles", label: "Role Permissions" },
  { id: "stages", label: "Pipeline Stages" },
  { id: "templates", label: "Email Templates" },
  { id: "criteria", label: "Scoring Criteria" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ── Helper: call /api/settings ────────────────────────────────── */

async function saveSettings(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success?: boolean; data?: unknown; error?: string }> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

/* ── Main Component ────────────────────────────────────────────── */

export default function SettingsDashboard({
  team: initialTeam,
  users: initialUsers,
  stages: initialStages,
  templates: initialTemplates,
  criteria: initialCriteria,
  teamId,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const [team, setTeam] = useState(initialTeam);
  const [users, setUsers] = useState(initialUsers);
  const [stages, setStages] = useState(initialStages);
  const [templates, setTemplates] = useState(initialTemplates);
  const [criteria, setCriteria] = useState(initialCriteria);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#272727]">Settings</h2>
        <p className="text-sm text-[#a59494] mt-0.5">
          Manage your team, pipeline, and preferences
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-[#1c759e] text-white"
                : "text-[#272727] hover:bg-[#f5f0f0]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "team" && (
        <TeamTab team={team} onTeamUpdated={setTeam} />
      )}
      {activeTab === "members" && (
        <MembersTab users={users} onUsersUpdated={setUsers} teamId={teamId} />
      )}
      {activeTab === "roles" && (
        <RolesPermissionsTab team={team} onTeamUpdated={setTeam} teamId={teamId} />
      )}
      {activeTab === "stages" && (
        <StagesTab stages={stages} onStagesUpdated={setStages} />
      )}
      {activeTab === "templates" && (
        <TemplatesTab
          templates={templates}
          onTemplatesUpdated={setTemplates}
        />
      )}
      {activeTab === "criteria" && (
        <CriteriaTab criteria={criteria} onCriteriaUpdated={setCriteria} />
      )}
    </div>
  );
}

/* ── Team Tab ──────────────────────────────────────────────────── */

function TeamTab({
  team,
  onTeamUpdated,
}: {
  team: Team | null;
  onTeamUpdated: (team: Team) => void;
}) {
  const [teamName, setTeamName] = useState(team?.name ?? "");
  const [adminEmail, setAdminEmail] = useState(team?.admin_email ?? "");
  const [adminCc, setAdminCc] = useState(team?.admin_cc ?? true);
  const [zoomLink, setZoomLink] = useState(
    team?.group_interview_zoom_link ?? ""
  );
  const [interviewDate, setInterviewDate] = useState(
    team?.group_interview_date
      ? new Date(team.group_interview_date).toISOString().slice(0, 16)
      : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  async function handleSave() {
    if (!team) return;
    setIsSaving(true);
    setSaveStatus("");

    const result = await saveSettings("update_team", {
      id: team.id,
      name: teamName,
      admin_email: adminEmail || null,
      admin_cc: adminCc,
      group_interview_zoom_link: zoomLink || null,
      group_interview_date: interviewDate
        ? new Date(interviewDate).toISOString()
        : null,
    });

    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else if (result.data) {
      onTeamUpdated(result.data as Team);
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setIsSaving(false);
  }

  if (!team) return <p className="text-[#a59494]">No team found</p>;

  return (
    <div className="space-y-6">
      {/* General */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#272727] mb-4">General</h3>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Admin Email
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@team.com"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={adminCc}
              onChange={(e) => setAdminCc(e.target.checked)}
              className="w-4 h-4 rounded border-[#a59494]/40 text-[#1c759e] focus:ring-[#1c759e]"
            />
            <span className="text-sm text-[#272727]">
              CC admin on all candidate emails
            </span>
          </label>
        </div>
      </div>

      {/* Group Interview Settings */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#272727] mb-1">
          Group Interview Settings
        </h3>
        <p className="text-xs text-[#a59494] mb-4">
          Configure recurring group interview details for the team
        </p>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Zoom Link
            </label>
            <input
              type="url"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Next Group Interview Date
            </label>
            <input
              type="datetime-local"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3">
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
          className="px-6 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ── Members Tab ───────────────────────────────────────────────── */

const ROLE_OPTIONS = [
  "Team Lead",
  "Leader",
  "Admin",
  "Front Desk",
  "VP Ops",
  "owner",
  "member",
];

function MembersTab({
  users,
  onUsersUpdated,
  teamId,
}: {
  users: TeamUser[];
  onUsersUpdated: (users: TeamUser[]) => void;
  teamId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    customRole: "",
    from_email: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  function startEditing(user: TeamUser) {
    const isPreset = ROLE_OPTIONS.includes(user.role);
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      role: isPreset ? user.role : "__custom__",
      customRole: isPreset ? "" : user.role,
      from_email: user.from_email ?? "",
    });
  }

  const resolvedEditRole =
    editForm.role === "__custom__" && editForm.customRole.trim()
      ? editForm.customRole.trim()
      : editForm.role === "__custom__"
      ? "member"
      : editForm.role;

  async function handleSaveUser() {
    if (!editingId) return;
    setIsSaving(true);

    const result = await saveSettings("update_user", {
      id: editingId,
      name: editForm.name,
      role: resolvedEditRole,
      from_email: editForm.from_email || null,
    });

    if (!result.error) {
      onUsersUpdated(
        users.map((u) =>
          u.id === editingId
            ? {
                ...u,
                name: editForm.name,
                role: resolvedEditRole,
                from_email: editForm.from_email || null,
              }
            : u
        )
      );
      setEditingId(null);
    }
    setIsSaving(false);
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#272727]">Team Members</h3>
            <p className="text-xs text-[#a59494] mt-0.5">
              {users.length} member{users.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c759e] hover:bg-[#155f82] text-white text-xs font-semibold transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Member
          </button>
        </div>

        <div className="divide-y divide-[#a59494]/10">
          {users.map((user) => (
            <div key={user.id} className="px-6 py-4">
              {editingId === user.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#a59494] mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, name: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#a59494] mb-1">
                        Role / Title
                      </label>
                      <select
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            role: e.target.value,
                            customRole: e.target.value === "__custom__" ? p.customRole : "",
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition bg-white"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {editForm.role === "__custom__" && (
                        <input
                          type="text"
                          value={editForm.customRole}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, customRole: e.target.value }))
                          }
                          placeholder="Enter custom role"
                          className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#a59494] mb-1">
                        From Email (for sending)
                      </label>
                      <input
                        type="email"
                        value={editForm.from_email}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            from_email: e.target.value,
                          }))
                        }
                        placeholder="name@team.com"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveUser}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg bg-[#1c759e] hover:bg-[#155f82] text-white text-xs font-semibold transition disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1c759e] flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#272727]">
                        {user.name}
                      </p>
                      <p className="text-xs text-[#a59494]">{user.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1c759e]/10 text-[#1c759e]">
                          {user.role}
                        </span>
                        {user.from_email && (
                          <span className="text-[10px] text-[#a59494]">
                            Sends as: {user.from_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => startEditing(user)}
                    className="text-xs font-medium text-[#1c759e] hover:text-[#155f82] transition"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-[#a59494]">No team members found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          teamId={teamId}
          onClose={() => setShowAddModal(false)}
          onMemberAdded={(newUser) => {
            onUsersUpdated([...users, newUser]);
            setShowAddModal(false);
          }}
        />
      )}
    </>
  );
}

/* ── Add Member Modal ──────────────────────────────────────────── */

function AddMemberModal({
  teamId,
  onClose,
  onMemberAdded,
}: {
  teamId: string;
  onClose: () => void;
  onMemberAdded: (user: TeamUser) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Leader");
  const [customRole, setCustomRole] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const resolvedRole =
    role === "__custom__" && customRole.trim()
      ? customRole.trim()
      : role === "__custom__"
      ? "member"
      : role;

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
      return;
    }
    setIsSaving(true);
    setError("");

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_user",
        payload: {
          team_id: teamId,
          name: name.trim(),
          email: email.trim(),
          role: resolvedRole,
        },
      }),
    });
    const result = await res.json();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      onMemberAdded(result.data as TeamUser);
    }
    setIsSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-lg font-bold text-[#272727]">Add Team Member</h3>
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

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brooklyn Smith"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@team.com"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (e.target.value !== "__custom__") setCustomRole("");
              }}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition bg-white"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
            {role === "__custom__" && (
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Enter custom role title"
                className="w-full mt-2 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
              />
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || !email.trim()}
              className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Add Member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stages Tab (Display Only) ─────────────────────────────────── */

function StagesTab({
  stages,
}: {
  stages: PipelineStage[];
  onStagesUpdated: (stages: PipelineStage[]) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
      <div className="px-6 py-4 border-b border-[#a59494]/10">
        <h3 className="text-sm font-semibold text-[#272727]">
          Pipeline Stages
        </h3>
        <p className="text-xs text-[#a59494] mt-0.5">
          {stages.length} stages configured
        </p>
      </div>
      <div className="divide-y divide-[#a59494]/10">
        {stages.map((stage, i) => (
          <div key={stage.id} className="px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#a59494] w-6">{i + 1}</span>
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: stage.color ?? "#6B7280" }}
              />
              <span className="text-sm text-[#272727] flex-1">
                {stage.name}
              </span>
              {stage.ghl_tag && (
                <span className="text-[10px] text-[#a59494] font-mono">
                  {stage.ghl_tag}
                </span>
              )}
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  stage.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {stage.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Templates Tab ─────────────────────────────────────────────── */

function TemplatesTab({
  templates,
  onTemplatesUpdated,
}: {
  templates: EmailTemplate[];
  onTemplatesUpdated: (templates: EmailTemplate[]) => void;
}) {
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

    const result = await saveSettings("update_template", {
      id: selected.id,
      subject: editSubject,
      body: editBody,
    });

    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      setSaveStatus("Saved!");
      const updated = templates.map((t) =>
        t.id === selected.id
          ? { ...t, subject: editSubject, body: editBody }
          : t
      );
      onTemplatesUpdated(updated);
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setIsSaving(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm divide-y divide-[#a59494]/10">
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
            </button>
          ))}
          {templates.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[#a59494]">No templates found</p>
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-2">
        {selected ? (
          <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#272727]">
                {selected.name}
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selected.merge_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded bg-[#1c759e]/10 text-[#1c759e] font-mono"
                  >
                    {`{{${tag}}}`}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Subject
              </label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Body
              </label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
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
                className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
            <p className="text-[#a59494]">Select a template to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Role Permissions Tab ──────────────────────────────────────── */

function RolesPermissionsTab({
  team,
  onTeamUpdated,
  teamId,
}: {
  team: Team | null;
  onTeamUpdated: (team: Team) => void;
  teamId: string;
}) {
  const stored = (team?.settings as Record<string, unknown>)?.role_permissions as
    | Partial<TeamRolePermissions>
    | undefined;
  const [permissions, setPermissions] = useState<TeamRolePermissions>(
    resolveRolePermissions(stored)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  function togglePermission(role: string, key: PermissionKey) {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role]?.[key],
      },
    }));
  }

  function toggleAllForRole(role: string, value: boolean) {
    setPermissions((prev) => {
      const updated = { ...prev[role] };
      for (const key of PERMISSION_KEYS) {
        updated[key] = value;
      }
      return { ...prev, [role]: updated };
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("");

    const result = await saveSettings("update_role_permissions", {
      team_id: teamId,
      role_permissions: permissions,
    });

    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      setSaveStatus("Saved!");
      // Update team state so parent has latest settings
      if (team) {
        const currentSettings = (team.settings ?? {}) as Record<string, unknown>;
        onTeamUpdated({
          ...team,
          settings: { ...currentSettings, role_permissions: permissions },
        });
      }
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setIsSaving(false);
  }

  const roles = Object.keys(permissions);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-sm font-semibold text-[#272727]">
            Role Permissions
          </h3>
          <p className="text-xs text-[#a59494] mt-0.5">
            Configure what each role can access and do in the app
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#a59494]/10">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#272727] w-52">
                  Permission
                </th>
                {roles.map((role) => (
                  <th
                    key={role}
                    className="px-3 py-3 text-xs font-semibold text-[#272727] text-center min-w-[100px]"
                  >
                    <div>{role}</div>
                    <div className="flex justify-center gap-1 mt-1.5">
                      <button
                        onClick={() => toggleAllForRole(role, true)}
                        className="text-[10px] text-[#1c759e] hover:underline"
                        title="Enable all"
                      >
                        All
                      </button>
                      <span className="text-[10px] text-[#a59494]">|</span>
                      <button
                        onClick={() => toggleAllForRole(role, false)}
                        className="text-[10px] text-[#a59494] hover:underline"
                        title="Disable all"
                      >
                        None
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#a59494]/10">
              {PERMISSION_KEYS.map((key) => {
                const meta = PERMISSION_LABELS[key];
                return (
                  <tr key={key} className="hover:bg-[#f5f0f0]/50 transition">
                    <td className="px-6 py-3">
                      <div className="text-sm font-medium text-[#272727]">
                        {meta.label}
                      </div>
                      <div className="text-[10px] text-[#a59494] mt-0.5">
                        {meta.description}
                      </div>
                    </td>
                    {roles.map((role) => (
                      <td key={role} className="px-3 py-3 text-center">
                        <button
                          onClick={() => togglePermission(role, key)}
                          className={`w-8 h-5 rounded-full relative transition-colors duration-200 ${
                            permissions[role]?.[key]
                              ? "bg-[#1c759e]"
                              : "bg-[#a59494]/30"
                          }`}
                          title={`${permissions[role]?.[key] ? "Disable" : "Enable"} ${meta.label} for ${role}`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                              permissions[role]?.[key]
                                ? "left-3.5"
                                : "left-0.5"
                            }`}
                          />
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3">
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
          className="px-6 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Permissions"}
        </button>
      </div>
    </div>
  );
}

/* ── Criteria Tab (Editable) ───────────────────────────────────── */

function CriteriaTab({
  criteria,
  onCriteriaUpdated,
}: {
  criteria: ScoringCriterion[];
  onCriteriaUpdated: (criteria: ScoringCriterion[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState(0);
  const [editThreshold, setEditThreshold] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const CATEGORIES = [
    { name: "Mindset & Drive", range: [1, 5] },
    { name: "Communication & People Skills", range: [6, 9] },
    { name: "Business Acumen & Real Estate Knowledge", range: [10, 13] },
    { name: "Culture & Team Fit", range: [14, 16] },
    { name: "Execution & Structure", range: [17, 19] },
  ];

  function getCategoryForCriterion(orderIndex: number): string {
    for (const cat of CATEGORIES) {
      if (orderIndex >= cat.range[0] && orderIndex <= cat.range[1])
        return cat.name;
    }
    return "Other";
  }

  function startEditing(c: ScoringCriterion) {
    setEditingId(c.id);
    setEditWeight(c.weight_percent);
    setEditThreshold(c.min_threshold);
  }

  async function handleSave() {
    if (!editingId) return;
    setIsSaving(true);

    const result = await saveSettings("update_criterion", {
      id: editingId,
      weight_percent: editWeight,
      min_threshold: editThreshold,
    });

    if (!result.error) {
      onCriteriaUpdated(
        criteria.map((c) =>
          c.id === editingId
            ? { ...c, weight_percent: editWeight, min_threshold: editThreshold }
            : c
        )
      );
      setEditingId(null);
    }
    setIsSaving(false);
  }

  const grouped = criteria.reduce(
    (acc, c) => {
      const cat = getCategoryForCriterion(c.order_index);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(c);
      return acc;
    },
    {} as Record<string, ScoringCriterion[]>
  );

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => {
        const items = grouped[cat.name] ?? [];
        if (items.length === 0) return null;
        const totalWeight = items.reduce((s, c) => s + c.weight_percent, 0);

        return (
          <div
            key={cat.name}
            className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm"
          >
            <div className="px-6 py-3 border-b border-[#a59494]/10 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#272727]">
                {cat.name}
              </h4>
              <span className="text-xs text-[#a59494]">
                {totalWeight}% total weight
              </span>
            </div>
            <div className="divide-y divide-[#a59494]/10">
              {items.map((c) => (
                <div key={c.id} className="px-6 py-2.5">
                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#a59494] w-6">
                          {c.order_index}
                        </span>
                        <span className="text-sm text-[#272727] flex-1">
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 ml-9">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[#a59494]">Weight %</label>
                          <input
                            type="number"
                            value={editWeight}
                            onChange={(e) => setEditWeight(Number(e.target.value))}
                            min={0}
                            max={100}
                            step={0.5}
                            className="w-20 px-2 py-1 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[#a59494]">Min Threshold</label>
                          <input
                            type="number"
                            value={editThreshold ?? ""}
                            onChange={(e) =>
                              setEditThreshold(
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            min={0}
                            max={10}
                            step={0.5}
                            placeholder="None"
                            className="w-20 px-2 py-1 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
                          />
                        </div>
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-3 py-1 rounded-lg bg-[#1c759e] hover:bg-[#155f82] text-white text-xs font-semibold transition disabled:opacity-50"
                          >
                            {isSaving ? "..." : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#a59494] w-6">
                        {c.order_index}
                      </span>
                      <span className="text-sm text-[#272727] flex-1">
                        {c.name}
                      </span>
                      <span className="text-xs text-[#1c759e] font-medium">
                        {c.weight_percent}%
                      </span>
                      {c.min_threshold !== null && (
                        <span className="text-[10px] text-[#a59494]">
                          min: {c.min_threshold}
                        </span>
                      )}
                      <button
                        onClick={() => startEditing(c)}
                        className="text-xs font-medium text-[#1c759e] hover:text-[#155f82] transition"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
