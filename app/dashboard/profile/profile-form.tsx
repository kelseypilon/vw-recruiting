"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TeamUser } from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  user: TeamUser;
}

/* ── Helper ────────────────────────────────────────────────────── */

async function saveProfile(
  payload: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update_user_profile", payload }),
  });
  return res.json();
}

/* ── Lock Icon ─────────────────────────────────────────────────── */

function LockIcon({ tooltip }: { tooltip: string }) {
  return (
    <span title={tooltip} className="inline-flex items-center ml-1.5">
      <svg
        className="w-3.5 h-3.5 text-[#a59494]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    </span>
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export default function ProfileForm({ user }: Props) {
  const [name, setName] = useState(user.name);
  const [photoUrl, setPhotoUrl] = useState(user.photo_url ?? "");
  const [fromEmail, setFromEmail] = useState(user.from_email ?? "");
  const [bookingUrl, setBookingUrl] = useState(user.google_booking_url ?? "");
  const [virtualBookingUrl, setVirtualBookingUrl] = useState(user.virtual_booking_url ?? "");
  const [inpersonBookingUrl, setInpersonBookingUrl] = useState(user.inperson_booking_url ?? "");
  const [virtualMeetingLink, setVirtualMeetingLink] = useState(user.virtual_meeting_link ?? "");
  const [scorecardVisibility, setScorecardVisibility] = useState(
    user.scorecard_visibility ?? "team"
  );
  const [emailReminders, setEmailReminders] = useState(
    user.notification_preferences?.email_reminders ?? true
  );
  const [digest, setDigest] = useState(
    user.notification_preferences?.digest ?? false
  );

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // Google connection state
  const [googleEmail, setGoogleEmail] = useState(user.google_email ?? "");
  const isGoogleConnected = !!user.google_refresh_token;
  const [disconnecting, setDisconnecting] = useState(false);

  // Handle Google OAuth callback params
  useEffect(() => {
    const connected = searchParams.get("google_connected");
    const googleError = searchParams.get("google_error");
    if (connected === "true") {
      setToast("Google account connected successfully!");
      setTimeout(() => setToast(null), 4000);
      // Clean up URL
      window.history.replaceState({}, "", "/dashboard/profile");
    } else if (googleError) {
      setToast(`Error: ${googleError}`);
      setTimeout(() => setToast(null), 5000);
      window.history.replaceState({}, "", "/dashboard/profile");
    }
  }, [searchParams]);

  /* ── Dirty check ───────────────────────────────────── */
  const isDirty =
    name !== user.name ||
    photoUrl !== (user.photo_url ?? "") ||
    fromEmail !== (user.from_email ?? "") ||
    bookingUrl !== (user.google_booking_url ?? "") ||
    virtualBookingUrl !== (user.virtual_booking_url ?? "") ||
    inpersonBookingUrl !== (user.inperson_booking_url ?? "") ||
    virtualMeetingLink !== (user.virtual_meeting_link ?? "") ||
    scorecardVisibility !== (user.scorecard_visibility ?? "team") ||
    emailReminders !== (user.notification_preferences?.email_reminders ?? true) ||
    digest !== (user.notification_preferences?.digest ?? false);

  /* ── Avatar upload ─────────────────────────────────── */
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setToast("Error: Please select an image file");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setToast("Error: Image must be smaller than 5MB");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setToast(`Error: ${uploadError.message}`);
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache-busting param so the browser shows the new image
      setPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
      setToast("Photo uploaded! Remember to save your profile.");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Error: Failed to upload photo");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploading(false);
      // Reset file input so re-selecting the same file works
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const result = await saveProfile({
        id: user.id,
        name: name.trim(),
        photo_url: photoUrl.trim() || null,
        from_email: fromEmail.trim() || null,
        google_booking_url: bookingUrl.trim() || null,
        virtual_booking_url: virtualBookingUrl.trim() || null,
        inperson_booking_url: inpersonBookingUrl.trim() || null,
        virtual_meeting_link: virtualMeetingLink.trim() || null,
        scorecard_visibility: scorecardVisibility,
        notification_preferences: {
          email_reminders: emailReminders,
          digest,
        },
      });

      if (result.error) {
        setToast(`Error: ${result.error}`);
      } else {
        setToast("Profile saved successfully!");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleGoogleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setGoogleEmail("");
        setToast("Google account disconnected.");
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(`Error: ${data.error || "Failed to disconnect"}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast("Error: Failed to disconnect Google account");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDisconnecting(false);
    }
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#272727] mb-1">My Profile</h1>
      <p className="text-sm text-[#a59494] mb-8">
        Update your personal settings and preferences
      </p>

      <div className="bg-white rounded-xl border border-[#a59494]/20 divide-y divide-[#a59494]/10">
        {/* Avatar + Name */}
        <div className="p-6">
          <div className="flex items-center gap-5 mb-6">
            {/* Clickable Avatar */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative group flex-shrink-0"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#a59494]/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white text-xl font-bold">
                  {initials}
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <svg
                    className="w-5 h-5 text-white animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                    />
                  </svg>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </button>

            <div>
              <p className="text-lg font-semibold text-[#272727]">{name}</p>
              <p className="text-sm text-[#a59494]">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center text-xs px-2 py-0.5 bg-brand/10 text-brand rounded-full font-medium">
                  {user.role}
                  <LockIcon tooltip="Set by your team admin" />
                </span>
                {user.title && (
                  <span className="text-xs text-[#a59494]">{user.title}</span>
                )}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
        </div>

        {/* Email settings */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#272727] uppercase tracking-wide">
            Email Settings
          </h3>

          <div>
            <label className="flex items-center text-sm font-medium text-[#272727] mb-1">
              Email Address
              <LockIcon tooltip="Linked to your login account" />
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full border border-[#a59494]/20 rounded-lg px-4 py-2.5 text-sm bg-[#f5f0f0] text-[#a59494] cursor-not-allowed"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Your email is linked to your login and cannot be changed here.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              From Email (for candidate emails)
            </label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="your-name@company.com"
              className="w-full border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Optional. Emails to candidates will appear from this address.
            </p>
          </div>
        </div>

        {/* Google Workspace Connection */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#272727] uppercase tracking-wide">
            Google Workspace
          </h3>
          <p className="text-xs text-[#a59494]">
            Connect your Google account to send emails directly from your Gmail address.
          </p>

          {isGoogleConnected && googleEmail ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  <p className="text-xs text-green-600">{googleEmail}</p>
                </div>
              </div>
              <button
                onClick={handleGoogleDisconnect}
                disabled={disconnecting}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-md hover:bg-red-50 transition disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#a59494]/30 rounded-lg text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Google Account
            </a>
          )}
        </div>

        {/* Booking URLs */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#272727] uppercase tracking-wide">
            Scheduling &amp; Booking Links
          </h3>

          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Virtual Booking Link
            </label>
            <input
              type="url"
              value={virtualBookingUrl}
              onChange={(e) => setVirtualBookingUrl(e.target.value)}
              placeholder="https://calendly.com/... or https://calendar.google.com/..."
              className="w-full border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Booking link for virtual/video interviews.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              In-Person Booking Link
            </label>
            <input
              type="url"
              value={inpersonBookingUrl}
              onChange={(e) => setInpersonBookingUrl(e.target.value)}
              placeholder="https://calendly.com/... or https://calendar.google.com/..."
              className="w-full border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Booking link for in-person interviews at the office.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Virtual Meeting Link
            </label>
            <input
              type="url"
              value={virtualMeetingLink}
              onChange={(e) => setVirtualMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
              className="w-full border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Your personal Zoom or Google Meet link for virtual interviews.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Legacy Booking URL
              <span className="text-xs font-normal text-[#a59494] ml-1">(deprecated)</span>
            </label>
            <input
              type="url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://calendar.google.com/..."
              className="w-full border border-[#a59494]/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-[#a59494]"
            />
            <p className="text-xs text-[#a59494] mt-1">
              Previous booking link. Use the fields above instead.
            </p>
          </div>
        </div>

        {/* Preferences */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#272727] uppercase tracking-wide">
            Preferences
          </h3>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[#272727]">
              Notification Preferences
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailReminders}
                onChange={(e) => setEmailReminders(e.target.checked)}
                className="w-4 h-4 text-brand border-[#a59494]/30 rounded focus:ring-brand/30"
              />
              <div>
                <span className="text-sm text-[#272727]">Email Reminders</span>
                <p className="text-xs text-[#a59494]">
                  Receive email reminders for upcoming interviews and overdue tasks
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={digest}
                onChange={(e) => setDigest(e.target.checked)}
                className="w-4 h-4 text-brand border-[#a59494]/30 rounded focus:ring-brand/30"
              />
              <div>
                <span className="text-sm text-[#272727]">Daily Digest</span>
                <p className="text-xs text-[#a59494]">
                  Receive a daily summary of recruiting activity
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="p-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !isDirty}
            className="relative px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
            {isDirty && !saving && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
            )}
          </button>

          {toast && (
            <span
              className={`text-sm font-medium ${
                toast.startsWith("Error") ? "text-red-600" : "text-green-600"
              }`}
            >
              {toast}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
