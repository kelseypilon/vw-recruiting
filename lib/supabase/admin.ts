import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using the service role key.
 * Bypasses Row Level Security — use only in server components and API routes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
