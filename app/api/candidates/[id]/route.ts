import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Verify candidate belongs to the user's team
  const { data: candidate, error: lookupErr } = await supabase
    .from("candidates")
    .select("id, team_id, first_name, last_name")
    .eq("id", id)
    .single();

  if (lookupErr || !candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (candidate.team_id !== auth.teamId) {
    return NextResponse.json({ error: "Unauthorized for this team" }, { status: 403 });
  }

  // Check user has Admin-level role
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.userId)
    .single();

  const ALLOWED_ROLES = ["Admin", "Super Admin", "Team Lead", "VP Ops"];
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // All FK references use ON DELETE CASCADE, so deleting the candidate
  // row will automatically remove all related records (notes, scores,
  // evaluations, interviews, scorecards, stage_history, etc.)
  const { error } = await supabase
    .from("candidates")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
