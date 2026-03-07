import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOAuth2Client, getValidGoogleToken } from "@/lib/google";
import { google } from "googleapis";

/**
 * POST /api/gmail/sync
 *
 * Syncs inbound replies for a candidate's email threads.
 * Body: { candidate_id: string }
 *
 * Fetches all gmail_thread_ids for the candidate, then pulls any
 * new messages from Gmail that we haven't stored yet.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidate_id } = await req.json();
  if (!candidate_id) {
    return NextResponse.json(
      { error: "candidate_id is required" },
      { status: 400 }
    );
  }

  // Get a valid Google token for this user
  const accessToken = await getValidGoogleToken(auth.userId);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google account not connected" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get all unique thread IDs for this candidate
  const { data: existingEmails } = await supabase
    .from("candidate_emails")
    .select("gmail_thread_id, gmail_message_id")
    .eq("candidate_id", candidate_id)
    .not("gmail_thread_id", "is", null);

  const threadIds = [
    ...new Set(
      (existingEmails ?? [])
        .map((e: { gmail_thread_id: string | null }) => e.gmail_thread_id)
        .filter(Boolean)
    ),
  ] as string[];

  if (threadIds.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  // Set of message IDs we already have
  const knownMessageIds = new Set(
    (existingEmails ?? [])
      .map((e: { gmail_message_id: string | null }) => e.gmail_message_id)
      .filter(Boolean)
  );

  // Set up Gmail client
  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  let synced = 0;

  for (const threadId of threadIds) {
    try {
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });

      const messages = thread.data.messages ?? [];

      for (const msg of messages) {
        if (!msg.id || knownMessageIds.has(msg.id)) continue;

        // Extract headers
        const headers = msg.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find(
            (h: { name?: string | null }) =>
              h.name?.toLowerCase() === name.toLowerCase()
          )?.value ?? null;

        const from = getHeader("From");
        const to = getHeader("To");
        const subject = getHeader("Subject");
        const dateStr = getHeader("Date");

        // Get snippet for body preview
        const snippet = msg.snippet ?? "";

        await supabase.from("candidate_emails").insert({
          team_id: auth.teamId,
          candidate_id,
          sender_user_id: null, // inbound replies don't have a sender_user_id
          direction: "inbound",
          gmail_message_id: msg.id,
          gmail_thread_id: threadId,
          subject,
          body_snippet: snippet.slice(0, 500),
          from_address: from,
          to_address: to,
          sent_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        });

        synced++;
      }
    } catch {
      // Skip threads that fail (e.g. deleted threads)
      continue;
    }
  }

  return NextResponse.json({ synced });
}
