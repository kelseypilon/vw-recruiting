import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import { TeamProvider } from "@/lib/team-context";
import { UserPermissionsProvider } from "@/lib/user-permissions-context";
import DashboardLayout from "./dashboard-layout";

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
    admin.from("teams").select("settings").eq("id", teamId).single(),
    admin
      .from("users")
      .select("id, team_id, name, email, role, from_email")
      .eq("team_id", teamId)
      .eq("email", user.email!)
      .single(),
  ]);

  const teams = teamsResult.data ?? [];
  const teamSettings = (teamResult.data?.settings as Record<string, unknown>) ?? null;
  const profile = profileResult.data;

  return (
    <TeamProvider initialTeamId={teamId} teams={teams}>
      <UserPermissionsProvider
        userRole={profile?.role ?? "member"}
        userName={profile?.name ?? user.email ?? ""}
        userEmail={user.email ?? ""}
        teamSettings={teamSettings}
      >
        <DashboardLayout email={user.email ?? ""}>{children}</DashboardLayout>
      </UserPermissionsProvider>
    </TeamProvider>
  );
}
