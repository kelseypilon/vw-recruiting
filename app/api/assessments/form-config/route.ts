import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_FIELDS } from "@/lib/default-form-fields";

/**
 * GET /api/assessments/form-config?team_id=xxx
 *
 * Public endpoint — returns the application form field configuration
 * for a given team. Falls back to default fields if none configured.
 * Also returns interested_in options if the team has any.
 */
export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("team_id");
  if (!teamId) {
    return NextResponse.json({ error: "team_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch team settings
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("settings")
    .eq("id", teamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Extract form fields from settings, fall back to defaults
  const settings = (team.settings ?? {}) as Record<string, unknown>;
  const fields = settings.application_form_fields ?? DEFAULT_FORM_FIELDS;

  // Fetch interested_in options for this team (if the form has an interested_in field)
  const { data: intOptions } = await supabase
    .from("interested_in_options")
    .select("id, label, order_index")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("order_index");

  return NextResponse.json({
    fields,
    interested_in_options: intOptions ?? [],
  });
}
