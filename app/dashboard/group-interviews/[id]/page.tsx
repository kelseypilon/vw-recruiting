import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import SessionDetail from "./session-detail";
import type { TeamUser, GroupInterviewPrompt } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GroupInterviewSessionPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

  // Get authenticated user to resolve current user ID
  const authClient = await createClient();
  const {
    data: { user: authUser },
  } = await authClient.auth.getUser();

  const [sessionResult, usersResult, profileResult, promptsResult, teamResult] = await Promise.all([
    // Fetch session + candidates + notes via API-style query
    (async () => {
      const { data: session, error: sessErr } = await supabase
        .from("group_interview_sessions")
        .select(
          "*, creator:users!group_interview_sessions_created_by_fkey(name)"
        )
        .eq("id", id)
        .eq("team_id", TEAM_ID)
        .single();

      if (sessErr || !session) return { data: null };

      // Get linked candidates (expanded fields for quick-view)
      const { data: links } = await supabase
        .from("group_interview_candidates")
        .select(
          "candidate_id, candidate:candidates(id, first_name, last_name, stage, role_applied, email, phone, current_brokerage, years_experience, is_licensed)"
        )
        .eq("session_id", id);

      const candidates = (links ?? []).map(
        (l) => (l as unknown as { candidate: unknown }).candidate
      );

      // Get notes
      const { data: notes } = await supabase
        .from("group_interview_notes")
        .select("*, author:users(name)")
        .eq("session_id", id)
        .order("updated_at", { ascending: false });

      return {
        data: { ...session, candidates, notes: notes ?? [] },
      };
    })(),
    supabase
      .from("users")
      .select("id, team_id, name, email, role, from_email")
      .eq("team_id", TEAM_ID),
    authUser?.email
      ? supabase
          .from("users")
          .select("id, name")
          .eq("team_id", TEAM_ID)
          .eq("email", authUser.email)
          .single()
      : Promise.resolve({ data: null }),
    // Fetch active group interview prompts
    supabase
      .from("group_interview_prompts")
      .select("*")
      .eq("team_id", TEAM_ID)
      .eq("is_active", true)
      .order("order_index"),
    // Fetch team data for guidelines
    supabase
      .from("teams")
      .select("id, settings")
      .eq("id", TEAM_ID)
      .single(),
  ]);

  if (!sessionResult.data) {
    notFound();
  }

  const session = sessionResult.data;
  const leaders: TeamUser[] = (usersResult.data ?? []) as TeamUser[];
  const currentUserId: string = profileResult.data?.id ?? "";
  const currentUserName: string =
    (profileResult.data as { id: string; name: string } | null)?.name ?? "";
  const prompts: GroupInterviewPrompt[] =
    (promptsResult.data as GroupInterviewPrompt[]) ?? [];
  const guidelines: string[] =
    ((teamResult.data?.settings as Record<string, unknown>)?.group_interview_guidelines as string[]) ?? [];

  return (
    <SessionDetail
      session={session}
      leaders={leaders}
      teamId={TEAM_ID}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      prompts={prompts}
      guidelines={guidelines}
    />
  );
}
