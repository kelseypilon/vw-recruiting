import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cron/notifications
 *
 * Multi-tenant cron endpoint — loops through all active teams
 * and runs the notification triggers for each.
 *
 * Auth: requires CRON_SECRET header.
 *
 * Designed to be called by Vercel Cron, GitHub Actions, or any
 * external scheduler on a regular cadence (e.g. every hour).
 */
export async function POST(req: NextRequest) {
  try {
    // Auth: only accept CRON_SECRET header
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    const headerSecret = req.headers.get("x-cron-secret");
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Fetch all active teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("is_active", true);

    if (teamsError) {
      return NextResponse.json(
        { error: `Failed to fetch teams: ${teamsError.message}` },
        { status: 500 }
      );
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active teams found",
        teams_processed: 0,
      });
    }

    // Process each team by calling the existing /api/notifications endpoint
    const results: {
      team_id: string;
      team_name: string;
      status: "ok" | "error";
      data?: unknown;
      error?: string;
    }[] = [];

    for (const team of teams) {
      try {
        const baseUrl = req.nextUrl.origin;
        const res = await fetch(`${baseUrl}/api/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": cronSecret,
          },
          body: JSON.stringify({ team_id: team.id }),
        });

        const data = await res.json();

        if (res.ok) {
          results.push({
            team_id: team.id,
            team_name: team.name,
            status: "ok",
            data,
          });
        } else {
          results.push({
            team_id: team.id,
            team_name: team.name,
            status: "error",
            error: data.error || `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        results.push({
          team_id: team.id,
          team_name: team.name,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const succeeded = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      teams_processed: teams.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/cron/notifications
 *
 * Health check for the cron endpoint.
 * Vercel Cron uses GET requests by default.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");

  // Also accept Vercel's cron authorization header
  const vercelAuth = req.headers.get("authorization");
  const isVercelCron = vercelAuth === `Bearer ${cronSecret}`;

  if (!cronSecret || (!isVercelCron && headerSecret !== cronSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // For GET requests, run the same notification processing
  // (Vercel Cron jobs use GET by default)
  const supabase = createAdminClient();

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("is_active", true);

  if (teamsError) {
    return NextResponse.json(
      { error: `Failed to fetch teams: ${teamsError.message}` },
      { status: 500 }
    );
  }

  if (!teams || teams.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No active teams found",
      teams_processed: 0,
    });
  }

  const results: {
    team_id: string;
    team_name: string;
    status: "ok" | "error";
    data?: unknown;
    error?: string;
  }[] = [];

  for (const team of teams) {
    try {
      const baseUrl = req.nextUrl.origin;
      const res = await fetch(`${baseUrl}/api/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({ team_id: team.id }),
      });

      const data = await res.json();

      if (res.ok) {
        results.push({
          team_id: team.id,
          team_name: team.name,
          status: "ok",
          data,
        });
      } else {
        results.push({
          team_id: team.id,
          team_name: team.name,
          status: "error",
          error: data.error || `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      results.push({
        team_id: team.id,
        team_name: team.name,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    success: true,
    teams_processed: teams.length,
    succeeded,
    failed,
    results,
  });
}
