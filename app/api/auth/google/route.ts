import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google";

/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth 2.0 flow for Gmail integration.
 * Requires authenticated user — encodes userId in state parameter.
 */
export async function GET() {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." },
      { status: 503 }
    );
  }

  // Encode userId in state so the callback can look up the right user
  const state = Buffer.from(
    JSON.stringify({ userId: auth.userId })
  ).toString("base64url");

  const authUrl = getGoogleAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
