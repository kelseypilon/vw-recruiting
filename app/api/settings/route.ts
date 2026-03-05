import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/settings
 *
 * A unified API for all settings writes using the admin client (bypasses RLS).
 *
 * Actions:
 *   update_team      { id, name?, admin_email?, admin_cc?, group_interview_zoom_link?, group_interview_date? }
 *   update_user      { id, name?, from_email?, phone?, calendly_url?, google_booking_url? }
 *   update_stage     { id, name?, color? }
 *   update_template  { id, subject?, body? }
 *   update_criterion { id, weight_percent?, min_threshold? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    if (!action || !payload?.id) {
      return NextResponse.json(
        { error: "action and payload.id are required" },
        { status: 400 }
      );
    }

    const { id, ...updates } = payload;

    if (action === "update_team") {
      const { data, error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "update_user") {
      const { error } = await supabase.from("users").update(updates).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "update_stage") {
      const { error } = await supabase
        .from("pipeline_stages")
        .update(updates)
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "update_template") {
      const { error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "update_criterion") {
      const { error } = await supabase
        .from("scoring_criteria")
        .update(updates)
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
