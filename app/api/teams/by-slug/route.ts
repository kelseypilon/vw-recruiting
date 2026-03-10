import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/teams/by-slug?slug=xxx
 *
 * Public endpoint — looks up a team by slug.
 * Returns team info + branding + accepting_applications flag.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, slug, brand_name, brand_logo_url, brand_primary_color, brand_secondary_color, branding_mode, brand_show_powered_by, settings"
    )
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Check if team is accepting applications (default: true)
  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const acceptingApplications = settings.accepting_applications !== false;

  return NextResponse.json({
    team: data,
    accepting_applications: acceptingApplications,
  });
}
