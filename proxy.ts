import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - api/ routes (handled by route handlers directly)
     * - login, apply, auth/, setup/, update-password (public routes — no auth check needed)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|login|apply|auth/|setup/|update-password|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
