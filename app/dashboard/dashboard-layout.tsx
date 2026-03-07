"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTeam } from "@/lib/team-context";
import { usePermissions } from "@/lib/user-permissions-context";
import type { PermissionKey } from "@/lib/permissions";

const NAV_ITEMS: {
  label: string;
  href: string;
  icon: React.ComponentType<{ active: boolean }>;
  permission?: PermissionKey;
  superAdminOnly?: boolean;
}[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Candidates", href: "/dashboard/candidates", icon: CandidatesIcon, permission: "view_candidates" },
  { label: "Interviews", href: "/dashboard/interviews", icon: InterviewsIcon, permission: "manage_interviews" },
  { label: "Group Interviews", href: "/dashboard/group-interviews", icon: GroupInterviewsIcon, permission: "manage_interviews" },
  { label: "Onboarding", href: "/dashboard/onboarding", icon: OnboardingIcon, permission: "view_onboarding" },
  { label: "Settings", href: "/dashboard/settings", icon: SettingsIcon, permission: "manage_settings" },
  { label: "Profile", href: "/dashboard/profile", icon: ProfileIcon },
  { label: "Help", href: "/dashboard/help", icon: HelpIcon },
  { label: "Super Admin", href: "/dashboard/super-admin", icon: SuperAdminIcon, superAdminOnly: true },
];

export default function DashboardLayout({
  email,
  isSuperAdmin,
  children,
}: {
  email: string;
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { teamId, teamName, teams, switchTeam, branding } = useTeam();
  const { can } = usePermissions();

  // Filter nav items based on user permissions and super admin flag
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f0f0]">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#a59494]/20 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center bg-brand"
            >
              <span className="text-white text-sm font-bold">
                {branding.initials}
              </span>
            </div>
          )}
          <span className="text-lg font-bold text-[#272727] tracking-tight">
            {teamName || branding.name}
          </span>

          {/* Team Switcher */}
          {teams.length > 1 && (
            <select
              value={teamId}
              onChange={(e) => switchTeam(e.target.value)}
              className="ml-3 text-sm border border-[#a59494]/30 rounded-lg px-2.5 py-1.5 bg-[#f5f0f0] text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#a59494]">{email}</span>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-brand hover:text-brand-dark transition"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 py-6 shrink-0 flex flex-col" style={{ backgroundColor: "#0D1B2A" }}>
          <nav className="flex flex-col gap-1 px-3 flex-1">
            {visibleNavItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? "text-white bg-[#1B6CA8]"
                      : "text-[#a5b4c4] hover:text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon active={active} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Powered by footer for custom branding */}
          {branding.mode === "custom" && branding.showPoweredBy && (
            <div className="px-6 py-3 text-xs text-[#a5b4c4]/60">
              Powered by Vantage West
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

/* ── Sidebar icons ────────────────────────────────────────────── */

function DashboardIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CandidatesIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InterviewsIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function OnboardingIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function GroupInterviewsIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HelpIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SuperAdminIcon({ active }: { active: boolean }) {
  const color = active ? "#ffffff" : "#a5b4c4";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
