import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth 2.0 flow for Gmail integration.
 * Uses direct Supabase auth check (no verifyAuth) for resilience.
 */
export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim();
  const profileUrl = `${baseUrl}/dashboard/profile`;

  // 1. Check Google OAuth is configured
  if (!isGoogleOAuthConfigured()) {
    console.error("[Google OAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent("Google OAuth is not configured. Contact your administrator.")}`
    );
  }

  // 2. Get the authenticated Supabase user
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser?.email) {
    console.error("[Google OAuth] No authenticated user — redirecting to login");
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // 3. Look up the internal user ID
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("email", authUser.email)
    .limit(1)
    .single();

  if (!profile) {
    console.error("[Google OAuth] No user profile found for", authUser.email);
    return NextResponse.redirect(
      `${profileUrl}?google_error=${encodeURIComponent("User profile not found. Please contact your administrator.")}`
    );
  }

  // 4. Build state and redirect to Google consent
  const state = Buffer.from(
    JSON.stringify({ userId: profile.id })
  ).toString("base64url");

  return NextResponse.redirect(getGoogleAuthUrl(state));
}
