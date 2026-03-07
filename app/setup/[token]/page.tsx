"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface InviteInfo {
  email: string;
  role: string;
  team_id: string;
  team_name: string;
  team_logo: string | null;
  primary_color: string;
}

export default function SetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch("/api/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "validate_token", token }),
        });
        const json = await res.json();
        if (json.valid) {
          setInvite(json.invite);
        } else {
          setError(json.error ?? "Invalid invite link");
        }
      } catch {
        setError("Failed to validate invite. Please try again.");
      }
      setLoading(false);
    }
    validate();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept_invite",
          token,
          name: name.trim(),
          password,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(true);
      } else {
        setError(json.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error — please try again");
    }
    setSubmitting(false);
  }

  const primaryColor = invite?.primary_color ?? "#1c759e";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0f0]">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[#a59494] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#a59494]">Validating invite…</p>
        </div>
      </div>
    );
  }

  if (!invite && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0f0]">
        <div className="w-full max-w-md px-8 py-10 bg-white rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#272727] mb-2">Invalid Invite</h1>
          <p className="text-sm text-[#a59494] mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition"
            style={{ backgroundColor: "#1c759e" }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0f0]">
        <div className="w-full max-w-md px-8 py-10 bg-white rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#272727] mb-2">Account Created!</h1>
          <p className="text-sm text-[#a59494] mb-6">
            Your account has been set up successfully. You can now sign in.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition"
            style={{ backgroundColor: primaryColor }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0f0]">
      <div className="w-full max-w-md px-8 py-10 bg-white rounded-2xl shadow-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          {invite?.team_logo ? (
            <img
              src={invite.team_logo}
              alt={invite.team_name}
              className="w-16 h-16 rounded-full object-cover mb-3"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="text-white text-xl font-bold">
                {invite?.team_name?.slice(0, 2).toUpperCase() ?? "VW"}
              </span>
            </div>
          )}
          <h1 className="text-xl font-bold text-[#272727]">
            Join {invite?.team_name}
          </h1>
          <p className="text-sm text-[#a59494] mt-1">
            Set up your account as <span className="font-medium capitalize">{invite?.role}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">Email</label>
            <input
              type="email"
              value={invite?.email ?? ""}
              readOnly
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#a59494] bg-[#f5f0f0] text-sm cursor-not-allowed"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:border-transparent transition text-sm"
              style={{ "--tw-ring-color": primaryColor } as React.CSSProperties}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:border-transparent transition text-sm"
              style={{ "--tw-ring-color": primaryColor } as React.CSSProperties}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-[#272727] mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:border-transparent transition text-sm"
              style={{ "--tw-ring-color": primaryColor } as React.CSSProperties}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm transition disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? "Creating Account…" : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[#a59494]">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/login")}
            className="font-medium hover:underline"
            style={{ color: primaryColor }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
