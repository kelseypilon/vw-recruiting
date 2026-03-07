"use client";

import { useState, useEffect } from "react";
import type {
  Team,
  TeamUser,
  PipelineStage,
  EmailTemplate,
  ScoringCriterion,
  InterviewQuestion,
  OnboardingTask,
  GroupInterviewPrompt,
  TeamIntegrations,
} from "@/lib/types";
import InterviewQuestionsTab from "./interview-questions-tab";
import OnboardingTasksTab from "./onboarding-tasks-tab";
import GroupInterviewPromptsTab from "./group-interview-prompts-tab";
import PipelineStagesTab from "./pipeline-stages-tab";
import IntegrationsTab from "./integrations-tab";
import { usePermissions } from "@/lib/user-permissions-context";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  DEFAULT_ROLES,
  resolveRolePermissions,
  resolveRolePermissionsWithCustom,
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
  interviewQuestions: InterviewQuestion[];
  onboardingTasks: OnboardingTask[];
  groupInterviewPrompts: GroupInterviewPrompt[];
  teamId: string;
  currentUserId: string;
}

/* ── Tabs ──────────────────────────────────────────────────────── */

const TABS: { id: string; label: string; permission?: PermissionKey }[] = [
  { id: "team", label: "Team" },
  { id: "members", label: "Team Members", permission: "manage_members" },
  { id: "roles", label: "Role Permissions", permission: "manage_members" },
  { id: "stages", label: "Pipeline Stages", permission: "manage_settings" },
  { id: "templates", label: "Email Templates", permission: "manage_templates" },
  { id: "criteria", label: "Scoring Criteria", permission: "manage_settings" },
  { id: "questions", label: "Interview Questions" },
  { id: "onboarding-tasks", label: "Onboarding Tasks", permission: "manage_onboarding" },
  { id: "group-prompts", label: "Group Interview Prompts", permission: "manage_interviews" },
  { id: "integrations", label: "Integrations", permission: "manage_settings" },
];

