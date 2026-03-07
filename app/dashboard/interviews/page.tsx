import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import InterviewsDashboard from "./interviews-dashboard";
import type {
  Interview,
  TeamUser,
  Team,
} from "@/lib/types";

export default async function InterviewsPage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user to resolve current user ID
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

  const [
    interviewsResult,
    usersResult,
    teamResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from("interviews")
      .select(
        "*, candidate:candidates(first_name, last_name, role_applied, stage)"
      )
      .eq("team_id", TEAM_ID)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("users")
      .select("id, team_id, name, email, role, from_email, google_booking_url")
      .eq("team_id", TEAM_ID),
    supabase.from("teams").select("*").eq("id", TEAM_ID).single(),
    authUser?.email
      ? supabase
          .from("users")
          .select("id")
          .eq("team_id", TEAM_ID)
          .eq("email", authUser.email)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const interviews: Interview[] = interviewsResult.data ?? [];
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const team: Team | null = (teamResult.data as Team) ?? null;
  const currentUserId: string = profileResult.data?.id ?? "";

  return (
    <InterviewsDashboard
      interviews={interviews}
      leaders={leaders}
      teamId={TEAM_ID}
      team={team}
      currentUserId={currentUserId}
    />
  );
}
