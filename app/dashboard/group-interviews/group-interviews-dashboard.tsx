"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Candidate, TeamUser, GroupInterviewSession } from "@/lib/types";
import { usePermissions } from "@/lib/user-permissions-context";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  eligibleCandidates: Candidate[];
  leaders: TeamUser[];
  teamId: string;
  currentUserId: string;
  teamInterviewDate: string | null;
}

/* ── Main Component ────────────────────────────────────────────── */

export default function GroupInterviewsDashboard({
  eligibleCandidates,
  leaders,
  teamId,
  currentUserId,
  teamInterviewDate,
}: Props) {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("manage_interviews");
  const [sessions, setSessions] = useState<
    (GroupInterviewSession & { _candidate_count?: number })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
    candidateCount: number;
  } | null>(null);
  const [toast, setToast] = useState("");

  // Fetch sessions
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_sessions",
            payload: { team_id: teamId },
          }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        setSessions(json.data ?? []);
      } catch {
        console.error("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const upcoming = sessions.filter(
    (s) => (s.status ?? "upcoming") !== "completed"
  );
  const completed = sessions.filter(
    (s) => (s.status ?? "upcoming") === "completed"
  );

  async function handleDeleteSession(sessionId: string) {
    // Optimistic: remove from list immediately
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setDeleteConfirm(null);

    try {
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_session",
          payload: { session_id: sessionId },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast("Session deleted");
      setTimeout(() => setToast(""), 3000);
    } catch {
      // Re-fetch on failure
      setToast("Failed to delete session");
      setTimeout(() => setToast(""), 3000);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#272727]">
            Group Interviews
          </h2>
          <p className="text-sm text-[#a59494] mt-0.5">
            {upcoming.length} upcoming · {sessions.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="px-3 py-2 rounded-lg border border-[#a59494]/20 hover:bg-[#f5f0f0] text-sm font-medium text-[#272727] transition flex items-center gap-1.5"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Session Settings
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition whitespace-nowrap"
            >
              + New Group Interview
            </button>
          )}
        </div>
      </div>

      {/* Session Settings Panel */}
      {showSettings && canManage && (
        <SessionSettingsPanel
          teamId={teamId}
          initialInterviewDate={teamInterviewDate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active" value={upcoming.length} color="#3B82F6" />
        <StatCard label="Completed" value={completed.length} color="#10B981" />
        <StatCard
          label="Total Sessions"
          value={sessions.length}
          color="var(--brand-primary)"
        />
        <StatCard
          label="Total Candidates"
          value={sessions.reduce(
            (sum, s) => sum + (s._candidate_count ?? 0),
            0
          )}
          color="#a59494"
        />
      </div>

      {/* Session list */}
      {loading ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <p className="text-[#a59494]">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
          <p className="text-[#a59494] mb-2">No group interview sessions yet</p>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm font-medium text-brand hover:text-brand-dark transition"
            >
              Create one now
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#a59494]/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Session
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Candidates
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Created By
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#a59494]/10">
              {sessions.map((session) => {
                const status = (session.status as string) ?? "upcoming";
                const statusBadge = status === "completed"
                  ? { label: "Completed", cls: "bg-green-100 text-green-700" }
                  : status === "in_progress"
                    ? { label: "In Progress", cls: "bg-amber-100 text-amber-700" }
                    : { label: "Upcoming", cls: "bg-blue-100 text-blue-700" };
                return (
                  <tr
                    key={session.id}
                    className="hover:bg-[#f5f0f0]/50 transition cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/group-interviews/${session.id}`)
                    }
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="var(--brand-primary)"
                            strokeWidth="2"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#272727]">
                            {session.title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#272727]">
                          {session.session_date
                            ? new Date(session.session_date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                }
                              )
                            : "Not scheduled"}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#272727]">
                      {session._candidate_count ?? 0} candidates
                    </td>
                    <td className="px-5 py-4 text-sm text-[#a59494]">
                      {(session.creator as { name: string } | undefined)?.name ??
                        "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/dashboard/group-interviews/${session.id}`
                            );
                          }}
                          className="text-xs font-medium text-brand hover:text-brand-dark transition"
                        >
                          Open
                        </button>
                        {canManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                id: session.id,
                                title: session.title,
                                candidateCount: session._candidate_count ?? 0,
                              });
                            }}
                            className="p-1 text-[#a59494] hover:text-red-500 transition"
                            title="Delete session"
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreate && (
        <CreateSessionModal
          eligibleCandidates={eligibleCandidates}
          teamId={teamId}
          currentUserId={currentUserId}
          onClose={() => setShowCreate(false)}
          onCreated={(session) => {
            setSessions((prev) => [session, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#272727]">
                Delete Session
              </h3>
            </div>
            <p className="text-sm text-[#272727] mb-1">
              <strong>{deleteConfirm.title}</strong>
            </p>
            <p className="text-sm text-[#a59494] mb-5">
              {deleteConfirm.candidateCount > 0
                ? `This session has ${deleteConfirm.candidateCount} candidate(s). Deleting it will remove them from the session but not from the pipeline. Continue?`
                : "Delete this session? This cannot be undone."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-[#a59494]/30 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(deleteConfirm.id)}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#272727] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}
    </>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <p className="text-xs font-medium text-[#a59494] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/* ── Session Settings Panel ────────────────────────────────────── */

function SessionSettingsPanel({
  teamId,
  initialInterviewDate,
  onClose,
}: {
  teamId: string;
  initialInterviewDate: string | null;
  onClose: () => void;
}) {
  // Split initialInterviewDate into date + time parts
  const parsed = initialInterviewDate ? new Date(initialInterviewDate) : null;
  const [dateVal, setDateVal] = useState(
    parsed ? parsed.toISOString().slice(0, 10) : ""
  );
  const [timeVal, setTimeVal] = useState(
    parsed
      ? parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaveStatus("");
    try {
      let isoDate: string | null = null;
      if (dateVal) {
        const combined = timeVal ? `${dateVal}T${timeVal}` : `${dateVal}T09:00`;
        isoDate = new Date(combined).toISOString();
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_team",
          payload: {
            id: teamId,
            group_interview_date: isoDate,
          },
        }),
      });
      const json = await res.json();
      if (json.error) {
        setSaveStatus(`Error: ${json.error}`);
      } else {
        setSaveStatus("Saved!");
        setTimeout(() => setSaveStatus(""), 2000);
      }
    } catch {
      setSaveStatus("Error: Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputClasses =
    "px-3 py-2 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/40 transition";

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#272727]">
            Session Settings
          </h3>
          <p className="text-xs text-[#a59494] mt-0.5">
            Next scheduled group interview date
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[#a59494] hover:text-[#272727] transition p-1"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="max-w-sm">
        <label className="block text-sm font-medium text-[#272727] mb-1.5">
          Next Group Interview Date
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#a59494] mb-1">Date</label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className={`w-full ${inputClasses}`}
            />
          </div>
          <div>
            <label className="block text-xs text-[#a59494] mb-1">Time</label>
            <input
              type="time"
              value={timeVal}
              onChange={(e) => setTimeVal(e.target.value)}
              className={`w-full ${inputClasses}`}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saveStatus && (
          <span
            className={`text-sm ${
              saveStatus.startsWith("Error")
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {saveStatus}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Create Session Modal ──────────────────────────────────────── */

function CreateSessionModal({
  eligibleCandidates,
  teamId,
  currentUserId,
  onClose,
  onCreated,
}: {
  eligibleCandidates: Candidate[];
  teamId: string;
  currentUserId: string;
  onClose: () => void;
  onCreated: (session: GroupInterviewSession & { _candidate_count?: number }) => void;
}) {
  const [title, setTitle] = useState(
    `Group Interview — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  );
  const [dateVal, setDateVal] = useState("");
  const [timeVal, setTimeVal] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const filtered = eligibleCandidates.filter((c) => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  async function handleCreate() {
    if (!title.trim()) return;
    if (!dateVal) { setError("Date is required"); return; }
    if (!timeVal) { setError("Time is required"); return; }
    setError("");
    setSaving(true);
    try {
      const sessionDate = new Date(`${dateVal}T${timeVal}`).toISOString();
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          payload: {
            team_id: teamId,
            title: title.trim(),
            session_date: sessionDate,
            zoom_link: zoomLink.trim() || null,
            general_notes: notes.trim() || null,
            created_by: currentUserId || null,
            candidate_ids: selectedCandidates,
          },
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (json.data) {
        onCreated({
          ...json.data,
          _candidate_count: selectedCandidates.length,
        });
      }
    } catch (err) {
      console.error("Failed to create session:", err);
      setError("Failed to create session. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClasses =
    "w-full px-3 py-2 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/40 transition";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#a59494]/10">
          <h3 className="text-lg font-bold text-[#272727]">
            New Group Interview
          </h3>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Session Name */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1.5">
              Session Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Group Interview — Mar 15"
              className={inputClasses}
            />
          </div>

          {/* Date + Time (native inputs side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1.5">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#272727] mb-1.5">
                Time <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={timeVal}
                onChange={(e) => setTimeVal(e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>

          {/* Zoom / Location Link */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1.5">
              Zoom / Location Link
            </label>
            <input
              type="text"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/... or meeting address"
              className={inputClasses}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional details about this session..."
              className={`${inputClasses} resize-y`}
            />
          </div>

          {/* Candidate Selection */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1.5">
              Candidates ({selectedCandidates.length} selected)
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates..."
              className={`${inputClasses} mb-2`}
            />
            <div className="max-h-48 overflow-y-auto border border-[#a59494]/20 rounded-lg">
              {filtered.length === 0 ? (
                <p className="text-sm text-[#a59494] p-3">
                  No eligible candidates found
                </p>
              ) : (
                filtered.map((c) => {
                  const selected = selectedCandidates.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#f5f0f0]/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setSelectedCandidates((prev) =>
                            selected
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          )
                        }
                        className="rounded border-[#a59494]/40 text-brand focus:ring-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#272727]">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="text-xs text-[#a59494]">
                          {c.role_applied ?? "—"} · {c.stage}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#a59494]/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
