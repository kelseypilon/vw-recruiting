"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/lib/user-permissions-context";
import type {
  Candidate,
  PipelineStage,
  CandidateNote,
  StageHistoryEntry,
  EmailTemplate,
  TeamUser,
  OnboardingTask,
  CandidateOnboarding,
  Team,
  Interview,
  InterviewScorecard,
  InterviewQuestion,
  CandidateGroupSession,
  GroupInterviewNote,
} from "@/lib/types";
import ScheduleModal from "@/app/dashboard/interviews/schedule-modal";
import EmailPreviewModal from "@/app/dashboard/interviews/email-preview-modal";
import type { EmailPreviewData } from "@/app/dashboard/interviews/email-preview-modal";
import OnboardingTaskList from "@/app/dashboard/onboarding/onboarding-task-list";
import OnboardingEmailModal from "@/app/dashboard/onboarding/onboarding-email-modal";

/* ── Props ─────────────────────────────────────────────────────── */

interface Props {
  candidate: Candidate;
  stages: PipelineStage[];
  notes: CandidateNote[];
  history: StageHistoryEntry[];
  emailTemplates: EmailTemplate[];
  leaders: TeamUser[];
  teamId: string;
  onboardingTasks: OnboardingTask[];
  onboardingProgress: CandidateOnboarding[];
  team: Team | null;
  interviews: Interview[];
  scorecards: InterviewScorecard[];
  interviewQuestions: InterviewQuestion[];
  currentUserId: string;
  groupSessions?: CandidateGroupSession[];
  groupNotes?: GroupInterviewNote[];
}

/* ── Main Component ────────────────────────────────────────────── */

