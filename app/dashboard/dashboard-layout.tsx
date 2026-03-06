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
}[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Candidates", href: "/dashboard/candidates", icon: CandidatesIcon, permission: "view_candidates" },
  { label: "Interviews", href: "/dashboard/interviews", icon: InterviewsIcon, permission: "manage_interviews" },
  { label: "Onboarding", href: "/dashboard/onboarding", icon: OnboardingIcon },
  { label: "Settings", href: "/dashboard/settings", icon: SettingsIcon, permission: "manage_settings" },
  { label: "Help", href: "/dashboard/help", icon: HelpIcon },
];

export default function DashboardLayout({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { teamId, teamName, teams, switchTeam } = useTeam();
  const { can, userRole } = usePermissions();

  // Filter nav items based on user permissions
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f0f0]">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#a59494]/20 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1c759e] flex items-center justify-center">
            <span className="text-white text-sm font-bold">VW</span>
          </div>
          <span className="text-lg font-bold text-[#272727] tracking-tight">
            {teamName || "VW Recruiting"}
          </span>

          {/* Team Switcher */}
          {teams.length > 1 && (
            <select
              value={teamId}
              onChange={(e) => switchTeam(e.target.value)}
              className="ml-3 text-sm border border-[#a59494]/30 rounded-lg px-2.5 py-1.5 bg-[#f5f0f0] text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e]/30 cursor-pointer"
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
              className="text-sm font-medium text-[#1c759e] hover:text-[#155f82] transition"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-white border-r border-[#a59494]/20 py-6 shrink-0">
          <nav className="flex flex-col gap-1 px-3">
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
                      ? "bg-[#1c759e]/10 text-[#1c759e]"
                      : "text-[#272727] hover:bg-[#f5f0f0]"
                  }`}
                >
                  <item.icon active={active} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

/* ── Sidebar icons ────────────────────────────────────────────── */

function DashboardIcon({ active }: { active: boolean }) {
  const color = active ? "#1c759e" : "#a59494";
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
  const color = active ? "#1c759e" : "#a59494";
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
  const color = active ? "#1c759e" : "#a59494";
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
  const color = active ? "#1c759e" : "#a59494";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const color = active ? "#1c759e" : "#a59494";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon({ active }: { active: boolean }) {
  const color = active ? "#1c759e" : "#a59494";
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
