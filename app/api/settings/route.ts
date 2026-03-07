import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/settings
 *
 * A unified API for all settings writes using the admin client (bypasses RLS).
 *
 * Actions:
 *   update_team             { id, name?, admin_email?, admin_cc?, group_interview_zoom_link?, group_interview_date? }
 *   update_user             { id, name?, role?, from_email?, google_booking_url? }
 *   update_user_profile     { id, name?, photo_url?, from_email?, google_booking_url?, scorecard_visibility?, notification_preferences? }
 *   update_member_title     { id, title }
 *   create_user             { team_id, name, email, role }
 *   update_role_permissions { team_id, role_permissions }
 *   update_stage            { id, name?, color? }
 *   create_stage            { team_id, name, color? }
 *   delete_stage            { id, move_candidates_to? }
 *   reorder_stages          { stages: { id, order_index }[] }
 *   get_stage_candidate_count { stage_name, team_id }
 *   update_template         { id, subject?, body? }
 *   create_template         { team_id, name, subject, body }
 *   delete_template         { id }
 *   update_criterion        { id, weight_percent?, min_threshold? }
 *   deactivate_user         { id, reassign_interviews_to?, reassign_onboarding_to? }
 *   get_user_assignments    { id, team_id }
 *   get_role_user_count     { team_id, role_name }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();
    const { action, payload } = body;

    // update_role_permissions: merge role permissions into teams.settings
    if (action === "update_role_permissions") {
      if (!payload?.team_id || !payload?.role_permissions) {
        return NextResponse.json(
          { error: "team_id and role_permissions are required" },
          { status: 400 }
        );
      }
      // Fetch current settings
      const { data: team, error: fetchErr } = await supabase
        .from("teams")
        .select("settings")
        .eq("id", payload.team_id)
        .single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const currentSettings = (team?.settings ?? {}) as Record<string, unknown>;
      const newSettings = {
        ...currentSettings,
        role_permissions: payload.role_permissions,
      };

      const { error: updateErr } = await supabase
        .from("teams")
        .update({ settings: newSettings })
        .eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true, settings: newSettings });
    }

    // create_user doesn't require payload.id
    if (action === "create_user") {
      if (!payload?.team_id || !payload?.name || !payload?.email) {
        return NextResponse.json(
          { error: "team_id, name, and email are required" },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from("users")
        .insert({
          team_id: payload.team_id,
          name: payload.name,
          email: payload.email,
          role: payload.role ?? "member",
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    // update_member_title: set the title field on a users row
    if (action === "update_member_title") {
      if (!payload?.id) {
        return NextResponse.json(
          { error: "payload.id is required" },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from("users")
        .update({ title: payload.title ?? null })
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // update_user_profile: profile page self-service update
    if (action === "update_user_profile") {
      if (!payload?.id) {
        return NextResponse.json(
          { error: "payload.id is required" },
          { status: 400 }
        );
      }
      const allowed = [
        "name",
        "photo_url",
        "from_email",
        "google_booking_url",
        "virtual_booking_url",
        "inperson_booking_url",
        "virtual_meeting_link",
        "scorecard_visibility",
        "notification_preferences",
      ];
      const profileUpdates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in payload) profileUpdates[key] = payload[key];
      }
      if (Object.keys(profileUpdates).length === 0) {
        return NextResponse.json(
          { error: "No update fields provided" },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from("users")
        .update(profileUpdates)
        .eq("id", payload.id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Custom Role Management ──────────────────────────────────────

    if (action === "add_custom_role") {
      if (!payload?.team_id || !payload?.role_name) {
        return NextResponse.json({ error: "team_id and role_name are required" }, { status: 400 });
      }
      const { data: team, error: fetchErr } = await supabase
        .from("teams").select("settings").eq("id", payload.team_id).single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const customRoles = (settings.custom_roles as string[]) ?? [];
      const rolePerms = (settings.role_permissions ?? {}) as Record<string, Record<string, boolean>>;

      if ([...customRoles, "Team Lead", "Leader", "Admin", "Front Desk", "VP Ops", "Interviewer", "View Only"].includes(payload.role_name)) {
        return NextResponse.json({ error: "Role name already exists" }, { status: 400 });
      }

      customRoles.push(payload.role_name);
      rolePerms[payload.role_name] = {
        view_candidates: false, edit_candidates: false, send_emails: false,
        manage_interviews: false, manage_settings: false, view_reports: false,
        manage_members: false, manage_templates: false, manage_scorecards: false,
        manage_onboarding: false, view_onboarding: false,
      };

      const newSettings = { ...settings, custom_roles: customRoles, role_permissions: rolePerms };
      const { error: updateErr } = await supabase.from("teams").update({ settings: newSettings }).eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true, settings: newSettings });
    }

    if (action === "rename_role") {
      if (!payload?.team_id || !payload?.old_name || !payload?.new_name) {
        return NextResponse.json({ error: "team_id, old_name, and new_name are required" }, { status: 400 });
      }
      const { data: team, error: fetchErr } = await supabase
        .from("teams").select("settings").eq("id", payload.team_id).single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const customRoles = (settings.custom_roles as string[]) ?? [];
      const rolePerms = (settings.role_permissions ?? {}) as Record<string, Record<string, boolean>>;

      const idx = customRoles.indexOf(payload.old_name);
      if (idx !== -1) customRoles[idx] = payload.new_name;

      if (rolePerms[payload.old_name]) {
        rolePerms[payload.new_name] = rolePerms[payload.old_name];
        delete rolePerms[payload.old_name];
      }

      const newSettings = { ...settings, custom_roles: customRoles, role_permissions: rolePerms };
      const { error: updateErr } = await supabase.from("teams").update({ settings: newSettings }).eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

      await supabase.from("users").update({ role: payload.new_name }).eq("team_id", payload.team_id).eq("role", payload.old_name);
      return NextResponse.json({ success: true, settings: newSettings });
    }

    if (action === "delete_role") {
      if (!payload?.team_id || !payload?.role_name) {
        return NextResponse.json({ error: "team_id and role_name are required" }, { status: 400 });
      }
      const protectedRoles = ["Admin", "Team Lead", "Leader", "Agent", "Employee"];
      if (protectedRoles.includes(payload.role_name)) {
        return NextResponse.json({ error: "Cannot delete a protected role" }, { status: 400 });
      }

      // Check if any active users have this role
      const { count: userCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("team_id", payload.team_id)
        .eq("role", payload.role_name)
        .eq("is_active", true);

      if ((userCount ?? 0) > 0) {
        return NextResponse.json({
          error: `${userCount} user${userCount !== 1 ? "s" : ""} have this role. Reassign them first.`,
          user_count: userCount,
        }, { status: 400 });
      }

      const { data: team, error: fetchErr } = await supabase
        .from("teams").select("settings").eq("id", payload.team_id).single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const customRoles = ((settings.custom_roles as string[]) ?? []).filter((r: string) => r !== payload.role_name);
      const rolePerms = (settings.role_permissions ?? {}) as Record<string, Record<string, boolean>>;
      delete rolePerms[payload.role_name];

      const newSettings = { ...settings, custom_roles: customRoles, role_permissions: rolePerms };
      const { error: updateErr } = await supabase.from("teams").update({ settings: newSettings }).eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true, settings: newSettings });
    }

    // ── Group Interview Guidelines ─────────────────────────────────

    if (action === "update_group_guidelines") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const { data: team, error: fetchErr } = await supabase
        .from("teams").select("settings").eq("id", payload.team_id).single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const newSettings = { ...settings, group_interview_guidelines: payload.guidelines ?? [] };

      const { error: updateErr } = await supabase.from("teams").update({ settings: newSettings }).eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true, settings: newSettings });
    }

    // ── Settings Tab Visibility ─────────────────────────────────────

    if (action === "update_settings_visibility") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const { data: team, error: fetchErr } = await supabase
        .from("teams").select("settings").eq("id", payload.team_id).single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const newSettings = { ...settings, settings_visibility: payload.settings_visibility ?? {} };

      const { error: updateErr } = await supabase.from("teams").update({ settings: newSettings }).eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true, settings: newSettings });
    }

    // ── Pipeline Stage CRUD ──────────────────────────────────────────

    if (action === "create_stage") {
      if (!payload?.team_id || !payload?.name) {
        return NextResponse.json({ error: "team_id and name are required" }, { status: 400 });
      }
      // Get max order_index
      const { data: maxStage } = await supabase
        .from("pipeline_stages")
        .select("order_index")
        .eq("team_id", payload.team_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxStage?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from("pipeline_stages")
        .insert({
          team_id: payload.team_id,
          name: payload.name,
          color: payload.color ?? "#6B7280",
          order_index: nextOrder,
          is_active: true,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "delete_stage") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      // Get the stage to find its name
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("name, team_id")
        .eq("id", payload.id)
        .single();
      if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

      // Move candidates if a target stage is specified
      if (payload.move_candidates_to) {
        await supabase
          .from("candidates")
          .update({ stage: payload.move_candidates_to })
          .eq("team_id", stage.team_id)
          .eq("stage", stage.name);
      }

      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "reorder_stages") {
      if (!payload?.stages || !Array.isArray(payload.stages)) {
        return NextResponse.json({ error: "stages array is required" }, { status: 400 });
      }
      // Update each stage's order_index
      for (const s of payload.stages as { id: string; order_index: number }[]) {
        const { error } = await supabase
          .from("pipeline_stages")
          .update({ order_index: s.order_index })
          .eq("id", s.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "get_stage_candidate_count") {
      if (!payload?.stage_name || !payload?.team_id) {
        return NextResponse.json({ error: "stage_name and team_id are required" }, { status: 400 });
      }
      const { count, error } = await supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("team_id", payload.team_id)
        .eq("stage", payload.stage_name);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count ?? 0 });
    }

    // ── Template CRUD ───────────────────────────────────────────────

    if (action === "create_template") {
      if (!payload?.team_id || !payload?.name || !payload?.subject) {
        return NextResponse.json({ error: "team_id, name, and subject are required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          team_id: payload.team_id,
          name: payload.name,
          subject: payload.subject,
          body: payload.body ?? "",
          merge_tags: payload.merge_tags ?? [],
          is_active: true,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "delete_template") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      // Verify it's not a system template
      const { data: tmpl } = await supabase
        .from("email_templates")
        .select("trigger")
        .eq("id", payload.id)
        .single();
      const systemTriggers = ["interview_invite", "not_a_fit", "assessment_invite", "welcome"];
      if (tmpl?.trigger && systemTriggers.includes(tmpl.trigger)) {
        return NextResponse.json({ error: "Cannot delete a system template" }, { status: 400 });
      }
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── User Deactivation ───────────────────────────────────────────

    if (action === "deactivate_user") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      // Get user info for the "(former member)" suffix
      const { data: user } = await supabase
        .from("users")
        .select("name, team_id")
        .eq("id", payload.id)
        .single();
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // Reassign interviews if specified
      if (payload.reassign_interviews_to) {
        // Reassign as interviewer in interview_interviewers
        await supabase
          .from("interview_interviewers")
          .update({ user_id: payload.reassign_interviews_to })
          .eq("user_id", payload.id);
      }

      // Reassign onboarding tasks if specified
      if (payload.reassign_onboarding_to) {
        // Reassign default assignee on tasks
        await supabase
          .from("onboarding_tasks")
          .update({ default_assignee_id: payload.reassign_onboarding_to })
          .eq("team_id", user.team_id)
          .eq("default_assignee_id", payload.id);
        // Reassign active candidate onboarding entries
        await supabase
          .from("candidate_onboarding")
          .update({ assigned_user_id: payload.reassign_onboarding_to })
          .eq("assigned_user_id", payload.id)
          .is("completed_at", null);
      }

      // Deactivate the user (soft delete)
      const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "get_user_assignments") {
      if (!payload?.id || !payload?.team_id) {
        return NextResponse.json({ error: "id and team_id are required" }, { status: 400 });
      }
      // Count open interviews where user is an interviewer
      const { count: interviewCount } = await supabase
        .from("interview_interviewers")
        .select("interview_id", { count: "exact", head: true })
        .eq("user_id", payload.id);

      // Count onboarding tasks assigned to user (uncompleted)
      const { count: onboardingCount } = await supabase
        .from("candidate_onboarding")
        .select("id", { count: "exact", head: true })
        .eq("assigned_user_id", payload.id)
        .is("completed_at", null);

      // Count onboarding task templates with this default assignee
      const { count: taskTemplateCount } = await supabase
        .from("onboarding_tasks")
        .select("id", { count: "exact", head: true })
        .eq("team_id", payload.team_id)
        .eq("default_assignee_id", payload.id);

      return NextResponse.json({
        interviews: interviewCount ?? 0,
        onboarding: (onboardingCount ?? 0) + (taskTemplateCount ?? 0),
      });
    }

    if (action === "get_role_user_count") {
      if (!payload?.team_id || !payload?.role_name) {
        return NextResponse.json({ error: "team_id and role_name are required" }, { status: 400 });
      }
      const { count, error } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("team_id", payload.team_id)
        .eq("role", payload.role_name)
        .eq("is_active", true);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count ?? 0 });
    }

    // ── Actions requiring payload.id ────────────────────────────────

    if (action === "update_team" || action === "update_user" || action === "update_stage" || action === "update_template" || action === "update_criterion") {
      if (!payload?.id) {
        return NextResponse.json(
          { error: `payload.id is required for ${action}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
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
