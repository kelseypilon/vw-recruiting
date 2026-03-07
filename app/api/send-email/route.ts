import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const body = await req.json();
    const { to, subject, body: emailBody, from_email, cc } = body;

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
      text: string;
      cc?: string[];
    } = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: emailBody,
    };

    if (cc) {
      emailPayload.cc = Array.isArray(cc) ? cc : [cc];
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
