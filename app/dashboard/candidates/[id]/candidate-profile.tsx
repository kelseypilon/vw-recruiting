"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Candidate,
  PipelineStage,
  CandidateNote,
  StageHistoryEntry,
} from "@/lib/types";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  candidate: Candidate;
  stages: PipelineStage[];
  notes: CandidateNote[];
  history: StageHistoryEntry[];
  teamId: string;
}

/* ── Main Component ────────────────────────────────────────────── */

export default function CandidateProfile({
  candidate: initialCandidate,
  stages,
  notes: initialNotes,
  history: initialHistory,
  teamId,
}: Props) {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [notes, setNotes] = useState(initialNotes);
  const [history, setHistory] = useState(initialHistory);
  const [isMoving, setIsMoving] = useState(false);

  const currentStage = stages.find((s) => s.name === candidate.stage);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-[#a59494] hover:text-[#1c759e] transition mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Candidates
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1c759e] flex items-center justify-center shrink-0">
              <span className="text-white text-lg font-bold">
                {candidate.first_name[0]}
                {candidate.last_name[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#272727]">
                {candidate.first_name} {candidate.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: (currentStage?.color ?? "#6B7280") + "20",
                    color: currentStage?.color ?? "#6B7280",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: currentStage?.color ?? "#6B7280" }}
                  />
                  {candidate.stage}
                </span>
                {candidate.role_applied && (
                  <span className="text-sm text-[#a59494]">
                    {candidate.role_applied}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <ActionButtons
          candidate={candidate}
          stages={stages}
          isMoving={isMoving}
          onMoveStage={async (newStage) => {
            setIsMoving(true);
            const supabase = createClient();
            const { error } = await supabase
              .from("candidates")
              .update({ stage: newStage })
              .eq("id", candidate.id);
            if (!error) {
              // Add to stage history
              await supabase.from("stage_history").insert({
                candidate_id: candidate.id,
                from_stage: candidate.stage,
                to_stage: newStage,
              });
              setCandidate((prev) => ({ ...prev, stage: newStage }));
              setHistory((prev) => [
                {
                  id: crypto.randomUUID(),
                  candidate_id: candidate.id,
                  from_stage: candidate.stage,
                  to_stage: newStage,
                  changed_by: null,
                  created_at: new Date().toISOString(),
                  changer: null,
                },
                ...prev,
              ]);
            }
            setIsMoving(false);
          }}
        />
      </div>

      {/* Grid layout: left = details, right = scoring + notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: contact + application */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <ContactCard candidate={candidate} />
          <ApplicationCard candidate={candidate} />
        </div>

        {/* Right column: scoring + notes + timeline */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Scoring row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DISCCard candidate={candidate} />
            <AQCard candidate={candidate} />
            <CompositeCard candidate={candidate} />
          </div>

          {/* Notes */}
          <NotesSection
            candidateId={candidate.id}
            notes={notes}
            onNoteAdded={(note) => setNotes((prev) => [note, ...prev])}
          />

          {/* Stage History */}
          <StageTimeline history={history} stages={stages} />
        </div>
      </div>
    </div>
  );
}

/* ── Contact Card ──────────────────────────────────────────────── */

function ContactCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#272727] mb-4">Contact Info</h3>
      <div className="space-y-3">
        <InfoRow label="Email" value={candidate.email} />
        <InfoRow label="Phone" value={candidate.phone} />
        <InfoRow label="Current Role" value={candidate.current_role} />
        <InfoRow label="Heard About Us" value={candidate.heard_about} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-[#a59494] mb-0.5">{label}</p>
      <p className="text-sm text-[#272727]">{value ?? "—"}</p>
    </div>
  );
}

/* ── Application Card ──────────────────────────────────────────── */

function ApplicationCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#272727] mb-4">Application Details</h3>
      <div className="space-y-3">
        <InfoRow label="Role Applied" value={candidate.role_applied} />
        <InfoRow
          label="Licensed"
          value={candidate.is_licensed === null ? "—" : candidate.is_licensed ? "Yes" : "No"}
        />
        <InfoRow
          label="Years Experience"
          value={candidate.years_experience !== null ? `${candidate.years_experience} years` : null}
        />
        <InfoRow
          label="Transactions (2024)"
          value={candidate.transactions_2024 !== null ? String(candidate.transactions_2024) : null}
        />
        <InfoRow
          label="Application Submitted"
          value={
            candidate.app_submitted_at
              ? new Date(candidate.app_submitted_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null
          }
        />
      </div>
    </div>
  );
}

/* ── DISC Score Card ───────────────────────────────────────────── */

function DISCCard({ candidate }: { candidate: Candidate }) {
  const scores = [
    { label: "D", value: candidate.disc_d, color: "#EF4444" },
    { label: "I", value: candidate.disc_i, color: "#F59E0B" },
    { label: "S", value: candidate.disc_s, color: "#10B981" },
    { label: "C", value: candidate.disc_c, color: "#3B82F6" },
  ];

  const hasScores = scores.some((s) => s.value !== null);
  const maxVal = Math.max(...scores.map((s) => s.value ?? 0), 1);
  const discTag = candidate.disc_primary
    ? `${candidate.disc_primary}${candidate.disc_secondary ? "/" + candidate.disc_secondary : ""}`
    : null;

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#272727]">DISC Profile</h3>
        {discTag && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            {discTag}
          </span>
        )}
      </div>

      {hasScores ? (
        <div className="space-y-3">
          {scores.map((s) => (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#272727]">{s.label}</span>
                <span className="text-xs text-[#a59494]">{s.value ?? 0}</span>
              </div>
              <div className="h-2.5 bg-[#f5f0f0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((s.value ?? 0) / maxVal) * 100}%`,
                    backgroundColor: s.color,
                  }}
                />
              </div>
            </div>
          ))}
          {candidate.disc_meets_threshold !== null && (
            <div className="flex items-center gap-1.5 pt-1">
              <span
                className={`w-2 h-2 rounded-full ${candidate.disc_meets_threshold ? "bg-green-500" : "bg-red-400"}`}
              />
              <span className="text-xs text-[#a59494]">
                {candidate.disc_meets_threshold ? "Meets threshold" : "Below threshold"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#a59494] text-center py-4">No DISC scores yet</p>
      )}
    </div>
  );
}

/* ── AQ Score Card ─────────────────────────────────────────────── */

function AQCard({ candidate }: { candidate: Candidate }) {
  const tierColors: Record<string, { bg: string; text: string }> = {
    Elite: { bg: "bg-green-100", text: "text-green-800" },
    Strong: { bg: "bg-blue-100", text: "text-blue-800" },
    Developing: { bg: "bg-amber-100", text: "text-amber-800" },
  };

  const tier = candidate.aq_tier ?? "Unknown";
  const colors = tierColors[tier] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  const hasScore = candidate.aq_normalized !== null;

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#272727]">AQ Score</h3>
        {candidate.aq_tier && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
            {candidate.aq_tier}
          </span>
        )}
      </div>

      {hasScore ? (
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-3">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#f5f0f0"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#1c759e"
                strokeWidth="3"
                strokeDasharray={`${(candidate.aq_normalized! / 100) * 97.4} 97.4`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-[#272727]">
                {Math.round(candidate.aq_normalized!)}
              </span>
            </div>
          </div>
          {candidate.aq_raw !== null && (
            <p className="text-xs text-[#a59494]">
              Raw: {candidate.aq_raw}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#a59494] text-center py-4">No AQ score yet</p>
      )}
    </div>
  );
}

/* ── Composite Score Card ──────────────────────────────────────── */

function CompositeCard({ candidate }: { candidate: Candidate }) {
  const verdictColors: Record<string, { bg: string; text: string; ring: string }> = {
    "Strong Hire": { bg: "bg-green-100", text: "text-green-800", ring: "ring-green-300" },
    Hire: { bg: "bg-blue-100", text: "text-blue-800", ring: "ring-blue-300" },
    Consider: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-300" },
    Hold: { bg: "bg-orange-100", text: "text-orange-800", ring: "ring-orange-300" },
    "No Hire": { bg: "bg-red-100", text: "text-red-800", ring: "ring-red-300" },
    Pass: { bg: "bg-red-100", text: "text-red-800", ring: "ring-red-300" },
  };

  const verdict = candidate.composite_verdict ?? "Pending";
  const colors = verdictColors[verdict] ?? { bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-200" };
  const hasScore = candidate.composite_score !== null;

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#272727] mb-4">Composite Score</h3>

      {hasScore ? (
        <div className="text-center">
          <div className="text-3xl font-bold text-[#272727] mb-2">
            {candidate.composite_score!.toFixed(1)}
          </div>
          <span
            className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}
          >
            {verdict}
          </span>
        </div>
      ) : (
        <p className="text-sm text-[#a59494] text-center py-4">Not scored yet</p>
      )}
    </div>
  );
}

/* ── Notes Section ─────────────────────────────────────────────── */

function NotesSection({
  candidateId,
  notes,
  onNoteAdded,
}: {
  candidateId: string;
  notes: CandidateNote[];
  onNoteAdded: (note: CandidateNote) => void;
}) {
  const [newNote, setNewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleAddNote() {
    if (!newNote.trim() || isSaving) return;
    setIsSaving(true);
    const supabase = createClient();

    // Get current user for author_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("candidate_notes")
      .insert({
        candidate_id: candidateId,
        author_id: user.id,
        note_text: newNote.trim(),
      })
      .select("*, author:users(name, email)")
      .single();

    if (!error && data) {
      onNoteAdded(data as CandidateNote);
      setNewNote("");
    }
    setIsSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#272727] mb-4">Notes</h3>

      {/* Add note form */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition resize-none"
        />
        <button
          onClick={handleAddNote}
          disabled={!newNote.trim() || isSaving}
          className="self-end px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isSaving ? "Saving..." : "Add Note"}
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-[#a59494] text-center py-4">
          No notes yet. Add one above.
        </p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg bg-[#f5f0f0]/50 border border-[#a59494]/10"
            >
              <p className="text-sm text-[#272727] whitespace-pre-wrap">
                {note.note_text}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#a59494]">
                  {note.author?.name ?? "System"}
                </span>
                <span className="text-xs text-[#a59494]">·</span>
                <span className="text-xs text-[#a59494]">
                  {new Date(note.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Stage History Timeline ────────────────────────────────────── */

function StageTimeline({
  history,
  stages,
}: {
  history: StageHistoryEntry[];
  stages: PipelineStage[];
}) {
  function stageColor(stageName: string) {
    return stages.find((s) => s.name === stageName)?.color ?? "#6B7280";
  }

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#272727] mb-4">Stage History</h3>

      {history.length === 0 ? (
        <p className="text-sm text-[#a59494] text-center py-4">
          No stage changes recorded yet.
        </p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[#a59494]/20" />

          <div className="space-y-4">
            {history.map((entry, i) => (
              <div key={entry.id} className="relative flex gap-3 pl-1">
                {/* Dot */}
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-white shrink-0 mt-0.5 z-10"
                  style={{ backgroundColor: stageColor(entry.to_stage) }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.from_stage ? (
                      <>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: stageColor(entry.from_stage) + "20",
                            color: stageColor(entry.from_stage),
                          }}
                        >
                          {entry.from_stage}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a59494" strokeWidth="2">
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: stageColor(entry.to_stage) + "20",
                            color: stageColor(entry.to_stage),
                          }}
                        >
                          {entry.to_stage}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[#272727]">
                        Entered{" "}
                        <span
                          className="font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: stageColor(entry.to_stage) + "20",
                            color: stageColor(entry.to_stage),
                          }}
                        >
                          {entry.to_stage}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {entry.changer?.name && (
                      <>
                        <span className="text-xs text-[#a59494]">
                          by {entry.changer.name}
                        </span>
                        <span className="text-xs text-[#a59494]">·</span>
                      </>
                    )}
                    <span className="text-xs text-[#a59494]">
                      {new Date(entry.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Action Buttons ────────────────────────────────────────────── */

function ActionButtons({
  candidate,
  stages,
  isMoving,
  onMoveStage,
}: {
  candidate: Candidate;
  stages: PipelineStage[];
  isMoving: boolean;
  onMoveStage: (newStage: string) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Move Stage dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowMoveMenu(!showMoveMenu)}
          disabled={isMoving}
          className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
        >
          {isMoving ? "Moving..." : "Move Stage"}
          {!isMoving && (
            <span className="ml-1.5">{showMoveMenu ? "\u25B4" : "\u25BE"}</span>
          )}
        </button>
        {showMoveMenu && (
          <div className="absolute right-0 top-10 z-30 w-48 bg-white border border-[#a59494]/20 rounded-lg shadow-lg py-1">
            {stages
              .filter((s) => s.name !== candidate.stage)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onMoveStage(s.name);
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#f5f0f0] transition flex items-center gap-2"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color ?? "#6B7280" }}
                  />
                  {s.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Schedule Interview */}
      <button className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition">
        Schedule Interview
      </button>

      {/* Move to Onboarding */}
      <button
        onClick={() => onMoveStage("Onboarding")}
        disabled={isMoving || candidate.stage === "Onboarding"}
        className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Move to Onboarding
      </button>
    </div>
  );
}
