import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/ghl
 *
 * Fire-and-forget GHL (GoHighLevel) webhook on stage changes.
 * Body: { team_id, candidate_id, from_stage, to_stage }
 *
 * 1. Looks up the team's GHL integration config
 * 2. If GHL is enabled and has an API key + location_id, fires webhook
 * 3. Logs the attempt to the webhook_log table
 * 4. Returns immediately — does not block caller
 */
export async function POST(req: NextRequest) {
  try {
    const { team_id, candidate_id, from_stage, to_stage } = await req.json();

    if (!team_id || !candidate_id) {
      return NextResponse.json({ skipped: true, reason: "missing fields" });
    }

    const supabase = createAdminClient();

    // Fetch team GHL config
    const { data: team } = await supabase
      .from("teams")
      .select("integrations, brand_name, name")
      .eq("id", team_id)
      .single();

    const ghl = (team?.integrations as Record<string, Record<string, unknown>> | null)?.ghl;
    if (!ghl?.enabled || !ghl?.api_key) {
      return NextResponse.json({ skipped: true, reason: "GHL not enabled" });
    }

    // Fetch candidate info for the webhook payload
    const { data: candidate } = await supabase
      .from("candidates")
      .select("first_name, last_name, email, phone")
      .eq("id", candidate_id)
      .single();

    if (!candidate) {
      return NextResponse.json({ skipped: true, reason: "candidate not found" });
    }

    const teamName = team?.brand_name ?? team?.name ?? "Team";

    // Build webhook payload
    const payload = {
      event: "stage_change",
      team: teamName,
      team_id,
      candidate: {
        id: candidate_id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: candidate.email,
        phone: candidate.phone,
      },
      from_stage,
      to_stage,
      timestamp: new Date().toISOString(),
    };

    // Fire the GHL webhook
    // GHL custom webhooks typically go to the inbound webhook URL
    // Format: POST to GHL location webhook with API key auth
    const locationId = ghl.location_id as string | undefined;
    const apiKey = ghl.api_key as string;
    const webhookUrl = locationId
      ? `https://services.leadconnectorhq.com/hooks/${locationId}/webhook`
      : null;

    let status: "success" | "failed" | "skipped" = "skipped";
    let responseCode: number | null = null;
    let errorMessage: string | null = null;

    if (webhookUrl) {
      try {
        const ghlRes = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
        responseCode = ghlRes.status;
        status = ghlRes.ok ? "success" : "failed";
        if (!ghlRes.ok) {
          errorMessage = `GHL returned ${ghlRes.status}`;
        }
      } catch (err: unknown) {
        status = "failed";
        errorMessage = err instanceof Error ? err.message : "GHL request failed";
      }
    } else {
      errorMessage = "No location_id configured — cannot determine webhook URL";
    }

    // Log to webhook_log table (best effort)
    try {
      await supabase
        .from("webhook_log")
        .insert({
          team_id,
          event_type: "stage_change",
          provider: "ghl",
          payload,
          status,
          response_code: responseCode,
          error_message: errorMessage,
        });
    } catch {
      // silently fail log insert
    }

    return NextResponse.json({ status, response_code: responseCode });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
