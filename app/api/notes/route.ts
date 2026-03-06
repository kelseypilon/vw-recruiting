import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";

/**
 * POST /api/notes
 *
 * Save a candidate note using admin client (bypasses RLS).
 *
 * Body: { candidate_id, note_text, author_id? }
 *   - If author_id is omitted, falls back to the first team user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, note_text, author_id } = body;

    if (!candidate_id || !note_text?.trim()) {
      return NextResponse.json(
        { error: "candidate_id and note_text are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const TEAM_ID = await getTeamId();

    // Resolve author: use provided author_id or fall back to first team user
    let resolvedAuthorId = author_id;
    if (!resolvedAuthorId) {
      const { data: teamUsers } = await supabase
        .from("users")
        .select("id")
        .eq("team_id", TEAM_ID)
        .limit(1)
        .single();
      resolvedAuthorId = teamUsers?.id ?? null;
    }

    if (!resolvedAuthorId) {
      return NextResponse.json(
        { error: "No team users found to attribute the note" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("candidate_notes")
      .insert({
        candidate_id,
        author_id: resolvedAuthorId,
        note_text: note_text.trim(),
      })
      .select("*, author:users(name, email)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