type TabId = string;

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
  interviewQuestions: initialQuestions,
  onboardingTasks: initialOnboardingTasks,
  groupInterviewPrompts: initialGroupPrompts,
  teamId,
  currentUserId,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const [team, setTeam] = useState(initialTeam);
  const [users, setUsers] = useState(initialUsers);
  const [stages, setStages] = useState(initialStages);
  const [templates, setTemplates] = useState(initialTemplates);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [questions, setQuestions] = useState(initialQuestions);
  const [onboardingTasks, setOnboardingTasks] = useState(initialOnboardingTasks);
  const [groupPrompts] = useState(initialGroupPrompts);
  const { can, userRole } = usePermissions();

  // Settings tab visibility from team settings
  const teamSettings = (initialTeam?.settings ?? {}) as Record<string, unknown>;
  const settingsVisibility = (teamSettings.settings_visibility ?? {}) as Record<string, Record<string, boolean>>;

  // Filter tabs by permission AND settings tab visibility
  const visibleTabs = TABS.filter((tab) => {
    // Permission check first
    if (tab.permission && !can(tab.permission)) return false;
    // Team Lead always sees all tabs
    if (userRole === "Team Lead") return true;
    // If visibility is configured for this role, check it
    const roleVisibility = settingsVisibility[userRole];
    if (roleVisibility && tab.id in roleVisibility) {
      return roleVisibility[tab.id];
    }
    // Default: show if user has the required permission (already checked above)
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#272727]">Settings</h2>
        <p className="text-sm text-[#a59494] mt-0.5">
          Manage your team, pipeline, and preferences
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-1 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-brand text-white"
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
        <MembersTab users={users.filter(u => u.is_active !== false)} onUsersUpdated={setUsers} teamId={teamId} team={team} />
      )}
      {activeTab === "roles" && (
        <RolesPermissionsTab team={team} onTeamUpdated={setTeam} teamId={teamId} users={users} currentUserId={currentUserId} />
      )}
      {activeTab === "stages" && (
        <PipelineStagesTab stages={stages} onStagesUpdated={setStages} teamId={teamId} />
      )}
      {activeTab === "templates" && (
        <TemplatesTab
          templates={templates}
          onTemplatesUpdated={setTemplates}
          teamId={teamId}
        />
      )}
      {activeTab === "criteria" && (
        <CriteriaTab criteria={criteria} onCriteriaUpdated={setCriteria} />
      )}
      {activeTab === "questions" && (
        <InterviewQuestionsTab
          questions={questions}
          onQuestionsUpdated={setQuestions}
          teamId={teamId}
          currentUserId={currentUserId}
          users={users}
        />
      )}
      {activeTab === "onboarding-tasks" && (
        <OnboardingTasksTab
          tasks={onboardingTasks}
          onTasksUpdated={setOnboardingTasks}
          users={users}
          teamId={teamId}
        />
      )}
      {activeTab === "group-prompts" && (
        <>
          <GroupInterviewGuidelinesSection
            team={team}
            onTeamUpdated={setTeam}
            teamId={teamId}
          />
          <GroupInterviewPromptsTab
            prompts={groupPrompts}
            teamId={teamId}
          />
        </>
      )}
      {activeTab === "integrations" && (
        <IntegrationsTab
          integrations={(team?.integrations ?? {}) as TeamIntegrations}
          teamId={teamId}
        />
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [thresholdStuckDays, setThresholdStuckDays] = useState(team?.threshold_stuck_days ?? 7);
  const [thresholdScorecardHours, setThresholdScorecardHours] = useState(team?.threshold_scorecard_hours ?? 24);
  const [thresholdEscalationHours, setThresholdEscalationHours] = useState(team?.threshold_escalation_hours ?? 48);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [thresholdStatus, setThresholdStatus] = useState("");

  async function handleSave() {
    if (!team) return;
    setIsSaving(true);
    setSaveStatus("");

    const result = await saveSettings("update_team", {
      id: team.id,
      name: teamName,
      admin_email: adminEmail || null,
      admin_cc: adminCc,
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

  async function handleSaveThresholds() {
    if (!team) return;
    setIsSavingThresholds(true);
    setThresholdStatus("");

    const result = await saveSettings("update_thresholds", {
      team_id: team.id,
      threshold_stuck_days: thresholdStuckDays,
      threshold_scorecard_hours: thresholdScorecardHours,
      threshold_escalation_hours: thresholdEscalationHours,
    });

    if (result.error) {
      setThresholdStatus(`Error: ${result.error}`);
    } else {
      onTeamUpdated({
        ...team,
        threshold_stuck_days: thresholdStuckDays,
        threshold_scorecard_hours: thresholdScorecardHours,
        threshold_escalation_hours: thresholdEscalationHours,
      });
      setThresholdStatus("Saved!");
      setTimeout(() => setThresholdStatus(""), 2000);
    }
    setIsSavingThresholds(false);
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
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
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
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={adminCc}
              onChange={(e) => setAdminCc(e.target.checked)}
              className="w-4 h-4 rounded border-[#a59494]/40 text-brand focus:ring-brand"
            />
            <span className="text-sm text-[#272727]">
              CC admin on all candidate emails
            </span>
          </label>
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
          className="px-6 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Notification Thresholds */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#272727] mb-1">Notification Thresholds</h3>
        <p className="text-xs text-[#a59494] mb-4">
          Configure when the system sends reminder notifications and escalation alerts.
        </p>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Flag candidate as stuck after
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={thresholdStuckDays}
                onChange={(e) => setThresholdStuckDays(Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
              <span className="text-sm text-[#a59494]">days in a stage</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Send scorecard reminder after
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={168}
                value={thresholdScorecardHours}
                onChange={(e) => setThresholdScorecardHours(Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
              <span className="text-sm text-[#a59494]">hours after interview</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Escalate to escalation contact after
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={336}
                value={thresholdEscalationHours}
                onChange={(e) => setThresholdEscalationHours(Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
              <span className="text-sm text-[#a59494]">hours with no action</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          {thresholdStatus && (
            <span className={`text-sm ${thresholdStatus.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {thresholdStatus}
            </span>
          )}
          <button
            onClick={handleSaveThresholds}
            disabled={isSavingThresholds}
            className="px-6 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {isSavingThresholds ? "Saving..." : "Save Thresholds"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Members Tab ───────────────────────────────────────────────── */

function getRoleOptions(team: Team | null): string[] {
  const customRoles =
    ((team?.settings as Record<string, unknown>)?.custom_roles as string[]) ??
    [];
  return [...DEFAULT_ROLES, ...customRoles];
}

function MembersTab({
  users,
  onUsersUpdated,
  teamId,
  team,
}: {
  users: TeamUser[];
  onUsersUpdated: (users: TeamUser[]) => void;
  team: Team | null;
  teamId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    title: "",
    role: "",
    customRole: "",
    from_email: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null);
  const [removeMember, setRemoveMember] = useState<TeamUser | null>(null);
  const [togglingEscalation, setTogglingEscalation] = useState(false);

  const escalationContact = users.find((u) => u.is_escalation_contact);

  async function handleToggleEscalation(userId: string) {
    setTogglingEscalation(true);
    const isCurrently = users.find((u) => u.id === userId)?.is_escalation_contact;
    if (isCurrently) {
      await saveSettings("clear_escalation_contact", { team_id: teamId });
      onUsersUpdated(users.map((u) => ({ ...u, is_escalation_contact: false })));
    } else {
      await saveSettings("set_escalation_contact", { user_id: userId, team_id: teamId });
      onUsersUpdated(
        users.map((u) => ({ ...u, is_escalation_contact: u.id === userId }))
      );
    }
    setTogglingEscalation(false);
  }

  function startEditing(user: TeamUser) {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      title: user.title ?? "",
      role: user.role,
      customRole: "",
      from_email: user.from_email ?? "",
    });
  }

  const resolvedEditRole = editForm.role;

  async function handleSaveUser() {
    if (!editingId) return;
    setIsSaving(true);

    // Save role + name + from_email
    const result = await saveSettings("update_user", {
      id: editingId,
      name: editForm.name,
      role: resolvedEditRole,
      from_email: editForm.from_email || null,
    });

    // Save title separately (different column)
    await saveSettings("update_member_title", {
      id: editingId,
      title: editForm.title || null,
    });

    if (!result.error) {
      onUsersUpdated(
        users.map((u) =>
          u.id === editingId
            ? {
                ...u,
                name: editForm.name,
                title: editForm.title || null,
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
      {/* Warning: no escalation contact */}
      {!escalationContact && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-amber-600 text-lg">⚠️</span>
          <p className="text-sm text-amber-800">
            No escalation contact set. Notifications that require escalation won&apos;t have a recipient.
            Designate one team member below.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#272727]">Team Members</h3>
            <p className="text-xs text-[#a59494] mt-0.5">
              {users.length} member{users.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowInviteInput(!showInviteInput); setInviteResult(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand text-brand hover:bg-brand/5 text-xs font-semibold transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Invite
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Member
            </button>
          </div>
        </div>

        {/* Invite Input Row */}
        {showInviteInput && (
          <div className="px-6 py-3 border-b border-[#a59494]/10 bg-brand/5">
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@team.com"
                className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                disabled={inviting || !inviteEmail.includes("@")}
                onClick={async () => {
                  setInviting(true);
                  setInviteResult(null);
                  try {
                    const res = await fetch("/api/invites", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "create_invite",
                        team_id: teamId,
                        email: inviteEmail,
                        role: inviteRole,
                      }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      setInviteResult({ success: true, message: "Invite sent!" });
                      setInviteEmail("");
                    } else {
                      setInviteResult({ success: false, message: json.error });
                    }
                  } catch {
                    setInviteResult({ success: false, message: "Failed to send invite" });
                  }
                  setInviting(false);
                }}
                className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-50 whitespace-nowrap"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
            {inviteResult && (
              <p className={`mt-1.5 text-xs ${inviteResult.success ? "text-green-600" : "text-red-600"}`}>
                {inviteResult.message}
              </p>
            )}
          </div>
        )}

        <div className="divide-y divide-[#a59494]/10">
          {users.map((user) => (
            <div key={user.id} className="px-6 py-4">
              {editingId === user.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
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
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#a59494] mb-1">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, title: e.target.value }))
                        }
                        placeholder="e.g. Recruiter"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#a59494] mb-1">
                        Permission Role
                      </label>
                      <select
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            role: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                      >
                        {getRoleOptions(team).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
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
                        className="w-full px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        const user = users.find((u) => u.id === editingId);
                        if (user) setRemoveMember(user);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                    >
                      Remove Member
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveUser}
                        disabled={isSaving}
                        className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center shrink-0">
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
                        {user.is_escalation_contact && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                            ⚡ Escalation Contact
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#a59494]">{user.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                          {user.role}
                        </span>
                        {user.title && (
                          <span className="text-[10px] text-[#a59494]">
                            {user.title}
                          </span>
                        )}
                        {user.from_email && (
                          <span className="text-[10px] text-[#a59494]">
                            Sends as: {user.from_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleEscalation(user.id)}
                      disabled={togglingEscalation}
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition ${
                        user.is_escalation_contact
                          ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                          : "bg-[#f5f0f0] text-[#a59494] hover:bg-[#a59494]/20 hover:text-[#272727]"
                      }`}
                      title={user.is_escalation_contact ? "Remove as escalation contact" : "Set as escalation contact"}
                    >
                      ⚡ {user.is_escalation_contact ? "Escalation On" : "Set Escalation"}
                    </button>
                    <button
                      onClick={() => startEditing(user)}
                      className="text-xs font-medium text-brand hover:text-brand-dark transition"
                    >
                      Edit
                    </button>
                  </div>
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
          team={team}
          onClose={() => setShowAddModal(false)}
          onMemberAdded={(newUser) => {
            onUsersUpdated([...users, newUser]);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Remove Member Modal */}
      {removeMember && (
        <RemoveMemberModal
          member={removeMember}
          users={users.filter((u) => u.id !== removeMember.id && u.is_active)}
          teamId={teamId}
          onClose={() => setRemoveMember(null)}
          onRemoved={() => {
            onUsersUpdated(users.filter((u) => u.id !== removeMember.id));
            setEditingId(null);
            setRemoveMember(null);
          }}
        />
      )}
    </>
  );
}

/* ── Remove Member Modal ───────────────────────────────────────── */

function RemoveMemberModal({
  member,
  users,
  teamId,
  onClose,
  onRemoved,
}: {
  member: TeamUser;
  users: TeamUser[];
  teamId: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [assignments, setAssignments] = useState<{
    interviews: number;
    onboarding: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reassignInterviewsTo, setReassignInterviewsTo] = useState("");
  const [reassignOnboardingTo, setReassignOnboardingTo] = useState("");

  // Fetch assignment counts on mount
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_user_assignments",
          payload: { id: member.id, team_id: teamId },
        }),
      });
      const data = await res.json();
      setAssignments({
        interviews: data.interviews ?? 0,
        onboarding: data.onboarding ?? 0,
      });
      setLoading(false);
    })();
  }, [member.id, teamId]);

  const hasAssignments =
    assignments && (assignments.interviews > 0 || assignments.onboarding > 0);

  async function handleRemove() {
    setSaving(true);
    const payload: Record<string, unknown> = { id: member.id };
    if (reassignInterviewsTo) payload.reassign_interviews_to = reassignInterviewsTo;
    if (reassignOnboardingTo) payload.reassign_onboarding_to = reassignOnboardingTo;

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate_user", payload }),
    });
    const result = await res.json();
    if (!result.error) {
      onRemoved();
    }
    setSaving(false);
  }

  const canRemove =
    !loading &&
    (!hasAssignments ||
      ((assignments!.interviews === 0 || reassignInterviewsTo) &&
        (assignments!.onboarding === 0 || reassignOnboardingTo)));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-lg font-bold text-[#272727]">
            Remove {member.name}?
          </h3>
          <button onClick={onClose} className="text-[#a59494] hover:text-[#272727] transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-[#a59494]">Checking assignments...</p>
          ) : hasAssignments ? (
            <>
              <p className="text-sm text-[#272727]">
                This member has active assignments that need to be reassigned:
              </p>
              {assignments!.interviews > 0 && (
                <div>
                  <p className="text-sm text-[#272727] mb-1">
                    <span className="font-medium">{assignments!.interviews}</span> interview{assignments!.interviews !== 1 ? "s" : ""} assigned
                  </p>
                  <select
                    value={reassignInterviewsTo}
                    onChange={(e) => setReassignInterviewsTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                  >
                    <option value="">Reassign interviews to...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {assignments!.onboarding > 0 && (
                <div>
                  <p className="text-sm text-[#272727] mb-1">
                    <span className="font-medium">{assignments!.onboarding}</span> onboarding task{assignments!.onboarding !== 1 ? "s" : ""} assigned
                  </p>
                  <select
                    value={reassignOnboardingTo}
                    onChange={(e) => setReassignOnboardingTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
                  >
                    <option value="">Reassign onboarding to...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[#a59494]">
              No active assignments. This member can be safely removed.
            </p>
          )}

          <p className="text-xs text-[#a59494]">
            Historical records will be preserved as &ldquo;{member.name} (former member)&rdquo;.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRemove}
              disabled={saving || !canRemove}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? "Removing..." : "Remove Member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Add Member Modal ──────────────────────────────────────────── */

function AddMemberModal({
  teamId,
  team,
  onClose,
  onMemberAdded,
}: {
  teamId: string;
  team: Team | null;
  onClose: () => void;
  onMemberAdded: (user: TeamUser) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Leader");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const resolvedRole = role;

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
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
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
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              {getRoleOptions(team).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Add Member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stages Tab → now imported from pipeline-stages-tab.tsx ────── */

/* ── Templates Tab ─────────────────────────────────────────────── */

const SYSTEM_TRIGGERS = new Set(["interview_invite", "not_a_fit", "assessment_invite", "welcome"]);

function TemplatesTab({
  templates,
  onTemplatesUpdated,
  teamId,
}: {
  templates: EmailTemplate[];
  onTemplatesUpdated: (templates: EmailTemplate[]) => void;
  teamId: string;
}) {
  const [selected, setSelected] = useState<EmailTemplate | null>(
    templates[0] ?? null
  );
  const [editSubject, setEditSubject] = useState(selected?.subject ?? "");
  const [editBody, setEditBody] = useState(selected?.body ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  async function handleDelete() {
    if (!selected) return;
    setIsSaving(true);
    const result = await saveSettings("delete_template", { id: selected.id });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      const updated = templates.filter((t) => t.id !== selected.id);
      onTemplatesUpdated(updated);
      setSelected(updated[0] ?? null);
      if (updated[0]) {
        setEditSubject(updated[0].subject);
        setEditBody(updated[0].body);
      }
    }
    setShowDeleteConfirm(false);
    setIsSaving(false);
  }

  async function handleAddTemplate(name: string, subject: string, body: string) {
    const result = await saveSettings("create_template", {
      team_id: teamId,
      name,
      subject,
      body,
    });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      const newTmpl = (result as { data: EmailTemplate }).data;
      const updated = [...templates, newTmpl];
      onTemplatesUpdated(updated);
      handleSelect(newTmpl);
    }
    setShowAddModal(false);
  }

  const isSystemTemplate = selected?.trigger ? SYSTEM_TRIGGERS.has(selected.trigger) : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="divide-y divide-[#a59494]/10">
            {templates.map((tmpl) => {
              const isSystem = tmpl.trigger ? SYSTEM_TRIGGERS.has(tmpl.trigger) : false;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelect(tmpl)}
                  className={`w-full text-left px-4 py-3 transition ${
                    selected?.id === tmpl.id
                      ? "bg-brand/10"
                      : "hover:bg-[#f5f0f0]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-medium truncate flex-1 ${
                        selected?.id === tmpl.id
                          ? "text-brand"
                          : "text-[#272727]"
                      }`}
                    >
                      {tmpl.name}
                    </p>
                    {isSystem && (
                      <span title="System template">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#a59494] shrink-0">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#a59494] truncate mt-0.5">
                    {tmpl.subject}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-[#a59494]/10">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#a59494]/40 text-xs font-medium text-[#a59494] hover:text-brand hover:border-brand/40 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Template
            </button>
          </div>
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
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#272727]">
                  {selected.name}
                </h3>
                {isSystemTemplate && (
                  <p className="text-xs text-[#a59494] mt-0.5 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    System template — cannot be deleted
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selected.merge_tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded bg-brand/10 text-brand font-mono"
                    >
                      {`{{${tag}}}`}
                    </span>
                  ))}
                </div>
              </div>
              {!isSystemTemplate && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-500 hover:text-red-700 transition shrink-0"
                  title="Delete template"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Subject
              </label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
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
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
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
                className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[#272727] mb-2">Delete Template</h3>
            <p className="text-sm text-[#a59494] mb-4">
              Delete &ldquo;{selected.name}&rdquo;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {isSaving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {showAddModal && (
        <AddTemplateModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTemplate}
        />
      )}
    </div>
  );
}

function AddTemplateModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, subject: string, body: string) => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), subject.trim(), body);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-lg font-bold text-[#272727]">Add Email Template</h3>
          <button onClick={onClose} className="text-[#a59494] hover:text-[#272727] transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Follow-Up Email"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Email body content..."
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] font-mono leading-relaxed placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !subject.trim()}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Role Permissions Tab ──────────────────────────────────────── */

function RolesPermissionsTab({
  team,
  onTeamUpdated,
  teamId,
  users,
  currentUserId,
}: {
  team: Team | null;
  onTeamUpdated: (team: Team) => void;
  teamId: string;
  users: TeamUser[];
  currentUserId: string;
}) {
  const currentUser = users.find((u) => u.id === currentUserId);
  const isTeamLead = currentUser?.role === "Team Lead";

  // Settings Tab Visibility
  const SETTINGS_TABS_CONFIG = [
    { id: "team", label: "Team" },
    { id: "members", label: "Team Members" },
    { id: "roles", label: "Role Permissions" },
    { id: "stages", label: "Pipeline Stages" },
    { id: "templates", label: "Email Templates" },
    { id: "criteria", label: "Scoring Criteria" },
    { id: "questions", label: "Interview Questions" },
    { id: "onboarding-tasks", label: "Onboarding Tasks" },
    { id: "group-prompts", label: "Group Interview Prompts" },
  ];
  const settings = (team?.settings ?? {}) as Record<string, unknown>;
  const stored = settings.role_permissions as
    | Partial<TeamRolePermissions>
    | undefined;
  const customRoles =
    (settings.custom_roles as string[]) ?? [];

  const [permissions, setPermissions] = useState<TeamRolePermissions>(
    resolveRolePermissionsWithCustom(stored, customRoles)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Settings tab visibility state
  const storedVisibility = (settings.settings_visibility ?? {}) as Record<string, Record<string, boolean>>;
  const [tabVisibility, setTabVisibility] = useState<Record<string, Record<string, boolean>>>(storedVisibility);

  function toggleTabVisibility(tabId: string, role: string) {
    if (role === "Team Lead") return; // Team Lead always sees all
    setTabVisibility((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] ?? {}),
        [tabId]: !(prev[role]?.[tabId] ?? false),
      },
    }));
  }

  async function handleSaveVisibility() {
    setIsSaving(true);
    setSaveStatus("");
    const result = await saveSettings("update_settings_visibility", {
      team_id: teamId,
      settings_visibility: tabVisibility,
    });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      setSaveStatus("Saved!");
      if (team) {
        const currentSettings = (team.settings ?? {}) as Record<string, unknown>;
        onTeamUpdated({
          ...team,
          settings: { ...currentSettings, settings_visibility: tabVisibility },
        });
      }
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setIsSaving(false);
  }

  // Manage Roles state
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [deleteRole, setDeleteRole] = useState<string | null>(null);
  const [roleActionLoading, setRoleActionLoading] = useState(false);

  const protectedRoles = new Set(["Admin", "Team Lead", "Leader", "Agent", "Employee"]);
  const defaultRoleSet = new Set<string>(DEFAULT_ROLES as unknown as string[]);

  function updateTeamState(newSettings: Record<string, unknown>) {
    if (team) {
      onTeamUpdated({ ...team, settings: newSettings });
    }
  }

  async function handleAddRole() {
    if (!newRoleName.trim()) return;
    setRoleActionLoading(true);
    const result = await saveSettings("add_custom_role", {
      team_id: teamId,
      role_name: newRoleName.trim(),
    });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      const newSettings = (result as { settings: Record<string, unknown> }).settings;
      updateTeamState(newSettings);
      // Add to local permissions state
      setPermissions((prev) => {
        const updated = { ...prev };
        updated[newRoleName.trim()] = {} as Record<string, boolean> as TeamRolePermissions[string];
        for (const key of PERMISSION_KEYS) {
          (updated[newRoleName.trim()] as Record<string, boolean>)[key] = false;
        }
        return updated;
      });
      setSaveStatus("Role added!");
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setNewRoleName("");
    setShowAddRole(false);
    setRoleActionLoading(false);
  }

  async function handleRenameRole() {
    if (!editingRole || !editRoleName.trim()) return;
    setRoleActionLoading(true);
    const result = await saveSettings("rename_role", {
      team_id: teamId,
      old_name: editingRole,
      new_name: editRoleName.trim(),
    });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      const newSettings = (result as { settings: Record<string, unknown> }).settings;
      updateTeamState(newSettings);
      // Update local permissions state
      setPermissions((prev) => {
        const updated = { ...prev };
        if (updated[editingRole]) {
          updated[editRoleName.trim()] = updated[editingRole];
          delete updated[editingRole];
        }
        return updated;
      });
      setSaveStatus("Role renamed!");
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setEditingRole(null);
    setEditRoleName("");
    setRoleActionLoading(false);
  }

  async function handleDeleteRole() {
    if (!deleteRole) return;
    setRoleActionLoading(true);
    const result = await saveSettings("delete_role", {
      team_id: teamId,
      role_name: deleteRole,
    });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      const newSettings = (result as { settings: Record<string, unknown> }).settings;
      updateTeamState(newSettings);
      setPermissions((prev) => {
        const updated = { ...prev };
        delete updated[deleteRole];
        return updated;
      });
      setSaveStatus("Role deleted!");
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setDeleteRole(null);
    setRoleActionLoading(false);
  }

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

  const usersPerRole = (roleName: string) =>
    users.filter((u) => u.role === roleName).length;

  return (
    <div className="space-y-6">
      {/* ── Manage Roles Section (Team Lead only) ─────────────── */}
      {isTeamLead && (<>
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-sm font-semibold text-[#272727]">
            Manage Roles
          </h3>
          <p className="text-xs text-[#a59494] mt-0.5">
            Add, rename, or remove custom roles. Default roles cannot be
            deleted.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2 items-center">
            {roles.map((role) => {
              const isProtected = protectedRoles.has(role);
              const isDefault = defaultRoleSet.has(role);
              const count = usersPerRole(role);

              if (editingRole === role) {
                return (
                  <div
                    key={role}
                    className="flex items-center gap-1 bg-brand/5 border border-brand/20 rounded-full px-3 py-1.5"
                  >
                    <input
                      type="text"
                      value={editRoleName}
                      onChange={(e) => setEditRoleName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameRole();
                        if (e.key === "Escape") setEditingRole(null);
                      }}
                      className="text-xs border-none bg-transparent outline-none w-24"
                      autoFocus
                    />
                    <button
                      onClick={handleRenameRole}
                      disabled={roleActionLoading}
                      className="text-brand hover:text-brand-dark"
                      title="Save"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingRole(null)}
                      className="text-[#a59494] hover:text-[#272727]"
                      title="Cancel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={role}
                  className="group flex items-center gap-1.5 bg-[#f5f0f0] border border-[#a59494]/15 rounded-full px-3 py-1.5"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDefault || isProtected ? "bg-brand" : "bg-[#a59494]"
                    }`}
                  />
                  <span className="text-xs font-medium text-[#272727]">
                    {role}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] text-[#a59494]">
                      ({count})
                    </span>
                  )}
                  {isProtected ? (
                    <span title="Protected role — cannot be deleted">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#a59494] ml-0.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition ml-0.5">
                      <button
                        onClick={() => {
                          setEditingRole(role);
                          setEditRoleName(role);
                        }}
                        className="text-[#a59494] hover:text-brand"
                        title="Rename role"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {count > 0 ? (
                        <span className="text-[10px] text-red-400 ml-1" title={`${count} user${count !== 1 ? "s" : ""} have this role. Reassign them first.`}>
                          Can&apos;t delete
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteRole(role)}
                          className="text-[#a59494] hover:text-red-500"
                          title="Delete role"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Role */}
            {showAddRole ? (
              <div className="flex items-center gap-1 bg-white border border-brand/30 rounded-full px-3 py-1.5">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddRole();
                    if (e.key === "Escape") {
                      setShowAddRole(false);
                      setNewRoleName("");
                    }
                  }}
                  placeholder="Role name..."
                  className="text-xs border-none bg-transparent outline-none w-24"
                  autoFocus
                />
                <button
                  onClick={handleAddRole}
                  disabled={roleActionLoading || !newRoleName.trim()}
                  className="text-brand hover:text-brand-dark disabled:opacity-40"
                  title="Add"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setShowAddRole(false);
                    setNewRoleName("");
                  }}
                  className="text-[#a59494] hover:text-[#272727]"
                >
                  <svg
                    width="14"
                    height="14"
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
            ) : (
              <button
                onClick={() => setShowAddRole(true)}
                className="flex items-center gap-1 border border-dashed border-[#a59494]/40 rounded-full px-3 py-1.5 text-xs text-[#a59494] hover:border-brand hover:text-brand transition"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Role
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────── */}
      {deleteRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-[#272727] mb-2">
              Delete &ldquo;{deleteRole}&rdquo;?
            </h3>
            <p className="text-xs text-[#a59494] mb-4">
              This role and its permissions will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteRole(null)}
                className="px-4 py-2 rounded-lg text-sm text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRole}
                disabled={roleActionLoading}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {roleActionLoading ? "Deleting..." : "Delete Role"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* ── Permissions Matrix ──────────────────────────────────── */}
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
                        className="text-[10px] text-brand hover:underline"
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
                              ? "bg-brand"
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

      {/* Save Permissions button */}
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
          className="px-6 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Permissions"}
        </button>
      </div>

      {/* ── Settings Tab Visibility (Team Lead only) ──────────── */}
      {isTeamLead && (
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-sm font-semibold text-[#272727]">
            Settings Tab Visibility
          </h3>
          <p className="text-xs text-[#a59494] mt-0.5">
            Control which Settings tabs each role can see. Team Lead always sees all tabs.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#a59494]/10">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[#272727] w-52">
                  Tab
                </th>
                {roles.map((role) => (
                  <th
                    key={role}
                    className="px-3 py-3 text-xs font-semibold text-[#272727] text-center min-w-[100px]"
                  >
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#a59494]/10">
              {SETTINGS_TABS_CONFIG.map((tab) => (
                <tr key={tab.id} className="hover:bg-[#f5f0f0]/50 transition">
                  <td className="px-6 py-3 text-sm font-medium text-[#272727]">
                    {tab.label}
                  </td>
                  {roles.map((role) => {
                    const isLead = role === "Team Lead";
                    const isOn = isLead || (tabVisibility[role]?.[tab.id] ?? false);
                    return (
                      <td key={role} className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleTabVisibility(tab.id, role)}
                          disabled={isLead}
                          className={`w-8 h-5 rounded-full relative transition-colors duration-200 ${
                            isOn ? "bg-brand" : "bg-[#a59494]/30"
                          } ${isLead ? "opacity-60 cursor-not-allowed" : ""}`}
                          title={isLead ? "Team Lead always sees all tabs" : `${isOn ? "Hide" : "Show"} ${tab.label} for ${role}`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                              isOn ? "left-3.5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-[#a59494]/10 flex justify-end">
          <button
            onClick={handleSaveVisibility}
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Visibility"}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/* ── Group Interview Guidelines Section ───────────────────────── */

function GroupInterviewGuidelinesSection({
  team,
  onTeamUpdated,
  teamId,
}: {
  team: Team | null;
  onTeamUpdated: (team: Team) => void;
  teamId: string;
}) {
  const settings = (team?.settings ?? {}) as Record<string, unknown>;
  const saved = (settings.group_interview_guidelines as string[]) ?? [];
  const [guidelines, setGuidelines] = useState<string[]>(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  function updateGuideline(index: number, value: string) {
    setGuidelines((prev) => prev.map((g, i) => (i === index ? value : g)));
  }

  function addGuideline() {
    setGuidelines((prev) => [...prev, ""]);
  }

  function removeGuideline(index: number) {
    setGuidelines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("");
    const filtered = guidelines.filter((g) => g.trim());
    const result = await saveSettings("update_group_guidelines", {
      team_id: teamId,
      guidelines: filtered,
    });
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      setGuidelines(filtered);
      setSaveStatus("Saved!");
      if (team) {
        const currentSettings = (team.settings ?? {}) as Record<string, unknown>;
        onTeamUpdated({
          ...team,
          settings: { ...currentSettings, group_interview_guidelines: filtered },
        });
      }
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setIsSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm mb-6">
      <div className="px-6 py-4 border-b border-[#a59494]/10">
        <h3 className="text-sm font-semibold text-[#272727]">
          Group Interview Guidelines
        </h3>
        <p className="text-xs text-[#a59494] mt-0.5">
          These guidelines will be shown to interviewers on the group interview
          session page
        </p>
      </div>
      <div className="p-6 space-y-3">
        {guidelines.map((g, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs text-[#a59494] mt-2.5 w-5 shrink-0 text-right">
              {i + 1}.
            </span>
            <textarea
              value={g}
              onChange={(e) => updateGuideline(i, e.target.value)}
              rows={2}
              className="flex-1 border border-[#a59494]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              placeholder="Enter a guideline..."
            />
            <button
              onClick={() => removeGuideline(i)}
              className="mt-2 text-[#a59494] hover:text-red-500 transition"
            >
              <svg
                width="16"
                height="16"
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
        ))}
        <button
          onClick={addGuideline}
          className="text-xs text-brand hover:underline font-medium"
        >
          + Add Guideline
        </button>
      </div>
      <div className="px-6 pb-4 flex items-center justify-end gap-3">
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
          className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Guidelines"}
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
                            className="w-20 px-2 py-1 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
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
                            className="w-20 px-2 py-1 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
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
                            className="px-3 py-1 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
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
                      <span className="text-xs text-brand font-medium">
                        {c.weight_percent}%
                      </span>
                      {c.min_threshold !== null && (
                        <span className="text-[10px] text-[#a59494]">
                          min: {c.min_threshold}
                        </span>
                      )}
                      <button
                        onClick={() => startEditing(c)}
                        className="text-xs font-medium text-brand hover:text-brand-dark transition"
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
