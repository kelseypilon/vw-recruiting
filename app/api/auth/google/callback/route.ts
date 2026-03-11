import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { google } from "googleapis";

/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth 2.0 callback from Google.
 * Exchanges the authorization code for tokens and stores them on the user record.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Base redirect — go back to profile page
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const profileUrl = `${siteUrl}/dashboard/profile`;

  if (error) {
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent("Missing code or state")}`
    );
  }

  // Decode state to get userId
  let userId: string;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    userId = parsed.userId;
    if (!userId) throw new Error("No userId");
  } catch {
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent("Invalid state parameter")}`
    );
  }

  // Exchange code for tokens
  const oauth2 = createOAuth2Client();

  try {
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Get the user's Google email
    const oauth2Service = google.oauth2({ version: "v2", auth: oauth2 });
    const { data: userInfo } = await oauth2Service.userinfo.get();
    const googleEmail = userInfo.email ?? null;

    // Store tokens on the user record
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        google_access_token: tokens.access_token ?? null,
        google_refresh_token: tokens.refresh_token ?? null,
        google_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        google_email: googleEmail,
      })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.redirect(
        `${profileUrl}?google_error=${encodeURIComponent("Failed to save tokens")}`
      );
    }

    return NextResponse.redirect(`${profileUrl}?google_connected=true`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent(message)}`
    );
  }
}
