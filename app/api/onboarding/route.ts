import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/onboarding
 *
 * Actions:
 *   { action: "initialize", candidate_id, hire_type, team_id }
 *     → sets candidate.hire_type, fetches matching tasks, creates candidate_onboarding rows
 *
 *   { action: "toggle", entry_id, completed_at }
 *     → sets completed_at on a candidate_onboarding row
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    if (body.action === "initialize") {
      const { candidate_id, hire_type, team_id } = body;

      if (!candidate_id || !hire_type || !team_id) {
        return NextResponse.json(
          { error: "candidate_id, hire_type, and team_id are required" },
          { status: 400 }
        );
      }

      if (!["agent", "employee"].includes(hire_type)) {
        return NextResponse.json(
          { error: "hire_type must be 'agent' or 'employee'" },
          { status: 400 }
        );
      }

      // Check if already initialized
      const { data: existing } = await supabase
        .from("candidate_onboarding")
        .select("id")
        .eq("candidate_id", candidate_id);

      if (existing && existing.length > 0) {
        // Already initialized — fetch with joins and return
        const { data, error } = await supabase
          .from("candidate_onboarding")
          .select("*, task:onboarding_tasks(*)")
          .eq("candidate_id", candidate_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ data });
      }

      // Set hire_type on the candidate
      const { error: updateError } = await supabase
        .from("candidates")
        .update({ hire_type })
        .eq("id", candidate_id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      // Fetch matching tasks (hire_type matches or 'both')
      const { data: tasks, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select("id")
        .eq("team_id", team_id)
        .eq("is_active", true)
        .in("hire_type", [hire_type, "both"])
        .order("order_index");

      if (tasksError) {
        return NextResponse.json(
          { error: tasksError.message },
          { status: 500 }
        );
      }

      if (!tasks || tasks.length === 0) {
        return NextResponse.json(
          { error: "No onboarding tasks found for this hire type" },
          { status: 400 }
        );
      }

      // Insert new entries
      const entries = tasks.map((task) => ({
        candidate_id,
        task_id: task.id,
      }));

      const { data, error } = await supabase
        .from("candidate_onboarding")
        .insert(entries)
        .select("*, task:onboarding_tasks(*)");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (body.action === "toggle") {
      const { entry_id, completed_at } = body;

      if (!entry_id) {
        return NextResponse.json(
          { error: "entry_id is required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("candidate_onboarding")
        .update({ completed_at: completed_at ?? null })
        .eq("id", entry_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
