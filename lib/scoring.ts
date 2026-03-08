import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Composite score = weighted average of available assessment components.
 *
 *  Component         Weight   Range   Normalized to 0-100
 *  ─────────────────────────────────────────────────────────
 *  AQ (normalized)    30%     0-100   already 0-100
 *  DISC (coverage)    20%     0-28    (max / 28) × 100
 *  Interview avg      50%     0-10    (score / 10) × 100
 *
 * Only components that have data are included; weights are redistributed
 * proportionally so the total always sums to 100%.
 *
 * Verdict thresholds:
 *   80+  → Strong Hire
 *   65+  → Hire
 *   50+  → Consider
 *   35+  → Hold
 *   <35  → Pass
 */

const WEIGHTS = {
  aq: 30,
  disc: 20,
  interview: 50,
} as const;

function deriveVerdict(score: number): string {
  if (score >= 80) return "Strong Hire";
  if (score >= 65) return "Hire";
  if (score >= 50) return "Consider";
  if (score >= 35) return "Hold";
  return "Pass";
}

/**
 * Recalculate composite_score and composite_verdict for a candidate,
 * then write them to the candidates table.
 *
 * Call this after any assessment or interview scorecard submission.
 */
export async function calculateCompositeScore(candidateId: string): Promise<{
  composite_score: number | null;
  composite_verdict: string | null;
}> {
  const supabase = createAdminClient();

  // Fetch candidate's current assessment data
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("aq_normalized, disc_d, disc_i, disc_s, disc_c, interview_score")
    .eq("id", candidateId)
    .single();

  if (error || !candidate) {
    console.error("calculateCompositeScore: candidate not found", candidateId);
    return { composite_score: null, composite_verdict: null };
  }

  // Build available components
  const components: { key: string; normalizedScore: number; weight: number }[] = [];

  // AQ — already 0-100
  if (candidate.aq_normalized !== null && candidate.aq_normalized !== undefined) {
    components.push({
      key: "aq",
      normalizedScore: candidate.aq_normalized,
      weight: WEIGHTS.aq,
    });
  }

  // DISC — use highest score out of 28 as a proxy for profile strength
  const discScores = [candidate.disc_d, candidate.disc_i, candidate.disc_s, candidate.disc_c];
  const hasDisc = discScores.some((s) => s !== null && s !== undefined);
  if (hasDisc) {
    const maxDisc = Math.max(...discScores.filter((s): s is number => s !== null && s !== undefined));
    // Normalize: max possible per letter is 28 (if every group picked same letter)
    const discNormalized = Math.min((maxDisc / 28) * 100, 100);
    components.push({
      key: "disc",
      normalizedScore: discNormalized,
      weight: WEIGHTS.disc,
    });
  }

  // Interview — 0-10 scale → 0-100
  if (candidate.interview_score !== null && candidate.interview_score !== undefined) {
    components.push({
      key: "interview",
      normalizedScore: Math.min((candidate.interview_score / 10) * 100, 100),
      weight: WEIGHTS.interview,
    });
  }

  // If no components available, clear composite
  if (components.length === 0) {
    await supabase
      .from("candidates")
      .update({ composite_score: null, composite_verdict: null })
      .eq("id", candidateId);
    return { composite_score: null, composite_verdict: null };
  }

  // Redistribute weights proportionally
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce(
    (sum, c) => sum + c.normalizedScore * (c.weight / totalWeight),
    0
  );

  const composite_score = Math.round(weightedSum * 10) / 10; // 1 decimal
  const composite_verdict = deriveVerdict(composite_score);

  // Write to DB
  const { error: updateErr } = await supabase
    .from("candidates")
    .update({ composite_score, composite_verdict })
    .eq("id", candidateId);

  if (updateErr) {
    console.error("calculateCompositeScore: update failed", updateErr);
  }

  return { composite_score, composite_verdict };
}
