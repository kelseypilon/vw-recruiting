/**
 * Role-based permissions system.
 *
 * Permissions are stored in teams.settings.role_permissions as a JSONB object:
 *   { "Team Lead": { "view_candidates": true, ... }, ... }
 *
 * Each permission key maps to a specific capability in the app.
 */

/* ── Permission keys ─────────────────────────────────────────────── */

export const PERMISSION_KEYS = [
  "view_candidates",
  "edit_candidates",
  "send_emails",
  "manage_interviews",
  "manage_settings",
  "view_reports",
  "manage_members",
  "manage_templates",
  "manage_scorecards",
  "manage_onboarding",
  "view_onboarding",
  "view_interview_notes",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type RolePermissions = Record<PermissionKey, boolean>;

/** Map of role name → permission flags */
export type TeamRolePermissions = Record<string, RolePermissions>;

/* ── Human-readable labels ────────────────────────────────────────── */

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  view_candidates: {
    label: "View Candidates",
    description: "View candidate profiles, pipeline, and details",
  },
  edit_candidates: {
    label: "Edit Candidates",
    description: "Edit candidate info, move pipeline stages, add notes",
  },
  send_emails: {
    label: "Send Emails",
    description: "Send emails to candidates from the app",
  },
  manage_interviews: {
    label: "Manage Interviews",
    description: "Schedule interviews and manage interview records",
  },
  manage_settings: {
    label: "Manage Settings",
    description: "Access and modify team settings and pipeline config",
  },
  view_reports: {
    label: "View Reports",
    description: "View analytics, scoring, and reporting dashboards",
  },
  manage_members: {
    label: "Manage Members",
    description: "Add, edit, or remove team members and roles",
  },
  manage_templates: {
    label: "Manage Templates",
    description: "Create and edit email templates",
  },
  manage_scorecards: {
    label: "Manage Scorecards",
    description: "Submit and view interview scorecards",
  },
  manage_onboarding: {
    label: "Manage Onboarding",
    description: "Create and manage onboarding tasks and assignments",
  },
  view_onboarding: {
    label: "View Onboarding",
    description: "View onboarding task lists and progress",
  },
  view_interview_notes: {
    label: "View Interview Notes",
    description: "View shared interview guide notes from other interviewers",
  },
};

/* ── Default roles the app ships with ─────────────────────────────── */

export const DEFAULT_ROLES = [
  "Team Lead",
  "Leader",
  "Admin",
  "Front Desk",
  "VP Ops",
  "Interviewer",
  "View Only",
] as const;

/* ── Default permissions per role ──────────────────────────────────── */

const ALL_TRUE: RolePermissions = {
  view_candidates: true,
  edit_candidates: true,
  send_emails: true,
  manage_interviews: true,
  manage_settings: true,
  view_reports: true,
  manage_members: true,
  manage_templates: true,
  manage_scorecards: true,
  manage_onboarding: true,
  view_onboarding: true,
  view_interview_notes: true,
};

export const DEFAULT_ROLE_PERMISSIONS: TeamRolePermissions = {
  "Team Lead": { ...ALL_TRUE },
  Leader: {
    ...ALL_TRUE,
    manage_members: false,
    manage_templates: false,
  },
  Admin: { ...ALL_TRUE },
  "Front Desk": {
    view_candidates: true,
    edit_candidates: false,
    send_emails: false,
    manage_interviews: false,
    manage_settings: false,
    view_reports: false,
    manage_members: false,
    manage_templates: false,
    manage_scorecards: false,
    manage_onboarding: false,
    view_onboarding: true,
    view_interview_notes: false,
  },
  "VP Ops": { ...ALL_TRUE },
  Interviewer: {
    view_candidates: true,
    edit_candidates: false,
    send_emails: false,
    manage_interviews: true,
    manage_settings: false,
    view_reports: false,
    manage_members: false,
    manage_templates: false,
    manage_scorecards: true,
    manage_onboarding: false,
    view_onboarding: true,
    view_interview_notes: true,
  },
  "View Only": {
    view_candidates: true,
    edit_candidates: false,
    send_emails: false,
    manage_interviews: false,
    manage_settings: false,
    view_reports: false,
    manage_members: false,
    manage_templates: false,
    manage_scorecards: false,
    manage_onboarding: false,
    view_onboarding: true,
    view_interview_notes: false,
  },
};

