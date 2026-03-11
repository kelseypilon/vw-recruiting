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
  current_role: string | null;
  years_experience: number | null;
  is_licensed: boolean | null;
  disc_primary: string | null;
  disc_secondary: string | null;
  aq_normalized: number | null;
  aq_tier: string | null;
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

interface Evaluation {
  id?: string;
  overall_score: number | null;
  recommendation: string | null;
  summary_notes: string;
  is_locked: boolean;
  locked_at: string | null;
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

/* ── Badge helpers ─────────────────────────────────────────────── */

function discColor(type: string | null): string {
  switch (type?.toUpperCase()) {
    case "D": return "bg-red-100 text-red-700";
    case "I": return "bg-yellow-100 text-yellow-700";
    case "S": return "bg-green-100 text-green-700";
    case "C": return "bg-blue-100 text-blue-700";
    default: return "bg-gray-100 text-gray-500";
  }
}

function aqColor(tier: string | null): string {
  switch (tier) {
    case "A+": return "bg-green-100 text-green-700";
    case "A": return "bg-blue-100 text-blue-700";
    case "B+": return "bg-yellow-100 text-yellow-700";
    case "B": return "bg-amber-100 text-amber-700";
    case "C": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-500";
  }
}

const REC_OPTIONS = [
  { value: "", label: "—" },
  { value: "strong_yes", label: "Strong Yes" },
  { value: "yes", label: "Yes" },
  { value: "hold", label: "Hold" },
  { value: "no", label: "No" },
] as const;

function recBadge(rec: string | null) {
  switch (rec) {
    case "strong_yes": return { label: "Strong Yes", cls: "bg-green-100 text-green-700" };
    case "yes": return { label: "Yes", cls: "bg-blue-100 text-blue-700" };
    case "hold": return { label: "Hold", cls: "bg-amber-100 text-amber-700" };
    case "no": return { label: "No", cls: "bg-red-100 text-red-700" };
    default: return null;
  }
}

const SCORECARD_CRITERIA = [
  "Coachability", "Communication Skills", "Work Ethic & Drive",
  "Integrity & Ethics", "Client Focus", "Resilience & Adaptability",
  "Team Collaboration", "Problem Solving", "Professional Presentation",
  "Market Knowledge", "Tech Savviness", "Business Development",
  "Time Management", "Goal Orientation", "Cultural Fit",
  "Leadership Potential", "Emotional Intelligence", "Self-Motivation",
  "Long-term Vision",
];

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
  const [editingZoom, setEditingZoom] = useState(false);
  const [zoomDraft, setZoomDraft] = useState(session.zoom_link ?? "");

  // Right-panel active tab
  const [activeTab, setActiveTab] = useState<"notes" | "prompts" | "scorecard">("notes");

