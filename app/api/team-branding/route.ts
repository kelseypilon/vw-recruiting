import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTeamBranding } from "@/lib/branding";

/**
 * GET /api/team-branding?slug=xxx
 *
 * Public endpoint — returns TeamBranding data for a given team slug.
 * Used by the login page to render dynamic branding before auth.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  if (!slug) {
    // Return default Vantage West branding
    return NextResponse.json({ data: resolveTeamBranding(null) });
  }

  const supabase = createAdminClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select(
      "name, branding_mode, brand_name, brand_logo_url, brand_primary_color, brand_secondary_color, brand_show_powered_by"
    )
    .eq("slug", slug)
    .single();

  if (error || !team) {
    // Fall back to defaults if slug not found
    return NextResponse.json({ data: resolveTeamBranding(null) });
  }

  return NextResponse.json({ data: resolveTeamBranding(team) });
}
