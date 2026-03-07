import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/onboarding/automate
 *
 * Runs an automation for an onboarding task.
 * Body: { task_id, candidate_id, team_id, automation_key, entry_id? }
 *
 * Supported automation_key values:
 *   - google_workspace  → placeholder (would create Google Workspace account)
 *   - teachable         → placeholder (would enrol in Teachable course)
 *   - slack             → sends Slack webhook notification
 *   - follow_up_boss    → placeholder (would create FUB contact)
 *
 * All automations are fire-and-forget style. On success the caller should
 * mark the task as completed (the dashboard does this automatically).
 */
export async function POST(req: NextRequest) {
  try {
    const { task_id, candidate_id, team_id, automation_key, entry_id } =
      await req.json();

    if (!task_id || !candidate_id || !team_id) {
      return NextResponse.json(
        { error: "task_id, candidate_id, and team_id are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch team integrations
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("integrations, brand_name, name")
      .eq("id", team_id)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Fetch candidate info
    const { data: candidate, error: candError } = await supabase
      .from("candidates")
      .select("first_name, last_name, email, phone")
      .eq("id", candidate_id)
      .single();

    if (candError || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    const integrations = (team.integrations ?? {}) as Record<string, Record<string, unknown>>;
    const key = automation_key ?? "unknown";
    const teamName = team.brand_name ?? team.name ?? "Team";

    // ── Automation dispatch ──────────────────────────────────────────

    switch (key) {
      case "google_workspace": {
        const config = integrations.google_workspace;
        if (!config?.enabled) {
          return NextResponse.json(
            { error: "Google Workspace integration is not enabled. Configure it in Settings → Integrations." },
            { status: 400 }
          );
        }
        // Placeholder — in production, would call Google Admin SDK
        // to create user account under config.domain
        const domain = config.domain ?? "example.com";
        return NextResponse.json({
          success: true,
          message: `Google Workspace account would be created: ${candidate.first_name?.toLowerCase()}.${candidate.last_name?.toLowerCase()}@${domain}`,
          simulated: true,
        });
      }

      case "teachable": {
        const config = integrations.teachable;
        if (!config?.enabled) {
          return NextResponse.json(
            { error: "Teachable integration is not enabled. Configure it in Settings → Integrations." },
            { status: 400 }
          );
        }
        // Placeholder — in production, would call Teachable API
        // to enrol candidate in onboarding course
        return NextResponse.json({
          success: true,
          message: `${candidate.first_name} ${candidate.last_name} would be enrolled in Teachable onboarding course at ${config.school_url ?? "school.teachable.com"}.`,
          simulated: true,
        });
      }

      case "slack": {
        const config = integrations.slack;
        if (!config?.enabled || !config?.webhook_url) {
          return NextResponse.json(
            { error: "Slack integration is not enabled or webhook URL is missing. Configure it in Settings → Integrations." },
            { status: 400 }
          );
        }

        // Send a real Slack webhook notification
        try {
          const slackRes = await fetch(config.webhook_url as string, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `🎉 *New team member onboarding*\n*${candidate.first_name} ${candidate.last_name}* is being onboarded at ${teamName}.${candidate.email ? `\nEmail: ${candidate.email}` : ""}`,
              ...(config.channel ? { channel: config.channel } : {}),
            }),
          });

          if (!slackRes.ok) {
            return NextResponse.json(
              { error: `Slack webhook returned ${slackRes.status}. Check your webhook URL.` },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            message: `Slack notification sent to ${config.channel ? `#${config.channel}` : "configured channel"}.`,
          });
        } catch {
          return NextResponse.json(
            { error: "Failed to send Slack webhook. Check the webhook URL." },
            { status: 500 }
          );
        }
      }

      case "follow_up_boss": {
        const config = integrations.follow_up_boss;
        if (!config?.enabled) {
          return NextResponse.json(
            { error: "Follow Up Boss integration is not enabled. Configure it in Settings → Integrations." },
            { status: 400 }
          );
        }
        // Placeholder — in production, would call FUB API to create contact
        return NextResponse.json({
          success: true,
          message: `${candidate.first_name} ${candidate.last_name} would be added as a contact in Follow Up Boss.`,
          simulated: true,
        });
      }

      default: {
        return NextResponse.json(
          { error: `Unknown automation key: "${key}". Supported: google_workspace, teachable, slack, follow_up_boss.` },
          { status: 400 }
        );
      }
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
