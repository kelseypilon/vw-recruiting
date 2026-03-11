import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KNOWN_CANDIDATE_COLUMNS } from "@/lib/default-form-fields";

/**
 * POST /api/assessments/public-apply
 *
 * Public endpoint — handles the first step of the generic application link.
 * Creates a new candidate (or finds existing by email) and submits the
 * application form. For returning candidates, clears old assessment
 * submissions so they can re-do assessments from scratch.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { team_id, form_data } = body;

    if (!team_id || !form_data) {
      return NextResponse.json(
        { error: "team_id and form_data are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Extract key fields from form_data
    const firstName = (form_data.first_name ?? "").trim();
    const lastName = (form_data.last_name ?? "").trim();
    const email = (form_data.email ?? "").trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    // Look up "New Lead" stage by ghl_tag
    const { data: newLeadStage } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("team_id", team_id)
      .eq("ghl_tag", "vw_new_lead")
      .eq("is_active", true)
      .maybeSingle();

    const stageName = newLeadStage?.name ?? "New Lead";

    // Check if candidate with email exists on this team
    const { data: existingCandidate } = await supabase
      .from("candidates")
      .select("id, stage")
      .eq("team_id", team_id)
      .eq("email", email)
      .maybeSingle();

    let candidateId: string;
    let previousStage: string | null = null;
    const now = new Date().toISOString();

    if (existingCandidate) {
      candidateId = existingCandidate.id;
      previousStage = existingCandidate.stage;

      // Delete old submissions so candidate can re-do assessments
      await supabase
        .from("application_submissions")
        .delete()
        .eq("candidate_id", candidateId);
      await supabase
        .from("aq_submissions")
        .delete()
        .eq("candidate_id", candidateId);
      await supabase
        .from("disc_submissions")
        .delete()
        .eq("candidate_id", candidateId);

      // Reset scores and move back to New Lead
      await supabase
        .from("candidates")
        .update({
          stage: stageName,
          stage_entered_at: now,
          aq_total: null,
          aq_raw: null,
          aq_normalized: null,
          aq_tier: null,
          aq_score_c: null,
          aq_score_o: null,
          aq_score_r: null,
          aq_score_e: null,
          disc_d: null,
          disc_i: null,
          disc_s: null,
          disc_c: null,
          disc_primary: null,
          disc_secondary: null,
          disc_profile_label: null,
          composite_score: null,
          composite_verdict: null,
          app_submitted_at: null,
        })
        .eq("id", candidateId);
    } else {
      // Create new candidate
      const { data: newCandidate, error: createErr } = await supabase
        .from("candidates")
        .insert({
          team_id,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: (form_data.phone ?? "").trim() || null,
          stage: stageName,
          stage_entered_at: now,
        })
        .select("id")
        .single();

      if (createErr || !newCandidate) {
        console.error("Public apply — create candidate error:", createErr);
        return NextResponse.json(
          { error: "Failed to create candidate" },
          { status: 500 }
        );
      }

      candidateId = newCandidate.id;
    }

    // ─── Insert application submission ───
    const phone = (form_data.phone ?? "").trim();
    const currentEmployment = form_data.current_employment ?? form_data.current_role ?? "";
    const yearsExperience = form_data.years_experience ?? "";
    const transactionsLastYear = form_data.transactions_last_year ?? "";
    // Handle both new "licensed" (select) and legacy "currently_licensed" (boolean) fields
    const licensedRaw = form_data.licensed ?? form_data.currently_licensed ?? form_data.has_license;
    const hasLicense = licensedRaw === "Yes" || licensedRaw === true;

    // Build application submission — map to existing columns where available,
    // store full form_data for complete record
    const submissionData: Record<string, unknown> = {
      candidate_id: candidateId,
      team_id,
      full_name: `${firstName} ${lastName}`.trim(),
      email,
      phone,
      current_role: currentEmployment,
      years_experience: yearsExperience ? parseFloat(yearsExperience) : null,
      has_license: hasLicense,
      // Map new text fields to existing columns when they exist
      why_real_estate: form_data.how_did_you_hear ?? form_data.why_real_estate ?? "",
      why_vantage: form_data.what_stood_out ?? form_data.why_vantage ?? "",
      biggest_achievement: form_data.why_great_addition ?? form_data.biggest_achievement ?? "",
      one_year_goal: form_data.most_important ?? form_data.one_year_goal ?? "",
      // Legacy columns — fill from form_data if present
      city: form_data.city ?? "",
      hours_per_week: form_data.hours_per_week ?? "",
      license_number: form_data.license_number ?? "",
      referral_source: form_data.referral_source ?? "",
    };

    const { error: insertErr } = await supabase
      .from("application_submissions")
      .insert(submissionData);

    if (insertErr) {
      console.error("Public apply — application insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save application" },
        { status: 500 }
      );
    }

    // ─── Update candidate record with form fields ───
    // Fields explicitly mapped to candidate columns
    const explicitlyHandled = new Set([
      "first_name", "last_name", "email", "phone",
      "current_employment", "current_role",
      "years_experience", "licensed", "currently_licensed", "has_license",
      "license_number", "referral_source", "role_interested_in",
    ]);

    // Collect everything not explicitly handled into custom_fields
    const customFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(form_data)) {
      if (!explicitlyHandled.has(key) && !KNOWN_CANDIDATE_COLUMNS.has(key)) {
        customFields[key] = val;
      }
    }
    // Store form-only fields (no candidate column) in custom_fields
    const formOnlyFields = [
      "info_night_date", "transactions_last_year",
      "how_did_you_hear", "what_stood_out", "why_great_addition",
      "most_important", "questions_answered", "additional_questions",
      "hours_per_week", "city",
    ];
    for (const key of formOnlyFields) {
      if (form_data[key] !== undefined && form_data[key] !== "") {
        customFields[key] = form_data[key];
      }
    }

    const candidateUpdate: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      email,
      app_submitted_at: now,
    };

    if (phone) candidateUpdate.phone = phone;
    if (currentEmployment) candidateUpdate.current_role = currentEmployment;
    if (yearsExperience) candidateUpdate.years_experience = parseFloat(yearsExperience);
    candidateUpdate.is_licensed = hasLicense;
    // Map role_interested_in → role_applied
    const roleInterestedIn = form_data.role_interested_in ?? "";
    if (roleInterestedIn) candidateUpdate.role_applied = roleInterestedIn;
    // Map how_did_you_hear → heard_about
    const howDidYouHear = form_data.how_did_you_hear ?? form_data.heard_about ?? "";
    if (howDidYouHear) candidateUpdate.heard_about = howDidYouHear;
    // Map transactions_last_year → transactions_2024
    if (transactionsLastYear) {
      const parsed = parseInt(transactionsLastYear);
      if (!isNaN(parsed)) candidateUpdate.transactions_2024 = parsed;
    }
    if (Object.keys(customFields).length > 0) {
      candidateUpdate.custom_fields = customFields;
    }

    await supabase
      .from("candidates")
      .update(candidateUpdate)
      .eq("id", candidateId);

    // ─── Stage history entry ───
    await supabase.from("stage_history").insert({
      candidate_id: candidateId,
      team_id,
      old_stage: previousStage,
      new_stage: stageName,
      changed_by: null, // system-triggered
    });

    return NextResponse.json({
      success: true,
      candidate_id: candidateId,
      team_id,
      first_name: firstName,
    });
  } catch (err) {
    console.error("Public apply API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
