"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Auth logic will be wired up once Supabase is configured
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0f0]">
      <div className="w-full max-w-md px-8 py-10 bg-white rounded-2xl shadow-lg">
        {/* Logo placeholder */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#1c759e] flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold tracking-wide">VW</span>
          </div>
          <h1 className="text-2xl font-bold text-[#272727] tracking-tight">
            Vantage West Realty
          </h1>
          <p className="text-sm text-[#a59494] mt-1 font-medium">Recruiting Portal</p>
        </div>

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
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition text-sm"
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
              className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2.5 px-4 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white font-semibold text-sm tracking-wide transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#a59494]">
          &copy; {new Date().getFullYear()} Vantage West Realty. All rights reserved.
        </p>
      </div>
    </div>
  );
}
