import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    // Auth gate: only authenticated users can send emails
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const body = await req.json();
    const { to, subject, body: emailBody, from_email, cc, attachments } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      );
    }

    // Use provided from_email or default
    const fromAddress = from_email || "noreply@recruiting.app";

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
    // Each attachment: { filename: string, content: string }
    if (Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments.map(
        (a: { filename: string; content: string }) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "utf-8"),
        })
      );
    }

    const { data, error } = await resend.emails.send(emailPayload as Parameters<typeof resend.emails.send>[0]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
