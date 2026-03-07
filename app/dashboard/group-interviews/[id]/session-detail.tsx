"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { TeamUser, GroupInterviewNote, GroupInterviewPrompt } from "@/lib/types";

/* ── Types ─────────────────────────────────────────────────────── */

interface SessionCandidate {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  role_applied: string | null;
  email: string | null;
  phone: string | null;
  current_brokerage: string | null;
  years_experience: number | null;
  is_licensed: boolean | null;
}

interface Session {
  id: string;
  team_id: string;
  title: string;
  session_date: string | null;
  zoom_link: string | null;
  summary: string | null;
  general_notes: string | null;
  status?: string;
  created_by: string | null;
  created_at: string;
  creator?: { name: string };
  candidates: SessionCandidate[];
  notes: (GroupInterviewNote & { author?: { name: string } })[];
}

interface Props {
  session: Session;
  leaders: TeamUser[];
  teamId: string;
  currentUserId: string;
  currentUserName: string;
  prompts: GroupInterviewPrompt[];
  guidelines?: string[];
}

/* ── Main Component ────────────────────────────────────────────── */

export default function SessionDetail({
  session: initialSession,
  leaders,
  teamId,
  currentUserId,
  currentUserName,
  prompts,
  guidelines = [],
}: Props) {
  const [session, setSession] = useState(initialSession);
  const [selectedCandidate, setSelectedCandidate] =
    useState<SessionCandidate | null>(
      initialSession.candidates[0] ?? null
    );
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(session.summary ?? "");
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [sendEmailOnAdd, setSendEmailOnAdd] = useState(true);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [quickViewCandidate, setQuickViewCandidate] = useState<SessionCandidate | null>(null);
  const [sessionGuideExpanded, setSessionGuideExpanded] = useState(false);

  const isCompleted = session.status === "completed";

  async function handleStatusChange(newStatus: string) {
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_session",
          payload: { session_id: session.id, status: newStatus },
        }),
      });
      setSession((prev) => ({ ...prev, status: newStatus }));
    } catch {
      console.error("Failed to update status");
    }
  }

  // General session notes (auto-save)
  const [generalNotes, setGeneralNotes] = useState(session.general_notes ?? "");
  const [generalNotesStatus, setGeneralNotesStatus] = useState<"idle" | "saving" | "saved">("idle");
  const generalNotesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notes per candidate (keyed by candidate_id) — only current user's notes
  const [notesByCandidate, setNotesByCandidate] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    for (const note of initialSession.notes) {
      if (
        note.author_user_id === currentUserId &&
        note.candidate_id
      ) {
        map[note.candidate_id] = note.note_text;
      }
    }
    return map;
  });

  // Get unique authors who have notes
  const activeAuthors = Array.from(
    new Set(session.notes.filter((n) => n.note_text.trim()).map((n) => n.author_user_id))
  );
  const authorMap = new Map<string, string>();
  for (const uid of activeAuthors) {
    const note = session.notes.find((n) => n.author_user_id === uid);
    const name = note?.author?.name ?? leaders.find((l) => l.id === uid)?.name ?? "Unknown";
    authorMap.set(uid, name);
  }
  const authorNames = Array.from(authorMap.values());

  /* ── Debounced auto-save for candidate notes ───────────────── */

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const saveNote = useCallback(
    async (candidateId: string, text: string) => {
      if (!currentUserId || !candidateId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_note",
            payload: {
              session_id: session.id,
              candidate_id: candidateId,
              author_user_id: currentUserId,
              team_id: teamId,
              note_text: text,
              mentioned_ids: extractMentionIds(text, session.candidates),
            },
          }),
        });
        const json = await res.json();
        if (json.data) {
          setSession((prev) => {
            const filtered = prev.notes.filter(
              (n) =>
                !(
                  n.author_user_id === currentUserId &&
                  n.candidate_id === candidateId
                )
            );
            return { ...prev, notes: [json.data, ...filtered] };
          });
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    [currentUserId, session.id, session.candidates, teamId]
  );

  function handleNoteChange(candidateId: string, text: string) {
    setNotesByCandidate((prev) => ({ ...prev, [candidateId]: text }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNote(candidateId, text), 2000);
  }

  /* ── General notes auto-save ───────────────────────────────── */

  const saveGeneralNotes = useCallback(
    async (text: string) => {
      setGeneralNotesStatus("saving");
      try {
        await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_session",
            payload: { session_id: session.id, general_notes: text },
          }),
        });
        setSession((prev) => ({ ...prev, general_notes: text }));
        setGeneralNotesStatus("saved");
        setTimeout(() => setGeneralNotesStatus("idle"), 2000);
      } catch {
        setGeneralNotesStatus("idle");
      }
    },
    [session.id]
  );

  function handleGeneralNotesChange(text: string) {
    setGeneralNotes(text);
    if (generalNotesTimerRef.current) clearTimeout(generalNotesTimerRef.current);
    generalNotesTimerRef.current = setTimeout(() => saveGeneralNotes(text), 2000);
  }

  /* ── @mention handling ───────────────────────────────────────── */

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionPos, setMentionPos] = useState<{
    candidateId: string;
    cursorPos: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleNoteKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    candidateId: string
  ) {
    if (e.key === "@") {
      setMentionOpen(true);
      setMentionFilter("");
      setMentionPos({
        candidateId,
        cursorPos: (e.target as HTMLTextAreaElement).selectionStart + 1,
      });
    }
    if (mentionOpen && e.key === "Escape") {
      setMentionOpen(false);
    }
  }

  function handleNoteInput(
    e: React.FormEvent<HTMLTextAreaElement>,
    candidateId: string
  ) {
    if (!mentionOpen || !mentionPos) return;
    const textarea = e.target as HTMLTextAreaElement;
    const text = textarea.value;
    const atPos = mentionPos.cursorPos - 1;
    const cursor = textarea.selectionStart;
    const afterAt = text.slice(atPos, cursor);

    if (cursor < atPos || afterAt.includes(" ") || afterAt.includes("\n")) {
      setMentionOpen(false);
      return;
    }
    setMentionFilter(afterAt.replace("@", ""));
  }

  function insertMention(candidate: SessionCandidate) {
    if (!mentionPos || !selectedCandidate) return;
    const candidateId = mentionPos.candidateId;
    const text = notesByCandidate[candidateId] ?? "";
    const atPos = mentionPos.cursorPos - 1;
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? text.length;

    const mention = `@${candidate.first_name} ${candidate.last_name}`;
    const newText = text.slice(0, atPos) + mention + " " + text.slice(cursor);

    setNotesByCandidate((prev) => ({ ...prev, [candidateId]: newText }));
    setMentionOpen(false);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(
      () => saveNote(candidateId, newText),
      2000
    );
  }

  const mentionCandidates = session.candidates.filter((c) => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(mentionFilter.toLowerCase());
  });

  /* ── Summary save ────────────────────────────────────────────── */

  async function saveSummary() {
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_session",
          payload: { session_id: session.id, summary: summaryDraft },
        }),
      });
      setSession((prev) => ({ ...prev, summary: summaryDraft }));
      setEditingSummary(false);
    } catch {
      console.error("Failed to save summary");
    }
  }

  /* ── Remove candidate ────────────────────────────────────────── */

  async function removeCandidate(candidateId: string) {
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_candidate",
          payload: { session_id: session.id, candidate_id: candidateId },
        }),
      });
      setSession((prev) => ({
        ...prev,
        candidates: prev.candidates.filter((c) => c.id !== candidateId),
      }));
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(
          session.candidates.find((c) => c.id !== candidateId) ?? null
        );
      }
    } catch {
      console.error("Failed to remove candidate");
    }
  }

  /* ── Add candidate ───────────────────────────────────────────── */

  async function addCandidate(candidateId: string) {
    try {
      const addRes = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_candidate",
          payload: { session_id: session.id, candidate_id: candidateId },
        }),
      });
      const addJson = await addRes.json();
      if (addJson.error) {
        console.error("Failed to add candidate:", addJson.error);
        alert(`Failed to add candidate: ${addJson.error}`);
        return;
      }

      // Send email if opted-in
      if (sendEmailOnAdd) {
        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidate_id: candidateId,
              team_id: teamId,
              trigger: "group_interview_invite",
              context: {
                session_title: session.title,
                interview_date: session.session_date,
                zoom_link: session.zoom_link || "",
              },
            }),
          });
        } catch {
          // Email failure shouldn't block the flow
        }
      }

      // Optimistic update: use candidate data returned from the API
      if (addJson.candidate) {
        const newCandidate = addJson.candidate as SessionCandidate;
        setSession((prev) => ({
          ...prev,
          candidates: [...prev.candidates.filter((c) => c.id !== newCandidate.id), newCandidate],
        }));
        setSelectedCandidate(newCandidate);
        setAddingCandidate(false);
        setCandidateSearch("");
        return;
      }

      // Fallback: re-fetch full session if candidate data wasn't returned
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_session",
          payload: { session_id: session.id },
        }),
      });
      const json = await res.json();
      if (json.data) {
        setSession(json.data);
        const freshCandidate = json.data.candidates?.find(
          (c: SessionCandidate) => c.id === candidateId
        );
        if (freshCandidate) setSelectedCandidate(freshCandidate);
      }
      setAddingCandidate(false);
      setCandidateSearch("");
    } catch (err) {
      console.error("Failed to add candidate:", err);
      alert("Failed to add candidate. Check the console for details.");
    }
  }

  // All notes for the selected candidate (for "View All Notes" mode)
  const allNotesForCandidate = session.notes.filter(
    (n) => n.candidate_id === selectedCandidate?.id && n.note_text.trim()
  );
  const otherNotes = allNotesForCandidate.filter(
    (n) => n.author_user_id !== currentUserId
  );

  // Quick-view notes for candidate
  const quickViewNotes = quickViewCandidate
    ? session.notes.filter(
        (n) => n.candidate_id === quickViewCandidate.id && n.note_text.trim()
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Back link + Session Header */}
      <div>
        <Link
          href="/dashboard/group-interviews"
          className="text-sm text-brand hover:text-brand-dark transition mb-3 inline-block"
        >
          &larr; Back to Group Interviews
        </Link>

        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#272727]">
                {session.title}
              </h2>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-[#a59494]">
                  {session.session_date
                    ? new Date(session.session_date).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )
                    : "Date not set"}
                </span>
                {session.creator && (
                  <span className="text-sm text-[#a59494]">
                    by {(session.creator as { name: string }).name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status selector */}
              <select
                value={session.status ?? "upcoming"}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border-0 cursor-pointer transition ${
                  session.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : session.status === "in_progress"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                <option value="upcoming">Upcoming</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              {session.zoom_link && (
                <a
                  href={session.zoom_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition"
                >
                  Join Zoom
                </a>
              )}
            </div>
          </div>

          {/* Who's Here — Active Evaluators */}
          {activeAuthors.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                Who&apos;s Here
              </span>
              <div className="flex -space-x-2">
                {Array.from(authorMap.entries()).map(([uid, name]) => {
                  const isMe = uid === currentUserId;
                  return (
                    <div
                      key={uid}
                      className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center ${
                        isMe ? "bg-brand/20 ring-2 ring-brand/40" : "bg-brand/10"
                      }`}
                      title={isMe ? `${name} (you)` : name}
                    >
                      <span className="text-[10px] font-bold text-brand">
                        {name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <span className="text-[10px] text-[#a59494]">
                {activeAuthors.length} evaluator{activeAuthors.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                Session Summary
              </span>
              {!editingSummary && !isCompleted && (
                <button
                  onClick={() => {
                    setSummaryDraft(session.summary ?? "");
                    setEditingSummary(true);
                  }}
                  className="text-xs text-brand hover:text-brand-dark"
                >
                  Edit
                </button>
              )}
            </div>
            {editingSummary ? (
              <div className="space-y-2">
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                  placeholder="Overall session notes..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveSummary}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingSummary(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] hover:bg-[#f5f0f0] transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#272727]">
                {session.summary || (
                  <span className="text-[#a59494] italic">
                    No summary yet — click Edit to add one.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Completed banner */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-green-600 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-green-800">
            This session is completed and locked. Notes and candidates are read-only.
          </span>
        </div>
      )}

      {/* General Session Notes — auto-saving shared notepad */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#a59494] uppercase tracking-wider">
            General Session Notes
          </span>
          {!isCompleted && (
            <span className="text-[10px] text-[#a59494]">
              {generalNotesStatus === "saving" && "Saving..."}
              {generalNotesStatus === "saved" && "Saved"}
              {generalNotesStatus === "idle" && "Auto-saves"}
            </span>
          )}
        </div>
        <textarea
          value={generalNotes}
          onChange={(e) => !isCompleted && handleGeneralNotesChange(e.target.value)}
          readOnly={isCompleted}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
          placeholder="Shared notes visible to all interviewers — observations about the group, logistics, etc."
        />
      </div>

      {/* Session Guide — combined guidelines + prompts */}
      {(guidelines.length > 0 || prompts.length > 0) && (
        <div className="bg-brand/5 border border-brand/10 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setSessionGuideExpanded(!sessionGuideExpanded)}
            className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-brand/10 transition"
          >
            <svg
              width="12"
              height="12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform text-brand ${sessionGuideExpanded ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-brand">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <span className="text-xs font-semibold text-brand uppercase tracking-wider">
              Session Guide ({guidelines.length + prompts.length})
            </span>
          </button>
          {sessionGuideExpanded && (
            <div className="px-5 pb-4 space-y-4">
              {guidelines.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-brand mb-2">Guidelines</h4>
                  <div className="space-y-1.5">
                    {guidelines.map((g, i) => (
                      <div key={i} className="flex gap-2 text-sm text-[#272727]">
                        <span className="text-brand font-semibold shrink-0">{i + 1}.</span>
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {prompts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-brand mb-2">Interview Prompts</h4>
                  <div className="space-y-1.5">
                    {prompts.map((p) => (
                      <p key={p.id} className="text-sm text-[#272727]">
                        &bull; {p.prompt_text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
        {/* Left panel — Candidate list */}
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#a59494]/10">
            <h3 className="text-sm font-bold text-[#272727]">
              Candidates ({session.candidates.length})
            </h3>
            {!isCompleted && (
              <button
                onClick={() => setAddingCandidate(true)}
                className="text-xs font-medium text-brand hover:text-brand-dark transition"
              >
                + Add
              </button>
            )}
          </div>
          <div className="divide-y divide-[#a59494]/10">
            {session.candidates.length === 0 ? (
              <p className="text-sm text-[#a59494] p-4">
                No candidates added yet
              </p>
            ) : (
              session.candidates.map((candidate) => {
                const isSelected = selectedCandidate?.id === candidate.id;
                const hasMyNote =
                  (notesByCandidate[candidate.id] ?? "").trim().length > 0;
                const otherNoteCount = session.notes.filter(
                  (n) =>
                    n.candidate_id === candidate.id &&
                    n.author_user_id !== currentUserId &&
                    n.note_text.trim()
                ).length;

                return (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                      isSelected
                        ? "bg-brand/5 border-l-2 border-brand"
                        : "hover:bg-[#f5f0f0]/50 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand">
                        {candidate.first_name?.[0]}
                        {candidate.last_name?.[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#272727] truncate">
                        {candidate.first_name} {candidate.last_name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#a59494]">
                          {candidate.stage}
                        </span>
                        {hasMyNote && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" title="You have notes" />
                        )}
                        {otherNoteCount > 0 && (
                          <span className="text-[10px] text-[#a59494]">
                            +{otherNoteCount} notes
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewCandidate(candidate);
                        }}
                        className="text-[#a59494] hover:text-brand transition opacity-0 group-hover:opacity-100 p-1"
                        title="Quick view"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCandidate(candidate.id);
                        }}
                        className="text-[#a59494] hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-1"
                        title="Remove candidate"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel — Notes area */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#a59494]/10 shadow-sm overflow-hidden">
          {selectedCandidate ? (
            <div className="h-full flex flex-col">
              {/* Candidate header */}
              <div className="flex items-center justify-between p-4 border-b border-[#a59494]/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-brand">
                      {selectedCandidate.first_name?.[0]}
                      {selectedCandidate.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#272727]">
                      {selectedCandidate.first_name}{" "}
                      {selectedCandidate.last_name}
                    </p>
                    <p className="text-xs text-[#a59494]">
                      {selectedCandidate.role_applied ?? "—"} ·{" "}
                      {selectedCandidate.stage}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {saveStatus === "saving" && (
                    <span className="text-xs text-[#a59494]">Saving...</span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-xs text-green-600">Saved</span>
                  )}
                  <button
                    onClick={() => setShowAllNotes(!showAllNotes)}
                    className={`text-xs font-medium transition px-2 py-1 rounded ${
                      showAllNotes
                        ? "bg-brand/10 text-brand"
                        : "text-[#a59494] hover:text-[#272727]"
                    }`}
                  >
                    {showAllNotes ? "My Notes" : "View All Notes"}
                  </button>
                  <button
                    onClick={() => setQuickViewCandidate(selectedCandidate)}
                    className="text-xs font-medium text-brand hover:text-brand-dark transition"
                  >
                    View Profile
                  </button>
                </div>
              </div>

              {/* Notes content */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {showAllNotes ? (
                  /* ── View All Notes mode: side-by-side from all evaluators ── */
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                      All Evaluator Notes for {selectedCandidate.first_name}
                    </h4>
                    {allNotesForCandidate.length === 0 ? (
                      <p className="text-sm text-[#a59494] italic">No notes yet</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {allNotesForCandidate.map((note) => {
                          const isMe = note.author_user_id === currentUserId;
                          return (
                            <div
                              key={note.id}
                              className={`rounded-lg p-3 ${
                                isMe ? "bg-brand/5 border border-brand/10" : "bg-[#f5f0f0]/50"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-brand">
                                    {(note.author?.name ?? "?")
                                      .split(" ")
                                      .map((w) => w[0])
                                      .join("")}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-[#272727]">
                                  {note.author?.name ?? "Unknown"}
                                  {isMe && " (you)"}
                                </span>
                                <span className="text-xs text-[#a59494]">
                                  {new Date(note.updated_at).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-[#272727] whitespace-pre-wrap">
                                {renderMentions(note.note_text)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Normal mode: my notes + others collapsed below ── */
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-2">
                        Your Notes{" "}
                        <span className="font-normal normal-case">
                          (type @ to mention a candidate)
                        </span>
                      </label>
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={notesByCandidate[selectedCandidate.id] ?? ""}
                          onChange={(e) =>
                            !isCompleted && handleNoteChange(selectedCandidate.id, e.target.value)
                          }
                          onKeyDown={(e) =>
                            !isCompleted && handleNoteKeyDown(e, selectedCandidate.id)
                          }
                          onInput={(e) =>
                            !isCompleted && handleNoteInput(e, selectedCandidate.id)
                          }
                          readOnly={isCompleted}
                          rows={8}
                          className={`w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none ${isCompleted ? "bg-gray-50 cursor-not-allowed" : ""}`}
                          placeholder={`Notes about ${selectedCandidate.first_name}...`}
                        />

                        {/* @mention dropdown */}
                        {mentionOpen &&
                          mentionPos?.candidateId === selectedCandidate.id && (
                            <div className="absolute left-0 top-full mt-1 bg-white border border-[#a59494]/20 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto min-w-[200px]">
                              {mentionCandidates.length === 0 ? (
                                <p className="text-xs text-[#a59494] p-2">
                                  No matches
                                </p>
                              ) : (
                                mentionCandidates.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => insertMention(c)}
                                    className="w-full text-left px-3 py-2 text-sm text-[#272727] hover:bg-[#f5f0f0] transition"
                                  >
                                    {c.first_name} {c.last_name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Other evaluators' notes */}
                    {otherNotes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-3">
                          Other Evaluators&apos; Notes
                        </h4>
                        <div className="space-y-3">
                          {otherNotes.map((note) => (
                            <div
                              key={note.id}
                              className="bg-[#f5f0f0]/50 rounded-lg p-3"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-brand">
                                    {(note.author?.name ?? "?")
                                      .split(" ")
                                      .map((w) => w[0])
                                      .join("")}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-[#272727]">
                                  {note.author?.name ?? "Unknown"}
                                </span>
                                <span className="text-xs text-[#a59494]">
                                  {new Date(note.updated_at).toLocaleString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    }
                                  )}
                                </span>
                              </div>
                              <p className="text-sm text-[#272727] whitespace-pre-wrap">
                                {renderMentions(note.note_text)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[#a59494] text-sm">
                {session.candidates.length === 0
                  ? "Add candidates to get started"
                  : "Select a candidate to view and add notes"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Candidate Modal */}
      {addingCandidate && (
        <AddCandidateModal
          sessionCandidateIds={session.candidates.map((c) => c.id)}
          onAdd={addCandidate}
          onClose={() => {
            setAddingCandidate(false);
            setCandidateSearch("");
          }}
          teamId={teamId}
          search={candidateSearch}
          setSearch={setCandidateSearch}
          sendEmail={sendEmailOnAdd}
          setSendEmail={setSendEmailOnAdd}
        />
      )}

      {/* Candidate Quick-View Slide-over */}
      {quickViewCandidate && (
        <CandidateQuickView
          candidate={quickViewCandidate}
          notes={quickViewNotes}
          onClose={() => setQuickViewCandidate(null)}
        />
      )}
    </div>
  );
}

/* ── Candidate Quick-View Slide-over Panel ────────────────────── */

function CandidateQuickView({
  candidate,
  notes,
  onClose,
}: {
  candidate: SessionCandidate;
  notes: (GroupInterviewNote & { author?: { name: string } })[];
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl border-l border-[#a59494]/20 animate-in slide-in-from-right overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[#272727]">
              Candidate Info
            </h3>
            <button
              onClick={onClose}
              className="text-[#a59494] hover:text-[#272727] transition p-1"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Candidate card */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
              <span className="text-lg font-bold text-brand">
                {candidate.first_name?.[0]}
                {candidate.last_name?.[0]}
              </span>
            </div>
            <div>
              <p className="text-lg font-bold text-[#272727]">
                {candidate.first_name} {candidate.last_name}
              </p>
              <p className="text-sm text-[#a59494]">
                {candidate.role_applied ?? "No role specified"} · {candidate.stage}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 mb-6">
            <DetailRow label="Email" value={candidate.email} />
            <DetailRow label="Phone" value={candidate.phone} />
            <DetailRow label="Current Brokerage" value={candidate.current_brokerage} />
            <DetailRow
              label="Experience"
              value={candidate.years_experience != null ? `${candidate.years_experience} years` : null}
            />
            <DetailRow
              label="Licensed"
              value={candidate.is_licensed != null ? (candidate.is_licensed ? "Yes" : "No") : null}
            />
          </div>

          {/* Notes from evaluators */}
          <div className="border-t border-[#a59494]/10 pt-4">
            <h4 className="text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-3">
              Evaluator Notes ({notes.length})
            </h4>
            {notes.length === 0 ? (
              <p className="text-sm text-[#a59494] italic">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="bg-[#f5f0f0]/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#272727]">
                        {note.author?.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-[#a59494]">
                        {new Date(note.updated_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-[#272727] whitespace-pre-wrap">
                      {note.note_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Full Profile link */}
          <div className="mt-6 pt-4 border-t border-[#a59494]/10">
            <Link
              href={`/dashboard/candidates/${candidate.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition"
            >
              Open Full Profile
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start">
      <span className="text-xs font-medium text-[#a59494] uppercase">{label}</span>
      <span className="text-sm text-[#272727] text-right max-w-[60%]">{value}</span>
    </div>
  );
}

/* ── Add Candidate Modal ───────────────────────────────────────── */

function AddCandidateModal({
  sessionCandidateIds,
  onAdd,
  onClose,
  teamId,
  search,
  setSearch,
  sendEmail,
  setSendEmail,
}: {
  sessionCandidateIds: string[];
  onAdd: (candidateId: string) => void;
  onClose: () => void;
  teamId: string;
  search: string;
  setSearch: (s: string) => void;
  sendEmail: boolean;
  setSendEmail: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [allCandidates, setAllCandidates] = useState<
    { id: string; first_name: string; last_name: string; stage: string; role_applied: string | null }[]
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_team_candidates",
            payload: { team_id: teamId },
          }),
        });
        const json = await res.json();
        setAllCandidates(json.data ?? []);
      } catch {
        console.error("Failed to fetch candidates");
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  const available = allCandidates.filter(
    (c) =>
      !sessionCandidateIds.includes(c.id) &&
      `${c.first_name} ${c.last_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#a59494]/10">
          <h3 className="text-sm font-bold text-[#272727]">Add Candidate</h3>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates..."
            className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            autoFocus
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#a59494]/40 text-brand focus:ring-brand/40"
            />
            <span className="text-xs text-[#272727]">
              Send interview invitation email on add
            </span>
          </label>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#a59494]/10">
          {loading ? (
            <p className="text-sm text-[#a59494] p-4">Loading...</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-[#a59494] p-4">No candidates found</p>
          ) : (
            available.map((c) => (
              <button
                key={c.id}
                onClick={() => onAdd(c.id)}
                className="w-full text-left px-4 py-3 hover:bg-[#f5f0f0]/50 transition flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand">
                    {c.first_name?.[0]}
                    {c.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#272727]">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-xs text-[#a59494]">
                    {c.role_applied ?? "—"} · {c.stage}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */

function extractMentionIds(
  text: string,
  candidates: { id: string; first_name: string; last_name: string }[]
): string[] {
  const ids: string[] = [];
  for (const c of candidates) {
    const mention = `@${c.first_name} ${c.last_name}`;
    if (text.includes(mention)) {
      ids.push(c.id);
    }
  }
  return ids;
}

function renderMentions(text: string) {
  return text.replace(/@(\w+\s\w+)/g, "**@$1**");
}
