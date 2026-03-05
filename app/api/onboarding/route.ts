import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/onboarding
 *
 * Actions:
 *   { action: "initialize", candidate_id, task_ids }
 *     → upserts candidate_onboarding rows for each task
 *
 *   { action: "toggle", entry_id, completed_at }
 *     → sets completed_at on a candidate_onboarding row
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();

    if (body.action === "initialize") {
      const { candidate_id, task_ids } = body;

      if (!candidate_id || !Array.isArray(task_ids) || task_ids.length === 0) {
        return NextResponse.json(
          { error: "candidate_id and task_ids[] are required" },
          { status: 400 }
        );
      }

      const entries = task_ids.map((task_id: string) => ({
        candidate_id,
        task_id,
      }));

      const { data, error } = await supabase
        .from("candidate_onboarding")
        .upsert(entries, { onConflict: "candidate_id,task_id" })
        .select("*, task:onboarding_tasks(*), assignee:users(name)");

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
