import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/assessments/candidate?candidate_id=xxx
 *
 * Public endpoint — returns basic candidate info for the assessment page.
 * Only exposes non-sensitive fields needed for the form pre-fill.
 */
export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  if (!candidateId) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("candidates")
    .select("id, team_id, first_name, last_name, email, phone")
    .eq("id", candidateId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Fetch team branding for the candidate's team
  const { data: team } = await supabase
    .from("teams")
    .select("name, brand_name, brand_logo_url, brand_primary_color, brand_secondary_color, branding_mode, brand_show_powered_by")
    .eq("id", data.team_id)
    .single();

  return NextResponse.json({ data, team: team ?? null });
}
