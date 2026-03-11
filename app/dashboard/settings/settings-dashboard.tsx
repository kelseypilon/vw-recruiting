"use client";

import { useState, useEffect, useRef } from "react";
import type {
  Team,
  TeamUser,
  PipelineStage,
  EmailTemplate,
  EmailTemplateFolder,
  ScoringCriterion,
  InterviewQuestion,
  OnboardingTask,
  GroupInterviewPrompt,
  TeamIntegrations,
  InterestedInOption,
} from "@/lib/types";
import InterviewQuestionsTab from "./interview-questions-tab";
import OnboardingTasksTab from "./onboarding-tasks-tab";
import GroupInterviewPromptsTab from "./group-interview-prompts-tab";
import PipelineStagesTab from "./pipeline-stages-tab";
import IntegrationsTab from "./integrations-tab";
import ApplicationFormTab from "./application-form-tab";
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
  templateFolders: EmailTemplateFolder[];
  criteria: ScoringCriterion[];
  interviewQuestions: InterviewQuestion[];
  onboardingTasks: OnboardingTask[];
  groupInterviewPrompts: GroupInterviewPrompt[];
  interestedInOptions: InterestedInOption[];
  teamId: string;
  currentUserId: string;
}

/* ── Tabs ──────────────────────────────────────────────────────── */

/* ── Sidebar sections with grouped tabs ─────────────────────── */

interface TabItem {
  id: string;
  label: string;
  permission?: PermissionKey;
  icon: string;
}

interface SidebarSection {
  title: string;
  tabs: TabItem[];
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: "TEAM",
    tabs: [
      { id: "team", label: "General", icon: "⚙️" },
      { id: "members", label: "Team Members", permission: "manage_members", icon: "👥" },
      { id: "roles", label: "Roles & Permissions", permission: "manage_members", icon: "🔐" },
    ],
  },
  {
    title: "RECRUITING",
    tabs: [
      { id: "app-form", label: "Application Form", permission: "manage_settings", icon: "📝" },
      { id: "stages", label: "Pipeline Stages", permission: "manage_settings", icon: "📊" },
      { id: "templates", label: "Email Templates", permission: "manage_templates", icon: "📧" },
      { id: "criteria", label: "Scoring Criteria", permission: "manage_settings", icon: "📏" },
      { id: "questions", label: "Interview Questions", icon: "❓" },
      { id: "group-prompts", label: "Group Interview", permission: "manage_interviews", icon: "📋" },
      { id: "interested-in", label: "Interested In Options", permission: "manage_settings", icon: "🏷️" },
    ],
  },
  {
    title: "ONBOARDING",
    tabs: [
      { id: "onboarding-tasks", label: "Onboarding Tasks", permission: "manage_onboarding", icon: "✅" },
    ],
  },
  {
    title: "INTEGRATIONS",
    tabs: [
      { id: "integrations", label: "Integrations", permission: "manage_settings", icon: "🔌" },
    ],
  },
];

// Flatten for backward compat
const ALL_TABS = SIDEBAR_SECTIONS.flatMap((s) => s.tabs);

type TabId = string;

/* ── Helper: call /api/settings ────────────────────────────────── */

async function saveSettings(
  action: string,
  payload: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.error ?? `Request failed (${res.status})`, ...body };
  }
  return body;
}

/* ── Main Component ────────────────────────────────────────────── */

