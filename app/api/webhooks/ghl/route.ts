import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET ?? "";

/**
 * Verify HMAC-SHA256 signature from an inbound webhook request.
 * If GHL_WEBHOOK_SECRET is configured, the X-GHL-Signature header
 * must match HMAC(secret, rawBody).
 */
function verifyGhlSignature(rawBody: string, signature: string | null): boolean {
  if (!GHL_WEBHOOK_SECRET) return true; // No secret configured — skip check
  if (!signature) return false;

  const expected = createHmac("sha256", GHL_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * POST /api/webhooks/ghl
 *
 * Fire-and-forget GHL (GoHighLevel) webhook on stage changes.
 * Body: { team_id, candidate_id, from_stage, to_stage }
 *
 * 1. Verifies webhook signature if GHL_WEBHOOK_SECRET is set
 * 2. Looks up the team's GHL integration config
 * 3. If GHL is enabled and has an API key + location_id, fires webhook
 * 4. Logs the attempt to the webhook_log table
 * 5. Returns immediately — does not block caller
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-ghl-signature");

    // Verify signature if secret is configured
    if (GHL_WEBHOOK_SECRET && !verifyGhlSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const { team_id, candidate_id, from_stage, to_stage } = JSON.parse(rawBody);

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
