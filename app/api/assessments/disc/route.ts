import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCompositeScore } from "@/lib/scoring";

const PROFILE_LABELS: Record<string, string> = {
  D: "Dominant",
  I: "Influential",
  S: "Steady",
  C: "Conscientious",
};

/**
 * POST /api/assessments/disc
 *
 * Public endpoint — saves DISC assessment.
 * 28 word groups, each response maps to D/I/S/C.
 * We score by counting how many times each letter was picked as "most".
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

    // Validate all 28 MOST responses present and valid (D, I, S, or C)
    const validLetters = new Set(["D", "I", "S", "C"]);
    const hasLeast = responses.g1_least !== undefined;
    for (let i = 1; i <= 28; i++) {
      const key = `g${i}`;
      const val = responses[key];
      if (!val || !validLetters.has(val)) {
        return NextResponse.json(
          { error: `Missing or invalid MOST answer for group ${i}: must be D, I, S, or C` },
          { status: 400 }
        );
      }
      // Validate LEAST if present (required when any LEAST answer exists)
      const leastVal = responses[`${key}_least`];
      if (hasLeast) {
        if (!leastVal || !validLetters.has(leastVal)) {
          return NextResponse.json(
            { error: `Missing or invalid LEAST answer for group ${i}: must be D, I, S, or C` },
            { status: 400 }
          );
        }
        if (leastVal === val) {
          return NextResponse.json(
            { error: `Group ${i}: MOST and LEAST cannot be the same word` },
            { status: 400 }
          );
        }
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
      .from("disc_submissions")
      .select("id")
      .eq("candidate_id", candidate_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "DISC assessment already submitted" },
        { status: 409 }
      );
    }

    // Calculate scores: MOST adds +1, LEAST subtracts 1
    let score_d = 0;
    let score_i = 0;
    let score_s = 0;
    let score_c = 0;

    for (let i = 1; i <= 28; i++) {
      // MOST: +1
      const mostLetter = responses[`g${i}`];
      if (mostLetter === "D") score_d++;
      else if (mostLetter === "I") score_i++;
      else if (mostLetter === "S") score_s++;
      else if (mostLetter === "C") score_c++;

      // LEAST: -1 (if provided)
      const leastLetter = responses[`g${i}_least`];
      if (leastLetter === "D") score_d--;
      else if (leastLetter === "I") score_i--;
      else if (leastLetter === "S") score_s--;
      else if (leastLetter === "C") score_c--;
    }

    // Determine primary and secondary profiles
    const scores = [
      { letter: "D", score: score_d },
      { letter: "I", score: score_i },
      { letter: "S", score: score_s },
      { letter: "C", score: score_c },
    ].sort((a, b) => b.score - a.score);

    const primary_profile = scores[0].letter;
    const secondary_profile = scores[1].letter;
    const profile_label = PROFILE_LABELS[primary_profile] ?? primary_profile;

    // Insert submission
    const { error: insertErr } = await supabase
      .from("disc_submissions")
      .insert({
        candidate_id,
        team_id,
        raw_responses: responses,
        score_d,
        score_i,
        score_s,
        score_c,
        primary_profile,
        secondary_profile,
        profile_label,
      });

    if (insertErr) {
      console.error("DISC insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save DISC assessment" },
        { status: 500 }
      );
    }

    // Update candidate record
    const { error: updateErr } = await supabase
      .from("candidates")
      .update({
        disc_d: score_d,
        disc_i: score_i,
        disc_s: score_s,
        disc_c: score_c,
        disc_primary: primary_profile,
        disc_secondary: secondary_profile,
        disc_profile_label: profile_label,
      })
      .eq("id", candidate_id);

    if (updateErr) {
      console.error("Candidate DISC update error:", updateErr);
    }

    // Recalculate composite score now that DISC data is available
    await calculateCompositeScore(candidate_id);

    // ─── Auto-move to "Application Received" if all assessments complete ───
    // DISC is the last assessment. Check if application + AQ are also done.
    const { data: cand, error: candFetchErr } = await supabase
      .from("candidates")
      .select("stage, app_submitted_at, aq_total")
      .eq("id", candidate_id)
      .single();

    if (candFetchErr) {
      console.error("Pipeline auto-move: failed to fetch candidate stage:", candFetchErr);
    }

    if (cand?.app_submitted_at && cand.aq_total != null) {
      // All 3 assessments done — look up "Application Received" stage by ghl_tag
      const { data: appSentStage, error: stageLookupErr } = await supabase
        .from("pipeline_stages")
        .select("name, order_index")
        .eq("team_id", team_id)
        .eq("ghl_tag", "vw_app_sent")
        .eq("is_active", true)
        .maybeSingle();

      if (stageLookupErr) {
        console.error("Pipeline auto-move: failed to look up vw_app_sent stage:", stageLookupErr);
      }

      if (appSentStage) {
        // Edge case: only move forward — don't move candidates backward if they're
        // already past "Application Received" (e.g. already in interview stages)
        const { data: currentStage } = await supabase
          .from("pipeline_stages")
          .select("order_index")
          .eq("team_id", team_id)
          .eq("name", cand.stage)
          .eq("is_active", true)
          .maybeSingle();

        const currentIndex = currentStage?.order_index ?? -1;
        const targetIndex = appSentStage.order_index ?? 999;

        if (currentIndex < targetIndex) {
          const previousStage = cand.stage;
          const now = new Date().toISOString();

          const { error: stageUpdateErr } = await supabase
            .from("candidates")
            .update({ stage: appSentStage.name, stage_entered_at: now })
            .eq("id", candidate_id);

          if (stageUpdateErr) {
            console.error("Pipeline auto-move: failed to update candidate stage:", stageUpdateErr);
          }

          const { error: historyErr } = await supabase.from("stage_history").insert({
            candidate_id,
            team_id,
            old_stage: previousStage,
            new_stage: appSentStage.name,
            changed_by: null, // system-triggered
          });

          if (historyErr) {
            console.error("Pipeline auto-move: failed to insert stage_history:", historyErr);
          }

          console.log(`Pipeline auto-move: candidate ${candidate_id} moved from "${previousStage}" to "${appSentStage.name}"`);
        } else {
          console.log(`Pipeline auto-move: skipped — candidate ${candidate_id} already at "${cand.stage}" (index ${currentIndex}) which is >= target "${appSentStage.name}" (index ${targetIndex})`);
        }
      } else {
        console.warn(`Pipeline auto-move: vw_app_sent stage not found for team ${team_id}`);
      }
    } else {
      console.log(`Pipeline auto-move: skipped — not all assessments complete for candidate ${candidate_id} (app: ${!!cand?.app_submitted_at}, aq: ${cand?.aq_total != null})`);
    }

    return NextResponse.json({
      success: true,
      scores: {
        score_d,
        score_i,
        score_s,
        score_c,
        primary_profile,
        secondary_profile,
        profile_label,
      },
    });
  } catch (err) {
    console.error("DISC API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/assessments/disc?candidate_id=xxx
 */
export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  if (!candidateId) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("disc_submissions")
    .select("id, submitted_at, score_d, score_i, score_s, score_c, primary_profile, profile_label")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  return NextResponse.json({ submitted: !!data, data });
}