export default function SettingsDashboard({
  team: initialTeam,
  users: initialUsers,
  stages: initialStages,
  templates: initialTemplates,
  templateFolders: initialTemplateFolders,
  criteria: initialCriteria,
  interviewQuestions: initialQuestions,
  onboardingTasks: initialOnboardingTasks,
  groupInterviewPrompts: initialGroupPrompts,
  interestedInOptions: initialInterestedInOptions,
  teamId,
  currentUserId,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("team");
  const [team, setTeam] = useState(initialTeam);
  const [users, setUsers] = useState(initialUsers);
  const [stages, setStages] = useState(initialStages);
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateFolders, setTemplateFolders] = useState(initialTemplateFolders);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [questions, setQuestions] = useState(initialQuestions);
  const [onboardingTasks, setOnboardingTasks] = useState(initialOnboardingTasks);
  const [groupPrompts] = useState(initialGroupPrompts);
  const [interestedInOptions, setInterestedInOptions] = useState(initialInterestedInOptions);
  const { can, userRole } = usePermissions();

  // Settings tab visibility from team settings
  const teamSettings = (initialTeam?.settings ?? {}) as Record<string, unknown>;
  const settingsVisibility = (teamSettings.settings_visibility ?? {}) as Record<string, Record<string, boolean>>;

  // Filter function for tab visibility
  function isTabVisible(tab: TabItem): boolean {
    if (tab.permission && !can(tab.permission)) return false;
    if (userRole === "Team Lead") return true;
    const roleVisibility = settingsVisibility[userRole];
    if (roleVisibility && tab.id in roleVisibility) {
      return roleVisibility[tab.id];
    }
    return true;
  }

  // Filter sidebar sections — hide sections with no visible tabs
  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    tabs: section.tabs.filter(isTabVisible),
  })).filter((section) => section.tabs.length > 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#272727]">Settings</h2>
        <p className="text-sm text-[#a59494] mt-0.5">
          Manage your team, pipeline, and preferences
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left sidebar */}
        <nav className="w-56 shrink-0">
          <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm overflow-hidden sticky top-24">
            {visibleSections.map((section, idx) => (
              <div key={section.title}>
                {idx > 0 && <div className="border-t border-[#a59494]/10" />}
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] font-bold tracking-wider text-[#a59494] uppercase">
                    {section.title}
                  </p>
                </div>
                <div className="pb-1">
                  {section.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition text-left ${
                        activeTab === tab.id
                          ? "bg-brand/10 text-brand font-semibold border-r-2 border-brand"
                          : "text-[#272727] hover:bg-[#f5f0f0]"
                      }`}
                    >
                      <span className="text-sm">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">

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
      {activeTab === "app-form" && (
        <ApplicationFormTab teamId={teamId} />
      )}
      {activeTab === "stages" && (
        <PipelineStagesTab stages={stages} onStagesUpdated={setStages} teamId={teamId} />
      )}
      {activeTab === "templates" && (
        <TemplatesTab
          templates={templates}
          onTemplatesUpdated={setTemplates}
          folders={templateFolders}
          onFoldersUpdated={setTemplateFolders}
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
          <GroupInterviewPromptsTab
            prompts={groupPrompts}
            teamId={teamId}
          />
          <div className="mt-8">
            <GroupInterviewGuidelinesSection
              teamId={teamId}
              initialGuidelines={((team?.settings as Record<string, unknown>)?.group_interview_guidelines as string[]) ?? []}
            />
          </div>
        </>
      )}
      {activeTab === "interested-in" && (
        <InterestedInTab
          options={interestedInOptions}
          onOptionsUpdated={setInterestedInOptions}
          teamId={teamId}
        />
      )}
      {activeTab === "integrations" && (
        <IntegrationsTab
          integrations={(team?.integrations ?? {}) as TeamIntegrations}
          teamId={teamId}
        />
      )}
        </div>{/* end flex-1 */}
      </div>{/* end flex gap-6 */}
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
  const [officeAddress, setOfficeAddress] = useState(team?.office_address ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [slug, setSlug] = useState(team?.slug ?? "");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState(team?.slug ?? "");
  const [slugError, setSlugError] = useState("");
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [slugSaveStatus, setSlugSaveStatus] = useState("");
  const [thresholdStuckDays, setThresholdStuckDays] = useState(team?.threshold_stuck_days ?? 7);
  const [thresholdScorecardHours, setThresholdScorecardHours] = useState(team?.threshold_scorecard_hours ?? 24);
  const [thresholdEscalationHours, setThresholdEscalationHours] = useState(team?.threshold_escalation_hours ?? 48);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [thresholdStatus, setThresholdStatus] = useState("");

  // Public application link state
  const teamSettings = (team?.settings ?? {}) as Record<string, unknown>;
  const [acceptingApplications, setAcceptingApplications] = useState(
    teamSettings.accepting_applications !== false
  );
  const [isSavingAccepting, setIsSavingAccepting] = useState(false);
  const [acceptingStatus, setAcceptingStatus] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const publicUrl = slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://vw-recruiting.vercel.app"}/apply/${slug}`
    : "";

  // Branding state
  const [brandPrimary, setBrandPrimary] = useState(team?.brand_primary_color ?? "#1c759e");
  const [brandSecondary, setBrandSecondary] = useState(team?.brand_secondary_color ?? "#272727");
  const [brandLogoUrl, setBrandLogoUrl] = useState(team?.brand_logo_url ?? "");
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!team) return;
    setIsSaving(true);
    setSaveStatus("");

    const result = await saveSettings("update_team", {
      id: team.id,
      name: teamName,
      admin_email: adminEmail || null,
      admin_cc: adminCc,
      office_address: officeAddress.trim() || null,
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

  async function handleToggleAccepting(newValue: boolean) {
    if (!team) return;
    setIsSavingAccepting(true);
    setAcceptingStatus("");

    const result = await saveSettings("update_team", {
      id: team.id,
      accepting_applications: newValue,
    });

    if (result.error) {
      setAcceptingStatus(`Error: ${result.error}`);
    } else {
      setAcceptingApplications(newValue);
      if (result.data) onTeamUpdated(result.data as Team);
      setAcceptingStatus(newValue ? "Now accepting applications" : "Applications paused");
      setTimeout(() => setAcceptingStatus(""), 2500);
    }
    setIsSavingAccepting(false);
  }

  function handleCopyPublicLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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

  function validateSlug(value: string): string {
    if (value.length < 3) return "Slug must be at least 3 characters";
    if (!/^[a-z0-9-]+$/.test(value))
      return "Only lowercase letters, numbers, and hyphens allowed";
    if (value.startsWith("-") || value.endsWith("-"))
      return "Slug cannot start or end with a hyphen";
    return "";
  }

  async function handleSaveSlug() {
    const error = validateSlug(slugDraft);
    if (error) {
      setSlugError(error);
      return;
    }
    if (!team) return;
    setIsSavingSlug(true);
    setSlugSaveStatus("");

    const result = await saveSettings("update_team", {
      id: team.id,
      slug: slugDraft,
    });

    if (result.error) {
      setSlugSaveStatus(`Error: ${result.error}`);
    } else if (result.data) {
      setSlug(slugDraft);
      onTeamUpdated(result.data as Team);
      setIsEditingSlug(false);
      setSlugSaveStatus("Saved!");
      setTimeout(() => setSlugSaveStatus(""), 2000);
    }
    setIsSavingSlug(false);
  }

  async function handleSaveBranding() {
    if (!team) return;
    setIsSavingBranding(true);
    setBrandingStatus("");

    const result = await saveSettings("update_team", {
      id: team.id,
      brand_primary_color: brandPrimary,
      brand_secondary_color: brandSecondary,
      brand_logo_url: brandLogoUrl || null,
    });

    if (result.error) {
      setBrandingStatus(`Error: ${result.error}`);
    } else if (result.data) {
      onTeamUpdated(result.data as Team);
      setBrandingStatus("Saved! Reload to see changes.");
      setTimeout(() => setBrandingStatus(""), 3000);
    }
    setIsSavingBranding(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !team) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setBrandingStatus("Error: Please upload a JPG, PNG, WebP, or SVG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBrandingStatus("Error: Logo must be under 2MB");
      return;
    }

    setIsUploadingLogo(true);
    setBrandingStatus("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("teamId", team.id);

      const res = await fetch("/api/logo-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setBrandingStatus(`Error: ${data.error}`);
        return;
      }

      setBrandLogoUrl(data.url);
      setBrandingStatus("Logo uploaded!");
      setTimeout(() => setBrandingStatus(""), 2000);
    } catch {
      setBrandingStatus("Error: Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
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
              Team Slug
            </label>
            <p className="text-xs text-[#a59494] mb-1">
              Used in URLs for your team (e.g. /apply/<strong>{slug || "your-team"}</strong>)
            </p>
            {isEditingSlug ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={slugDraft}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setSlugDraft(v);
                    setSlugError(v ? validateSlug(v) : "");
                  }}
                  placeholder="your-team-slug"
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition ${
                    slugError ? "border-red-400" : "border-[#a59494]/40"
                  }`}
                />
                {slugError && (
                  <p className="text-xs text-red-600">{slugError}</p>
                )}
                {slugSaveStatus && (
                  <p className={`text-xs ${slugSaveStatus.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
                    {slugSaveStatus}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSlug}
                    disabled={isSavingSlug || !!slugError}
                    className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
                  >
                    {isSavingSlug ? "Saving..." : "Save Slug"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingSlug(false);
                      setSlugDraft(slug);
                      setSlugError("");
                      setSlugSaveStatus("");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] hover:bg-[#a59494]/5 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-lg border border-[#a59494]/20 bg-[#a59494]/5 text-sm text-[#272727] font-mono flex-1">
                  {slug || <span className="text-[#a59494] italic">Not set</span>}
                </span>
                <button
                  onClick={() => {
                    setSlugDraft(slug);
                    setIsEditingSlug(true);
                    setSlugError("");
                    setSlugSaveStatus("");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#a59494]/5 transition"
                >
                  Edit
                </button>
              </div>
            )}
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
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Office Address
            </label>
            <input
              type="text"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              placeholder="123 Main St, Suite 100, Phoenix, AZ 85001"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Auto-fills the &ldquo;Office&rdquo; location when scheduling in-person interviews.
            </p>
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
          className="px-6 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Public Application Link */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#272727] mb-1">Public Application Link</h3>
        <p className="text-xs text-[#a59494] mb-4">
          Share this link so candidates can apply directly. No login required.
        </p>

        <div className="space-y-4 max-w-lg">
          {slug ? (
            <>
              {/* URL display + copy */}
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/20 bg-[#a59494]/5 text-sm text-[#272727] font-mono truncate">
                  {publicUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPublicLink}
                  className="shrink-0 px-3 py-2 rounded-lg border border-[#a59494]/30 text-xs font-semibold text-[#272727] hover:bg-[#a59494]/5 transition"
                >
                  {linkCopied ? "Copied!" : "Copy Link"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-2 rounded-lg border border-[#a59494]/30 text-xs font-semibold text-[#272727] hover:bg-[#a59494]/5 transition"
                >
                  Preview
                </a>
              </div>

              {/* Accept Applications toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#272727]">Accept Applications</p>
                  <p className="text-xs text-[#a59494]">
                    {acceptingApplications
                      ? "Candidates can submit applications via the public link."
                      : "The public form shows a \"not accepting\" message."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAccepting(!acceptingApplications)}
                  disabled={isSavingAccepting}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50 ${
                    acceptingApplications ? "bg-brand" : "bg-[#a59494]/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                      acceptingApplications ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {acceptingStatus && (
                <p className={`text-xs ${acceptingStatus.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
                  {acceptingStatus}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#a59494] italic">
              Set a team slug above to enable the public application link.
            </p>
          )}
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#272727] mb-1">Branding</h3>
        <p className="text-xs text-[#a59494] mb-4">
          Customize how your team appears to candidates on the application form and emails.
        </p>

        <div className="space-y-5 max-w-lg">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-2">
              Team Logo
            </label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-16 h-16 rounded-xl border border-[#a59494]/20 bg-[#f5f0f0] flex items-center justify-center overflow-hidden shrink-0">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt="Team logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#a59494] text-xs">No logo</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#a59494]/5 transition disabled:opacity-50"
                >
                  {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                </button>
                {brandLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setBrandLogoUrl("")}
                    className="px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-[#a59494]">
                  JPG, PNG, WebP, or SVG — max 2MB
                </p>
              </div>
            </div>
          </div>

          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Primary Color
            </label>
            <p className="text-xs text-[#a59494] mb-2">
              Used for buttons, links, and accent elements.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandPrimary}
                onChange={(e) => setBrandPrimary(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#a59494]/20 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={brandPrimary}
                onChange={(e) => {
                  let v = e.target.value;
                  if (!v.startsWith("#")) v = "#" + v;
                  if (v.length <= 7) setBrandPrimary(v);
                }}
                placeholder="#1c759e"
                className={`w-28 px-3 py-2 rounded-lg border text-sm font-mono text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition ${
                  isValidHex(brandPrimary) ? "border-[#a59494]/40" : "border-red-400"
                }`}
              />
              <div
                className="w-10 h-10 rounded-lg border border-[#a59494]/20"
                style={{ backgroundColor: isValidHex(brandPrimary) ? brandPrimary : "#ccc" }}
                title="Preview"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Secondary Color
            </label>
            <p className="text-xs text-[#a59494] mb-2">
              Used for the sidebar, header backgrounds, and dark accents.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandSecondary}
                onChange={(e) => setBrandSecondary(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#a59494]/20 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={brandSecondary}
                onChange={(e) => {
                  let v = e.target.value;
                  if (!v.startsWith("#")) v = "#" + v;
                  if (v.length <= 7) setBrandSecondary(v);
                }}
                placeholder="#272727"
                className={`w-28 px-3 py-2 rounded-lg border text-sm font-mono text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition ${
                  isValidHex(brandSecondary) ? "border-[#a59494]/40" : "border-red-400"
                }`}
              />
              <div
                className="w-10 h-10 rounded-lg border border-[#a59494]/20"
                style={{ backgroundColor: isValidHex(brandSecondary) ? brandSecondary : "#ccc" }}
                title="Preview"
              />
            </div>
          </div>

          {/* Brand Preview Panel */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-2">
              Preview
            </label>
            <div className="rounded-xl border border-[#a59494]/20 overflow-hidden">
              {/* Mini header */}
              <div
                className="px-4 py-3 flex items-center gap-2"
                style={{ backgroundColor: isValidHex(brandSecondary) ? brandSecondary : "#0D1B2A" }}
              >
                {brandLogoUrl ? (
                  <img src={brandLogoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: isValidHex(brandPrimary) ? brandPrimary : "#1c759e" }}
                  >
                    {(team?.name ?? "T").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white text-xs font-semibold">{team?.name ?? "Team"}</span>
              </div>
              {/* Mini body */}
              <div className="bg-[#f5f0f0] p-4 space-y-3">
                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div className="h-2 w-24 bg-[#a59494]/20 rounded" />
                  <div className="h-2 w-40 bg-[#a59494]/10 rounded" />
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                  style={{ backgroundColor: isValidHex(brandPrimary) ? brandPrimary : "#1c759e" }}
                >
                  Sample Button
                </button>
                <div className="flex gap-2">
                  <div
                    className="h-1 w-20 rounded-full"
                    style={{ backgroundColor: isValidHex(brandPrimary) ? brandPrimary : "#1c759e" }}
                  />
                  <div className="h-1 w-20 rounded-full bg-[#a59494]/20" />
                  <div className="h-1 w-20 rounded-full bg-[#a59494]/20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save branding */}
        <div className="flex items-center justify-end gap-3 mt-5">
          {brandingStatus && (
            <span className={`text-sm ${brandingStatus.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {brandingStatus}
            </span>
          )}
          <button
            onClick={handleSaveBranding}
            disabled={isSavingBranding || !isValidHex(brandPrimary) || !isValidHex(brandSecondary)}
            className="px-6 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {isSavingBranding ? "Saving..." : "Save Branding"}
          </button>
        </div>
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

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
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
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const escalationContact = users.find((u) => u.is_escalation_contact);

  // Fetch pending invites on mount
  useEffect(() => {
    async function fetchInvites() {
      try {
        const res = await fetch("/api/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_invites", team_id: teamId }),
        });
        const json = await res.json();
        if (json.data) {
          // Show only pending (not accepted, not expired)
          const pending = (json.data as PendingInvite[]).filter(
            (inv) => !inv.accepted_at && new Date(inv.expires_at) > new Date()
          );
          setPendingInvites(pending);
        }
      } catch {
        // silent
      }
    }
    fetchInvites();
  }, [teamId]);

  async function handleResendInvite(invite: PendingInvite) {
    setResendingId(invite.id);
    try {
      // Revoke old invite then create new one
      await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_invite", invite_id: invite.id }),
      });
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_invite",
          team_id: teamId,
          email: invite.email,
          role: invite.role,
        }),
      });
      const json = await res.json();
      if (json.success && json.invite) {
        // Update pending list — remove old, add new
        setPendingInvites((prev) => [
          ...prev.filter((p) => p.id !== invite.id),
          { ...invite, id: json.invite.id, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
        ]);
      }
    } catch {
      // silent
    }
    setResendingId(null);
  }

  async function handleRevokeInvite(inviteId: string) {
    await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_invite", invite_id: inviteId }),
    });
    setPendingInvites((prev) => prev.filter((p) => p.id !== inviteId));
  }

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
      {/* Escalation Contact Dropdown */}
      <div className="mb-4 bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-[#272727] flex items-center gap-2">
              ⚡ Escalation Contact
            </h4>
            <p className="text-xs text-[#a59494] mt-0.5">
              Receives escalation notifications when action is overdue
            </p>
          </div>
          <select
            value={escalationContact?.id ?? ""}
            onChange={async (e) => {
              const selectedId = e.target.value;
              setTogglingEscalation(true);
              if (!selectedId) {
                await saveSettings("clear_escalation_contact", { team_id: teamId });
                onUsersUpdated(users.map((u) => ({ ...u, is_escalation_contact: false })));
              } else {
                await saveSettings("set_escalation_contact", { user_id: selectedId, team_id: teamId });
                onUsersUpdated(users.map((u) => ({ ...u, is_escalation_contact: u.id === selectedId })));
              }
              setTogglingEscalation(false);
            }}
            disabled={togglingEscalation}
            className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition min-w-[200px]"
          >
            <option value="">None selected</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        {!escalationContact && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ No escalation contact set. Notifications that require escalation won&apos;t have a recipient.
          </p>
        )}
      </div>

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

        {/* Add / Invite row */}
        {showInviteInput && (
          <div className="px-6 py-3 border-b border-[#a59494]/10 bg-brand/5">
            <p className="text-xs text-[#272727] font-medium mb-2">Add by email — sends an invite link if they don&apos;t have an account</p>
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
                {getRoleOptions(team).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
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

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm mt-4">
          <div className="px-6 py-3 border-b border-[#a59494]/10">
            <h4 className="text-sm font-semibold text-[#272727]">
              Pending Invites ({pendingInvites.length})
            </h4>
          </div>
          <div className="divide-y divide-[#a59494]/10">
            {pendingInvites.map((inv) => {
              const ageHours = (Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60);
              return (
                <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#a59494]/20 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#a59494" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-[#272727]">{inv.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Invite Pending
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                          {inv.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ageHours >= 24 && (
                      <button
                        onClick={() => handleResendInvite(inv)}
                        disabled={resendingId === inv.id}
                        className="text-xs font-medium text-brand hover:text-brand-dark transition disabled:opacity-50"
                      >
                        {resendingId === inv.id ? "Sending..." : "Resend"}
                      </button>
                    )}
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs font-medium text-[#a59494] hover:text-red-500 transition"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_user_assignments",
            payload: { id: member.id, team_id: teamId },
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted) {
          setAssignments({
            interviews: data.interviews ?? 0,
            onboarding: data.onboarding ?? 0,
          });
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Leader");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const resolvedRole = role;

  async function handleSave() {
    if (!firstName.trim() || !email.trim()) {
      setError("First name and email are required");
      return;
    }
    setIsSaving(true);
    setError("");

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_user",
        payload: {
          team_id: teamId,
          name: fullName,
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
          {/* First + Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Brooklyn"
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
              />
            </div>
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
              disabled={isSaving || !firstName.trim() || !email.trim()}
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
  folders,
  onFoldersUpdated,
  teamId,
}: {
  templates: EmailTemplate[];
  onTemplatesUpdated: (templates: EmailTemplate[]) => void;
  folders: EmailTemplateFolder[];
  onFoldersUpdated: (folders: EmailTemplateFolder[]) => void;
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Folder state
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null); // null = "All Templates"
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  const MERGE_TAGS = [
    "first_name", "last_name", "email", "phone", "role_applied",
    "team_name", "sender_name", "sender_email", "interview_date",
    "interview_time", "interview_type", "zoom_link", "booking_url",
  ];

  function insertMergeTag(tag: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const token = `{{${tag}}}`;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = editBody.slice(0, start);
    const after = editBody.slice(end);
    setEditBody(before + token + after);
    setTimeout(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

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
      folder_id: activeFolderId,
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

  // ── Folder CRUD ──────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const result = await saveSettings("create_template_folder", {
      team_id: teamId,
      name: newFolderName.trim(),
    });
    if (!result.error && result.data) {
      onFoldersUpdated([...folders, result.data as EmailTemplateFolder]);
    }
    setNewFolderName("");
    setShowNewFolder(false);
  }

  async function handleRenameFolder(folderId: string) {
    if (!renameFolderName.trim()) return;
    const result = await saveSettings("rename_template_folder", {
      id: folderId,
      name: renameFolderName.trim(),
    });
    if (!result.error) {
      onFoldersUpdated(
        folders.map((f) =>
          f.id === folderId ? { ...f, name: renameFolderName.trim() } : f
        )
      );
    }
    setRenamingFolderId(null);
    setRenameFolderName("");
  }

  async function handleDeleteFolder(folderId: string) {
    const result = await saveSettings("delete_template_folder", { id: folderId });
    if (!result.error) {
      onFoldersUpdated(folders.filter((f) => f.id !== folderId));
      // Templates in this folder get unassigned (DB sets folder_id to null)
      onTemplatesUpdated(
        templates.map((t) =>
          t.folder_id === folderId ? { ...t, folder_id: null } : t
        )
      );
      if (activeFolderId === folderId) setActiveFolderId(null);
    }
  }

  async function handleMoveToFolder(templateId: string, folderId: string | null) {
    const result = await saveSettings("move_template_to_folder", {
      template_id: templateId,
      folder_id: folderId,
    });
    if (!result.error) {
      onTemplatesUpdated(
        templates.map((t) =>
          t.id === templateId ? { ...t, folder_id: folderId } : t
        )
      );
    }
  }

  function toggleFolderCollapse(folderId: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  // Filter templates by active folder
  const filteredTemplates =
    activeFolderId === null
      ? templates
      : activeFolderId === "__unfiled__"
        ? templates.filter((t) => !t.folder_id)
        : templates.filter((t) => t.folder_id === activeFolderId);

  const isSystemTemplate = selected?.is_system_template ?? (selected?.trigger ? SYSTEM_TRIGGERS.has(selected.trigger) : false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-3">
        {/* Folder sidebar */}
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="px-4 py-3 border-b border-[#a59494]/10">
            <p className="text-xs font-bold tracking-wider text-[#a59494] uppercase">Folders</p>
          </div>
          <div className="divide-y divide-[#a59494]/10">
            {/* All Templates */}
            <button
              onClick={() => setActiveFolderId(null)}
              className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                activeFolderId === null ? "bg-brand/10 text-brand font-semibold" : "text-[#272727] hover:bg-[#f5f0f0]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              All Templates
              <span className="ml-auto text-xs text-[#a59494]">{templates.length}</span>
            </button>
            {/* Unfiled */}
            <button
              onClick={() => setActiveFolderId("__unfiled__")}
              className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                activeFolderId === "__unfiled__" ? "bg-brand/10 text-brand font-semibold" : "text-[#272727] hover:bg-[#f5f0f0]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
              Unfiled
              <span className="ml-auto text-xs text-[#a59494]">{templates.filter((t) => !t.folder_id).length}</span>
            </button>
            {/* Custom folders */}
            {folders.map((folder) => {
              const count = templates.filter((t) => t.folder_id === folder.id).length;
              const isRenaming = renamingFolderId === folder.id;
              return (
                <div key={folder.id} className="group">
                  {isRenaming ? (
                    <div className="px-4 py-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={renameFolderName}
                        onChange={(e) => setRenameFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameFolder(folder.id);
                          if (e.key === "Escape") setRenamingFolderId(null);
                        }}
                        className="flex-1 px-2 py-1 rounded border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameFolder(folder.id)}
                        className="text-xs text-brand hover:text-brand-dark"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                        activeFolderId === folder.id ? "bg-brand/10 text-brand font-semibold" : "text-[#272727] hover:bg-[#f5f0f0]"
                      }`}
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`shrink-0 transition ${!collapsedFolders.has(folder.id) ? "" : ""}`}
                      >
                        <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                      </svg>
                      <span className="truncate flex-1">{folder.name}</span>
                      <span className="text-xs text-[#a59494] shrink-0">{count}</span>
                      {/* Actions — show on hover */}
                      <span className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameFolderName(folder.name); }}
                          className="p-0.5 text-[#a59494] hover:text-brand"
                          title="Rename"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                          className="p-0.5 text-[#a59494] hover:text-red-500"
                          title="Delete folder"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Add folder */}
          <div className="px-4 py-2 border-t border-[#a59494]/10">
            {showNewFolder ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
                  }}
                  placeholder="Folder name"
                  className="flex-1 px-2 py-1 rounded border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  autoFocus
                />
                <button onClick={handleCreateFolder} className="text-xs font-medium text-brand hover:text-brand-dark">
                  Add
                </button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="text-xs text-[#a59494] hover:text-[#272727]">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#a59494] hover:text-brand transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Folder
              </button>
            )}
          </div>
        </div>

        {/* Template list (filtered by folder) */}
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="divide-y divide-[#a59494]/10">
            {filteredTemplates.map((tmpl) => {
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
          {filteredTemplates.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[#a59494]">No templates in this folder</p>
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-2">
        {selected ? (
          <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
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
                {/* Folder assignment dropdown */}
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-xs text-[#a59494]">Folder:</label>
                  <select
                    value={selected.folder_id ?? ""}
                    onChange={(e) => handleMoveToFolder(selected.id, e.target.value || null)}
                    className="text-xs px-2 py-1 rounded border border-[#a59494]/30 text-[#272727] bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="">Unfiled</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                {selected.merge_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.merge_tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertMergeTag(tag)}
                        className="text-xs px-2 py-0.5 rounded bg-brand/10 text-brand font-mono hover:bg-brand/20 transition cursor-pointer"
                        title={`Insert {{${tag}}}`}
                      >
                        {`{{${tag}}}`}
                      </button>
                    ))}
                  </div>
                )}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-[#272727]">
                  Body
                </label>
                <span className="text-[10px] text-[#a59494]">Click a merge tag above to insert at cursor</span>
              </div>
              {/* Merge tag toolbar */}
              <div className="flex flex-wrap gap-1 mb-2 p-2 bg-[#f5f0f0] rounded-lg">
                {MERGE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertMergeTag(tag)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#a59494]/20 text-[#272727] font-mono hover:bg-brand/10 hover:text-brand hover:border-brand/30 transition"
                  >
                    {`{{${tag}}}`}
                  </button>
                ))}
              </div>
              <textarea
                ref={bodyRef}
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
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute top-4 right-4 text-[#a59494] hover:text-[#272727] transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
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
  const [addRoleError, setAddRoleError] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [deleteRole, setDeleteRole] = useState<string | null>(null);
  const [deleteRoleUsers, setDeleteRoleUsers] = useState<TeamUser[]>([]);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [roleActionLoading, setRoleActionLoading] = useState(false);

  const protectedRoles = new Set(["Admin", "Super Admin"]);
  const defaultRoleSet = new Set<string>(DEFAULT_ROLES as unknown as string[]);

  function updateTeamState(newSettings: Record<string, unknown>) {
    if (team) {
      onTeamUpdated({ ...team, settings: newSettings });
    }
  }

  async function handleAddRole() {
    const trimmed = newRoleName.trim();
    if (!trimmed) {
      setAddRoleError("Role name cannot be blank.");
      return;
    }
    if (trimmed.length > 30) {
      setAddRoleError("Role name must be 30 characters or fewer.");
      return;
    }
    const duplicate = roles.some(
      (r) => r.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setAddRoleError("A role with this name already exists.");
      return;
    }
    setAddRoleError("");
    setRoleActionLoading(true);
    const result = await saveSettings("add_custom_role", {
      team_id: teamId,
      role_name: trimmed,
    });
    if (result.error) {
      setAddRoleError(result.error);
    } else {
      const newSettings = (result as { settings: Record<string, unknown> }).settings;
      updateTeamState(newSettings);
      // Add to local permissions state
      setPermissions((prev) => {
        const updated = { ...prev };
        updated[trimmed] = {} as Record<string, boolean> as TeamRolePermissions[string];
        for (const key of PERMISSION_KEYS) {
          (updated[trimmed] as Record<string, boolean>)[key] = false;
        }
        return updated;
      });
      setSaveStatus("Role added!");
      setTimeout(() => setSaveStatus(""), 2000);
      setNewRoleName("");
      setShowAddRole(false);
    }
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

  async function handleDeleteRole(forceReassignTo?: string) {
    if (!deleteRole) return;
    setRoleActionLoading(true);
    const result = await saveSettings("delete_role", {
      team_id: teamId,
      role_name: deleteRole,
      ...(forceReassignTo ? { reassign_to: forceReassignTo } : {}),
    }) as { error?: string; needs_reassignment?: boolean; user_count?: number; settings?: Record<string, unknown> };
    if (result.needs_reassignment) {
      // API says users need reassignment — populate user list for the modal
      const affected = users.filter((u) => u.role === deleteRole);
      setDeleteRoleUsers(affected);
      setRoleActionLoading(false);
      return; // keep modal open with reassignment dropdown
    }
    if (result.error) {
      setSaveStatus(`Error: ${result.error}`);
    } else {
      const newSettings = result.settings;
      if (newSettings) updateTeamState(newSettings);
      setPermissions((prev) => {
        const updated = { ...prev };
        delete updated[deleteRole];
        return updated;
      });
      setSaveStatus("Role deleted!");
      setTimeout(() => setSaveStatus(""), 2000);
    }
    setDeleteRole(null);
    setDeleteRoleUsers([]);
    setReassignTo("");
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
                  className="group flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5"
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
                      <button
                        onClick={() => {
                          setDeleteRole(role);
                          setDeleteRoleUsers(count > 0 ? users.filter((u) => u.role === role) : []);
                          setReassignTo("");
                        }}
                        className="text-[#a59494] hover:text-red-500"
                        title={count > 0 ? `Delete role (${count} user${count !== 1 ? "s" : ""} will need reassignment)` : "Delete role"}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Role */}
            {showAddRole ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-1 bg-white border border-brand/30 rounded-full px-3 py-1.5">
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => {
                      setNewRoleName(e.target.value);
                      setAddRoleError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddRole();
                      if (e.key === "Escape") {
                        setShowAddRole(false);
                        setNewRoleName("");
                        setAddRoleError("");
                      }
                    }}
                    maxLength={30}
                    placeholder="Role name..."
                    className="text-xs border-none bg-transparent outline-none w-28"
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
                      setAddRoleError("");
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
                {addRoleError && (
                  <p className="text-[10px] text-red-600 mt-1 ml-3">{addRoleError}</p>
                )}
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

      {/* ── Delete / Reassign Role Modal ────────────────────────── */}
      {deleteRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <button
              onClick={() => { setDeleteRole(null); setDeleteRoleUsers([]); setReassignTo(""); }}
              className="absolute top-4 right-4 text-[#a59494] hover:text-[#272727] transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-sm font-semibold text-[#272727] mb-2">
              Delete &ldquo;{deleteRole}&rdquo;?
            </h3>

            {deleteRoleUsers.length > 0 ? (
              <>
                <p className="text-xs text-[#a59494] mb-3">
                  {deleteRoleUsers.length} {deleteRoleUsers.length === 1 ? "person is" : "people are"} assigned
                  to &ldquo;{deleteRole}&rdquo;. Reassign them before deleting.
                </p>

                {/* Affected user list */}
                <div className="border border-[#a59494]/15 rounded-lg mb-3 max-h-40 overflow-y-auto divide-y divide-[#a59494]/10">
                  {deleteRoleUsers.map((u) => (
                    <div key={u.id} className="px-3 py-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(u.name?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#272727] truncate">{u.name || "Unnamed"}</p>
                        <p className="text-[10px] text-[#a59494] truncate">{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <label className="block text-xs font-medium text-[#272727] mb-1">Reassign all to:</label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full mb-4 px-3 py-2 rounded-lg border border-[#a59494]/20 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  <option value="">Select a role...</option>
                  {roles
                    .filter((r) => r !== deleteRole)
                    .map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <p className="text-xs text-[#a59494] mb-4">
                This role has no users assigned. It will be permanently removed.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteRole(null);
                  setDeleteRoleUsers([]);
                  setReassignTo("");
                }}
                className="px-4 py-2 rounded-lg text-sm text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteRoleUsers.length > 0) {
                    handleDeleteRole(reassignTo);
                  } else {
                    handleDeleteRole();
                  }
                }}
                disabled={roleActionLoading || (deleteRoleUsers.length > 0 && !reassignTo)}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {roleActionLoading
                  ? "Deleting..."
                  : deleteRoleUsers.length > 0
                    ? "Reassign & Delete"
                    : "Delete Role"}
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
                {roles.map((role) => {
                  const isProtectedRole = protectedRoles.has(role);
                  const roleUserCount = usersPerRole(role);
                  return (
                  <th
                    key={role}
                    className="px-3 py-3 text-xs font-semibold text-[#272727] text-center min-w-[100px] group/col"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{role}</span>
                      {isTeamLead && !isProtectedRole && (
                        <button
                          onClick={() => {
                            setDeleteRole(role);
                            setDeleteRoleUsers(roleUserCount > 0 ? users.filter((u) => u.role === role) : []);
                            setReassignTo("");
                          }}
                          className="opacity-0 group-hover/col:opacity-100 text-[#a59494] hover:text-red-500 transition"
                          title={roleUserCount > 0 ? `Delete role (${roleUserCount} user${roleUserCount !== 1 ? "s" : ""} will need reassignment)` : "Delete role"}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
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
                  );
                })}
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
  teamId,
  initialGuidelines,
}: {
  teamId: string;
  initialGuidelines: string[];
}) {
  const [guidelines, setGuidelines] = useState<string[]>(initialGuidelines);
  const [newGuideline, setNewGuideline] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(updated: string[]) {
    setSaving(true);
    await saveSettings("update_group_guidelines", {
      team_id: teamId,
      guidelines: updated,
    });
    setSaving(false);
  }

  function addGuideline() {
    if (!newGuideline.trim()) return;
    const updated = [...guidelines, newGuideline.trim()];
    setGuidelines(updated);
    setNewGuideline("");
    persist(updated);
  }

  function removeGuideline(index: number) {
    const updated = guidelines.filter((_, i) => i !== index);
    setGuidelines(updated);
    persist(updated);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#272727]">Session Guidelines</h3>
        <p className="text-sm text-[#a59494] mt-1">
          Guidelines shown to interviewers at the start of each group interview session.
        </p>
      </div>

      {guidelines.length > 0 && (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm divide-y divide-[#a59494]/10">
          {guidelines.map((g, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 group">
              <span className="text-xs font-semibold text-[#a59494] w-5">{idx + 1}</span>
              <p className="flex-1 text-sm text-[#272727]">{g}</p>
              <button
                onClick={() => removeGuideline(idx)}
                className="p-1 text-[#a59494] hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add a new guideline..."
          value={newGuideline}
          onChange={(e) => setNewGuideline(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addGuideline(); }}
          className="flex-1 border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
        />
        <button
          onClick={addGuideline}
          disabled={!newGuideline.trim() || saving}
          className="px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
        >
          {saving ? "..." : "Add"}
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
  }

  async function handleSave() {
    if (!editingId) return;
    setIsSaving(true);

    const result = await saveSettings("update_criterion", {
      id: editingId,
      weight_percent: editWeight,
    });

    if (!result.error) {
      onCriteriaUpdated(
        criteria.map((c) =>
          c.id === editingId
            ? { ...c, weight_percent: editWeight }
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

/* ── Interested In Options Tab ─────────────────────────────────── */

function InterestedInTab({
  options,
  onOptionsUpdated,
  teamId,
}: {
  options: InterestedInOption[];
  onOptionsUpdated: (options: InterestedInOption[]) => void;
  teamId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const sorted = [...options].sort((a, b) => a.order_index - b.order_index);

  function startEditing(opt: InterestedInOption) {
    setEditingId(opt.id);
    setEditLabel(opt.label);
    setError("");
  }

  async function handleSave() {
    if (!editingId || !editLabel.trim()) return;
    setIsSaving(true);
    setError("");

    const result = await saveSettings("update_interested_in", {
      id: editingId,
      label: editLabel.trim(),
    });

    if (result.error) {
      setError(result.error);
    } else {
      onOptionsUpdated(
        options.map((o) =>
          o.id === editingId ? { ...o, label: editLabel.trim() } : o
        )
      );
      setEditingId(null);
    }
    setIsSaving(false);
  }

  async function handleToggleActive(opt: InterestedInOption) {
    const result = await saveSettings("update_interested_in", {
      id: opt.id,
      is_active: !opt.is_active,
    });
    if (!result.error) {
      onOptionsUpdated(
        options.map((o) =>
          o.id === opt.id ? { ...o, is_active: !opt.is_active } : o
        )
      );
    }
  }

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setIsAdding(true);
    setError("");

    const result = await saveSettings("create_interested_in", {
      team_id: teamId,
      label: newLabel.trim(),
    });

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      onOptionsUpdated([...options, result.data as InterestedInOption]);
      setNewLabel("");
    }
    setIsAdding(false);
  }

  async function handleDelete(id: string) {
    const result = await saveSettings("delete_interested_in", { id });
    if (!result.error) {
      onOptionsUpdated(options.filter((o) => o.id !== id));
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const newSorted = [...sorted];
    [newSorted[index - 1], newSorted[index]] = [newSorted[index], newSorted[index - 1]];
    const reordered = newSorted.map((o, i) => ({ ...o, order_index: i }));
    onOptionsUpdated(reordered);

    await saveSettings("reorder_interested_in", {
      items: reordered.map((o) => ({ id: o.id, order_index: o.order_index })),
    });
  }

  async function handleMoveDown(index: number) {
    if (index >= sorted.length - 1) return;
    const newSorted = [...sorted];
    [newSorted[index], newSorted[index + 1]] = [newSorted[index + 1], newSorted[index]];
    const reordered = newSorted.map((o, i) => ({ ...o, order_index: i }));
    onOptionsUpdated(reordered);

    await saveSettings("reorder_interested_in", {
      items: reordered.map((o) => ({ id: o.id, order_index: o.order_index })),
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10">
          <h3 className="text-sm font-bold text-[#272727]">
            Interested In Options
          </h3>
          <p className="text-xs text-[#a59494] mt-0.5">
            Configure the options available when selecting what a candidate is interested in.
          </p>
        </div>

        <div className="divide-y divide-[#a59494]/10">
          {sorted.map((opt, index) => (
            <div key={opt.id} className="px-6 py-3 flex items-center gap-3">
              {editingId === opt.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                    autoFocus
                  />
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 rounded-lg border border-[#a59494]/40 text-xs font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !editLabel.trim()}
                    className="px-3 py-1 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold transition disabled:opacity-50"
                  >
                    {isSaving ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <>
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-[10px] text-[#a59494] hover:text-[#272727] disabled:opacity-20 transition leading-none"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= sorted.length - 1}
                      className="text-[10px] text-[#a59494] hover:text-[#272727] disabled:opacity-20 transition leading-none"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Label */}
                  <span
                    className={`text-sm flex-1 ${
                      opt.is_active ? "text-[#272727]" : "text-[#a59494] line-through"
                    }`}
                  >
                    {opt.label}
                  </span>

                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(opt)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
                      opt.is_active
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-[#f5f0f0] text-[#a59494] hover:bg-[#e5e0e0]"
                    }`}
                  >
                    {opt.is_active ? "Active" : "Inactive"}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => startEditing(opt)}
                    className="text-xs font-medium text-brand hover:text-brand-dark transition"
                  >
                    Edit
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(opt.id)}
                    className="text-xs font-medium text-red-400 hover:text-red-600 transition"
                    title="Delete option"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}

          {sorted.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-[#a59494]">
              No options yet. Add one below.
            </div>
          )}
        </div>

        {/* Add new option */}
        <div className="px-6 py-4 border-t border-[#a59494]/10 bg-[#f5f0f0]/30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="New option label..."
              className="flex-1 px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !newLabel.trim()}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