export default function CandidateProfile({
  candidate: initialCandidate,
  stages,
  notes: initialNotes,
  history: initialHistory,
  emailTemplates,
  leaders,
  teamId,
  onboardingTasks,
  onboardingProgress: initialOnboardingProgress,
  team,
  interviews,
  scorecards,
  interviewQuestions,
  currentUserId,
  groupSessions = [],
  groupNotes = [],
}: Props) {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [notes, setNotes] = useState(initialNotes);
  const [history, setHistory] = useState(initialHistory);
  const [localInterviews, setLocalInterviews] = useState(interviews);
  const [isMoving, setIsMoving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "onboarding" | "interviews">("profile");

  const currentStage = stages.find((s) => s.name === candidate.stage);

  const tabs = [
    { key: "profile" as const, label: "Profile" },
    { key: "interviews" as const, label: "Interviews" },
    { key: "onboarding" as const, label: "Onboarding" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-[#a59494] hover:text-brand transition mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Candidates
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center shrink-0">
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
          onSendEmail={() => setShowEmailModal(true)}
          onScheduleInterview={() => setShowScheduleModal(true)}
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

              // Auto-create interview when moving to interview stages
              const interviewStages = ["Group Interview", "1on1 Interview"];
              if (interviewStages.includes(newStage)) {
                const { data: newInterview } = await supabase
                  .from("interviews")
                  .insert({
                    team_id: teamId,
                    candidate_id: candidate.id,
                    interview_type: newStage,
                    status: "scheduled",
                    scheduled_at: null,
                    notes: `Auto-created when moved to ${newStage}`,
                  })
                  .select(
                    "*, candidate:candidates(first_name, last_name, role_applied, stage)"
                  )
                  .single();
                if (newInterview) {
                  setLocalInterviews((prev) => [
                    ...prev,
                    newInterview as Interview,
                  ]);
                  // Link current user as interviewer
                  if (currentUserId) {
                    await supabase
                      .from("interview_interviewers")
                      .insert({
                        interview_id: newInterview.id,
                        user_id: currentUserId,
                      });
                  }
                }
              }
            }
            setIsMoving(false);
          }}
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-[#a59494]/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab.key
                ? "text-brand border-brand"
                : "text-[#a59494] border-transparent hover:text-[#272727]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: contact + application + resume */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <ContactCard candidate={candidate} />
            <ApplicationCard candidate={candidate} />
            <ResumeCard
              candidate={candidate}
              onResumeUploaded={(url) =>
                setCandidate((prev) => ({ ...prev, resume_url: url }))
              }
            />
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
              groupNotes={groupNotes}
              onNoteAdded={(note) => setNotes((prev) => [note, ...prev])}
            />

            {/* Stage History */}
            <StageTimeline history={history} stages={stages} />
          </div>
        </div>
      )}

      {activeTab === "onboarding" && (
        <OnboardingTab
          candidate={candidate}
          tasks={onboardingTasks}
          initialProgress={initialOnboardingProgress}
          emailTemplates={emailTemplates}
          leaders={leaders}
          team={team}
          teamId={teamId}
          onCandidateUpdate={(c) => setCandidate(c)}
        />
      )}

      {activeTab === "interviews" && (
        <InterviewsTab
          candidate={candidate}
          interviews={localInterviews}
          scorecards={scorecards}
          interviewQuestions={interviewQuestions}
          currentUserId={currentUserId}
          teamId={teamId}
          team={team}
          groupSessions={groupSessions}
          emailTemplates={emailTemplates}
          leaders={leaders}
        />
      )}

      {/* Email Modal */}
      {showEmailModal && candidate.email && (
        <SendEmailModal
          candidate={candidate}
          templates={emailTemplates}
          leaders={leaders}
          team={team}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {/* Schedule Interview Modal */}
      {showScheduleModal && (
        <ScheduleModal
          eligibleCandidates={[candidate]}
          leaders={leaders}
          emailTemplates={emailTemplates}
          teamId={teamId}
          team={team}
          preselectedCandidateId={candidate.id}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}

/* ── Onboarding Tab ───────────────────────────────────────────── */

function OnboardingTab({
  candidate,
  tasks,
  initialProgress,
  emailTemplates,
  leaders,
  team,
  teamId,
  onCandidateUpdate,
}: {
  candidate: Candidate;
  tasks: OnboardingTask[];
  initialProgress: CandidateOnboarding[];
  emailTemplates: EmailTemplate[];
  leaders: TeamUser[];
  team: Team | null;
  teamId: string;
  onCandidateUpdate: (c: Candidate) => void;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState("");
  const [emailModalTask, setEmailModalTask] = useState<OnboardingTask | null>(
    null
  );
  const [startDate, setStartDate] = useState(candidate.start_date ?? "");
  const [isSavingStartDate, setIsSavingStartDate] = useState(false);

  const progressMap = new Map<string, CandidateOnboarding>();
  progress.forEach((p) => progressMap.set(p.task_id, p));

  const completedCount = progress.filter((p) => p.completed_at).length;
  const totalTasks = progress.length || tasks.length;
  const progressPercent =
    totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  async function handleStartDateSave(newDate: string) {
    setIsSavingStartDate(true);
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { error: saveErr } = await supabase
        .from("candidates")
        .update({ start_date: newDate || null })
        .eq("id", candidate.id);
      if (!saveErr) {
        setStartDate(newDate);
        onCandidateUpdate({ ...candidate, start_date: newDate || null });
      }
    } catch {
      // silently fail — user can retry
    }
    setIsSavingStartDate(false);
  }

  async function handleInitialize(hireType: "agent" | "employee") {
    if (isInitializing) return;
    setIsInitializing(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initialize",
          candidate_id: candidate.id,
          hire_type: hireType,
          team_id: teamId,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setProgress(result.data as CandidateOnboarding[]);
        onCandidateUpdate({ ...candidate, hire_type: hireType });
      }
    } catch {
      setError("Network error — please try again");
    }
    setIsInitializing(false);
  }

  async function handleToggleTask(taskId: string) {
    const existing = progressMap.get(taskId);
    if (!existing) return;

    const newCompleted = existing.completed_at
      ? null
      : new Date().toISOString();

    // Optimistic update
    setProgress((prev) =>
      prev.map((p) =>
        p.id === existing.id ? { ...p, completed_at: newCompleted } : p
      )
    );

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          entry_id: existing.id,
          completed_at: newCompleted,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setProgress((prev) =>
          prev.map((p) =>
            p.id === existing.id
              ? { ...p, completed_at: existing.completed_at }
              : p
          )
        );
      }
    } catch {
      setProgress((prev) =>
        prev.map((p) =>
          p.id === existing.id
            ? { ...p, completed_at: existing.completed_at }
            : p
        )
      );
    }
  }

  function handleEmailSent(taskId: string) {
    // Mark the email task as complete after send
    handleToggleTask(taskId);
    setEmailModalTask(null);
  }

  // Filter tasks to only those that have a progress entry (matched to hire type)
  const activeTasks =
    progress.length > 0
      ? tasks.filter((t) => progressMap.has(t.id))
      : tasks;

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D97706"
            strokeWidth="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <p className="text-[#272727] font-medium mb-1">
          No onboarding tasks configured
        </p>
        <p className="text-sm text-[#a59494]">
          Run the onboarding rebuild migration in your Supabase SQL Editor.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        {/* Progress header */}
        <div className="px-6 py-4 border-b border-[#a59494]/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#272727]">
                Onboarding Progress
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {candidate.hire_type && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                    {candidate.hire_type === "agent" ? "Agent" : "Employee"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Start Date field */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#a59494] whitespace-nowrap">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleStartDateSave(e.target.value);
                  }}
                  disabled={isSavingStartDate}
                  className="px-2 py-1 rounded-lg border border-[#a59494]/30 text-xs text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition disabled:opacity-50"
                />
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-brand">
                  {Math.round(progressPercent)}%
                </span>
                <span className="text-xs text-[#a59494] ml-2">
                  {completedCount} of {totalTasks} tasks
                </span>
              </div>
            </div>
          </div>
          <div className="h-2 bg-[#f5f0f0] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor:
                  progressPercent === 100 ? "#10B981" : "var(--brand-primary)",
              }}
            />
          </div>
        </div>

        {/* Task list */}
        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {progress.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#a59494] mb-4">
                Select hire type to initialize onboarding
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleInitialize("agent")}
                  disabled={isInitializing}
                  className="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {isInitializing ? "Initializing..." : "Start as Agent"}
                </button>
                <button
                  onClick={() => handleInitialize("employee")}
                  disabled={isInitializing}
                  className="px-5 py-2.5 rounded-lg border-2 border-brand text-brand hover:bg-brand/5 text-sm font-semibold transition disabled:opacity-50"
                >
                  {isInitializing ? "Initializing..." : "Start as Employee"}
                </button>
              </div>
            </div>
          ) : (
            <OnboardingTaskList
              tasks={activeTasks}
              progress={progress}
              candidate={candidate}
              onToggle={handleToggleTask}
              onEmailTask={(task) => setEmailModalTask(task)}
            />
          )}
        </div>
      </div>

      {/* Email Modal */}
      {emailModalTask && candidate.email && (
        <OnboardingEmailModal
          task={emailModalTask}
          candidate={candidate}
          templates={emailTemplates}
          leaders={leaders}
          team={team}
          onSent={() => handleEmailSent(emailModalTask.id)}
          onClose={() => setEmailModalTask(null)}
        />
      )}
    </>
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
        <InfoRow label="Current Brokerage" value={candidate.current_brokerage} />
        <InfoRow label="Heard About Us" value={candidate.heard_about} />
        {candidate.website_url && (
          <div>
            <p className="text-xs text-[#a59494] mb-0.5">Website</p>
            <a
              href={candidate.website_url.startsWith("http") ? candidate.website_url : `https://${candidate.website_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand hover:underline break-all"
            >
              {candidate.website_url}
            </a>
          </div>
        )}
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
          label="Deals Done Last Year"
          value={candidate.transactions_2024 !== null ? String(candidate.transactions_2024) : null}
        />
        <InfoRow
          label="Active Listings"
          value={candidate.active_listings !== null ? String(candidate.active_listings) : null}
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

/* ── Resume Card ──────────────────────────────────────────────── */

function ResumeCard({
  candidate,
  onResumeUploaded,
}: {
  candidate: Candidate;
  onResumeUploaded: (url: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Please upload a PDF or Word document");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be under 10MB");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "pdf";
    const filePath = `${candidate.team_id}/${candidate.id}/resume.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("resumes")
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      setUploadError(uploadErr.message);
      setIsUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("resumes").getPublicUrl(filePath);

    // Save URL to candidate record
    const { error: dbErr } = await supabase
      .from("candidates")
      .update({ resume_url: publicUrl })
      .eq("id", candidate.id);

    if (dbErr) {
      setUploadError(dbErr.message);
    } else {
      onResumeUploaded(publicUrl);
    }

    setIsUploading(false);
    // Reset the input
    e.target.value = "";
  }

  return (
    <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#272727] mb-4">Resume</h3>

      {candidate.resume_url ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#f5f0f0]/50 border border-[#a59494]/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--brand-primary)"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#272727] truncate">Resume uploaded</p>
            </div>
            <a
              href={candidate.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand hover:underline shrink-0"
            >
              View
            </a>
          </div>

          {/* Replace resume */}
          <label className="block text-center cursor-pointer">
            <span className="text-xs text-[#a59494] hover:text-brand transition">
              {isUploading ? "Uploading..." : "Replace resume"}
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 py-6 cursor-pointer rounded-lg border-2 border-dashed border-[#a59494]/30 hover:border-brand/50 transition">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a59494"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-sm text-[#a59494]">
            {isUploading ? "Uploading..." : "Upload Resume"}
          </span>
          <span className="text-xs text-[#a59494]">PDF or Word, max 10MB</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      )}

      {uploadError && (
        <p className="text-xs text-red-500 mt-2">{uploadError}</p>
      )}
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
                stroke="var(--brand-primary)"
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
  groupNotes = [],
  onNoteAdded,
}: {
  candidateId: string;
  notes: CandidateNote[];
  groupNotes?: GroupInterviewNote[];
  onNoteAdded: (note: CandidateNote) => void;
}) {
  const [newNote, setNewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleAddNote() {
    if (!newNote.trim() || isSaving) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          note_text: newNote.trim(),
        }),
      });
      const result = await res.json();
      if (result.data) {
        onNoteAdded(result.data as CandidateNote);
        setNewNote("");
      }
    } catch {
      // silently fail — user sees note didn't appear
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
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#a59494]/40 text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
        />
        <button
          onClick={handleAddNote}
          disabled={!newNote.trim() || isSaving}
          className="self-end px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isSaving ? "Saving..." : "Add Note"}
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 && groupNotes.length === 0 ? (
        <p className="text-sm text-[#a59494] text-center py-4">
          No notes yet. Add one above.
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
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

          {/* Group Interview Notes */}
          {groupNotes.map((gn) => (
            <div
              key={gn.id}
              className="p-3 rounded-lg bg-brand/5 border border-brand/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                  From Group Interview
                </span>
              </div>
              <p className="text-sm text-[#272727] whitespace-pre-wrap">
                {gn.note_text}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#a59494]">
                  {gn.author?.name ?? "Unknown"}
                </span>
                <span className="text-xs text-[#a59494]">·</span>
                <span className="text-xs text-[#a59494]">
                  {new Date(gn.updated_at).toLocaleDateString("en-US", {
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
            {history.map((entry) => (
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
  onSendEmail,
  onScheduleInterview,
}: {
  candidate: Candidate;
  stages: PipelineStage[];
  isMoving: boolean;
  onMoveStage: (newStage: string) => void;
  onSendEmail?: () => void;
  onScheduleInterview?: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const { can } = usePermissions();
  const canSendEmails = can("send_emails");
  const canManageInterviews = can("manage_interviews");
  const canEditCandidates = can("edit_candidates");

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Move Stage dropdown — requires edit_candidates permission */}
      {canEditCandidates && (
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
      )}

      {/* Send Email — requires send_emails permission */}
      {candidate.email && canSendEmails && (
        <button
          onClick={() => onSendEmail?.()}
          className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
        >
          Send Email
        </button>
      )}

      {/* Schedule Interview — requires manage_interviews permission */}
      {canManageInterviews && (
        <button
          onClick={() => onScheduleInterview?.()}
          className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
        >
          Schedule Interview
        </button>
      )}

      {/* Move to Onboarding — requires edit_candidates permission */}
      {canEditCandidates && (
        <button
          onClick={() => onMoveStage("Onboarding")}
          disabled={isMoving || candidate.stage === "Onboarding"}
          className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Move to Onboarding
        </button>
      )}
    </div>
  );
}

/* ── Send Email Modal ─────────────────────────────────────────── */

function SendEmailModal({
  candidate,
  templates,
  leaders,
  team,
  onClose,
}: {
  candidate: Candidate;
  templates: EmailTemplate[];
  leaders: TeamUser[];
  team: Team | null;
  onClose: () => void;
}) {
  // Senders: all team members (prefer from_email, fall back to regular email)
  const senders = leaders.filter((l) => l.from_email || l.email);
  const [fromUserId, setFromUserId] = useState(senders[0]?.id ?? "");
  const [ccEmail, setCcEmail] = useState(
    team?.admin_cc && team?.admin_email ? team.admin_email : ""
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  const selectedSender = leaders.find((l) => l.id === fromUserId);

  function replaceMergeTags(text: string) {
    return text
      .replace(/\{\{first_name\}\}/g, candidate.first_name)
      .replace(/\{\{last_name\}\}/g, candidate.last_name)
      .replace(/\{\{team_name\}\}/g, team?.name ?? "Our Team")
      .replace(
        /\{\{sender_name\}\}/g,
        selectedSender?.name ?? "Recruiting Team"
      );
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setSubject(replaceMergeTags(tmpl.subject));
      setBody(replaceMergeTags(tmpl.body));
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setSendStatus("Please fill in subject and body");
      return;
    }
    setIsSending(true);
    setSendStatus("");

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: candidate.email,
          subject,
          body,
          from_email: selectedSender?.from_email ?? selectedSender?.email ?? undefined,
          cc: ccEmail || undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setSendStatus(`Error: ${data.error}`);
      } else {
        setSendStatus("Email sent successfully!");
        setTimeout(() => onClose(), 1500);
      }
    } catch {
      setSendStatus("Failed to send email");
    }
    setIsSending(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#a59494]/10 sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="text-lg font-bold text-[#272727]">Send Email</h3>
          <button
            onClick={onClose}
            className="text-[#a59494] hover:text-[#272727] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* From */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              From
            </label>
            {senders.length > 0 ? (
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} &lt;{s.from_email ?? s.email}&gt;
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#a59494] bg-[#f5f0f0]">
                No sending addresses configured.{" "}
                <span className="text-xs">
                  Go to Settings → Team Members to add a &quot;From Email&quot;.
                </span>
              </div>
            )}
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              To
            </label>
            <div className="px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] bg-[#f5f0f0]/50">
              {candidate.first_name} {candidate.last_name} &lt;{candidate.email}&gt;
            </div>
          </div>

          {/* CC */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              CC
            </label>
            <input
              type="email"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="cc@team.com"
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
            {team?.admin_cc && team?.admin_email && (
              <p className="text-xs text-[#a59494] mt-1">
                Pre-filled with team admin email (admin CC is enabled)
              </p>
            )}
          </div>

          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Use Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition bg-white"
            >
              <option value="">Blank email (no template)</option>
              {templates
                .filter((t) => t.is_active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-[#272727] mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-[#272727] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
            />
          </div>

          {sendStatus && (
            <p
              className={`text-sm ${
                sendStatus.startsWith("Error") || sendStatus.startsWith("Failed")
                  ? "text-red-600"
                  : sendStatus.includes("success")
                  ? "text-green-600"
                  : "text-[#a59494]"
              }`}
            >
              {sendStatus}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !subject.trim() || !body.trim()}
              className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Interviews Tab ────────────────────────────────────────────── */

const INTERVIEW_CATEGORY_ORDER = [
  "Timeline & Rapport", "Values - Joy", "Values - Ownership", "Values - Grit",
  "Coachability", "Curiosity", "Work Ethic", "Intelligence",
  "Prior Success", "Passion", "Adaptability", "Emotional Intelligence",
  "Resilience", "Confidence", "Closing",
];

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  strong_yes: { label: "Strong Yes", color: "bg-green-600 text-white" },
  yes: { label: "Yes", color: "bg-green-500 text-white" },
  hold: { label: "Hold", color: "bg-amber-500 text-white" },
  no: { label: "No", color: "bg-red-500 text-white" },
};

function scoreColor(score: number) {
  if (score >= 4) return "text-green-700 bg-green-50";
  if (score >= 3) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function InterviewsTab({
  candidate,
  interviews,
  scorecards,
  interviewQuestions,
  currentUserId,
  teamId,
  team,
  groupSessions = [],
  emailTemplates = [],
  leaders = [],
}: {
  candidate: Candidate;
  interviews: Interview[];
  scorecards: InterviewScorecard[];
  interviewQuestions: InterviewQuestion[];
  currentUserId: string;
  teamId: string;
  team: Team | null;
  groupSessions?: CandidateGroupSession[];
  emailTemplates?: EmailTemplate[];
  leaders?: TeamUser[];
}) {
  const [subTab, setSubTab] = useState<"scheduled" | "guide" | "scorecard">("scheduled");

  const subTabs = [
    { key: "scheduled" as const, label: "Scheduled" },
    { key: "guide" as const, label: "Interview Guide" },
    { key: "scorecard" as const, label: "Scorecard" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-[#f5f0f0]/50 rounded-lg p-1">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition ${
              subTab === tab.key
                ? "bg-white text-[#272727] shadow-sm"
                : "text-[#a59494] hover:text-[#272727]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "scheduled" && (
        <ScheduledSubTab
          candidate={candidate}
          interviews={interviews}
          scorecards={scorecards}
          currentUserId={currentUserId}
          teamId={teamId}
          team={team}
          groupSessions={groupSessions}
          leaders={leaders}
        />
      )}

      {subTab === "guide" && (
        <InterviewGuideSubTab
          interviewQuestions={interviewQuestions}
          candidateId={candidate.id}
          teamId={teamId}
          currentUserId={currentUserId}
        />
      )}

      {subTab === "scorecard" && (
        <ScorecardSubTab
          candidate={candidate}
          interviews={interviews}
          scorecards={scorecards}
          interviewQuestions={interviewQuestions}
          currentUserId={currentUserId}
          teamId={teamId}
        />
      )}
    </div>
  );
}

/* ── Scheduled Sub-Tab ─────────────────────────────────────────── */

function ScheduledSubTab({
  candidate,
  interviews,
  scorecards,
  currentUserId,
  teamId,
  team,
  groupSessions = [],
  leaders = [],
}: {
  candidate: Candidate;
  interviews: Interview[];
  scorecards: InterviewScorecard[];
  currentUserId: string;
  teamId: string;
  team: Team | null;
  groupSessions?: CandidateGroupSession[];
  leaders?: TeamUser[];
}) {
  const [emailInterview, setEmailInterview] = useState<Interview | null>(null);
  const [localInterviewsList, setLocalInterviewsList] = useState(interviews);
  const [showNewInterviewForm, setShowNewInterviewForm] = useState(false);
  const [newInterviewType, setNewInterviewType] = useState("1on1 Interview");
  const [newInterviewDate, setNewInterviewDate] = useState("");
  const [creatingInterview, setCreatingInterview] = useState(false);

  const candidateInterviews = localInterviewsList.filter(
    (i) => i.candidate_id === candidate.id
  );

  async function handleCreateInterview() {
    setCreatingInterview(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_interview",
          payload: {
            team_id: teamId,
            candidate_id: candidate.id,
            interview_type: newInterviewType,
            status: "scheduled",
            scheduled_at: newInterviewDate || null,
            notes: "",
            interviewer_ids: [currentUserId],
          },
        }),
      });
      const json = await res.json();
      if (json.data) {
        setLocalInterviewsList((prev) => [...prev, json.data as Interview]);
        setShowNewInterviewForm(false);
        setNewInterviewDate("");
      }
    } catch (err) {
      console.error("Failed to create interview:", err);
    }
    setCreatingInterview(false);
  }

  return (
    <div className="space-y-4">
      {/* Interview list */}
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
        <div className="px-6 py-4 border-b border-[#a59494]/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#272727]">
            Interviews ({candidateInterviews.length})
          </h3>
          <button
            onClick={() => setShowNewInterviewForm(!showNewInterviewForm)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand-dark transition"
          >
            {showNewInterviewForm ? "Cancel" : "+ Schedule Interview"}
          </button>
        </div>

        {showNewInterviewForm && (
          <div className="px-6 py-4 border-b border-[#a59494]/10 bg-[#f5f0f0]/30">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#a59494] uppercase tracking-wider mb-1">
                  Type
                </label>
                <select
                  value={newInterviewType}
                  onChange={(e) => setNewInterviewType(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                >
                  <option value="1on1 Interview">1-on-1 Interview</option>
                  <option value="Phone Screen">Phone Screen</option>
                  <option value="Coffee Chat">Coffee Chat</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#a59494] uppercase tracking-wider mb-1">
                  Date & Time
                  <span className="font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={newInterviewDate}
                  onChange={(e) => setNewInterviewDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                />
              </div>
              <button
                onClick={handleCreateInterview}
                disabled={creatingInterview}
                className="px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50"
              >
                {creatingInterview ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {candidateInterviews.length === 0 && !showNewInterviewForm ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[#a59494] mb-3">No interviews scheduled yet</p>
            <button
              onClick={() => setShowNewInterviewForm(true)}
              className="text-sm font-medium text-brand hover:text-brand-dark transition"
            >
              + Schedule first interview
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#a59494]/10">
            {candidateInterviews.map((interview) => {
              const allSc = scorecards.filter(
                (s) => s.interview_id === interview.id && s.submitted_at
              );
              return (
                <div key={interview.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#272727]">
                      {interview.interview_type}
                    </p>
                    <p className="text-xs text-[#a59494]">
                      {interview.scheduled_at
                        ? new Date(interview.scheduled_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "Not scheduled"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {allSc.length > 0 && (
                      <span className="text-xs text-[#a59494]">
                        {allSc.length} scorecard{allSc.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {candidate.email && interview.status === "scheduled" && (
                      <button
                        onClick={() => setEmailInterview(interview)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                        title="Send invite email for this interview"
                      >
                        Email
                      </button>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        interview.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : interview.status === "scheduled"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group Interview Sessions */}
      {groupSessions.length > 0 && (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="px-6 py-4 border-b border-[#a59494]/10">
            <h3 className="text-sm font-semibold text-[#272727]">
              Group Interview Sessions ({groupSessions.length})
            </h3>
            <p className="text-xs text-[#a59494] mt-0.5">
              Group interviews are managed from the{" "}
              <Link href="/dashboard/group-interviews" className="text-brand hover:underline">
                Group Interviews page
              </Link>
            </p>
          </div>
          <div className="divide-y divide-[#a59494]/10">
            {groupSessions.map((gs) => {
              const session = gs.session;
              if (!session) return null;
              const statusColor =
                session.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : session.status === "in_progress"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700";
              return (
                <Link
                  key={gs.session_id}
                  href={`/dashboard/group-interviews/${session.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-[#f5f0f0]/50 transition"
                >
                  <div>
                    <p className="text-sm font-medium text-[#272727]">{session.title}</p>
                    <span className="text-xs text-[#a59494]">
                      {session.session_date
                        ? new Date(session.session_date).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "Date not set"}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                    {session.status === "in_progress"
                      ? "In Progress"
                      : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Send Email for Existing Interview */}
      {emailInterview && candidate.email && (
        <EmailPreviewModal
          data={{
            to: candidate.email,
            fromEmail: "",
            subject: `Your ${emailInterview.interview_type} with ${team?.name ?? "Our Team"}`,
            body: `Hi ${candidate.first_name},\n\nWe're reaching out regarding your upcoming ${emailInterview.interview_type} interview.\n\n${emailInterview.scheduled_at ? `Date: ${new Date(emailInterview.scheduled_at).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}` : "We will confirm the date and time shortly."}\n\nIf you have any questions, don't hesitate to reach out.\n\nBest,\n${team?.name ?? "Our Team"}`,
            teamId,
            candidateId: candidate.id,
            interviewType: emailInterview.interview_type,
            scheduledAt: emailInterview.scheduled_at,
            notes: emailInterview.notes ?? "",
            cc: team?.admin_cc && team?.admin_email ? team.admin_email : undefined,
            interviewId: emailInterview.id,
          } as EmailPreviewData}
          onClose={() => setEmailInterview(null)}
          onSent={() => setEmailInterview(null)}
        />
      )}
    </div>
  );
}

/* ── Interview Guide Sub-Tab ───────────────────────────────────── */

function InterviewGuideSubTab({
  interviewQuestions,
  candidateId,
  teamId,
  currentUserId,
}: {
  interviewQuestions: InterviewQuestion[];
  candidateId: string;
  teamId: string;
  currentUserId: string;
}) {
  const [guideNotes, setGuideNotes] = useState<Record<string, string>>({});
  const debounceTimers = useState<Record<string, ReturnType<typeof setTimeout>>>({})[0];

  // Load existing guide notes on mount
  useEffect(() => {
    async function loadNotes() {
      try {
        const res = await fetch("/api/interview-scorecards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_guide_notes",
            payload: { candidate_id: candidateId, author_user_id: currentUserId },
          }),
        });
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const notes: Record<string, string> = {};
          for (const n of json.data) {
            if (n.note_text) notes[n.question_id] = n.note_text;
          }
          setGuideNotes(notes);
        }
      } catch {}
    }
    loadNotes();
  }, [candidateId, currentUserId]);

  // Group questions by category in CATEGORY_ORDER
  const grouped: Record<string, InterviewQuestion[]> = {};
  for (const q of interviewQuestions) {
    if (!grouped[q.category]) grouped[q.category] = [];
    grouped[q.category].push(q);
  }
  const sortedCategoryKeys = Object.keys(grouped).sort((a, b) => {
    const ai = INTERVIEW_CATEGORY_ORDER.indexOf(a);
    const bi = INTERVIEW_CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  function handleNoteChange(questionId: string, text: string) {
    setGuideNotes((prev) => ({ ...prev, [questionId]: text }));

    // Debounced auto-save (2s)
    if (debounceTimers[questionId]) clearTimeout(debounceTimers[questionId]);
    debounceTimers[questionId] = setTimeout(() => {
      // Save note via API (fire-and-forget)
      fetch("/api/interview-scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_guide_note",
          payload: {
            candidate_id: candidateId,
            question_id: questionId,
            team_id: teamId,
            author_user_id: currentUserId,
            note_text: text,
          },
        }),
      }).catch(() => {});
    }, 2000);
  }

  if (interviewQuestions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-8 text-center">
        <p className="text-sm text-[#a59494] mb-2">No interview questions configured</p>
        <p className="text-xs text-[#a59494]">
          Add questions in{" "}
          <Link href="/dashboard/settings" className="text-brand hover:underline">
            Settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedCategoryKeys.map((category) => (
        <div key={category} className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="px-5 py-3 border-b border-[#a59494]/10">
            <h4 className="text-xs font-bold text-brand uppercase tracking-wider">
              {category}
            </h4>
          </div>
          <div className="divide-y divide-[#a59494]/5">
            {grouped[category].map((q) => (
              <div key={q.id} className="px-5 py-3">
                <p className="text-sm text-[#272727] mb-2">{q.question_text}</p>
                <textarea
                  placeholder="Notes..."
                  value={guideNotes[q.id] ?? ""}
                  onChange={(e) => handleNoteChange(q.id, e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#a59494]/20 text-sm text-[#272727] placeholder:text-[#a59494]/50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-transparent transition resize-none"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Scorecard Sub-Tab ─────────────────────────────────────────── */

function ScorecardSubTab({
  candidate,
  interviews,
  scorecards,
  interviewQuestions,
  currentUserId,
  teamId,
}: {
  candidate: Candidate;
  interviews: Interview[];
  scorecards: InterviewScorecard[];
  interviewQuestions: InterviewQuestion[];
  currentUserId: string;
  teamId: string;
}) {
  // Get unique categories from questions
  const categories = [...new Set(interviewQuestions.map((q) => q.category))].sort(
    (a, b) => {
      const ai = INTERVIEW_CATEGORY_ORDER.indexOf(a);
      const bi = INTERVIEW_CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
  );

  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<string>("");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [localScorecards, setLocalScorecards] = useState(scorecards);

  const { userRole } = usePermissions();
  const FULL_ACCESS_ROLES = ["Team Lead", "Admin", "VP Ops"];
  const isFullAccess = FULL_ACCESS_ROLES.includes(userRole);

  // Pick the first scheduled/completed interview for this candidate to attach scorecard to
  const candidateInterviews = interviews.filter((i) => i.candidate_id === candidate.id);
  const activeInterview = candidateInterviews.find((i) => i.status === "scheduled" || i.status === "completed");

  // Calculate overall score from rated categories
  const ratedValues = Object.values(categoryRatings).filter((v) => v > 0);
  const overallScore = ratedValues.length > 0
    ? Number((ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length).toFixed(2))
    : null;

  async function handleSaveOrSubmit(doSubmit: boolean) {
    if (!activeInterview) return;
    setSaving(true);

    try {
      // Build category_scores and answers
      const category_scores: Record<string, number> = {};
      const answers = categories
        .filter((cat) => categoryRatings[cat] && categoryRatings[cat] > 0)
        .map((cat) => {
          category_scores[cat] = categoryRatings[cat];
          return {
            question_id: cat,
            question_text: cat,
            category: cat,
            score: categoryRatings[cat],
            notes: "",
          };
        });

      const res = await fetch("/api/interview-scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: doSubmit ? "submit" : "save_draft",
          payload: {
            interview_id: activeInterview.id,
            interviewer_user_id: currentUserId,
            candidate_id: candidate.id,
            team_id: teamId,
            answers,
            category_scores,
            overall_score: overallScore,
            recommendation: recommendation || null,
            summary_notes: summaryNotes || null,
          },
        }),
      });
      const result = await res.json();

      if (result.data) {
        setLocalScorecards((prev) => {
          const idx = prev.findIndex((sc) => sc.id === result.data.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = result.data;
            return next;
          }
          return [...prev, result.data];
        });
        if (doSubmit) setSubmitted(true);
      }
    } catch (err) {
      console.error("Failed to save scorecard:", err);
    }
    setSaving(false);
  }

  // Visibility filtering for submitted scorecards
  const viewerHasSubmitted = localScorecards.some(
    (sc) => sc.interviewer_user_id === currentUserId && sc.submitted_at
  );
  const submittedScorecards = localScorecards
    .filter((sc) => sc.submitted_at)
    .filter((sc) => {
      if (sc.interviewer_user_id === currentUserId) return true;
      if (isFullAccess) return true;
      const vis = (sc.evaluator as Record<string, unknown> | null)?.scorecard_visibility as string | undefined;
      if (vis === "never") return false;
      if (vis === "after_submit") return viewerHasSubmitted;
      return true;
    });

  // Comparison grid data
  const allCategories = new Set<string>();
  submittedScorecards.forEach((sc) => {
    Object.keys(sc.category_scores).forEach((cat) => allCategories.add(cat));
  });
  const sortedCategories = [...allCategories].sort((a, b) => {
    const ai = INTERVIEW_CATEGORY_ORDER.indexOf(a);
    const bi = INTERVIEW_CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  const combinedOverall =
    submittedScorecards.length > 0
      ? Number(
          (submittedScorecards.reduce((sum, sc) => sum + (sc.overall_score ?? 0), 0) /
            submittedScorecards.length
          ).toFixed(2)
        )
      : null;

  return (
    <div className="space-y-4">
      {/* Scorecard Form */}
      {activeInterview && !submitted ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="px-6 py-4 border-b border-[#a59494]/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#272727]">Rate by Category</h3>
              <p className="text-xs text-[#a59494] mt-0.5">
                For: {activeInterview.interview_type}
              </p>
            </div>
            {overallScore !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#a59494]">Overall</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${scoreColor(overallScore)}`}>
                  {overallScore.toFixed(1)}/5
                </span>
              </div>
            )}
          </div>

          <div className="divide-y divide-[#a59494]/5">
            {categories.map((cat) => (
              <div key={cat} className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-[#272727] font-medium">{cat}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setCategoryRatings((prev) => ({ ...prev, [cat]: star }))
                      }
                      className="transition"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill={star <= (categoryRatings[cat] ?? 0) ? "var(--brand-primary)" : "none"}
                        stroke={star <= (categoryRatings[cat] ?? 0) ? "var(--brand-primary)" : "#a59494"}
                        strokeWidth="2"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-[#a59494]/10 space-y-3">
            {/* Recommendation */}
            <div>
              <label className="block text-xs font-semibold text-[#272727] mb-1.5">
                Recommendation
              </label>
              <div className="flex gap-2">
                {[
                  { value: "strong_yes", label: "Strong Yes", color: "bg-green-600" },
                  { value: "yes", label: "Yes", color: "bg-green-500" },
                  { value: "hold", label: "Hold", color: "bg-amber-500" },
                  { value: "no", label: "No", color: "bg-red-500" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecommendation(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      recommendation === opt.value
                        ? `${opt.color} text-white`
                        : "border border-[#a59494]/30 text-[#272727] hover:bg-[#f5f0f0]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary notes */}
            <div>
              <label className="block text-xs font-semibold text-[#272727] mb-1">
                General Notes
              </label>
              <textarea
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                rows={3}
                placeholder="Overall thoughts about this candidate..."
                className="w-full px-3 py-2 rounded-lg border border-[#a59494]/20 text-sm text-[#272727] placeholder:text-[#a59494]/50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => handleSaveOrSubmit(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-[#a59494]/30 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => handleSaveOrSubmit(true)}
                disabled={saving || ratedValues.length === 0}
                className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit Scorecard"}
              </button>
            </div>
          </div>
        </div>
      ) : !activeInterview ? (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-8 text-center">
          <p className="text-sm text-[#a59494]">
            No interview to score yet. Schedule an interview first.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#272727]">Scorecard Submitted</p>
          <p className="text-xs text-[#a59494] mt-1">Your evaluation has been recorded.</p>
        </div>
      )}

      {/* Score Comparison Grid */}
      {submittedScorecards.length > 0 && (
        <div className="bg-white rounded-xl border border-[#a59494]/10 shadow-sm">
          <div className="px-6 py-4 border-b border-[#a59494]/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#272727]">Score Comparison</h3>
              {combinedOverall !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#a59494]">Combined</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${scoreColor(combinedOverall)}`}>
                    {combinedOverall.toFixed(1)}/5
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#a59494]/10">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#a59494] uppercase tracking-wider min-w-[160px]">
                    Category
                  </th>
                  {submittedScorecards.map((sc) => (
                    <th key={sc.id} className="text-center px-3 py-2.5 text-xs font-semibold text-[#a59494] uppercase tracking-wider min-w-[80px]">
                      {sc.evaluator?.name ?? "Evaluator"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#a59494]/5">
                {sortedCategories.map((cat) => (
                  <tr key={cat} className="hover:bg-[#f5f0f0]/30 transition">
                    <td className="px-4 py-2 text-xs font-medium text-[#272727]">{cat}</td>
                    {submittedScorecards.map((sc) => {
                      const s = sc.category_scores[cat];
                      return (
                        <td key={sc.id} className="text-center px-3 py-2">
                          {s !== undefined ? (
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${scoreColor(s)}`}>
                              {s.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-[#a59494]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-[#a59494]/20 bg-[#f5f0f0]/30">
                  <td className="px-4 py-2.5 text-xs font-bold text-[#272727]">Overall</td>
                  {submittedScorecards.map((sc) => (
                    <td key={sc.id} className="text-center px-3 py-2.5">
                      {sc.overall_score !== null ? (
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${scoreColor(sc.overall_score)}`}>
                          {sc.overall_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-[#a59494]">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Recommendation badges */}
          <div className="px-6 py-3 border-t border-[#a59494]/10 flex flex-wrap gap-3">
            {submittedScorecards.map((sc) => {
              const rec = sc.recommendation ? RECOMMENDATION_LABELS[sc.recommendation] : null;
              return (
                <div key={sc.id} className="flex items-center gap-2">
                  <span className="text-xs text-[#a59494]">{sc.evaluator?.name ?? "Evaluator"}:</span>
                  {rec ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rec.color}`}>
                      {rec.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[#a59494]">No recommendation</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
