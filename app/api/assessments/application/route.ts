import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/assessments/application
 *
 * Public endpoint — saves an application form submission.
 * Also updates the candidate record with key fields.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      candidate_id,
      team_id,
      full_name,
      email,
      phone,
      city,
      current_role,
      years_experience,
      why_real_estate,
      why_vantage,
      biggest_achievement,
      one_year_goal,
      hours_per_week,
      has_license,
      license_number,
      referral_source,
    } = body;

    if (!candidate_id || !team_id) {
      return NextResponse.json(
        { error: "candidate_id and team_id are required" },
        { status: 400 }
      );
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
      .from("application_submissions")
      .select("id")
      .eq("candidate_id", candidate_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Application already submitted" },
        { status: 409 }
      );
    }

    // Insert submission
    const { error: insertErr } = await supabase
      .from("application_submissions")
      .insert({
        candidate_id,
        team_id,
        full_name,
        email,
        phone,
        city,
        current_role,
        years_experience: years_experience ? parseFloat(years_experience) : null,
        why_real_estate,
        why_vantage,
        biggest_achievement,
        one_year_goal,
        hours_per_week,
        has_license: !!has_license,
        license_number: has_license ? license_number : null,
        referral_source,
      });

    if (insertErr) {
      console.error("Application insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save application" },
        { status: 500 }
      );
    }

    // Update candidate record with key fields
    const candidateUpdate: Record<string, unknown> = {
      app_submitted_at: new Date().toISOString(),
    };

    // Split full_name into first/last
    if (full_name) {
      const parts = full_name.trim().split(/\s+/);
      candidateUpdate.first_name = parts[0];
      candidateUpdate.last_name = parts.slice(1).join(" ") || parts[0];
    }
    if (email) candidateUpdate.email = email;
    if (phone) candidateUpdate.phone = phone;
    if (current_role) candidateUpdate.current_role = current_role;
    if (years_experience) candidateUpdate.years_experience = parseFloat(years_experience);
    candidateUpdate.is_licensed = !!has_license;
    if (referral_source) candidateUpdate.heard_about = referral_source;

    const { error: updateErr } = await supabase
      .from("candidates")
      .update(candidateUpdate)
      .eq("id", candidate_id);

    if (updateErr) {
      console.error("Candidate update error:", updateErr);
      // Don't fail — submission was saved successfully
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Application API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/assessments/application?candidate_id=xxx
 *
 * Check if application already submitted for this candidate.
 */
export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  if (!candidateId) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("application_submissions")
    .select("id, submitted_at")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  return NextResponse.json({ submitted: !!data, data });
}
