import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/interview-questions
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    /* ── list ────────────────────────────────────────────────────── */
    if (action === "list") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }

      // Get questions with usage counts
      const { data: questions, error } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("team_id", payload.team_id)
        .order("order_index");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Get usage counts (how many interviewers have each question active)
      const questionIds = (questions ?? []).map((q) => q.id);
      let usageCounts: Record<string, { count: number; users: string[] }> = {};

      if (questionIds.length > 0) {
        const { data: selections } = await supabase
          .from("interviewer_question_selections")
          .select("question_id, user_id, users:users(name)")
          .in("question_id", questionIds)
          .eq("is_active", true);

        if (selections) {
          for (const sel of selections) {
            const qid = sel.question_id;
            if (!usageCounts[qid]) usageCounts[qid] = { count: 0, users: [] };
            usageCounts[qid].count++;
            const userName =
              (sel as unknown as { users: { name: string } | null })?.users?.name;
            if (userName) usageCounts[qid].users.push(userName);
          }
        }
      }

      return NextResponse.json({
        data: questions,
        usage: usageCounts,
      });
    }

    /* ── create ──────────────────────────────────────────────────── */
    if (action === "create") {
      const { team_id, question_text, category, user_id, interviewer_note } =
        payload ?? {};
      if (!team_id || !question_text || !category) {
        return NextResponse.json(
          { error: "team_id, question_text, and category are required" },
          { status: 400 }
        );
      }

      // Get max order_index for this team
      const { data: maxRow } = await supabase
        .from("interview_questions")
        .select("order_index")
        .eq("team_id", team_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxRow?.order_index ?? 0) + 1;

      const { data, error } = await supabase
        .from("interview_questions")
        .insert({
          team_id,
          question_text,
          category,
          user_id: user_id || null,
          interviewer_note: interviewer_note || null,
          sort_order: 0,
          order_index: nextOrder,
          is_active: true,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    /* ── update ──────────────────────────────────────────────────── */
    if (action === "update") {
      const { id, ...fields } = payload ?? {};
      if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }

      const allowedFields = [
        "question_text",
        "category",
        "interviewer_note",
        "is_active",
        "sort_order",
        "order_index",
      ];
      const updateData: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in fields) updateData[key] = fields[key];
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("interview_questions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    /* ── reorder ─────────────────────────────────────────────────── */
    if (action === "reorder") {
      const { items } = payload ?? {};
      if (!Array.isArray(items)) {
        return NextResponse.json(
          { error: "items array is required" },
          { status: 400 }
        );
      }

      for (const item of items) {
        const updateData: Record<string, unknown> = {};
        if ("sort_order" in item) updateData.sort_order = item.sort_order;
        if ("order_index" in item) updateData.order_index = item.order_index;

        await supabase
          .from("interview_questions")
          .update(updateData)
          .eq("id", item.id);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("interview-questions API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