  async function saveZoomLink() {
    const trimmed = zoomDraft.trim() || null;
    setEditingZoom(false);
    setSession((prev) => ({ ...prev, zoom_link: trimmed }));
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_session",
          payload: { session_id: session.id, zoom_link: trimmed },
        }),
      });
    } catch {
      console.error("Failed to save zoom link");
    }
  }

  // Per-prompt scoring state (1-5)
  const [promptScores, setPromptScores] = useState<Record<string, number>>({});

  // Per-prompt text responses
  const [promptResponses, setPromptResponses] = useState<Record<string, string>>({});
  const [promptResponseStatus, setPromptResponseStatus] = useState<"idle" | "saving" | "saved">("idle");
  const promptResponseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-criteria scoring state (19-criteria rubric)
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});

  // Universal evaluation state
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evalStatus, setEvalStatus] = useState<"idle" | "saving" | "saved">("idle");
  const evalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load scores on mount
  useEffect(() => {
    if (!session.id || prompts.length === 0) return;
    fetch("/api/group-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_scores", payload: { session_id: session.id } }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const map: Record<string, number> = {};
          for (const s of json.data) {
            if (s.evaluator_user_id === currentUserId) {
              map[`${s.candidate_id}__${s.prompt_id}`] = s.score;
            }
          }
          setPromptScores(map);
        }
      })
      .catch(() => {});
  }, [session.id, prompts.length, currentUserId]);

  // Load prompt responses on mount
  useEffect(() => {
    if (!session.id) return;
    fetch("/api/group-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_prompt_responses", payload: { session_id: session.id } }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const map: Record<string, string> = {};
          for (const r of json.data) {
            if (r.evaluator_user_id === currentUserId) {
              map[`${r.candidate_id}__${r.prompt_id}`] = r.response_text;
            }
          }
          setPromptResponses(map);
        }
      })
      .catch(() => {});
  }, [session.id, currentUserId]);

  // Load criteria scores on mount
  useEffect(() => {
    if (!session.id || !currentUserId) return;
    fetch("/api/group-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_criteria_scores", payload: { session_id: session.id } }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const map: Record<string, number> = {};
          for (const s of json.data) {
            if (s.evaluator_user_id === currentUserId) {
              map[`${s.candidate_id}__${s.criterion}`] = s.score;
            }
          }
          setCriteriaScores(map);
        }
      })
      .catch(() => {});
  }, [session.id, currentUserId]);

  // Load evaluation when selected candidate changes
  useEffect(() => {
    if (!selectedCandidate || !currentUserId) {
      setEvaluation(null);
      return;
    }
    fetch("/api/group-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_evaluation",
        payload: { candidate_id: selectedCandidate.id, evaluator_user_id: currentUserId },
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setEvaluation(json.data);
        } else {
          // No evaluation yet — start fresh
          setEvaluation({
            overall_score: null,
            recommendation: null,
            summary_notes: "",
            is_locked: false,
            locked_at: null,
          });
        }
      })
      .catch(() => {
        setEvaluation({
          overall_score: null,
          recommendation: null,
          summary_notes: "",
          is_locked: false,
          locked_at: null,
        });
      });
  }, [selectedCandidate?.id, currentUserId]);

  async function savePromptScore(candidateId: string, promptId: string, score: number) {
    const key = `${candidateId}__${promptId}`;
    setPromptScores((prev) => ({ ...prev, [key]: score }));
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_score",
          payload: {
            session_id: session.id,
            candidate_id: candidateId,
            prompt_id: promptId,
            evaluator_user_id: currentUserId,
            score,
          },
        }),
      });
    } catch {
      console.error("Failed to save prompt score");
    }
  }

  async function saveCriteriaScore(candidateId: string, criterion: string, score: number) {
    const key = `${candidateId}__${criterion}`;
    setCriteriaScores((prev) => ({ ...prev, [key]: score }));
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_criteria_score",
          payload: {
            session_id: session.id,
            candidate_id: candidateId,
            criterion,
            score,
            evaluator_user_id: currentUserId,
          },
        }),
      });
    } catch {
      console.error("Failed to save criteria score");
    }
  }

  /* ── Prompt response auto-save ─────────────────────────────── */

  const savePromptResponse = useCallback(
    async (candidateId: string, promptId: string, text: string) => {
      setPromptResponseStatus("saving");
      try {
        await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_prompt_response",
            payload: {
              session_id: session.id,
              candidate_id: candidateId,
              prompt_id: promptId,
              evaluator_user_id: currentUserId,
              response_text: text,
            },
          }),
        });
        setPromptResponseStatus("saved");
        setTimeout(() => setPromptResponseStatus("idle"), 2000);
      } catch {
        setPromptResponseStatus("idle");
      }
    },
    [session.id, currentUserId]
  );

  function handlePromptResponseChange(candidateId: string, promptId: string, text: string) {
    const key = `${candidateId}__${promptId}`;
    setPromptResponses((prev) => ({ ...prev, [key]: text }));
    if (promptResponseTimerRef.current) clearTimeout(promptResponseTimerRef.current);
    promptResponseTimerRef.current = setTimeout(
      () => savePromptResponse(candidateId, promptId, text),
      2000
    );
  }

  /* ── Evaluation auto-save ──────────────────────────────────── */

  const saveEvaluation = useCallback(
    async (candidateId: string, updates: Partial<Evaluation>) => {
      setEvalStatus("saving");
      try {
        await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_evaluation",
            payload: {
              candidate_id: candidateId,
              evaluator_user_id: currentUserId,
              team_id: teamId,
              ...updates,
            },
          }),
        });
        setEvalStatus("saved");
        setTimeout(() => setEvalStatus("idle"), 2000);
      } catch {
        setEvalStatus("idle");
      }
    },
    [currentUserId, teamId]
  );

  function handleEvalChange(field: keyof Evaluation, value: unknown) {
    if (!selectedCandidate || evaluation?.is_locked) return;
    setEvaluation((prev) => prev ? { ...prev, [field]: value } : prev);
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
    evalTimerRef.current = setTimeout(() => {
      saveEvaluation(selectedCandidate.id, { [field]: value });
    }, 2000);
  }

  async function handleToggleLock() {
    if (!selectedCandidate || !evaluation) return;
    const newLocked = !evaluation.is_locked;
    try {
      await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_evaluation_lock",
          payload: {
            candidate_id: selectedCandidate.id,
            evaluator_user_id: currentUserId,
            is_locked: newLocked,
          },
        }),
      });
      setEvaluation((prev) =>
        prev
          ? { ...prev, is_locked: newLocked, locked_at: newLocked ? new Date().toISOString() : null }
          : prev
      );
    } catch {
      console.error("Failed to toggle lock");
    }
  }

  const isCompleted = session.status === "completed";

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_session",
          payload: { session_id: session.id, status: newStatus },
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
        const res = await fetch("/api/group-interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_session",
            payload: { session_id: session.id, general_notes: text },
          }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_session",
          payload: { session_id: session.id, summary: summaryDraft },
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setSession((prev) => ({ ...prev, summary: summaryDraft }));
      setEditingSummary(false);
    } catch {
      console.error("Failed to save summary");
    }
  }

  /* ── Remove candidate ────────────────────────────────────────── */

  async function removeCandidate(candidateId: string) {
    try {
      const res = await fetch("/api/group-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_candidate",
          payload: { session_id: session.id, candidate_id: candidateId },
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setSession((prev) => {
        const remaining = prev.candidates.filter((c) => c.id !== candidateId);
        // Also update selectedCandidate if the removed one was selected
        if (selectedCandidate?.id === candidateId) {
          setSelectedCandidate(remaining[0] ?? null);
        }
        return { ...prev, candidates: remaining };
      });
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
      if (!addRes.ok) throw new Error(`Request failed (${addRes.status})`);
      const addJson = await addRes.json();
      if (addJson.error) {
        console.error("Failed to add candidate:", addJson.error);
        alert(`Failed to add candidate: ${addJson.error}`);
        setAddingCandidate(false);
        setCandidateSearch("");
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
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
      alert("Failed to add candidate. Please try again.");
      setAddingCandidate(false);
      setCandidateSearch("");
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
              {editingZoom ? (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={zoomDraft}
                    onChange={(e) => setZoomDraft(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                    className="px-2 py-1.5 rounded-lg border border-[#a59494]/30 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand/40"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveZoomLink();
                      if (e.key === "Escape") { setEditingZoom(false); setZoomDraft(session.zoom_link ?? ""); }
                    }}
                  />
                  <button
                    onClick={saveZoomLink}
                    className="px-2 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-dark transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingZoom(false); setZoomDraft(session.zoom_link ?? ""); }}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#a59494] hover:text-[#272727] transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {session.zoom_link ? (
                    <a
                      href={session.zoom_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition"
                    >
                      Join Zoom
                    </a>
                  ) : null}
                  <button
                    onClick={() => setEditingZoom(true)}
                    className="px-2 py-1 rounded-lg text-xs font-medium text-[#a59494] hover:text-brand hover:bg-brand/5 transition"
                  >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
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
                const discTag = candidate.disc_primary
                  ? `${candidate.disc_primary}${candidate.disc_secondary ? "/" + candidate.disc_secondary : ""}`
                  : null;

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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-[#a59494]">
                          {candidate.role_applied ?? candidate.stage}
                        </span>
                        {/* DISC badge */}
                        {discTag && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${discColor(candidate.disc_primary)}`}>
                            {discTag}
                          </span>
                        )}
                        {/* AQ badge */}
                        {candidate.aq_tier && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${aqColor(candidate.aq_tier)}`}>
                            {candidate.aq_tier}
                          </span>
                        )}
                        {hasMyNote && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" title="You have notes" />
                        )}
                        {otherNoteCount > 0 && (
                          <span className="text-[10px] text-[#a59494]">
                            +{otherNoteCount}
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
                      {!isCompleted && (
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
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel — Tabbed candidate view */}
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#272727]">
                        {selectedCandidate.first_name}{" "}
                        {selectedCandidate.last_name}
                      </p>
                      {/* DISC + AQ badges in header */}
                      {selectedCandidate.disc_primary && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${discColor(selectedCandidate.disc_primary)}`}>
                          {selectedCandidate.disc_primary}
                          {selectedCandidate.disc_secondary ? `/${selectedCandidate.disc_secondary}` : ""}
                        </span>
                      )}
                      {selectedCandidate.aq_tier && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${aqColor(selectedCandidate.aq_tier)}`}>
                          AQ {selectedCandidate.aq_tier}
                        </span>
                      )}
                      {/* Recommendation badge */}
                      {evaluation?.recommendation && (() => {
                        const rb = recBadge(evaluation.recommendation);
                        return rb ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${rb.cls}`}>
                            {rb.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <p className="text-xs text-[#a59494]">
                      {selectedCandidate.role_applied ?? "—"} ·{" "}
                      {selectedCandidate.stage}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Save status indicator */}
                  {(saveStatus === "saving" || promptResponseStatus === "saving" || evalStatus === "saving") && (
                    <span className="text-xs text-[#a59494]">Saving...</span>
                  )}
                  {(saveStatus === "saved" || promptResponseStatus === "saved" || evalStatus === "saved") && (
                    <span className="text-xs text-green-600">Saved</span>
                  )}
                  <button
                    onClick={() => setQuickViewCandidate(selectedCandidate)}
                    className="text-xs font-medium text-brand hover:text-brand-dark transition"
                  >
                    View Profile
                  </button>
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-[#a59494]/10">
                {(
                  [
                    { key: "notes", label: "Notes" },
                    { key: "prompts", label: "Prompts" },
                    { key: "scorecard", label: "Scorecard" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
                      activeTab === tab.key
                        ? "border-brand text-brand"
                        : "border-transparent text-[#a59494] hover:text-[#272727]"
                    }`}
                  >
                    {tab.label}
                    {tab.key === "scorecard" && evaluation?.is_locked && (
                      <span className="ml-1 text-[10px]">🔒</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {/* ─── Notes Tab ─── */}
                {activeTab === "notes" && (
                  <>
                    {showAllNotes ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                            All Evaluator Notes for {selectedCandidate.first_name}
                          </h4>
                          <button
                            onClick={() => setShowAllNotes(false)}
                            className="text-xs font-medium text-brand hover:text-brand-dark"
                          >
                            My Notes
                          </button>
                        </div>
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
                      <>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider">
                            Your Notes{" "}
                            <span className="font-normal normal-case">
                              (type @ to mention a candidate)
                            </span>
                          </label>
                          <button
                            onClick={() => setShowAllNotes(true)}
                            className="text-xs font-medium text-[#a59494] hover:text-[#272727]"
                          >
                            View All Notes
                          </button>
                        </div>
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
                  </>
                )}

                {/* ─── Prompts Tab ─── */}
                {activeTab === "prompts" && (
                  <div className="space-y-4">
                    {prompts.length === 0 ? (
                      <p className="text-sm text-[#a59494] italic">
                        No prompts configured. Add prompts in Settings → Group Interview.
                      </p>
                    ) : (
                      prompts.filter((p) => p.is_active !== false).map((prompt) => {
                        const scoreKey = `${selectedCandidate.id}__${prompt.id}`;
                        const currentScore = promptScores[scoreKey] ?? 0;
                        const responseKey = `${selectedCandidate.id}__${prompt.id}`;
                        const responseText = promptResponses[responseKey] ?? "";

                        return (
                          <div
                            key={prompt.id}
                            className="rounded-lg border border-[#a59494]/10 p-4 space-y-3"
                          >
                            {/* Prompt text + score */}
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-[#272727] flex-1">
                                {prompt.prompt_text}
                              </p>
                              <div className="flex gap-1 shrink-0">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    disabled={isCompleted}
                                    onClick={() => savePromptScore(selectedCandidate.id, prompt.id, val)}
                                    className={`w-7 h-7 rounded-full text-xs font-bold transition ${
                                      val <= currentScore
                                        ? "bg-brand text-white"
                                        : "bg-white border border-[#a59494]/30 text-[#a59494] hover:border-brand hover:text-brand"
                                    } ${isCompleted ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Text response */}
                            <textarea
                              value={responseText}
                              onChange={(e) =>
                                !isCompleted &&
                                handlePromptResponseChange(
                                  selectedCandidate.id,
                                  prompt.id,
                                  e.target.value
                                )
                              }
                              readOnly={isCompleted}
                              rows={3}
                              className={`w-full px-3 py-2 rounded-lg border border-[#a59494]/20 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent resize-none ${isCompleted ? "bg-gray-50 cursor-not-allowed" : ""}`}
                              placeholder={`Your response for this prompt...`}
                            />
                          </div>
                        );
                      })
                    )}
                    {/* Average score */}
                    {prompts.length > 0 && Object.keys(promptScores).filter((k) => k.startsWith(selectedCandidate.id)).length > 0 && (
                      <div className="text-right">
                        <span className="text-xs text-[#a59494]">
                          Avg Score:{" "}
                          <span className="font-bold text-brand">
                            {(
                              Object.entries(promptScores)
                                .filter(([k]) => k.startsWith(selectedCandidate.id))
                                .reduce((sum, [, v]) => sum + v, 0) /
                              Object.entries(promptScores).filter(([k]) => k.startsWith(selectedCandidate.id)).length
                            ).toFixed(1)}
                            /5
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Scorecard Tab ─── */}
                {activeTab === "scorecard" && (
                  <div className="space-y-5">
                    {/* Lock banner */}
                    {evaluation?.is_locked && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-600 shrink-0">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        <span className="text-xs font-medium text-amber-800">
                          This scorecard is locked.{" "}
                          {evaluation.locked_at && (
                            <>
                              Locked{" "}
                              {new Date(evaluation.locked_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </>
                          )}
                        </span>
                        <button
                          onClick={handleToggleLock}
                          className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                        >
                          Unlock
                        </button>
                      </div>
                    )}

                    {/* Criteria Scoring */}
                    <div className="space-y-3 mb-6">
                      <h4 className="text-xs font-semibold text-[#a59494] uppercase tracking-wider">Evaluation Criteria</h4>
                      {SCORECARD_CRITERIA.map((criterion) => (
                        <div key={criterion} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[#272727] flex-1">{criterion}</span>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map((score) => (
                              <button
                                key={score}
                                disabled={isCompleted}
                                onClick={() => selectedCandidate && saveCriteriaScore(selectedCandidate.id, criterion, score)}
                                className={`w-7 h-7 rounded text-xs font-medium transition ${
                                  criteriaScores[`${selectedCandidate?.id}__${criterion}`] === score
                                    ? "bg-brand text-white"
                                    : "bg-gray-100 text-gray-500 hover:bg-brand/20"
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Overall Score (1-10) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-2">
                        Overall Score (1–10)
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                          <button
                            key={val}
                            type="button"
                            disabled={isCompleted || evaluation?.is_locked}
                            onClick={() => handleEvalChange("overall_score", val)}
                            className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                              evaluation?.overall_score != null && val <= evaluation.overall_score
                                ? val <= 3
                                  ? "bg-red-500 text-white"
                                  : val <= 6
                                    ? "bg-amber-500 text-white"
                                    : "bg-green-500 text-white"
                                : "bg-white border border-[#a59494]/30 text-[#a59494] hover:border-brand hover:text-brand"
                            } ${(isCompleted || evaluation?.is_locked) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                      {evaluation?.overall_score != null && (
                        <p className="mt-1 text-xs text-[#a59494]">
                          Score: <span className="font-bold text-[#272727]">{evaluation.overall_score}/10</span>
                        </p>
                      )}
                    </div>

                    {/* Recommendation */}
                    <div>
                      <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-2">
                        Recommendation
                      </label>
                      <select
                        value={evaluation?.recommendation ?? ""}
                        onChange={(e) => handleEvalChange("recommendation", e.target.value || null)}
                        disabled={isCompleted || evaluation?.is_locked}
                        className={`px-3 py-2 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/40 ${(isCompleted || evaluation?.is_locked) ? "bg-gray-50 cursor-not-allowed" : ""}`}
                      >
                        {REC_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Summary Notes */}
                    <div>
                      <label className="block text-xs font-semibold text-[#a59494] uppercase tracking-wider mb-2">
                        Summary Notes
                      </label>
                      <textarea
                        value={evaluation?.summary_notes ?? ""}
                        onChange={(e) => handleEvalChange("summary_notes", e.target.value)}
                        readOnly={isCompleted || evaluation?.is_locked}
                        rows={5}
                        className={`w-full px-3 py-2 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent resize-none ${(isCompleted || evaluation?.is_locked) ? "bg-gray-50 cursor-not-allowed" : ""}`}
                        placeholder="Your overall assessment of this candidate..."
                      />
                    </div>

                    {/* Lock / Unlock button */}
                    {!isCompleted && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#a59494]/10">
                        <p className="text-xs text-[#a59494]">
                          {evaluation?.is_locked
                            ? "Unlock to make changes"
                            : "Lock when your evaluation is final"}
                        </p>
                        <button
                          onClick={handleToggleLock}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                            evaluation?.is_locked
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              : "bg-brand/10 text-brand hover:bg-brand/20"
                          }`}
                        >
                          {evaluation?.is_locked ? (
                            <span className="flex items-center gap-1.5">
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                              Unlock Scorecard
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                              Lock Scorecard
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
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

  const discTag = candidate.disc_primary
    ? `${candidate.disc_primary}${candidate.disc_secondary ? "/" + candidate.disc_secondary : ""}`
    : null;

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
              {/* DISC + AQ badges */}
              <div className="flex items-center gap-1.5 mt-1">
                {discTag && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${discColor(candidate.disc_primary)}`}>
                    DISC: {discTag}
                  </span>
                )}
                {candidate.aq_tier && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${aqColor(candidate.aq_tier)}`}>
                    AQ: {candidate.aq_tier}
                    {candidate.aq_normalized != null && ` (${candidate.aq_normalized})`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 mb-6">
            <DetailRow label="Email" value={candidate.email} />
            <DetailRow label="Phone" value={candidate.phone} />
            <DetailRow label="Current Role" value={candidate.current_role} />
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
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
