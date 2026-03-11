import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifySuper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_super_admin")
    .eq("email", user.email ?? "")
    .eq("is_super_admin", true)
    .maybeSingle();

  if (!profile) return null;
  return user;
}

/**
 * POST /api/super-admin/copy-team-settings
 *
 * Copies operational settings from one team to another.
 * Body: { source_team_id, target_team_id, dry_run?: boolean }
 *
 * Categories copied:
 *   - application_form_fields (JSONB in teams.settings)
 *   - pipeline_stages
 *   - interview_questions
 *   - onboarding_tasks
 *   - scoring_criteria
 *   - group_interview_prompts
 *   - email_template_folders + email_templates (with folder ID remapping)
 *
 * NOT copied: candidates, users, branding, team identity
 */
export async function POST(req: NextRequest) {
  const user = await verifySuper();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { source_team_id, target_team_id, dry_run = false } = body;

    if (!source_team_id || !target_team_id) {
      return NextResponse.json(
        { error: "source_team_id and target_team_id are required" },
        { status: 400 }
      );
    }

    if (source_team_id === target_team_id) {
      return NextResponse.json(
        { error: "Source and target teams must be different" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify both teams exist
    const { data: sourceTeam } = await admin
      .from("teams")
      .select("id, name, settings")
      .eq("id", source_team_id)
      .single();

    const { data: targetTeam } = await admin
      .from("teams")
      .select("id, name")
      .eq("id", target_team_id)
      .single();

    if (!sourceTeam || !targetTeam) {
      return NextResponse.json(
        { error: "Source or target team not found" },
        { status: 404 }
      );
    }

    // ─── Read all source data ───
    const [
      { data: srcStages },
      { data: srcQuestions },
      { data: srcOnboarding },
      { data: srcScoring },
      { data: srcPrompts },
      { data: srcFolders },
      { data: srcTemplates },
    ] = await Promise.all([
      admin
        .from("pipeline_stages")
        .select("*")
        .eq("team_id", source_team_id)
        .order("order_index"),
      admin
        .from("interview_questions")
        .select("*")
        .eq("team_id", source_team_id)
        .order("sort_order"),
      admin
        .from("onboarding_tasks")
        .select("*")
        .eq("team_id", source_team_id)
        .order("order_index"),
      admin
        .from("scoring_criteria")
        .select("*")
        .eq("team_id", source_team_id)
        .order("order_index"),
      admin
        .from("group_interview_prompts")
        .select("*")
        .eq("team_id", source_team_id)
        .order("order_index"),
      admin
        .from("email_template_folders")
        .select("*")
        .eq("team_id", source_team_id)
        .order("order_index"),
      admin
        .from("email_templates")
        .select("*")
        .eq("team_id", source_team_id),
    ]);

    // Application form fields from JSONB
    const srcFormFields =
      sourceTeam.settings?.application_form_fields ?? null;

    // ─── Dry run — return counts only ───
    if (dry_run) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        source_team: sourceTeam.name,
        target_team: targetTeam.name,
        counts: {
          application_form_fields: srcFormFields
            ? (srcFormFields as unknown[]).length
            : 0,
          pipeline_stages: srcStages?.length ?? 0,
          interview_questions: srcQuestions?.length ?? 0,
          onboarding_tasks: srcOnboarding?.length ?? 0,
          scoring_criteria: srcScoring?.length ?? 0,
          group_interview_prompts: srcPrompts?.length ?? 0,
          email_template_folders: srcFolders?.length ?? 0,
          email_templates: srcTemplates?.length ?? 0,
        },
      });
    }

    // ─── Execute copy ───
    const copied: Record<string, number> = {};

    // 1. Application form fields (JSONB in teams.settings)
    if (srcFormFields) {
      await admin
        .from("teams")
        .update({
          settings: {
            ...(sourceTeam.settings ?? {}),
            application_form_fields: srcFormFields,
          },
        })
        .eq("id", target_team_id);
      // Re-read target settings to merge properly
      const { data: currentTarget } = await admin
        .from("teams")
        .select("settings")
        .eq("id", target_team_id)
        .single();
      await admin
        .from("teams")
        .update({
          settings: {
            ...(currentTarget?.settings ?? {}),
            application_form_fields: srcFormFields,
          },
        })
        .eq("id", target_team_id);
      copied.application_form_fields = (srcFormFields as unknown[]).length;
    } else {
      copied.application_form_fields = 0;
    }

    // 2. Pipeline stages — delete target, insert source with new team_id
    await admin
      .from("pipeline_stages")
      .delete()
      .eq("team_id", target_team_id);

    if (srcStages && srcStages.length > 0) {
      const rows = srcStages.map(
        ({ id: _id, team_id: _tid, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
        })
      );
      await admin.from("pipeline_stages").insert(rows);
      copied.pipeline_stages = rows.length;
    } else {
      copied.pipeline_stages = 0;
    }

    // 3. Interview questions
    await admin
      .from("interview_questions")
      .delete()
      .eq("team_id", target_team_id);

    if (srcQuestions && srcQuestions.length > 0) {
      const rows = srcQuestions.map(
        ({ id: _id, team_id: _tid, user_id: _uid, created_at: _ca, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
          user_id: null, // team-shared, not user-specific
        })
      );
      await admin.from("interview_questions").insert(rows);
      copied.interview_questions = rows.length;
    } else {
      copied.interview_questions = 0;
    }

    // 4. Onboarding tasks
    await admin
      .from("onboarding_tasks")
      .delete()
      .eq("team_id", target_team_id);

    if (srcOnboarding && srcOnboarding.length > 0) {
      const rows = srcOnboarding.map(
        ({ id: _id, team_id: _tid, default_assignee_id: _da, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
          default_assignee_id: null, // assignees are user-specific
        })
      );
      await admin.from("onboarding_tasks").insert(rows);
      copied.onboarding_tasks = rows.length;
    } else {
      copied.onboarding_tasks = 0;
    }

    // 5. Scoring criteria
    await admin
      .from("scoring_criteria")
      .delete()
      .eq("team_id", target_team_id);

    if (srcScoring && srcScoring.length > 0) {
      const rows = srcScoring.map(
        ({ id: _id, team_id: _tid, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
        })
      );
      await admin.from("scoring_criteria").insert(rows);
      copied.scoring_criteria = rows.length;
    } else {
      copied.scoring_criteria = 0;
    }

    // 6. Group interview prompts
    await admin
      .from("group_interview_prompts")
      .delete()
      .eq("team_id", target_team_id);

    if (srcPrompts && srcPrompts.length > 0) {
      const rows = srcPrompts.map(
        ({ id: _id, team_id: _tid, created_at: _ca, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
        })
      );
      await admin.from("group_interview_prompts").insert(rows);
      copied.group_interview_prompts = rows.length;
    } else {
      copied.group_interview_prompts = 0;
    }

    // 7. Email template folders + email templates (with folder ID remapping)
    await admin
      .from("email_templates")
      .delete()
      .eq("team_id", target_team_id);
    await admin
      .from("email_template_folders")
      .delete()
      .eq("team_id", target_team_id);

    // Build old folder ID → new folder ID map
    const folderIdMap: Record<string, string> = {};

    if (srcFolders && srcFolders.length > 0) {
      const folderRows = srcFolders.map(
        ({ id: _id, team_id: _tid, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
        })
      );
      const { data: insertedFolders } = await admin
        .from("email_template_folders")
        .insert(folderRows)
        .select("id, name, order_index");

      // Map old folder IDs to new ones by matching name + order_index
      if (insertedFolders) {
        for (const srcFolder of srcFolders) {
          const match = insertedFolders.find(
            (f) =>
              f.name === srcFolder.name &&
              f.order_index === srcFolder.order_index
          );
          if (match) {
            folderIdMap[srcFolder.id] = match.id;
          }
        }
      }
      copied.email_template_folders = folderRows.length;
    } else {
      copied.email_template_folders = 0;
    }

    if (srcTemplates && srcTemplates.length > 0) {
      const templateRows = srcTemplates.map(
        ({ id: _id, team_id: _tid, folder_id, ...rest }) => ({
          ...rest,
          team_id: target_team_id,
          folder_id: folder_id ? folderIdMap[folder_id] ?? null : null,
        })
      );
      await admin.from("email_templates").insert(templateRows);
      copied.email_templates = templateRows.length;
    } else {
      copied.email_templates = 0;
    }

    return NextResponse.json({
      success: true,
      dry_run: false,
      source_team: sourceTeam.name,
      target_team: targetTeam.name,
      copied,
    });
  } catch (err) {
    console.error("Copy team settings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
