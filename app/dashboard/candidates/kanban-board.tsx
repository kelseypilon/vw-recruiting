"use client";

import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import type { PipelineStage, CandidateCard, TeamUser, GroupInterviewSession } from "@/lib/types";
import { getInterviewStageNames, stageNameByTag, STAGE_TAGS } from "@/lib/stage-utils";
import CandidateCardComponent from "./candidate-card";
import AddCandidateModal from "./add-candidate-modal";
import InterviewStageModal from "./interview-stage-modal";
import NotAFitModal from "./not-a-fit-modal";

interface PendingInterviewMove {
  candidateId: string;
  candidateName: string;
  fromStage: string;
  toStage: string;
}

interface PendingNotAFitMove {
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  fromStage: string;
  toStage: string;
}

interface Props {
  stages: PipelineStage[];
  candidates: CandidateCard[];
  teamId: string;
  currentUserId: string;
  leaders: TeamUser[];
  upcomingSessions: GroupInterviewSession[];
  teamZoomLink: string | null;
  thresholdStuckDays?: number;
  businessUnits?: string[];
}

export default function KanbanBoard({
  stages,
  candidates: initialCandidates,
  teamId,
  currentUserId,
  leaders,
  upcomingSessions,
  teamZoomLink,
  thresholdStuckDays = 7,
  businessUnits = [],
}: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterTrack, setFilterTrack] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingInterviewMove, setPendingInterviewMove] =
    useState<PendingInterviewMove | null>(null);
  const [pendingNotAFitMove, setPendingNotAFitMove] =
    useState<PendingNotAFitMove | null>(null);

  // Dynamic stage names from ghl_tag (allows teams to rename stages)
  const INTERVIEW_STAGES = getInterviewStageNames(stages);
  const notAFitName = stageNameByTag(stages, STAGE_TAGS.NOT_A_FIT, "Not a Fit");
  const NOT_A_FIT_STAGES = [notAFitName, "Archived"];

  // @hello-pangea/dnd requires client-only rendering to avoid SSR hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      `${c.first_name} ${c.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery));
    const matchesStage = !filterStage || c.stage === filterStage;
    const matchesTrack = !filterTrack || c.hire_track === filterTrack;
    return matchesSearch && matchesStage && matchesTrack;
  });

  const grouped = stages.reduce(
    (acc, stage) => {
      acc[stage.name] = filtered.filter((c) => c.stage === stage.name);
      return acc;
    },
    {} as Record<string, CandidateCard[]>
  );

  /** Optimistic UI-only stage update */
  function updateStageOptimistic(candidateId: string, newStage: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c))
    );
  }

  /** Persist stage change to DB + record history */
  async function persistStageChange(
    candidateId: string,
    fromStage: string,
    toStage: string
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("candidates")
      .update({ stage: toStage })
      .eq("id", candidateId);
    if (error) {
      // Revert on failure
      updateStageOptimistic(candidateId, fromStage);
      return false;
    }
    await supabase.from("stage_history").insert({
      candidate_id: candidateId,
      from_stage: fromStage,
      to_stage: toStage,
    });

    // Fire GHL webhook (fire-and-forget)
    fetch("/api/webhooks/ghl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        candidate_id: candidateId,
        from_stage: fromStage,
        to_stage: toStage,
      }),
    }).catch(() => {/* fire-and-forget */});

    return true;
  }

  /** Called by CandidateCard "Move Stage" dropdown */
  function handleStageChange(candidateId: string, newStage: string) {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    const fromStage = candidate.stage;

    // Intercept Not a Fit / Archived moves
    if (NOT_A_FIT_STAGES.includes(newStage)) {
      setPendingNotAFitMove({
        candidateId,
        candidateName: `${candidate.first_name} ${candidate.last_name}`,
        candidateEmail: candidate.email,
        fromStage,
        toStage: newStage,
      });
      return;
    }

    // Optimistic update
    updateStageOptimistic(candidateId, newStage);

    if (INTERVIEW_STAGES.includes(newStage)) {
      // Show interview modal — DB persist will happen on modal complete
      setPendingInterviewMove({
        candidateId,
        candidateName: `${candidate.first_name} ${candidate.last_name}`,
        fromStage,
        toStage: newStage,
      });
    } else {
      // Persist immediately for non-interview stages
      persistStageChange(candidateId, fromStage, newStage);
    }
  }

  function handleCandidateAdded(newCandidate: CandidateCard) {
    setCandidates((prev) => [...prev, newCandidate]);
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId;
    const candidateId = draggableId;
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    // Intercept Not a Fit / Archived moves
    if (NOT_A_FIT_STAGES.includes(newStage)) {
      setPendingNotAFitMove({
        candidateId,
        candidateName: `${candidate.first_name} ${candidate.last_name}`,
        candidateEmail: candidate.email,
        fromStage: source.droppableId,
        toStage: newStage,
      });
      return;
    }

    // Optimistic update
    updateStageOptimistic(candidateId, newStage);

    if (INTERVIEW_STAGES.includes(newStage)) {
      // Show interview modal — DB persist on modal complete
      setPendingInterviewMove({
        candidateId,
        candidateName: `${candidate.first_name} ${candidate.last_name}`,
        fromStage: source.droppableId,
        toStage: newStage,
      });
    } else {
      // Persist immediately
      await persistStageChange(candidateId, source.droppableId, newStage);
    }
  }

  function handleInterviewModalComplete() {
    if (pendingInterviewMove) {
      // Persist the stage change (modal already created the interview record)
      persistStageChange(
        pendingInterviewMove.candidateId,
        pendingInterviewMove.fromStage,
        pendingInterviewMove.toStage
      );
    }
    setPendingInterviewMove(null);
  }

  function handleInterviewModalCancel() {
    if (pendingInterviewMove) {
      // Revert optimistic update
      updateStageOptimistic(
        pendingInterviewMove.candidateId,
        pendingInterviewMove.fromStage
      );
    }
    setPendingInterviewMove(null);
  }

  function handleNotAFitMoveWithout() {
    if (!pendingNotAFitMove) return;
    updateStageOptimistic(pendingNotAFitMove.candidateId, pendingNotAFitMove.toStage);
    persistStageChange(pendingNotAFitMove.candidateId, pendingNotAFitMove.fromStage, pendingNotAFitMove.toStage);
    setPendingNotAFitMove(null);
  }

  function handleNotAFitSendEmail() {
    if (!pendingNotAFitMove) return;
    // Move the candidate first
    updateStageOptimistic(pendingNotAFitMove.candidateId, pendingNotAFitMove.toStage);
    persistStageChange(pendingNotAFitMove.candidateId, pendingNotAFitMove.fromStage, pendingNotAFitMove.toStage);
    // Navigate to candidate profile to compose the email
    window.location.href = `/dashboard/candidates/${pendingNotAFitMove.candidateId}?sendEmail=true`;
  }

  function handleNotAFitCancel() {
    setPendingNotAFitMove(null);
  }

  return (
    <>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-[#272727]">Candidates</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a59494]"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 w-56 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
          >
            <option value="">All Tracks</option>
            <option value="agent">Agent</option>
            <option value="employee">Employee</option>
          </select>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition whitespace-nowrap"
          >
            + Add Candidate
          </button>
        </div>
      </div>

      {/* Kanban columns with DnD — only render DnD after client hydration */}
      {isMounted ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageCards = grouped[stage.name] ?? [];
              return (
                <div
                  key={stage.id}
                  className="min-w-[272px] w-[272px] shrink-0 flex flex-col"
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color ?? "#6B7280" }}
                    />
                    <h3 className="text-sm font-semibold text-[#272727] truncate">
                      {stage.name}
                    </h3>
                    <span className="ml-auto text-xs font-medium text-[#a59494] bg-white px-2 py-0.5 rounded-full border border-[#a59494]/20">
                      {stageCards.length}
                    </span>
                  </div>

                  {/* Droppable column */}
                  <Droppable droppableId={stage.name}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col gap-3 flex-1 overflow-y-auto max-h-[calc(100vh-240px)] pr-1 rounded-lg transition-colors min-h-[80px] p-1 ${
                          snapshot.isDraggingOver
                            ? "bg-brand/5 ring-2 ring-brand/20"
                            : ""
                        }`}
                      >
                        {stageCards.map((candidate, index) => (
                          <Draggable
                            key={candidate.id}
                            draggableId={candidate.id}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`transition-shadow ${
                                  dragSnapshot.isDragging
                                    ? "shadow-lg ring-2 ring-brand/30 rounded-xl"
                                    : ""
                                }`}
                              >
                                <CandidateCardComponent
                                  candidate={candidate}
                                  stages={stages}
                                  onStageChange={handleStageChange}
                                  thresholdStuckDays={thresholdStuckDays}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {stageCards.length === 0 && !snapshot.isDraggingOver && (
                          <div className="rounded-xl border-2 border-dashed border-[#a59494]/20 p-6 text-center">
                            <p className="text-xs text-[#a59494]">
                              Drop candidates here
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        /* Static fallback during SSR / before hydration */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageCards = grouped[stage.name] ?? [];
            return (
              <div key={stage.id} className="min-w-[272px] w-[272px] shrink-0 flex flex-col">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color ?? "#6B7280" }} />
                  <h3 className="text-sm font-semibold text-[#272727] truncate">{stage.name}</h3>
                  <span className="ml-auto text-xs font-medium text-[#a59494] bg-white px-2 py-0.5 rounded-full border border-[#a59494]/20">{stageCards.length}</span>
                </div>
                <div className="flex flex-col gap-3 flex-1 min-h-[80px] p-1">
                  {stageCards.map((candidate) => (
                    <CandidateCardComponent key={candidate.id} candidate={candidate} stages={stages} onStageChange={handleStageChange} thresholdStuckDays={thresholdStuckDays} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddModal && (
        <AddCandidateModal
          teamId={teamId}
          businessUnits={businessUnits}
          onClose={() => setShowAddModal(false)}
          onAdded={handleCandidateAdded}
        />
      )}

      {/* Interview Stage Modal */}
      {pendingInterviewMove && (
        <InterviewStageModal
          candidateName={pendingInterviewMove.candidateName}
          candidateId={pendingInterviewMove.candidateId}
          newStage={pendingInterviewMove.toStage}
          teamId={teamId}
          currentUserId={currentUserId}
          leaders={leaders}
          upcomingSessions={upcomingSessions}
          teamZoomLink={teamZoomLink}
          stages={stages}
          onComplete={handleInterviewModalComplete}
          onCancel={handleInterviewModalCancel}
        />
      )}

      {/* Not a Fit / Archived Interception Modal */}
      {pendingNotAFitMove && (
        <NotAFitModal
          candidateName={pendingNotAFitMove.candidateName}
          candidateEmail={pendingNotAFitMove.candidateEmail}
          targetStage={pendingNotAFitMove.toStage}
          onSendEmail={handleNotAFitSendEmail}
          onMoveWithout={handleNotAFitMoveWithout}
          onCancel={handleNotAFitCancel}
        />
      )}
    </>
  );
}
