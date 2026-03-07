import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/google/disconnect
 *
 * Removes stored Google OAuth tokens from the user record.
 */
export async function POST() {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("users")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      google_email: null,
    })
    .eq("id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