/* ── Helper: merge saved permissions with defaults ─────────────────── */

/**
 * Given the team's stored role_permissions (possibly partial/empty)
 * returns a complete map with defaults filled in for any missing roles/keys.
 */
export function resolveRolePermissions(
  stored: Partial<TeamRolePermissions> | undefined | null
): TeamRolePermissions {
  const result: TeamRolePermissions = {};

  for (const role of DEFAULT_ROLES) {
    const saved = stored?.[role];
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] ?? ALL_TRUE;

    result[role] = {} as RolePermissions;
    for (const key of PERMISSION_KEYS) {
      result[role][key] = saved?.[key] ?? defaults[key];
    }
  }

  // Also include any custom roles that were saved but aren't in DEFAULT_ROLES
  if (stored) {
    for (const role of Object.keys(stored)) {
      if (!result[role]) {
        result[role] = {} as RolePermissions;
        for (const key of PERMISSION_KEYS) {
          result[role][key] = stored[role]?.[key] ?? false;
        }
      }
    }
  }

  return result;
}

/**
 * Like resolveRolePermissions but also ensures custom roles from
 * teams.settings.custom_roles appear even if they have no stored permissions yet.
 *
 * hiddenDefaultRoles: default roles that have been deleted or renamed by the team.
 * These are excluded from the result so they don't reappear.
 */
export function resolveRolePermissionsWithCustom(
  stored: Partial<TeamRolePermissions> | undefined | null,
  customRoles: string[],
  hiddenDefaultRoles: string[] = []
): TeamRolePermissions {
  const result = resolveRolePermissions(stored);

  // Remove any default roles the team has hidden (deleted/renamed away)
  for (const role of hiddenDefaultRoles) {
    delete result[role];
  }

  for (const role of customRoles) {
    if (!result[role]) {
      result[role] = {} as RolePermissions;
      for (const key of PERMISSION_KEYS) {
        result[role][key] = false;
      }
    }
  }
  return result;
}

/** Roles that cannot be deleted or renamed */
export const PROTECTED_ROLES = ["Admin", "VP Ops"] as const;

/**
 * Build the role options list for dropdowns (invite, user edit, etc.).
 * Respects hidden default roles and includes custom roles.
 */
export function getRoleOptionsList(
  customRoles: string[],
  hiddenDefaultRoles: string[] = []
): string[] {
  const hiddenSet = new Set(hiddenDefaultRoles);
  const defaults = DEFAULT_ROLES.filter((r) => !hiddenSet.has(r));
  return [...defaults, ...customRoles];
}

/* ── Permission check ──────────────────────────────────────────────── */

/**
 * Check if a user's role has a specific permission.
 * Falls back to default role permissions if team settings don't specify.
 */
export function hasPermission(
  rolePermissions: TeamRolePermissions | undefined | null,
  userRole: string,
  permission: PermissionKey
): boolean {
  // If no permissions configured, use defaults
  const perms = resolveRolePermissions(rolePermissions);
  return perms[userRole]?.[permission] ?? true;
}

/* ── Convenience helper functions ──────────────────────────────────── */

export function canEditSettings(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_settings");
}

export function canSeeAllCandidates(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "view_candidates");
}

export function canSendEmail(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "send_emails");
}

export function canManageTeam(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_members");
}

export function canManageOnboarding(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_onboarding");
}

export function canRunOnboardingTasks(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_onboarding");
}

export function canEditTemplates(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_templates");
}

export function canEditPipelineStages(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_settings");
}

export function canEditScoringCriteria(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_settings");
}

export function canManageRoles(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "manage_members");
}

export function canViewInterviewNotes(rp: TeamRolePermissions | undefined | null, role: string): boolean {
  return hasPermission(rp, role, "view_interview_notes");
}
