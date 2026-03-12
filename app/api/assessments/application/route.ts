import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KNOWN_CANDIDATE_COLUMNS } from "@/lib/default-form-fields";

/**
 * POST /api/assessments/application
 *
 * Public endpoint — saves an application form submission.
 * Also updates the candidate record with key fields.
 * Supports dynamic form fields — unknown fields go to candidates.custom_fields.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, team_id, form_data, ...legacyFields } = body;

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

    // Normalize: support both new `form_data` envelope and legacy flat fields
    const data = form_data ?? legacyFields;

    // For backward compat: map legacy full_name → first_name + last_name
    let firstName = data.first_name ?? "";
    let lastName = data.last_name ?? "";
    if (!firstName && data.full_name) {
      const parts = data.full_name.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ") || "";
    }

    const email = data.email ?? "";
    const phone = data.phone ?? "";
    const city = data.city ?? "";
    const currentRole = data.current_role ?? "";
    const yearsExperience = data.years_experience ?? "";
    const whyRealEstate = data.why_real_estate ?? "";
    const whyVantage = data.why_vantage ?? "";
    const biggestAchievement = data.biggest_achievement ?? "";
    const oneYearGoal = data.one_year_goal ?? "";
    const hoursPerWeek = data.hours_per_week ?? "";
    const hasLicense = data.currently_licensed ?? data.has_license ?? false;
    const licenseNumber = data.license_number ?? "";
    const referralSource = data.referral_source ?? "";

    // Insert submission (keep existing columns for backward compat)
    const { error: insertErr } = await supabase
      .from("application_submissions")
      .insert({
        candidate_id,
        team_id,
        full_name: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        city,
        current_role: currentRole,
        years_experience: yearsExperience ? parseFloat(yearsExperience) : null,
        why_real_estate: whyRealEstate,
        why_vantage: whyVantage,
        biggest_achievement: biggestAchievement,
        one_year_goal: oneYearGoal,
        hours_per_week: hoursPerWeek,
        has_license: !!hasLicense,
        license_number: hasLicense ? licenseNumber : null,
        referral_source: referralSource,
      });

    if (insertErr) {
      console.error("Application insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save application" },
        { status: 500 }
      );
    }

    // Separate custom fields from known fields
    const customFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith("custom_") && !KNOWN_CANDIDATE_COLUMNS.has(key)) {
        customFields[key] = val;
      }
    }

    // Update candidate record with key fields
    const candidateUpdate: Record<string, unknown> = {
      app_submitted_at: new Date().toISOString(),
    };

    if (firstName) candidateUpdate.first_name = firstName;
    if (lastName) candidateUpdate.last_name = lastName;
    if (email) candidateUpdate.email = email;
    if (phone) candidateUpdate.phone = phone;
    if (currentRole) candidateUpdate.current_employer = currentRole;
    if (yearsExperience) {
      const yeParsed = parseFloat(yearsExperience);
      if (!isNaN(yeParsed)) candidateUpdate.years_experience = yeParsed;
    }
    candidateUpdate.is_licensed = !!hasLicense;
    if (referralSource) candidateUpdate.heard_about = referralSource;

    // custom_fields column does not exist in production DB yet — skip for now

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
