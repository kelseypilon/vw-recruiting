import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import { TeamProvider } from "@/lib/team-context";
import { UserPermissionsProvider } from "@/lib/user-permissions-context";
import { BrandStyleInjector } from "@/lib/brand-style-injector";
import { resolveTeamBranding } from "@/lib/branding";
import DashboardLayout from "./dashboard-layout";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const admin = createAdminClient();
  const teamId = await getTeamId();
  const { data } = await admin
    .from("teams")
    .select("brand_name, name")
    .eq("id", teamId)
    .single();
  const teamName = data?.brand_name || data?.name || "Recruiting Portal";
  return {
    title: `${teamName} — Recruiting`,
  };
}

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check uses the SSR client (reads session cookie)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const teamId = await getTeamId();

  // Use admin client for DB reads — bypasses RLS so the user profile lookup works
  const admin = createAdminClient();

  const [teamsResult, teamResult, profileResult] = await Promise.all([
    admin.from("teams").select("id, name").order("name"),
    admin
      .from("teams")
      .select(
        "id, name, slug, settings, branding_mode, brand_name, brand_logo_url, brand_primary_color, brand_secondary_color, brand_show_powered_by"
      )
      .eq("id", teamId)
      .single(),
    admin
      .from("users")
      .select("id, team_id, name, email, role, from_email")
      .eq("team_id", teamId)
      .eq("email", user.email!)
      .single(),
  ]);

  const teams = teamsResult.data ?? [];
  const teamData = teamResult.data;
  const teamSettings =
    (teamData?.settings as Record<string, unknown>) ?? null;
  const profile = profileResult.data;

  const branding = resolveTeamBranding(teamData);

  return (
    <TeamProvider initialTeamId={teamId} teams={teams} branding={branding}>
      <UserPermissionsProvider
        userId={profile?.id ?? ""}
        userRole={profile?.role ?? "member"}
        userName={profile?.name ?? user.email ?? ""}
        userEmail={user.email ?? ""}
        teamSettings={teamSettings}
      >
        <BrandStyleInjector />
        <DashboardLayout email={user.email ?? ""}>{children}</DashboardLayout>
      </UserPermissionsProvider>
    </TeamProvider>
  );
}
