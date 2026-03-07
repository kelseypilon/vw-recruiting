import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/notes
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Resolve author: use provided author_id or fall back to the authenticated user
    let resolvedAuthorId = author_id;
    if (!resolvedAuthorId) {
      const { data: authProfile } = await supabase
        .from("users")
        .select("id")
        .eq("team_id", TEAM_ID)
        .eq("email", auth.email)
        .single();
      resolvedAuthorId = authProfile?.id ?? null;
    }

    if (!resolvedAuthorId) {
      return NextResponse.json(
        { error: "Could not resolve author. Please provide author_id." },
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
