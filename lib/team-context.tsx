"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { TeamBranding } from "./types";

interface TeamOption {
  id: string;
  name: string;
}

interface TeamContextValue {
  teamId: string;
  teamName: string;
  teams: TeamOption[];
  branding: TeamBranding;
  switchTeam: (id: string) => void;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}

export function TeamProvider({
  initialTeamId,
  teams,
  branding,
  children,
}: {
  initialTeamId: string;
  teams: TeamOption[];
  branding: TeamBranding;
  children: ReactNode;
}) {
  const [teamId, setTeamId] = useState(initialTeamId);

  const switchTeam = useCallback(
    (id: string) => {
      setTeamId(id);
      // Store preference in cookie for server components
      document.cookie = `vw_team_id=${id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Strict;Secure`;
      // If on a detail page (e.g. /group-interviews/[id], /candidates/[id]),
      // navigate to the parent list to avoid crashing on a stale entity ID.
      const path = window.location.pathname;
      const detailPattern = /^\/dashboard\/(group-interviews|candidates)\/[^/]+$/;
      if (detailPattern.test(path)) {
        const listPath = path.replace(/\/[^/]+$/, "");
        window.location.href = listPath;
      } else {
        window.location.reload();
      }
    },
    []
  );

  const current = teams.find((t) => t.id === teamId) ?? teams[0];

  return (
    <TeamContext.Provider
      value={{
        teamId: current?.id ?? teamId,
        teamName: current?.name ?? "",
        teams,
        branding,
        switchTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
