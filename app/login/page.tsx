"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TeamBranding } from "@/lib/types";
import { getBrandingFooter } from "@/lib/branding";

/** Default branding (Vantage West) used before API response arrives */
const DEFAULT_BRANDING: TeamBranding = {
  mode: "vantage",
  name: "Vantage West Realty",
  logoUrl: null,
  primaryColor: "#1c759e",
  secondaryColor: "#272727",
  primaryDark: "#155f82",
  primaryLight: "#2a8fc0",
  showPoweredBy: false,
  initials: "VW",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<TeamBranding>(DEFAULT_BRANDING);
  const router = useRouter();
  const searchParams = useSearchParams();

  const authError = searchParams.get("error");
  const teamSlug = searchParams.get("team");

  // Fetch branding for ?team=slug
  useEffect(() => {
    if (!teamSlug) return;
    async function loadBranding() {
      try {
        const res = await fetch(`/api/team-branding?slug=${encodeURIComponent(teamSlug!)}`);
        const json = await res.json();
        if (json.data) setBranding(json.data);
      } catch {
        // keep defaults
      }
    }
    loadBranding();
  }, [teamSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0f0]">
      <div className="w-full max-w-md px-8 py-10 bg-white rounded-2xl shadow-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {branding.logoUrl && branding.logoUrl.startsWith("https://") ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="w-20 h-20 rounded-full object-cover mb-4"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: branding.primaryColor }}
            >
              <span className="text-white text-2xl font-bold tracking-wide">
                {branding.initials}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-[#272727] tracking-tight">
            {branding.name}
          </h1>
          <p className="text-sm text-[#a59494] mt-1 font-medium">Recruiting Portal</p>
        </div>

        {/* Error messages */}
        {(error || authError) && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error || "Authentication failed. Please try again."}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-[#272727]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:border-transparent transition text-sm"
              style={{ "--tw-ring-color": branding.primaryColor } as React.CSSProperties}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-[#272727]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:border-transparent transition text-sm"
              style={{ "--tw-ring-color": branding.primaryColor } as React.CSSProperties}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm tracking-wide transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: branding.primaryColor }}
            onMouseEnter={(e) =>
              !loading && (e.currentTarget.style.backgroundColor = branding.primaryDark)
            }
            onMouseLeave={(e) =>
              !loading && (e.currentTarget.style.backgroundColor = branding.primaryColor)
            }
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#a59494]">
          {getBrandingFooter(branding)}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
