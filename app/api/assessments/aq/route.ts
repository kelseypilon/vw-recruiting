import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCompositeScore } from "@/lib/scoring";
import { CORE_DIMENSION_QUESTIONS } from "@/lib/aq-questions";

/**
 * POST /api/assessments/aq
 *
 * Public endpoint — saves AQ (Adversity Response Profile) assessment.
 * Uses Stoltz CORE dimensions with the correct question mapping:
 *
 *   C (Control)    → q1, q7, q13, q15, q17
 *   O (Ownership)  → q2, q6, q11, q16, q18
 *   R (Reach)      → q3, q5, q9,  q12, q20
 *   E (Endurance)  → q4, q8, q10, q14, q19
 *
 * ARP Score = (C + O + R + E) × 2  →  range 40–200
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, team_id, responses } = body;

    if (!candidate_id || !team_id) {
      return NextResponse.json(
        { error: "candidate_id and team_id are required" },
        { status: 400 }
      );
    }

    if (!responses || typeof responses !== "object") {
      return NextResponse.json(
        { error: "responses object is required" },
        { status: 400 }
      );
    }

    // Validate all 20 responses present and in range 1-5
    for (let i = 1; i <= 20; i++) {
      const key = `q${i}`;
      const val = responses[key];
      if (val === undefined || val === null) {
        return NextResponse.json(
          { error: `Missing answer for question ${i}` },
          { status: 400 }
        );
      }
      const num = Number(val);
      if (!Number.isInteger(num) || num < 1 || num > 5) {
        return NextResponse.json(
          { error: `Invalid answer for question ${i}: must be 1-5` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // Verify candidate exists
    const { data: candidate, error: candErr } = await supabase
      .from("candidates")
      .select("id")
      .eq("id", candidate_id)
      .eq("team_id", team_id)
      .single();

    if (candErr || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // Check for existing submission
    const { data: existing } = await supabase
      .from("aq_submissions")
      .select("id")
      .eq("candidate_id", candidate_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "AQ assessment already submitted" },
        { status: 409 }
      );
    }

    // Calculate CORE scores using correct Stoltz dimension mapping
    const r = responses;
    const sumQuestions = (qIds: string[]) =>
      qIds.reduce((sum, qId) => sum + Number(r[qId]), 0);

    const score_c = sumQuestions(CORE_DIMENSION_QUESTIONS.C);
    const score_o = sumQuestions(CORE_DIMENSION_QUESTIONS.O);
    const score_r = sumQuestions(CORE_DIMENSION_QUESTIONS.R);
    const score_e = sumQuestions(CORE_DIMENSION_QUESTIONS.E);
    const total_score = (score_c + score_o + score_r + score_e) * 2;

    // Derive normalized score (0-100) and tier
    const aq_normalized = Math.round((total_score / 200) * 100);
    let aq_tier: string;
    if (aq_normalized >= 80) aq_tier = "Very High";
    else if (aq_normalized >= 60) aq_tier = "High";
    else if (aq_normalized >= 40) aq_tier = "Moderate";
    else aq_tier = "Low";

    // Insert submission
    const { error: insertErr } = await supabase.from("aq_submissions").insert({
      candidate_id,
      team_id,
      responses,
      score_c,
      score_o,
      score_r,
      score_e,
      total_score,
    });

    if (insertErr) {
      console.error("AQ insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save AQ assessment" },
        { status: 500 }
      );
    }

    // Update candidate record with scores + normalized + tier
    const { error: updateErr } = await supabase
      .from("candidates")
      .update({
        aq_total: total_score,
        aq_raw: total_score,
        aq_normalized,
        aq_tier,
        aq_score_c: score_c,
        aq_score_o: score_o,
        aq_score_r: score_r,
        aq_score_e: score_e,
      })
      .eq("id", candidate_id);

    if (updateErr) {
      console.error("Candidate AQ update error:", updateErr);
    }

    // Recalculate composite score now that AQ data is available
    await calculateCompositeScore(candidate_id);

    return NextResponse.json({
      success: true,
      scores: { score_c, score_o, score_r, score_e, total_score, aq_normalized, aq_tier },
    });
  } catch (err) {
    console.error("AQ API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/assessments/aq?candidate_id=xxx
 */
export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  if (!candidateId) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("aq_submissions")
    .select("id, submitted_at, score_c, score_o, score_r, score_e, total_score")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  return NextResponse.json({ submitted: !!data, data });
}
