"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  hasPermission,
  resolveRolePermissions,
  type TeamRolePermissions,
  type PermissionKey,
} from "@/lib/permissions";

/* ── Context value ────────────────────────────────────────────── */

interface UserPermissionsContextValue {
  /** Current user's role (e.g. "Team Lead", "Admin") */
  userRole: string;
  /** Current user's display name */
  userName: string;
  /** Current user's email */
  userEmail: string;
  /** Resolved role → permissions map for the team */
  rolePermissions: TeamRolePermissions;
  /** Check if the current user has a specific permission */
  can: (permission: PermissionKey) => boolean;
}

const UserPermissionsContext = createContext<UserPermissionsContextValue | null>(
  null
);

/* ── Provider ─────────────────────────────────────────────────── */

interface ProviderProps {
  userRole: string;
  userName: string;
  userEmail: string;
  teamSettings: Record<string, unknown> | null;
  children: ReactNode;
}

export function UserPermissionsProvider({
  userRole,
  userName,
  userEmail,
  teamSettings,
  children,
}: ProviderProps) {
  const storedPerms = teamSettings?.role_permissions as
    | Partial<TeamRolePermissions>
    | undefined;
  const rolePermissions = resolveRolePermissions(storedPerms);

  // Roles that always have full access regardless of stored permissions
  const FULL_ACCESS_ROLES = ["Team Lead", "Admin", "VP Ops"];
  const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

  function can(permission: PermissionKey): boolean {
    if (isFullAccess) return true;
    return hasPermission(rolePermissions, userRole, permission);
  }

  return (
    <UserPermissionsContext.Provider
      value={{ userRole, userName, userEmail, rolePermissions, can }}
    >
      {children}
    </UserPermissionsContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────── */

/**
 * Access the current user's permissions.
 *
 * Usage:
 *   const { can, userRole } = usePermissions();
 *   if (can("send_emails")) { ... }
 */
export function usePermissions(): UserPermissionsContextValue {
  const ctx = useContext(UserPermissionsContext);
  if (!ctx) {
    // Fallback for components outside the provider — grant all by default
    // This prevents crashes during SSR/dev when context may not be available
    return {
      userRole: "Team Lead",
      userName: "",
      userEmail: "",
      rolePermissions: {},
      can: () => true,
    };
  }
  return ctx;
}
