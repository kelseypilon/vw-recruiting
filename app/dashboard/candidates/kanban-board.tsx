"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import type { PipelineStage, CandidateCard } from "@/lib/types";
import CandidateCardComponent from "./candidate-card";
import AddCandidateModal from "./add-candidate-modal";

interface Props {
  stages: PipelineStage[];
  candidates: CandidateCard[];
  teamId: string;
}

export default function KanbanBoard({
  stages,
  candidates: initialCandidates,
  teamId,
}: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      `${c.first_name} ${c.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery));
    const matchesStage = !filterStage || c.stage === filterStage;
    return matchesSearch && matchesStage;
  });

  const grouped = stages.reduce(
    (acc, stage) => {
      acc[stage.name] = filtered.filter((c) => c.stage === stage.name);
      return acc;
    },
    {} as Record<string, CandidateCard[]>
  );

  function handleStageChange(candidateId: string, newStage: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c))
    );
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

    // Optimistic update
    handleStageChange(candidateId, newStage);

    // Persist to DB
    const supabase = createClient();
    const { error } = await supabase
      .from("candidates")
      .update({ stage: newStage })
      .eq("id", candidateId);

    if (error) {
      // Revert on failure
      const oldStage = source.droppableId;
      handleStageChange(candidateId, oldStage);
    } else {
      // Record stage history
      await supabase.from("stage_history").insert({
        candidate_id: candidateId,
        from_stage: source.droppableId,
        to_stage: newStage,
      });
    }
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
              className="pl-9 pr-3 py-2 w-56 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition"
            />
          </div>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1c759e] focus:border-transparent transition bg-white"
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
            className="px-4 py-2 rounded-lg bg-[#1c759e] hover:bg-[#155f82] active:bg-[#0e4a66] text-white text-sm font-semibold transition whitespace-nowrap"
          >
            + Add Candidate
          </button>
        </div>
      </div>

      {/* Kanban columns with DnD */}
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
                      className={`flex flex-col gap-3 flex-1 overflow-y-auto max-h-[calc(100vh-240px)] pr-1 rounded-lg transition-colors min-h-[80px] ${
                        snapshot.isDraggingOver
                          ? "bg-[#1c759e]/5 ring-2 ring-[#1c759e]/20"
                          : ""
                      }`}
                    >
                      {stageCards.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="rounded-xl border-2 border-dashed border-[#a59494]/20 p-6 text-center">
                          <p className="text-xs text-[#a59494]">
                            Drop candidates here
                          </p>
                        </div>
                      ) : (
                        stageCards.map((candidate, index) => (
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
                                    ? "shadow-lg ring-2 ring-[#1c759e]/30 rounded-xl"
                                    : ""
                                }`}
                              >
                                <CandidateCardComponent
                                  candidate={candidate}
                                  stages={stages}
                                  onStageChange={handleStageChange}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <AddCandidateModal
          teamId={teamId}
          onClose={() => setShowAddModal(false)}
          onAdded={handleCandidateAdded}
        />
      )}
    </>
  );
}
