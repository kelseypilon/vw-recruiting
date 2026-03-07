import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/interview-questions/my-set
 *
 * Actions:
 *   get      { user_id, team_id }
 *   toggle   { user_id, question_id, team_id, is_active }
 *   reorder  { user_id, items: [{ question_id, sort_order }] }
 *   init     { user_id, team_id } — bulk-create selections for all active questions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    /* ── get ──────────────────────────────────────────────────────── */
    if (action === "get") {
      const { user_id, team_id } = payload ?? {};
      if (!user_id || !team_id) {
        return NextResponse.json(
          { error: "user_id and team_id are required" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("interviewer_question_selections")
        .select("*, question:interview_questions(*)")
        .eq("user_id", user_id)
        .eq("team_id", team_id)
        .order("sort_order");

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data: data ?? [] });
    }

    /* ── toggle ──────────────────────────────────────────────────── */
    if (action === "toggle") {
      const { user_id, question_id, team_id, is_active } = payload ?? {};
      if (!user_id || !question_id || !team_id || is_active === undefined) {
        return NextResponse.json(
          {
            error:
              "user_id, question_id, team_id, and is_active are required",
          },
          { status: 400 }
        );
      }

      // UPSERT the selection
      const { data, error } = await supabase
        .from("interviewer_question_selections")
        .upsert(
          {
            user_id,
            question_id,
            team_id,
            is_active,
            sort_order: 0,
          },
          { onConflict: "user_id,question_id" }
        )
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    /* ── reorder ─────────────────────────────────────────────────── */
    if (action === "reorder") {
      const { user_id, items } = payload ?? {};
      if (!user_id || !Array.isArray(items)) {
        return NextResponse.json(
          { error: "user_id and items array are required" },
          { status: 400 }
        );
      }

      for (const item of items) {
        await supabase
          .from("interviewer_question_selections")
          .update({ sort_order: item.sort_order })
          .eq("user_id", user_id)
          .eq("question_id", item.question_id);
      }

      return NextResponse.json({ success: true });
    }

    /* ── init ────────────────────────────────────────────────────── */
    if (action === "init") {
      const { user_id, team_id } = payload ?? {};
      if (!user_id || !team_id) {
        return NextResponse.json(
          { error: "user_id and team_id are required" },
          { status: 400 }
        );
      }

      // Check if user already has selections
      const { count } = await supabase
        .from("interviewer_question_selections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user_id)
        .eq("team_id", team_id);

      if (count && count > 0) {
        return NextResponse.json({
          data: [],
          message: "Already initialized",
        });
      }

      // Get all active team questions (shared)
      const { data: questions } = await supabase
        .from("interview_questions")
        .select("id, order_index")
        .eq("team_id", team_id)
        .eq("is_active", true)
        .is("user_id", null)
        .order("order_index");

      if (!questions || questions.length === 0) {
        return NextResponse.json({ data: [], message: "No questions found" });
      }

      const selections = questions.map((q, idx) => ({
        user_id,
        question_id: q.id,
        team_id,
        is_active: true,
        sort_order: idx,
      }));

      const { data, error } = await supabase
        .from("interviewer_question_selections")
        .insert(selections)
        .select();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("my-set API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
