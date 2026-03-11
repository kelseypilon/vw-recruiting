import "server-only";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

/* ── Google OAuth Configuration ──────────────────────────────── */

// Read env vars lazily at call-time (not module-load time) so that
// Vercel env vars added after a build are picked up on next cold-start.
function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function getGoogleRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;
}

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

/* ── OAuth2 Client ───────────────────────────────────────────── */

/** Returns true if the required Google OAuth env vars are configured */
export function isGoogleOAuthConfigured(): boolean {
  const hasClientId = !!getGoogleClientId();
  const hasClientSecret = !!getGoogleClientSecret();
  // Debug: log env var presence at runtime (remove once confirmed working)
  console.log(`[Google OAuth] client_id present: ${hasClientId}, client_secret present: ${hasClientSecret}`);
  return hasClientId && hasClientSecret;
}

export function createOAuth2Client() {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
    );
  }
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    getGoogleRedirectUri()
  );
}

/** Generate the Google consent URL for a user */
export function getGoogleAuthUrl(state: string): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/* ── Token Refresh ───────────────────────────────────────────── */

/**
 * Get a valid access token for a user, refreshing if expired.
 * Returns null if the user has no Google connection.
 */
export async function getValidGoogleToken(
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .single();

  if (!user?.google_refresh_token) return null;

  // Check if token is still valid (with 5-minute buffer)
  const expiry = user.google_token_expiry
    ? new Date(user.google_token_expiry)
    : new Date(0);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (user.google_access_token && expiry.getTime() - now.getTime() > bufferMs) {
    return user.google_access_token;
  }

  // Token expired — refresh it
  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ refresh_token: user.google_refresh_token });

  try {
    const { credentials } = await oauth2.refreshAccessToken();

    // Store the refreshed token
    await supabase
      .from("users")
      .update({
        google_access_token: credentials.access_token,
        google_token_expiry: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      })
      .eq("id", userId);

    return credentials.access_token ?? null;
  } catch {
    // Refresh failed — token may have been revoked
    // Clear the stale tokens so the user can re-connect
    await supabase
      .from("users")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_email: null,
      })
      .eq("id", userId);

    return null;
  }
}

/* ── Gmail Send ──────────────────────────────────────────────── */

/**
 * Send an email via Gmail API on behalf of a user.
 * Returns { messageId, threadId } on success.
 */
export async function sendViaGmail(
  userId: string,
  opts: {
    to: string | string[];
    subject: string;
    html: string;
    cc?: string | string[];
    from?: string;
    inReplyTo?: string;
    threadId?: string;
  }
): Promise<{ messageId: string; threadId: string } | null> {
  const accessToken = await getValidGoogleToken(userId);
  if (!accessToken) return null;

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const toAddresses = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
  const ccAddresses = opts.cc
    ? Array.isArray(opts.cc)
      ? opts.cc.join(", ")
      : opts.cc
    : "";

  // Build RFC 2822 MIME message
  const headers = [
    `To: ${toAddresses}`,
    `Subject: ${opts.subject}`,
    `Content-Type: text/html; charset=utf-8`,
  ];

  if (opts.from) headers.unshift(`From: ${opts.from}`);
  if (ccAddresses) headers.push(`Cc: ${ccAddresses}`);
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }

  const rawMessage = [...headers, "", opts.html].join("\r\n");

  // Base64url-encode the message
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendParams: { userId: string; requestBody: { raw: string; threadId?: string } } = {
    userId: "me",
    requestBody: { raw: encoded },
  };

  if (opts.threadId) {
    sendParams.requestBody.threadId = opts.threadId;
  }

  const result = await gmail.users.messages.send(sendParams);

  return {
    messageId: result.data.id ?? "",
    threadId: result.data.threadId ?? "",
  };
}
