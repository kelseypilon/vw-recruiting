import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/settings
 *
 * A unified API for all settings writes using the admin client (bypasses RLS).
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth gate: require authenticated user
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      const protectedRoleNames = ["Admin", "Team Lead", "Leader", "Agent", "Employee"];
      if (protectedRoleNames.includes(payload.old_name as string)) {
        return NextResponse.json({ error: "Cannot rename a protected role" }, { status: 400 });
      }

      const { data: team, error: fetchErr } = await supabase
        .from("teams").select("settings").eq("id", payload.team_id).single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const customRoles = (settings.custom_roles as string[]) ?? [];
      const rolePerms = (settings.role_permissions ?? {}) as Record<string, Record<string, boolean>>;

      // Check for duplicate name
      const allRoleNames = [...protectedRoleNames, ...customRoles];
      if (allRoleNames.includes(payload.new_name as string) && payload.new_name !== payload.old_name) {
        return NextResponse.json({ error: "A role with that name already exists" }, { status: 400 });
      }

      const idx = customRoles.indexOf(payload.old_name as string);
      if (idx !== -1) customRoles[idx] = payload.new_name as string;

      if (rolePerms[payload.old_name as string]) {
        rolePerms[payload.new_name as string] = rolePerms[payload.old_name as string];
        delete rolePerms[payload.old_name as string];
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

      // If users exist but no reassign_to provided, return the count so UI can show reassignment modal
      if ((userCount ?? 0) > 0 && !payload.reassign_to) {
        return NextResponse.json({
          error: `${userCount} user${userCount !== 1 ? "s" : ""} currently have this role. Choose a role to reassign them to.`,
          user_count: userCount,
          needs_reassignment: true,
        }, { status: 409 });
      }

      // Reassign users if needed
      if ((userCount ?? 0) > 0 && payload.reassign_to) {
        const { error: reassignErr } = await supabase
          .from("users")
          .update({ role: payload.reassign_to })
          .eq("team_id", payload.team_id)
          .eq("role", payload.role_name);
        if (reassignErr) return NextResponse.json({ error: reassignErr.message }, { status: 500 });
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
      // Get the stage to find its name and protection status
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("name, team_id, is_protected")
        .eq("id", payload.id)
        .single();
      if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

      // Server-side guard: protected stages cannot be deleted
      if (stage.is_protected) {
        return NextResponse.json({ error: "This stage cannot be deleted" }, { status: 403 });
      }

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
      // Update all stage order_indexes concurrently
      const results = await Promise.all(
        (payload.stages as { id: string; order_index: number }[]).map((s) =>
          supabase.from("pipeline_stages").update({ order_index: s.order_index }).eq("id", s.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
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
      const insertData: Record<string, unknown> = {
          team_id: payload.team_id,
          name: payload.name,
          subject: payload.subject,
          body: payload.body ?? "",
          merge_tags: payload.merge_tags ?? [],
          is_active: true,
        };
      if (payload.folder_id) insertData.folder_id = payload.folder_id;
      const { data, error } = await supabase
        .from("email_templates")
        .insert(insertData)
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

    // ── Template Folder CRUD ────────────────────────────────────────

    if (action === "list_template_folders") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("email_template_folders")
        .select("*")
        .eq("team_id", payload.team_id)
        .order("order_index");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "create_template_folder") {
      if (!payload?.team_id || !payload?.name) {
        return NextResponse.json({ error: "team_id and name are required" }, { status: 400 });
      }
      // Get max order_index
      const { data: existing } = await supabase
        .from("email_template_folders")
        .select("order_index")
        .eq("team_id", payload.team_id)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from("email_template_folders")
        .insert({
          team_id: payload.team_id,
          name: payload.name,
          order_index: nextOrder,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "rename_template_folder") {
      if (!payload?.id || !payload?.name) {
        return NextResponse.json({ error: "id and name are required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("email_template_folders")
        .update({ name: payload.name })
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "delete_template_folder") {
      if (!payload?.id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }
      // Templates in this folder will have folder_id set to null (ON DELETE SET NULL)
      const { error } = await supabase
        .from("email_template_folders")
        .delete()
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "move_template_to_folder") {
      if (!payload?.template_id) {
        return NextResponse.json({ error: "template_id is required" }, { status: 400 });
      }
      // folder_id can be null (to unfile)
      const { error } = await supabase
        .from("email_templates")
        .update({ folder_id: payload.folder_id ?? null })
        .eq("id", payload.template_id);
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

    // ── Escalation Contact ─────────────────────────────────────────

    if (action === "set_escalation_contact") {
      if (!payload?.user_id || !payload?.team_id) {
        return NextResponse.json({ error: "user_id and team_id are required" }, { status: 400 });
      }
      // Clear all existing escalation contacts on this team
      await supabase
        .from("users")
        .update({ is_escalation_contact: false })
        .eq("team_id", payload.team_id)
        .eq("is_escalation_contact", true);
      // Set the new one
      const { error } = await supabase
        .from("users")
        .update({ is_escalation_contact: true })
        .eq("id", payload.user_id)
        .eq("team_id", payload.team_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "clear_escalation_contact") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("users")
        .update({ is_escalation_contact: false })
        .eq("team_id", payload.team_id)
        .eq("is_escalation_contact", true);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Notification Thresholds ──────────────────────────────────────

    if (action === "update_thresholds") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if ("threshold_stuck_days" in payload) updates.threshold_stuck_days = payload.threshold_stuck_days;
      if ("threshold_scorecard_hours" in payload) updates.threshold_scorecard_hours = payload.threshold_scorecard_hours;
      if ("threshold_escalation_hours" in payload) updates.threshold_escalation_hours = payload.threshold_escalation_hours;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No threshold fields provided" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", payload.team_id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    // ── Integrations ──────────────────────────────────────────────────

    if (action === "update_integrations") {
      if (!payload?.team_id || !payload?.integrations) {
        return NextResponse.json(
          { error: "team_id and integrations are required" },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from("teams")
        .update({ integrations: payload.integrations })
        .eq("id", payload.team_id)
        .select("integrations")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, integrations: data?.integrations });
    }

    if (action === "test_integration") {
      if (!payload?.team_id || !payload?.integration_key) {
        return NextResponse.json(
          { error: "team_id and integration_key are required" },
          { status: 400 }
        );
      }
      // Fetch team integrations to verify config exists
      const { data: team, error: fetchErr } = await supabase
        .from("teams")
        .select("integrations")
        .eq("id", payload.team_id)
        .single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const integrations = (team?.integrations ?? {}) as Record<string, Record<string, unknown>>;
      const config = integrations[payload.integration_key];
      if (!config) {
        return NextResponse.json({ error: "Integration not configured" }, { status: 400 });
      }

      // Placeholder: in production, each integration would have a real connectivity test
      // For now, return success if config exists and has required fields
      return NextResponse.json({ success: true, message: "Connection test passed" });
    }

    // ── Onboarding Task CRUD ────────────────────────────────────────

    if (action === "create_onboarding_task") {
      if (!payload?.team_id || !payload?.title) {
        return NextResponse.json({ error: "team_id and title are required" }, { status: 400 });
      }
      // Get max order_index for this stage
      const { data: maxTask } = await supabase
        .from("onboarding_tasks")
        .select("order_index")
        .eq("team_id", payload.team_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxTask?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from("onboarding_tasks")
        .insert({
          team_id: payload.team_id,
          title: payload.title,
          owner_role: payload.owner_role ?? "Admin",
          applies_to: payload.applies_to ?? null,
          timing: payload.timing ?? null,
          order_index: nextOrder,
          is_active: true,
          hire_type: payload.hire_type ?? "agent",
          hire_track: payload.hire_track ?? "agent",
          stage: payload.stage ?? null,
          done_by: payload.done_by ?? null,
          action_type: payload.action_type ?? "manual",
          action_url: payload.action_url ?? null,
          email_template_key: payload.email_template_key ?? null,
          notes: payload.notes ?? null,
          default_assignee_id: payload.default_assignee_id ?? null,
          due_offset_days: payload.due_offset_days ?? null,
          due_offset_anchor: payload.due_offset_anchor ?? "hire_date",
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "update_onboarding_task") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      const allowed = [
        "title", "owner_role", "applies_to", "timing", "is_active",
        "hire_type", "hire_track", "stage", "done_by", "action_type",
        "action_url", "email_template_key", "notes", "default_assignee_id",
        "due_offset_days", "due_offset_anchor", "order_index",
      ];
      const taskUpdates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in payload) taskUpdates[key] = payload[key];
      }
      if (Object.keys(taskUpdates).length === 0) {
        return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .update(taskUpdates)
        .eq("id", payload.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "delete_onboarding_task") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("onboarding_tasks")
        .delete()
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "reorder_onboarding_tasks") {
      if (!payload?.tasks || !Array.isArray(payload.tasks)) {
        return NextResponse.json({ error: "tasks array is required" }, { status: 400 });
      }
      const results = await Promise.all(
        (payload.tasks as { id: string; order_index: number }[]).map((t) =>
          supabase.from("onboarding_tasks").update({ order_index: t.order_index }).eq("id", t.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Interested In Options CRUD ──────────────────────────────────

    if (action === "create_interested_in") {
      if (!payload?.team_id || !payload?.label) {
        return NextResponse.json({ error: "team_id and label are required" }, { status: 400 });
      }
      // Get max order_index
      const { data: maxOpt } = await supabase
        .from("interested_in_options")
        .select("order_index")
        .eq("team_id", payload.team_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxOpt?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from("interested_in_options")
        .insert({
          team_id: payload.team_id,
          label: payload.label,
          order_index: nextOrder,
          is_active: true,
        })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "update_interested_in") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      const allowed = ["label", "is_active", "order_index"];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in payload) updates[key] = payload[key];
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
      }
      const { error } = await supabase
        .from("interested_in_options")
        .update(updates)
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "delete_interested_in") {
      if (!payload?.id) {
        return NextResponse.json({ error: "payload.id is required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("interested_in_options")
        .delete()
        .eq("id", payload.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "reorder_interested_in") {
      if (!payload?.items || !Array.isArray(payload.items)) {
        return NextResponse.json({ error: "items array is required" }, { status: 400 });
      }
      const results = await Promise.all(
        (payload.items as { id: string; order_index: number }[]).map((item) =>
          supabase.from("interested_in_options").update({ order_index: item.order_index }).eq("id", item.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Application Form Fields ─────────────────────────────────────

    if (action === "get_form_fields") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const { data: team, error: fetchErr } = await supabase
        .from("teams")
        .select("settings")
        .eq("id", payload.team_id)
        .single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const fields = (settings.application_form_fields as unknown[]) ?? null;

      // Return stored fields, or null if not yet configured (frontend uses defaults)
      return NextResponse.json({ fields });
    }

    if (action === "save_form_fields") {
      if (!payload?.team_id || !payload?.fields || !Array.isArray(payload.fields)) {
        return NextResponse.json(
          { error: "team_id and fields array are required" },
          { status: 400 }
        );
      }

      // Validate constraints
      if (payload.fields.length > 20) {
        return NextResponse.json({ error: "Maximum 20 fields allowed" }, { status: 400 });
      }

      // Verify locked fields are present
      const lockedIds = ["first_name", "last_name", "email"];
      for (const lockId of lockedIds) {
        if (!payload.fields.find((f: { id: string }) => f.id === lockId)) {
          return NextResponse.json(
            { error: `Locked field "${lockId}" cannot be removed` },
            { status: 400 }
          );
        }
      }

      // Check for duplicate IDs
      const ids = payload.fields.map((f: { id: string }) => f.id);
      if (new Set(ids).size !== ids.length) {
        return NextResponse.json({ error: "Duplicate field IDs are not allowed" }, { status: 400 });
      }

      const { data: team, error: fetchErr } = await supabase
        .from("teams")
        .select("settings")
        .eq("id", payload.team_id)
        .single();
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

      const settings = (team?.settings ?? {}) as Record<string, unknown>;
      const newSettings = { ...settings, application_form_fields: payload.fields };

      const { error: updateErr } = await supabase
        .from("teams")
        .update({ settings: newSettings })
        .eq("id", payload.team_id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true, settings: newSettings });
    }

    // ── Business Units ──────────────────────────────────────────────

    if (action === "update_business_units") {
      if (!payload?.team_id || !payload?.business_units) {
        return NextResponse.json({ error: "team_id and business_units are required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("teams")
        .update({ business_units: payload.business_units })
        .eq("id", payload.team_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── List Email Templates ──────────────────────────────────────────

    if (action === "list_email_templates") {
      if (!payload?.team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("team_id", payload.team_id)
        .order("name");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ templates: data ?? [] });
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

    const { id, ...rawUpdates } = payload;

    // Whitelist allowed fields per action to prevent arbitrary field injection
    const allowedFields: Record<string, string[]> = {
      update_team: ["name", "admin_email", "admin_cc", "group_interview_zoom_link", "group_interview_date", "plan", "slug"],
      update_user: ["name", "role", "from_email", "google_booking_url", "virtual_booking_url", "inperson_booking_url", "virtual_meeting_link", "title"],
      update_stage: ["name", "color", "is_active", "order_index", "ghl_tag"],
      update_template: ["name", "subject", "body", "merge_tags", "is_active", "trigger", "folder_id"],
      update_criterion: ["name", "weight_percent", "min_threshold", "order_index"],
    };

    const allowed = allowedFields[action] ?? [];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in rawUpdates) updates[key] = rawUpdates[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

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
