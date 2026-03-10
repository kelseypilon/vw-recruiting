import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/teams/by-id?id=xxx
 *
 * Returns team slug for a given team ID.
 * Used by the dashboard to build public application links.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ slug: data.slug });
}
