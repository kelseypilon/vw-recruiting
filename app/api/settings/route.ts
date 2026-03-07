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
 *   update_template         { id, subject?, body? }
 *   update_criterion        { id, weight_percent?, min_threshold? }
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
      const defaultRoles = ["Team Lead", "Leader", "Admin", "Front Desk", "VP Ops", "Interviewer", "View Only"];
      if (defaultRoles.includes(payload.role_name)) {
        return NextResponse.json({ error: "Cannot delete a default role" }, { status: 400 });
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

      const reassignTo = payload.reassign_to ?? "View Only";
      await supabase.from("users").update({ role: reassignTo }).eq("team_id", payload.team_id).eq("role", payload.role_name);
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
