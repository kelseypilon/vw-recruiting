import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/interviews
 *
 * A unified API for interview operations using the admin client (bypasses RLS).
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    /* ── create_interview ──────────────────────────────────────── */
    if (action === "create_interview") {
      const { team_id, candidate_id, interview_type, status, scheduled_at, notes, interviewer_ids } = payload ?? {};
      if (!team_id || !candidate_id || !interview_type) {
        return NextResponse.json(
          { error: "team_id, candidate_id, and interview_type are required" },
          { status: 400 }
        );
      }

      const { data: created, error: insertErr } = await supabase
        .from("interviews")
        .insert({
          team_id,
          candidate_id,
          interview_type,
          status: status ?? "scheduled",
          scheduled_at: scheduled_at || null,
          notes: notes || null,
        })
        .select("*, candidate:candidates(first_name, last_name, role_applied, stage)")
        .single();

      if (insertErr || !created) {
        return NextResponse.json(
          { error: insertErr?.message ?? "Failed to create interview" },
          { status: 500 }
        );
      }

      // Insert interviewers if provided
      if (Array.isArray(interviewer_ids) && interviewer_ids.length > 0) {
        await supabase.from("interview_interviewers").insert(
          interviewer_ids.map((uid: string) => ({
            interview_id: created.id,
            user_id: uid,
          }))
        );
      }

      return NextResponse.json({ data: created });
    }

    /* ── update_interview ──────────────────────────────────────── */
    if (action === "update_interview") {
      const { id, ...updates } = payload ?? {};
      if (!id) {
        return NextResponse.json(
          { error: "payload.id is required" },
          { status: 400 }
        );
      }

      const allowed = ["status", "scheduled_at", "notes", "interview_type"];
      const updateData: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in updates) updateData[key] = updates[key];
      }

      const { data, error } = await supabase
        .from("interviews")
        .update(updateData)
        .eq("id", id)
        .select("*, candidate:candidates(first_name, last_name, role_applied, stage)")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
