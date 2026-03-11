import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import SessionDetail from "./session-detail";
import type { TeamUser, GroupInterviewPrompt, GroupInterviewNote } from "@/lib/types";

// Ensure this page is never served from cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Shape returned by the candidates query */
interface SessionCandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  role_applied: string | null;
  email: string | null;
  phone: string | null;
  current_brokerage: string | null;
  years_experience: number | null;
  is_licensed: boolean | null;
  disc_primary: string | null;
  disc_secondary: string | null;
  aq_normalized: number | null;
  aq_tier: string | null;
}

// Use select("*") so the query doesn't fail if a migration hasn't been applied
// (e.g. current_brokerage added in 20260304000001). The TypeScript interface
// still constrains what the component receives; missing columns → undefined.

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

  // ── 1. Fetch the session row ──────────────────────────────────
  const { data: sessionRow, error: sessErr } = await supabase
    .from("group_interview_sessions")
    .select("*, creator:users!group_interview_sessions_created_by_fkey(name)")
    .eq("id", id)
    .eq("team_id", TEAM_ID)
    .single();

  if (sessErr || !sessionRow) {
    console.error("[GI page] session fetch failed:", sessErr?.message ?? "no data");
    notFound();
  }

  // ── 2. Parallel fetches for candidates, notes, users, prompts, team ──
  const [linksResult, notesResult, usersResult, profileResult, promptsResult, teamResult] =
    await Promise.all([
      supabase
        .from("group_interview_candidates")
        .select("candidate_id")
        .eq("session_id", id),
      supabase
        .from("group_interview_notes")
        .select("*, author:users(name)")
        .eq("session_id", id)
        .order("updated_at", { ascending: false }),
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
      supabase
        .from("group_interview_prompts")
        .select("*")
        .eq("team_id", TEAM_ID)
        .eq("is_active", true)
        .order("order_index"),
      supabase
        .from("teams")
        .select("id, settings")
        .eq("id", TEAM_ID)
        .single(),
    ]);

  // ── 3. Fetch full candidate rows from linked IDs ──────────────
  if (linksResult.error) {
    console.error("[GI page] junction query error:", linksResult.error.message);
  }

  const candidateIds: string[] = (linksResult.data ?? [])
    .map((l) => l.candidate_id)
    .filter(Boolean);

  let candidates: SessionCandidateRow[] = [];
  if (candidateIds.length > 0) {
    const { data: candidateRows, error: candErr } = await supabase
      .from("candidates")
      .select("*")
      .in("id", candidateIds);

    if (candErr) {
      console.error("[GI page] candidate fetch error:", candErr.message);
    }
    candidates = (candidateRows ?? []) as SessionCandidateRow[];
  }

  // ── 4. Assemble the session object explicitly ─────────────────
  const session = {
    id: sessionRow.id as string,
    team_id: sessionRow.team_id as string,
    title: sessionRow.title as string,
    session_date: (sessionRow.session_date as string | null) ?? null,
    zoom_link: (sessionRow.zoom_link as string | null) ?? null,
    summary: (sessionRow.summary as string | null) ?? null,
    general_notes: (sessionRow.general_notes as string | null) ?? null,
    status: (sessionRow.status as string | undefined) ?? undefined,
    created_by: (sessionRow.created_by as string | null) ?? null,
    created_at: sessionRow.created_at as string,
    creator: sessionRow.creator as { name: string } | undefined,
    candidates,
    notes: (notesResult.data ?? []) as (GroupInterviewNote & { author?: { name: string } })[],
  };

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
