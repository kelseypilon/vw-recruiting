"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Candidate, TeamUser, GroupInterviewSession } from "@/lib/types";
import { usePermissions } from "@/lib/user-permissions-context";
import DateTimePicker from "@/components/date-time-picker";

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
  const [interviewDate, setInterviewDate] = useState(
    initialInterviewDate
      ? new Date(initialInterviewDate).toISOString().slice(0, 16)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaveStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_team",
          payload: {
            id: teamId,
            group_interview_date: interviewDate
              ? new Date(interviewDate).toISOString()
              : null,
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
        <div>
          <label className="block text-sm font-medium text-[#272727] mb-1">
            Next Group Interview Date
          </label>
          <DateTimePicker
            value={interviewDate}
            onChange={setInterviewDate}
          />
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
  const [sessionDate, setSessionDate] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = eligibleCandidates.filter((c) => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          payload: {
            team_id: teamId,
            title: title.trim(),
            session_date: sessionDate || null,
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1.5">
              Session Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1.5">
              Date & Time
            </label>
            <DateTimePicker
              value={sessionDate}
              onChange={setSessionDate}
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
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent mb-2"
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
