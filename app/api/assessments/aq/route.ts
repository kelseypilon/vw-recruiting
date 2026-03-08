import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCompositeScore } from "@/lib/scoring";

/**
 * POST /api/assessments/aq
 *
 * Public endpoint — saves AQ (Adversity Quotient / CORE) assessment.
 * Scores are calculated server-side — never trust client math.
 *
 * Questions 1-5   → C (Commitment)
 * Questions 6-10  → O (Ownership)
 * Questions 11-15 → R (Reach)
 * Questions 16-20 → E (Endurance)
 *
 * total = (C + O + R + E) × 2  (max 200, displayed as /100)
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

    // Calculate CORE scores server-side
    const r = responses;
    const score_c = Number(r.q1) + Number(r.q2) + Number(r.q3) + Number(r.q4) + Number(r.q5);
    const score_o = Number(r.q6) + Number(r.q7) + Number(r.q8) + Number(r.q9) + Number(r.q10);
    const score_r = Number(r.q11) + Number(r.q12) + Number(r.q13) + Number(r.q14) + Number(r.q15);
    const score_e = Number(r.q16) + Number(r.q17) + Number(r.q18) + Number(r.q19) + Number(r.q20);
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
