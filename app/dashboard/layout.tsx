import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import { TeamProvider } from "@/lib/team-context";
import DashboardLayout from "./dashboard-layout";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all teams for the team switcher
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .order("name");

  const teamId = await getTeamId();

  return (
    <TeamProvider initialTeamId={teamId} teams={teams ?? []}>
      <DashboardLayout email={user.email ?? ""}>{children}</DashboardLayout>
    </TeamProvider>
  );
}
