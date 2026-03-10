import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getClaims() instead of getUser() — validates JWT locally without
  // a network round-trip to Supabase, which is critical in the Node.js
  // proxy runtime (Next.js 16 proxy runs in Node, not Edge).
  const { data, error: claimsError } = await supabase.auth.getClaims();

  // Public routes (login, apply, auth/, api/) are excluded from the
  // middleware matcher, so this code only runs on protected routes.
  // No valid claims → redirect to login.
  if (claimsError || !data?.claims?.sub) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
