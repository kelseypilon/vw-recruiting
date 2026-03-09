"use client";

import { useState, useEffect, use, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   AQ Questions — 20 questions mapped to CORE categories
   ══════════════════════════════════════════════════════════════ */
const AQ_QUESTIONS: { id: string; text: string; category: string }[] = [
  { id: "q1", text: "I follow through on my commitments even when it becomes inconvenient.", category: "C" },
  { id: "q2", text: "I set clear goals and consistently work toward them.", category: "C" },
  { id: "q3", text: "I show up fully even when I don't feel motivated.", category: "C" },
  { id: "q4", text: "I keep my word to others, even in small matters.", category: "C" },
  { id: "q5", text: "I take my professional development seriously and invest time in it.", category: "C" },
  { id: "q6", text: "When something goes wrong, I look at what I could have done differently.", category: "O" },
  { id: "q7", text: "I take full responsibility for my results without blaming circumstances.", category: "O" },
  { id: "q8", text: "I proactively solve problems rather than waiting for someone to fix them.", category: "O" },
  { id: "q9", text: "I own my mistakes and work quickly to correct them.", category: "O" },
  { id: "q10", text: "I hold myself to a higher standard than what's required of me.", category: "O" },
  { id: "q11", text: "I am willing to step outside my comfort zone to achieve my goals.", category: "R" },
  { id: "q12", text: "I actively seek out new challenges and opportunities.", category: "R" },
  { id: "q13", text: "I push myself beyond what feels safe or familiar.", category: "R" },
  { id: "q14", text: "I set ambitious targets even when success isn't guaranteed.", category: "R" },
  { id: "q15", text: "I take calculated risks when the potential upside is significant.", category: "R" },
  { id: "q16", text: "I bounce back quickly after setbacks or failures.", category: "E" },
  { id: "q17", text: "I stay focused on long-term goals when facing short-term difficulties.", category: "E" },
  { id: "q18", text: "I maintain my effort and attitude even when results are slow.", category: "E" },
  { id: "q19", text: "I treat rejection or failure as feedback rather than a reason to quit.", category: "E" },
  { id: "q20", text: "I have a track record of persisting through difficult periods.", category: "E" },
];

/* ══════════════════════════════════════════════════════════════
   DISC Word Groups — 28 groups of 4 words
   ══════════════════════════════════════════════════════════════ */
const DISC_GROUPS: { id: number; words: { label: string; letter: string }[] }[] = [
  { id: 1, words: [{ label: "Decisive", letter: "D" }, { label: "Enthusiastic", letter: "I" }, { label: "Harmonious", letter: "S" }, { label: "Accurate", letter: "C" }] },
  { id: 2, words: [{ label: "Pioneering", letter: "D" }, { label: "Sociable", letter: "I" }, { label: "Patient", letter: "S" }, { label: "Precise", letter: "C" }] },
  { id: 3, words: [{ label: "Competitive", letter: "D" }, { label: "Talkative", letter: "I" }, { label: "Gentle", letter: "S" }, { label: "Systematic", letter: "C" }] },
  { id: 4, words: [{ label: "Direct", letter: "D" }, { label: "Influential", letter: "I" }, { label: "Stable", letter: "S" }, { label: "Analytical", letter: "C" }] },
  { id: 5, words: [{ label: "Bold", letter: "D" }, { label: "Optimistic", letter: "I" }, { label: "Supportive", letter: "S" }, { label: "Careful", letter: "C" }] },
  { id: 6, words: [{ label: "Results-driven", letter: "D" }, { label: "Expressive", letter: "I" }, { label: "Consistent", letter: "S" }, { label: "Thorough", letter: "C" }] },
  { id: 7, words: [{ label: "Assertive", letter: "D" }, { label: "Inspiring", letter: "I" }, { label: "Cooperative", letter: "S" }, { label: "Detail-oriented", letter: "C" }] },
  { id: 8, words: [{ label: "Daring", letter: "D" }, { label: "Persuasive", letter: "I" }, { label: "Loyal", letter: "S" }, { label: "Cautious", letter: "C" }] },
  { id: 9, words: [{ label: "Driven", letter: "D" }, { label: "Outgoing", letter: "I" }, { label: "Dependable", letter: "S" }, { label: "Methodical", letter: "C" }] },
  { id: 10, words: [{ label: "Demanding", letter: "D" }, { label: "Lively", letter: "I" }, { label: "Relaxed", letter: "S" }, { label: "Disciplined", letter: "C" }] },
  { id: 11, words: [{ label: "Strong-willed", letter: "D" }, { label: "Gregarious", letter: "I" }, { label: "Steady", letter: "S" }, { label: "Conscientious", letter: "C" }] },
  { id: 12, words: [{ label: "Independent", letter: "D" }, { label: "Animated", letter: "I" }, { label: "Team-oriented", letter: "S" }, { label: "Perfectionistic", letter: "C" }] },
  { id: 13, words: [{ label: "Forceful", letter: "D" }, { label: "Warm", letter: "I" }, { label: "Reserved", letter: "S" }, { label: "Logical", letter: "C" }] },
  { id: 14, words: [{ label: "Self-confident", letter: "D" }, { label: "Trusting", letter: "I" }, { label: "Predictable", letter: "S" }, { label: "Factual", letter: "C" }] },
  { id: 15, words: [{ label: "Adventurous", letter: "D" }, { label: "Cheerful", letter: "I" }, { label: "Accommodating", letter: "S" }, { label: "Restrained", letter: "C" }] },
  { id: 16, words: [{ label: "Determined", letter: "D" }, { label: "Convincing", letter: "I" }, { label: "Easy-going", letter: "S" }, { label: "Orderly", letter: "C" }] },
  { id: 17, words: [{ label: "Tough", letter: "D" }, { label: "Playful", letter: "I" }, { label: "Lenient", letter: "S" }, { label: "Particular", letter: "C" }] },
  { id: 18, words: [{ label: "Vigorous", letter: "D" }, { label: "Charming", letter: "I" }, { label: "Kind", letter: "S" }, { label: "Compliant", letter: "C" }] },
  { id: 19, words: [{ label: "Dominant", letter: "D" }, { label: "Communicative", letter: "I" }, { label: "Tolerant", letter: "S" }, { label: "Conventional", letter: "C" }] },
  { id: 20, words: [{ label: "Persistent", letter: "D" }, { label: "Fun-loving", letter: "I" }, { label: "Sympathetic", letter: "S" }, { label: "Rule-following", letter: "C" }] },
  { id: 21, words: [{ label: "Risk-taking", letter: "D" }, { label: "Motivating", letter: "I" }, { label: "Modest", letter: "S" }, { label: "Deliberate", letter: "C" }] },
  { id: 22, words: [{ label: "Resolute", letter: "D" }, { label: "Spontaneous", letter: "I" }, { label: "Sincere", letter: "S" }, { label: "Structured", letter: "C" }] },
  { id: 23, words: [{ label: "Inquisitive", letter: "D" }, { label: "Charismatic", letter: "I" }, { label: "Attentive", letter: "S" }, { label: "Composed", letter: "C" }] },
  { id: 24, words: [{ label: "Action-oriented", letter: "D" }, { label: "Positive", letter: "I" }, { label: "Thoughtful", letter: "S" }, { label: "Exacting", letter: "C" }] },
  { id: 25, words: [{ label: "Fearless", letter: "D" }, { label: "Popular", letter: "I" }, { label: "Agreeable", letter: "S" }, { label: "Meticulous", letter: "C" }] },
  { id: 26, words: [{ label: "Ambitious", letter: "D" }, { label: "Sociable", letter: "I" }, { label: "Reliable", letter: "S" }, { label: "Composed", letter: "C" }] },
  { id: 27, words: [{ label: "Resolute", letter: "D" }, { label: "Enthusiastic", letter: "I" }, { label: "Even-tempered", letter: "S" }, { label: "Principled", letter: "C" }] },
  { id: 28, words: [{ label: "Forthright", letter: "D" }, { label: "Engaging", letter: "I" }, { label: "Considerate", letter: "S" }, { label: "Rigorous", letter: "C" }] },
];

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */
type Tab = "application" | "disc" | "aq";

interface CandidateInfo {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface CompletionStatus {
  application: boolean;
  aq: boolean;
  disc: boolean;
}

/* ══════════════════════════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════════════════════════ */
export default function AssessmentsPage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const { candidateId } = use(params);

  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("application");
  const [completed, setCompleted] = useState<CompletionStatus>({
    application: false,
    aq: false,
    disc: false,
  });

  const completedCount = [completed.application, completed.aq, completed.disc].filter(Boolean).length;
  const allDone = completedCount === 3;

  // Validate candidate and check existing submissions
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Validate candidate via a lightweight check
        const res = await fetch(`/api/assessments/application?candidate_id=${candidateId}`);
        if (!res.ok) {
          setError("Invalid link — candidate not found.");
          setLoading(false);
          return;
        }

        // Fetch candidate info
        const candidateRes = await fetch(`/api/assessments/candidate?candidate_id=${candidateId}`);
        if (candidateRes.ok) {
          const cData = await candidateRes.json();
          if (!cancelled) setCandidate(cData.data);
        }

        // Check all 3 submission statuses in parallel
        const [appRes, aqRes, discRes] = await Promise.all([
          fetch(`/api/assessments/application?candidate_id=${candidateId}`).then((r) => r.json()),
          fetch(`/api/assessments/aq?candidate_id=${candidateId}`).then((r) => r.json()),
          fetch(`/api/assessments/disc?candidate_id=${candidateId}`).then((r) => r.json()),
        ]);

        if (!cancelled) {
          const status: CompletionStatus = {
            application: !!appRes.submitted,
            aq: !!aqRes.submitted,
            disc: !!discRes.submitted,
          };
          setCompleted(status);

          // Auto-select first incomplete tab
          if (status.application && !status.disc) setActiveTab("disc");
          else if (status.application && status.disc && !status.aq) setActiveTab("aq");
        }
      } catch {
        if (!cancelled) setError("Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [candidateId]);

  const markComplete = useCallback((tab: Tab) => {
    setCompleted((prev) => {
      const next = { ...prev, [tab]: true };
      // Auto-advance to next incomplete tab
      if (tab === "application" && !next.disc) setActiveTab("disc");
      else if (tab === "disc" && !next.aq) setActiveTab("aq");
      else if (tab === "application" && next.disc && !next.aq) setActiveTab("aq");
      return next;
    });
  }, []);

  /* ── Loading / Error / Invalid states ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D1B2A] to-[#1B6CA8] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D1B2A] to-[#1B6CA8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-[#272727] mb-2">Invalid Link</h1>
          <p className="text-[#a59494]">{error}</p>
        </div>
      </div>
    );
  }

  /* ── All Complete — Thank You screen ── */
  if (allDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D1B2A] to-[#1B6CA8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-lg text-center">
          <div className="w-20 h-20 bg-[#1B6CA8]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1B6CA8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#272727] mb-3">All Done!</h1>
          <p className="text-[#a59494] text-lg leading-relaxed">
            We&apos;ve received everything — we&apos;ll be in touch soon!
          </p>
          <p className="text-sm text-[#a59494] mt-4">You can safely close this page.</p>
        </div>
      </div>
    );
  }

  /* ── Main Assessment Layout ── */
  const TABS: { key: Tab; label: string }[] = [
    { key: "application", label: "Application" },
    { key: "disc", label: "DISC Assessment" },
    { key: "aq", label: "AQ Assessment" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1B2A] to-[#1B6CA8]">
      {/* Header */}
      <header className="bg-[#0D1B2A] border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1B6CA8] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">VW</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Vantage West Realty</h1>
              <p className="text-white/50 text-xs">
                {candidate ? `Hi ${candidate.first_name}! Complete your assessment below.` : "Candidate Assessment"}
              </p>
            </div>
          </div>
          <div className="text-white/50 text-sm">
            {completedCount}/3 Complete
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[#0D1B2A]/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1B6CA8] rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white text-[#272727] shadow-lg"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {completed[tab.key] ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B6CA8" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-current opacity-40" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {activeTab === "application" && (
            <ApplicationForm
              candidateId={candidateId}
              teamId={candidate?.team_id ?? ""}
              candidate={candidate}
              alreadyDone={completed.application}
              onComplete={() => markComplete("application")}
            />
          )}
          {activeTab === "disc" && (
            <DISCForm
              candidateId={candidateId}
              teamId={candidate?.team_id ?? ""}
              alreadyDone={completed.disc}
              onComplete={() => markComplete("disc")}
            />
          )}
          {activeTab === "aq" && (
            <AQForm
              candidateId={candidateId}
              teamId={candidate?.team_id ?? ""}
              alreadyDone={completed.aq}
              onComplete={() => markComplete("aq")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APPLICATION FORM — Dynamic fields from team config
   ══════════════════════════════════════════════════════════════ */

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "boolean" | "select" | "textarea" | "interested_in";
  required: boolean;
  locked: boolean;
  order: number;
  options?: string[];
  conditionalOn?: string;
}

function ApplicationForm({
  candidateId,
  teamId,
  candidate,
  alreadyDone,
  onComplete,
}: {
  candidateId: string;
  teamId: string;
  candidate: CandidateInfo | null;
  alreadyDone: boolean;
  onComplete: () => void;
}) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [interestedInOptions, setInterestedInOptions] = useState<{ id: string; label: string }[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string | boolean | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Fetch form config
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch(`/api/assessments/form-config?team_id=${teamId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const sorted = [...(data.fields as FormField[])].sort((a, b) => a.order - b.order);
            setFields(sorted);
            setInterestedInOptions(data.interested_in_options ?? []);

            // Initialize form state with defaults for each field
            const initial: Record<string, string | boolean | string[]> = {};
            for (const f of sorted) {
              if (f.type === "boolean") initial[f.id] = false;
              else if (f.type === "interested_in") initial[f.id] = [];
              else initial[f.id] = "";
            }
            // Pre-fill from candidate data
            if (candidate) {
              if (initial.first_name !== undefined) initial.first_name = candidate.first_name || "";
              if (initial.last_name !== undefined) initial.last_name = candidate.last_name || "";
              if (initial.email !== undefined) initial.email = candidate.email || "";
              if (initial.phone !== undefined) initial.phone = candidate.phone || "";
            }
            setForm(initial);
          }
        }
      } catch {
        // Fall back to empty — will show error on submit
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }

    loadConfig();
    return () => { cancelled = true; };
  }, [teamId, candidate]);

  // Pre-fill when candidate data arrives after config load
  useEffect(() => {
    if (candidate && fields.length > 0) {
      setForm((prev) => {
        const next = { ...prev };
        if (next.first_name !== undefined && !next.first_name) next.first_name = candidate.first_name || "";
        if (next.last_name !== undefined && !next.last_name) next.last_name = candidate.last_name || "";
        if (next.email !== undefined && !next.email) next.email = candidate.email || "";
        if (next.phone !== undefined && !next.phone) next.phone = candidate.phone || "";
        return next;
      });
    }
  }, [candidate, fields]);

  const update = (key: string, value: string | boolean | string[]) => setForm((p) => ({ ...p, [key]: value }));

  if (alreadyDone) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-[#1B6CA8]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B6CA8" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="text-xl font-bold text-[#272727] mb-2">Application Submitted</h2>
        <p className="text-[#a59494]">Your application has been received. Move on to the next assessment.</p>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin w-6 h-6 border-3 border-[#1B6CA8]/30 border-t-[#1B6CA8] rounded-full mx-auto" />
        <p className="text-sm text-[#a59494] mt-3">Loading form...</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    // Validate required visible fields
    for (const f of fields) {
      if (!f.required) continue;
      // Skip if conditional and parent is falsy
      if (f.conditionalOn && !form[f.conditionalOn]) continue;

      const val = form[f.id];
      if (f.type === "interested_in") {
        // interested_in is optional by nature even if required — skip strict check
        continue;
      }
      if (f.type === "boolean") continue; // boolean is always valid
      if (!val || (typeof val === "string" && !val.trim())) {
        setErr("Please fill in all required fields.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/assessments/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          team_id: teamId,
          form_data: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to submit application");
        return;
      }
      onComplete();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Separate fields by display type for layout
  const shortFields = fields.filter(
    (f) => ["text", "email", "tel", "number", "select"].includes(f.type) && !f.conditionalOn
  );
  const booleanFields = fields.filter((f) => f.type === "boolean");
  const textareaFields = fields.filter((f) => f.type === "textarea");
  const interestedInField = fields.find((f) => f.type === "interested_in");
  const conditionalFields = fields.filter((f) => f.conditionalOn);

  return (
    <form onSubmit={handleSubmit} className="p-8">
      <h2 className="text-xl font-bold text-[#272727] mb-1">Application Form</h2>
      <p className="text-sm text-[#a59494] mb-6">Tell us about yourself and your goals.</p>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{err}</div>}

      {/* Short fields in 2-col grid */}
      {shortFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {shortFields.map((f) => (
            <DynamicField
              key={f.id}
              field={f}
              value={form[f.id] ?? ""}
              onChange={(v) => update(f.id, v)}
            />
          ))}
        </div>
      )}

      {/* Boolean toggles with conditional children */}
      {booleanFields.map((f) => {
        const childFields = conditionalFields.filter((c) => c.conditionalOn === f.id);
        return (
          <div key={f.id} className="mb-6 p-4 bg-[#f5f0f0] rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-11 h-6 rounded-full transition-colors relative ${form[f.id] ? "bg-[#1B6CA8]" : "bg-[#a59494]/40"}`}
                onClick={() => update(f.id, !form[f.id])}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[f.id] ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-medium text-[#272727]">
                {f.label}{f.required ? " *" : ""}
              </span>
            </label>
            {form[f.id] && childFields.map((child) => (
              <div key={child.id} className="mt-3">
                <DynamicField
                  field={child}
                  value={form[child.id] ?? ""}
                  onChange={(v) => update(child.id, v)}
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* Interested-In tags */}
      {interestedInField && interestedInOptions.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#272727] mb-2">
            {interestedInField.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {interestedInOptions.map((opt) => {
              const selected = Array.isArray(form[interestedInField.id])
                && (form[interestedInField.id] as string[]).includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const current = (form[interestedInField.id] as string[]) || [];
                    update(
                      interestedInField.id,
                      selected ? current.filter((id) => id !== opt.id) : [...current, opt.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    selected
                      ? "bg-[#1B6CA8] text-white"
                      : "bg-[#f5f0f0] text-[#272727] hover:bg-[#1B6CA8]/10"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Textarea fields — full width */}
      {textareaFields.length > 0 && (
        <div className="space-y-4 mb-8">
          {textareaFields.map((f) => (
            <Textarea
              key={f.id}
              label={`${f.label}${f.required ? " *" : ""}`}
              value={(form[f.id] as string) ?? ""}
              onChange={(v) => update(f.id, v)}
            />
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3.5 bg-[#1B6CA8] text-white font-semibold rounded-xl hover:bg-[#155a8a] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

/** Renders a single form field based on its type */
function DynamicField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | string[];
  onChange: (v: string | boolean) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;

  switch (field.type) {
    case "text":
    case "number":
      return <Input label={label} type={field.type} value={value as string} onChange={(v) => onChange(v)} />;
    case "email":
      return <Input label={label} type="email" value={value as string} onChange={(v) => onChange(v)} />;
    case "tel":
      return <Input label={label} type="tel" value={value as string} onChange={(v) => onChange(v)} />;
    case "select":
      return <Select label={label} value={value as string} onChange={(v) => onChange(v)} options={field.options ?? []} />;
    case "textarea":
      return <Textarea label={label} value={value as string} onChange={(v) => onChange(v)} />;
    default:
      return <Input label={label} value={value as string} onChange={(v) => onChange(v)} />;
  }
}

/* ══════════════════════════════════════════════════════════════
   AQ ASSESSMENT FORM
   ══════════════════════════════════════════════════════════════ */
function AQForm({
  candidateId,
  teamId,
  alreadyDone,
  onComplete,
}: {
  candidateId: string;
  teamId: string;
  alreadyDone: boolean;
  onComplete: () => void;
}) {
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (alreadyDone) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-[#1B6CA8]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B6CA8" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="text-xl font-bold text-[#272727] mb-2">AQ Assessment Complete</h2>
        <p className="text-[#a59494]">Your Adversity Quotient assessment has been recorded.</p>
      </div>
    );
  }

  const answeredCount = Object.keys(responses).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (answeredCount < 20) {
      setErr(`Please answer all 20 questions. You've answered ${answeredCount}/20.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/assessments/aq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId, team_id: teamId, responses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to submit AQ assessment");
        return;
      }
      onComplete();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const CATEGORIES: Record<string, string> = { C: "Commitment", O: "Ownership", R: "Reach", E: "Endurance" };
  const SCALE_LABELS = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];

  return (
    <form onSubmit={handleSubmit} className="p-8">
      <h2 className="text-xl font-bold text-[#272727] mb-1">AQ Assessment</h2>
      <p className="text-sm text-[#a59494] mb-2">Rate each statement on a scale of 1–5.</p>
      <p className="text-xs text-[#a59494] mb-6">{answeredCount}/20 answered</p>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{err}</div>}

      <div className="space-y-2">
        {(["C", "O", "R", "E"] as const).map((cat) => (
          <div key={cat}>
            <h3 className="text-sm font-bold text-[#1B6CA8] uppercase tracking-wider mb-3 mt-6">
              {CATEGORIES[cat]}
            </h3>
            {AQ_QUESTIONS.filter((q) => q.category === cat).map((q, qi) => (
              <div key={q.id} className="mb-5 p-4 bg-[#f5f0f0] rounded-xl">
                <p className="text-sm text-[#272727] font-medium mb-3">
                  {qi + 1}. {q.text}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setResponses((p) => ({ ...p, [q.id]: val }))}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[70px] ${
                        responses[q.id] === val
                          ? "bg-[#1B6CA8] text-white shadow-md"
                          : "bg-white text-[#272727] hover:bg-[#1B6CA8]/10 border border-[#a59494]/20"
                      }`}
                    >
                      <span className="text-base font-bold">{val}</span>
                      <span className="leading-tight">{SCALE_LABELS[val - 1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving || answeredCount < 20}
        className="w-full py-3.5 mt-6 bg-[#1B6CA8] text-white font-semibold rounded-xl hover:bg-[#155a8a] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : `Submit AQ Assessment (${answeredCount}/20)`}
      </button>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════
   DISC ASSESSMENT FORM
   ══════════════════════════════════════════════════════════════ */
function DISCForm({
  candidateId,
  teamId,
  alreadyDone,
  onComplete,
}: {
  candidateId: string;
  teamId: string;
  alreadyDone: boolean;
  onComplete: () => void;
}) {
  const [mostResponses, setMostResponses] = useState<Record<string, string>>({});
  const [leastResponses, setLeastResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (alreadyDone) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-[#1B6CA8]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1B6CA8" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="text-xl font-bold text-[#272727] mb-2">DISC Assessment Complete</h2>
        <p className="text-[#a59494]">Your DISC personality profile has been recorded.</p>
      </div>
    );
  }

  const mostCount = Object.keys(mostResponses).length;
  const leastCount = Object.keys(leastResponses).length;
  const totalAnswered = Math.min(mostCount, leastCount);

  function handleMostSelect(groupKey: string, letter: string) {
    setMostResponses((p) => ({ ...p, [groupKey]: letter }));
    // If same word selected for both MOST and LEAST, clear LEAST
    if (leastResponses[groupKey] === letter) {
      setLeastResponses((p) => {
        const next = { ...p };
        delete next[groupKey];
        return next;
      });
    }
  }

  function handleLeastSelect(groupKey: string, letter: string) {
    setLeastResponses((p) => ({ ...p, [groupKey]: letter }));
    // If same word selected for both MOST and LEAST, clear MOST
    if (mostResponses[groupKey] === letter) {
      setMostResponses((p) => {
        const next = { ...p };
        delete next[groupKey];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (mostCount < 28 || leastCount < 28) {
      setErr(`Please select MOST and LEAST for all 28 groups. Completed: ${totalAnswered}/28.`);
      return;
    }

    // Build combined responses: { g1_most: "D", g1_least: "S", ... }
    const responses: Record<string, string> = {};
    for (let i = 1; i <= 28; i++) {
      const key = `g${i}`;
      responses[key] = mostResponses[key]; // backward compatible "most" key
      responses[`${key}_least`] = leastResponses[key];
    }

    setSaving(true);
    try {
      const res = await fetch("/api/assessments/disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId, team_id: teamId, responses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to submit DISC assessment");
        return;
      }
      onComplete();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-8">
      <h2 className="text-xl font-bold text-[#272727] mb-1">DISC Assessment</h2>
      <p className="text-sm text-[#a59494] mb-2">
        For each group of 4 words, select the one that is <strong>MOST</strong> like you and the one that is <strong>LEAST</strong> like you.
      </p>
      <div className="flex gap-4 items-center text-xs text-[#a59494] mb-6">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#1B6CA8]" /> MOST like me
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#0D1B2A]" /> LEAST like me
        </span>
        <span className="ml-auto">{totalAnswered}/28 complete</span>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DISC_GROUPS.map((group) => {
          const key = `g${group.id}`;
          const groupComplete = mostResponses[key] && leastResponses[key];
          return (
            <div key={group.id} className={`p-4 rounded-xl transition ${groupComplete ? "bg-[#1B6CA8]/5 ring-1 ring-[#1B6CA8]/20" : "bg-[#f5f0f0]"}`}>
              <p className="text-xs font-bold text-[#a59494] uppercase mb-3">Group {group.id}</p>
              <div className="space-y-2">
                {group.words.map((w) => {
                  const isMost = mostResponses[key] === w.letter;
                  const isLeast = leastResponses[key] === w.letter;
                  return (
                    <div
                      key={w.letter}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                        isMost
                          ? "bg-[#1B6CA8] text-white shadow-md"
                          : isLeast
                            ? "bg-[#0D1B2A] text-white shadow-md"
                            : "bg-white text-[#272727] border border-transparent"
                      }`}
                    >
                      <span className="text-sm font-medium flex-1">{w.label}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleMostSelect(key, w.letter)}
                          title="Most like me"
                          className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                            isMost
                              ? "bg-white text-[#1B6CA8] shadow"
                              : "border-2 border-[#1B6CA8]/30 text-[#1B6CA8] hover:bg-[#1B6CA8]/10"
                          }`}
                        >
                          M
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLeastSelect(key, w.letter)}
                          title="Least like me"
                          className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                            isLeast
                              ? "bg-white text-[#0D1B2A] shadow"
                              : "border-2 border-[#0D1B2A]/30 text-[#0D1B2A] hover:bg-[#0D1B2A]/10"
                          }`}
                        >
                          L
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={saving || totalAnswered < 28}
        className="w-full py-3.5 mt-6 bg-[#1B6CA8] text-white font-semibold rounded-xl hover:bg-[#155a8a] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : `Submit DISC Assessment (${totalAnswered}/28)`}
      </button>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════
   Shared Form Components
   ══════════════════════════════════════════════════════════════ */
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#272727] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1B6CA8]/40 focus:border-transparent transition"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#272727] mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[#1B6CA8]/40 focus:border-transparent transition bg-white"
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#272727] mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[#1B6CA8]/40 focus:border-transparent transition resize-none"
      />
    </div>
  );
}
