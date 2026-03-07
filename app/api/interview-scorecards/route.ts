import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/interview-scorecards
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    /* ── save_draft ──────────────────────────────────────────────── */
    if (action === "save_draft" || action === "submit") {
      const sc = payload?.scorecard ?? payload;
      if (
        !sc?.interview_id ||
        !sc?.interviewer_user_id ||
        !sc?.candidate_id ||
        !sc?.team_id
      ) {
        return NextResponse.json(
          {
            error:
              "interview_id, interviewer_user_id, candidate_id, and team_id are required",
          },
          { status: 400 }
        );
      }

      // Compute category_scores and overall_score from answers
      const answers: Array<{
        question_id: string;
        question_text: string;
        category: string;
        score: number | null;
        notes: string;
      }> = sc.answers ?? [];

      const categoryTotals: Record<string, { sum: number; count: number }> =
        {};
      let totalScore = 0;
      let scoredCount = 0;

      for (const a of answers) {
        if (a.score != null && a.score > 0) {
          totalScore += a.score;
          scoredCount++;
          if (!categoryTotals[a.category]) {
            categoryTotals[a.category] = { sum: 0, count: 0 };
          }
          categoryTotals[a.category].sum += a.score;
          categoryTotals[a.category].count++;
        }
      }

      const categoryScores: Record<string, number> = {};
      for (const [cat, { sum, count }] of Object.entries(categoryTotals)) {
        categoryScores[cat] = Math.round((sum / count) * 100) / 100;
      }

      const overallScore =
        scoredCount > 0
          ? Math.round((totalScore / scoredCount) * 100) / 100
          : null;

      const upsertData = {
        interview_id: sc.interview_id,
        interviewer_user_id: sc.interviewer_user_id,
        candidate_id: sc.candidate_id,
        team_id: sc.team_id,
        answers,
        category_scores: categoryScores,
        overall_score: overallScore,
        recommendation: sc.recommendation ?? null,
        summary_notes: sc.summary_notes ?? null,
        ...(action === "submit" ? { submitted_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("interview_scorecards")
        .upsert(upsertData, {
          onConflict: "interview_id,interviewer_user_id",
        })
        .select("*, evaluator:users!interview_scorecards_interviewer_user_id_fkey(name)")
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      // If submitting, update candidate.interview_score with average across all submitted scorecards
      if (action === "submit") {
        const { data: allCards } = await supabase
          .from("interview_scorecards")
          .select("overall_score")
          .eq("candidate_id", sc.candidate_id)
          .not("submitted_at", "is", null)
          .not("overall_score", "is", null);

        if (allCards && allCards.length > 0) {
          const avg =
            allCards.reduce(
              (sum, c) => sum + (c.overall_score ?? 0),
              0
            ) / allCards.length;
          const rounded = Math.round(avg * 100) / 100;

          await supabase
            .from("candidates")
            .update({ interview_score: rounded })
            .eq("id", sc.candidate_id);
        }
      }

      return NextResponse.json({ data });
    }

    /* ── get ──────────────────────────────────────────────────────── */
    if (action === "get") {
      const { interview_id, interviewer_user_id } = payload ?? {};
      if (!interview_id || !interviewer_user_id) {
        return NextResponse.json(
          {
            error: "interview_id and interviewer_user_id are required",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("interview_scorecards")
        .select("*, evaluator:users!interview_scorecards_interviewer_user_id_fkey(name)")
        .eq("interview_id", interview_id)
        .eq("interviewer_user_id", interviewer_user_id)
        .maybeSingle();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data });
    }

    /* ── save_guide_note ────────────────────────────────────────── */
    if (action === "save_guide_note") {
      const { candidate_id, question_id, team_id, author_user_id, note_text } =
        payload ?? {};
      if (!candidate_id || !question_id || !team_id || !author_user_id) {
        return NextResponse.json(
          {
            error:
              "candidate_id, question_id, team_id, and author_user_id are required",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("interview_guide_notes")
        .upsert(
          {
            candidate_id,
            question_id,
            team_id,
            author_user_id,
            note_text: note_text ?? "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "candidate_id,question_id,author_user_id" }
        )
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    /* ── get_guide_notes ───────────────────────────────────────── */
    if (action === "get_guide_notes") {
      const { candidate_id, author_user_id } = payload ?? {};
      if (!candidate_id) {
        return NextResponse.json(
          { error: "candidate_id is required" },
          { status: 400 }
        );
      }

      let query = supabase
        .from("interview_guide_notes")
        .select("*")
        .eq("candidate_id", candidate_id);

      if (author_user_id) {
        query = query.eq("author_user_id", author_user_id);
      }

      const { data, error } = await query;
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data ?? [] });
    }

    /* ── get_comparison ──────────────────────────────────────────── */
    if (action === "get_comparison") {
      const { candidate_id } = payload ?? {};
      if (!candidate_id) {
        return NextResponse.json(
          { error: "candidate_id is required" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("interview_scorecards")
        .select("*, evaluator:users!interview_scorecards_interviewer_user_id_fkey(name, scorecard_visibility)")
        .eq("candidate_id", candidate_id)
        .order("created_at");

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ data: data ?? [] });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("interview-scorecards API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
