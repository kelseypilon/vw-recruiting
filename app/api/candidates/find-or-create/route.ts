import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/candidates/find-or-create
 *
 * Finds an existing candidate by email within the team, or creates a new one.
 * Returns the candidate_id in either case.
 *
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { first_name, last_name, email, team_id } = await req.json();

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim() || !team_id) {
      return NextResponse.json(
        { error: "first_name, last_name, email, and team_id are required" },
        { status: 400 }
      );
    }

    // Verify user belongs to this team
    if (auth.teamId !== team_id) {
      return NextResponse.json({ error: "Unauthorized for this team" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Try to find existing candidate by email within this team
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("team_id", team_id)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ candidate_id: existing.id, created: false });
    }

    // Fetch "New Lead" stage by ghl_tag (fall back to order_index if tag missing)
    const { data: newLeadStage } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("team_id", team_id)
      .eq("is_active", true)
      .eq("ghl_tag", "vw_new_lead")
      .limit(1)
      .maybeSingle();

    let stageName = newLeadStage?.name;
    if (!stageName) {
      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("team_id", team_id)
        .eq("is_active", true)
        .order("order_index")
        .limit(1)
        .single();
      stageName = firstStage?.name ?? "New Lead";
    }

    const now = new Date().toISOString();

    // Create new candidate
    const { data: newCandidate, error: insertErr } = await supabase
      .from("candidates")
      .insert({
        team_id,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        stage: stageName,
        stage_entered_at: now,
        hire_track: "agent",
      })
      .select("id")
      .single();

    if (insertErr || !newCandidate) {
      console.error("find-or-create insert error:", insertErr);
      return NextResponse.json(
        { error: insertErr?.message ?? "Failed to create candidate" },
        { status: 500 }
      );
    }

    // Create stage_history entry for initial stage
    await supabase.from("stage_history").insert({
      candidate_id: newCandidate.id,
      team_id,
      new_stage: stageName,
      changed_by: auth.userId,
    });

    return NextResponse.json({ candidate_id: newCandidate.id, created: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
