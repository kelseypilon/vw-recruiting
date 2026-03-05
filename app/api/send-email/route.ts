import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, body: emailBody, from_email, bcc } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      );
    }

    // Use provided from_email or default
    const fromAddress = from_email || "noreply@vantagewestrealestate.com";

    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      text: string;
      bcc?: string[];
    } = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: emailBody,
    };

    if (bcc) {
      emailPayload.bcc = Array.isArray(bcc) ? bcc : [bcc];
    }

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
