import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth 2.0 flow for Gmail integration.
 * Requires authenticated user — encodes userId in state parameter.
 */
export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim();
  const profileUrl = `${baseUrl}/dashboard/profile`;

  const auth = await verifyAuth();
  if (!auth) {
    // Redirect to login instead of showing raw JSON
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  if (!isGoogleOAuthConfigured()) {
    console.error("[Google OAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent("Google OAuth is not configured. Contact your administrator.")}`
    );
  }

  // Encode userId in state so the callback can look up the right user
  const state = Buffer.from(
    JSON.stringify({ userId: auth.userId })
  ).toString("base64url");

  const authUrl = getGoogleAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
