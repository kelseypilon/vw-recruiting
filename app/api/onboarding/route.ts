import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/onboarding
 *
 * Actions:
 *   { action: "initialize", candidate_id, hire_type, team_id }
 *     → sets candidate.hire_type, fetches matching tasks, creates candidate_onboarding rows
 *       with assigned_user_id (from task defaults) and due_date (from offset + anchor)
 *
 *   { action: "toggle", entry_id, completed_at }
 *     → sets completed_at on a candidate_onboarding row
 *
 *   { action: "update_task_assignment", task_id, default_assignee_id?, due_offset_days?, due_offset_anchor? }
 *     → updates default_assignee_id and/or due offset fields on an onboarding_tasks row
 *
 *   { action: "reassign", entry_id, assigned_user_id }
 *     → updates assigned_user_id on a specific candidate_onboarding row
 *
 *   { action: "bulk_reassign", team_id, from_user_id, to_user_id }
 *     → batch updates default_assignee_id on onboarding_tasks where current assignee matches from_user_id
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
          .select("*, task:onboarding_tasks(*), assigned_user:users!candidate_onboarding_assigned_user_id_fkey(name)")
          .eq("candidate_id", candidate_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ data });
      }

      // Set hire_type and hire_track on the candidate
      const { error: updateError } = await supabase
        .from("candidates")
        .update({ hire_type, hire_track: hire_type })
        .eq("id", candidate_id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      // Fetch matching tasks (hire_track matches or 'both') — include assignment + scheduling columns
      // Use hire_track with fallback to hire_type for backward compat
      const { data: tasks, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select("id, default_assignee_id, due_offset_days, due_offset_anchor, hire_track, hire_type")
        .eq("team_id", team_id)
        .eq("is_active", true)
        .order("order_index");

      // Filter by hire_track (or hire_type fallback)
      const filteredTasks = (tasks ?? []).filter((t) => {
        const track = (t as Record<string, unknown>).hire_track ?? (t as Record<string, unknown>).hire_type ?? "both";
        return track === hire_type || track === "both";
      });

      if (tasksError) {
        return NextResponse.json(
          { error: tasksError.message },
          { status: 500 }
        );
      }

      if (filteredTasks.length === 0) {
        return NextResponse.json(
          { error: "No onboarding tasks found for this hire type" },
          { status: 400 }
        );
      }

      // Fetch candidate for start_date and hire_date (for due date calculation)
      const { data: candidateData } = await supabase
        .from("candidates")
        .select("start_date, created_at")
        .eq("id", candidate_id)
        .single();

      const startDate = candidateData?.start_date
        ? new Date(candidateData.start_date)
        : null;
      const hireDate = candidateData?.created_at
        ? new Date(candidateData.created_at)
        : null;

      // Build entries with assigned_user_id and calculated due_date
      const entries = filteredTasks.map((task) => {
        let due_date: string | null = null;

        if (task.due_offset_days != null) {
          const anchor =
            task.due_offset_anchor === "hire_date" ? hireDate : startDate;
          if (anchor) {
            const d = new Date(anchor);
            d.setDate(d.getDate() + task.due_offset_days);
            due_date = d.toISOString().split("T")[0]; // YYYY-MM-DD
          }
        }

        return {
          candidate_id,
          task_id: task.id,
          assigned_user_id: task.default_assignee_id ?? null,
          due_date,
        };
      });

      const { data, error } = await supabase
        .from("candidate_onboarding")
        .insert(entries)
        .select("*, task:onboarding_tasks(*), assigned_user:users!candidate_onboarding_assigned_user_id_fkey(name)");

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

    if (body.action === "update_task_assignment") {
      const { task_id, ...fields } = body;

      if (!task_id) {
        return NextResponse.json(
          { error: "task_id is required" },
          { status: 400 }
        );
      }

      // Build update payload — only include fields that were sent
      const updates: Record<string, unknown> = {};
      if ("default_assignee_id" in fields) {
        updates.default_assignee_id = fields.default_assignee_id ?? null;
      }
      if ("due_offset_days" in fields) {
        updates.due_offset_days = fields.due_offset_days ?? null;
      }
      if ("due_offset_anchor" in fields) {
        updates.due_offset_anchor = fields.due_offset_anchor;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "No update fields provided" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", task_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === "reassign") {
      const { entry_id, assigned_user_id } = body;

      if (!entry_id) {
        return NextResponse.json(
          { error: "entry_id is required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("candidate_onboarding")
        .update({ assigned_user_id: assigned_user_id ?? null })
        .eq("id", entry_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── Task CRUD ────────────────────────────────────────────────────

    if (body.action === "create_task") {
      const { team_id, title, stage, hire_type, hire_track, action_type, done_by, due_offset_days, due_offset_anchor, action_url, notes, default_assignee_id, automation_key } = body;
      if (!team_id || !title) {
        return NextResponse.json({ error: "team_id and title are required" }, { status: 400 });
      }
      // Get max order_index for this stage
      const { data: maxTask } = await supabase
        .from("onboarding_tasks")
        .select("order_index")
        .eq("team_id", team_id)
        .eq("stage", stage ?? null)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxTask?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from("onboarding_tasks")
        .insert({
          team_id,
          title,
          stage: stage ?? null,
          hire_type: hire_type ?? "both",
          hire_track: hire_track ?? hire_type ?? "both",
          action_type: action_type ?? "manual",
          done_by: done_by ?? null,
          owner_role: done_by ?? "Team Lead",
          due_offset_days: due_offset_days ?? null,
          due_offset_anchor: due_offset_anchor ?? "start_date",
          action_url: action_url ?? null,
          notes: notes ?? null,
          default_assignee_id: default_assignee_id ?? null,
          automation_key: automation_key ?? null,
          order_index: nextOrder,
          is_active: true,
        })
        .select("*, default_assignee:users!onboarding_tasks_default_assignee_id_fkey(name)")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (body.action === "update_task_full") {
      const { task_id, ...fields } = body;
      if (!task_id) {
        return NextResponse.json({ error: "task_id is required" }, { status: 400 });
      }
      const allowed = [
        "title", "stage", "hire_type", "hire_track", "action_type", "done_by",
        "due_offset_days", "due_offset_anchor", "action_url", "notes", "automation_key",
        "default_assignee_id", "is_active",
      ];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in fields) updates[key] = fields[key];
      }
      // Keep owner_role in sync with done_by
      if ("done_by" in fields) updates.owner_role = fields.done_by ?? "Team Lead";

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .update(updates)
        .eq("id", task_id)
        .select("*, default_assignee:users!onboarding_tasks_default_assignee_id_fkey(name)")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (body.action === "delete_task") {
      const { task_id } = body;
      if (!task_id) {
        return NextResponse.json({ error: "task_id is required" }, { status: 400 });
      }
      // Delete related candidate_onboarding entries first
      const { error: relatedErr } = await supabase
        .from("candidate_onboarding")
        .delete()
        .eq("task_id", task_id);
      if (relatedErr) {
        return NextResponse.json({ error: `Failed to remove related entries: ${relatedErr.message}` }, { status: 500 });
      }
      const { error } = await supabase
        .from("onboarding_tasks")
        .delete()
        .eq("id", task_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === "reset") {
      const { candidate_id } = body;
      if (!candidate_id) {
        return NextResponse.json({ error: "candidate_id is required" }, { status: 400 });
      }
      // Delete all candidate_onboarding entries for this candidate
      const { error: deleteErr } = await supabase
        .from("candidate_onboarding")
        .delete()
        .eq("candidate_id", candidate_id);
      if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

      // Clear hire_type on the candidate
      const { error: clearErr } = await supabase
        .from("candidates")
        .update({ hire_type: null })
        .eq("id", candidate_id);

      if (clearErr) {
        console.error("Failed to clear hire_type:", clearErr.message);
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === "bulk_reassign") {
      const { team_id, from_user_id, to_user_id } = body;

      if (!team_id || !from_user_id || !to_user_id) {
        return NextResponse.json(
          { error: "team_id, from_user_id, and to_user_id are required" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update({ default_assignee_id: to_user_id })
        .eq("team_id", team_id)
        .eq("default_assignee_id", from_user_id);

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
