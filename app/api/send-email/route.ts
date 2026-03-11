import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyAuth } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendViaGmail } from "@/lib/google";

export async function POST(req: NextRequest) {
  try {
    // Auth gate: only authenticated users can send emails
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      to,
      subject,
      body: emailBody,
      cc,
      attachments,
      candidate_id,
      in_reply_to,
      thread_id,
    } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      );
    }

    // Resolve from address: use the authenticated user's configured from_email,
    // NOT an arbitrary value from the request body. Falls back to noreply.
    const supabase = createAdminClient();
    const { data: sender } = await supabase
      .from("users")
      .select("from_email, name, google_refresh_token, google_email")
      .eq("id", auth.userId)
      .single();

    const fromAddress = sender?.from_email || "VW Recruiting <onboarding@resend.dev>";

    // ── Try Gmail first (if user has connected Google) ──────────
    if (sender?.google_refresh_token) {
      try {
        const gmailResult = await sendViaGmail(auth.userId, {
          to,
          subject,
          html: emailBody,
          cc: cc || undefined,
          from: sender.google_email
            ? `${sender.name || "Recruiting"} <${sender.google_email}>`
            : undefined,
          inReplyTo: in_reply_to || undefined,
          threadId: thread_id || undefined,
        });

        if (gmailResult) {
          // Log to candidate_emails if candidate_id is provided
          if (candidate_id) {
            await supabase.from("candidate_emails").insert({
              team_id: auth.teamId,
              candidate_id,
              sender_user_id: auth.userId,
              direction: "outbound",
              gmail_message_id: gmailResult.messageId,
              gmail_thread_id: gmailResult.threadId,
              subject,
              body_snippet: emailBody.replace(/<[^>]*>/g, "").slice(0, 500),
              from_address: sender.google_email || fromAddress,
              to_address: Array.isArray(to) ? to[0] : to,
              sent_at: new Date().toISOString(),
            });
          }

          return NextResponse.json({
            success: true,
            sent_via: "gmail",
            gmail_message_id: gmailResult.messageId,
            gmail_thread_id: gmailResult.threadId,
          });
        }
        // If sendViaGmail returned null, fall through to Resend
      } catch {
        // Gmail send failed — fall through to Resend
      }
    }

    // ── Fallback: Resend ────────────────────────────────────────
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Email sending is not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      cc?: string[];
      attachments?: { filename: string; content: Buffer }[];
    } = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: emailBody,
      text: emailBody.replace(/<[^>]*>/g, ""),
    };

    if (cc) {
      emailPayload.cc = Array.isArray(cc) ? cc : [cc];
    }

    // Support file attachments (e.g. .ics calendar files)
    if (Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments.map(
        (a: { filename: string; content: string }) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "utf-8"),
        })
      );
    }

    const { data, error } = await resend.emails.send(
      emailPayload as Parameters<typeof resend.emails.send>[0]
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log to candidate_emails if candidate_id is provided
    if (candidate_id) {
      await supabase.from("candidate_emails").insert({
        team_id: auth.teamId,
        candidate_id,
        sender_user_id: auth.userId,
        direction: "outbound",
        subject,
        body_snippet: emailBody.replace(/<[^>]*>/g, "").slice(0, 500),
        from_address: fromAddress,
        to_address: Array.isArray(to) ? to[0] : to,
        sent_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, sent_via: "resend", id: data?.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
