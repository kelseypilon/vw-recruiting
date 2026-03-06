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
};

/* ── Default roles the app ships with ─────────────────────────────── */

export const DEFAULT_ROLES = [
  "Team Lead",
  "Leader",
  "Admin",
  "Front Desk",
  "VP Ops",
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
};

export const DEFAULT_ROLE_PERMISSIONS: TeamRolePermissions = {
  "Team Lead": { ...ALL_TRUE },
  Leader: {
    ...ALL_TRUE,
    manage_settings: false,
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
  },
  "VP Ops": { ...ALL_TRUE },
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
  return perms[userRole]?.[permission] ?? false;
}
