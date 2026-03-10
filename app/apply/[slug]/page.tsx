"use client";

import { useState, useEffect, use, useCallback } from "react";
import { resolveTeamBranding, getBrandingFooter } from "@/lib/branding";
import type { TeamBranding } from "@/lib/types";

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

interface TeamInfo {
  id: string;
  name: string;
  slug: string;
}

interface CompletionStatus {
  application: boolean;
  aq: boolean;
  disc: boolean;
}

/* ══════════════════════════════════════════════════════════════
   Main Page Component — Generic Public Application
   ══════════════════════════════════════════════════════════════ */
export default function PublicApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: teamSlug } = use(params);

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notAccepting, setNotAccepting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("application");
  const [completed, setCompleted] = useState<CompletionStatus>({
    application: false,
    aq: false,
    disc: false,
  });
  const [branding, setBranding] = useState<TeamBranding>(resolveTeamBranding(null));

  // After application submit, we get the candidateId back
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [candidateFirstName, setCandidateFirstName] = useState("");

  const completedCount = [completed.application, completed.aq, completed.disc].filter(Boolean).length;
  const allDone = completedCount === 3;

  // Load team by slug
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(`/api/teams/by-slug?slug=${encodeURIComponent(teamSlug)}`);
        if (!res.ok) {
          setError("This application link is invalid or the team was not found.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setTeam({ id: data.team.id, name: data.team.name, slug: data.team.slug });
          setBranding(resolveTeamBranding(data.team));
          if (!data.accepting_applications) {
            setNotAccepting(true);
          }
        }
      } catch {
        if (!cancelled) setError("Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [teamSlug]);

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

  /* ── Brand CSS vars ── */
  const brandStyle = `
    :root {
      --brand-primary: ${branding.primaryColor};
      --brand-primary-dark: ${branding.primaryDark};
      --brand-primary-light: ${branding.primaryLight};
      --brand-secondary: ${branding.secondaryColor};
    }
  `;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-secondary)] to-[var(--brand-primary)] flex items-center justify-center">
        <style>{brandStyle}</style>
        <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-secondary)] to-[var(--brand-primary)] flex items-center justify-center p-4">
        <style>{brandStyle}</style>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md text-center">
          <div className="text-4xl mb-4">&#x26A0;&#xFE0F;</div>
          <h1 className="text-xl font-bold text-[#272727] mb-2">Invalid Link</h1>
          <p className="text-[#a59494]">{error}</p>
        </div>
      </div>
    );
  }

  if (notAccepting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-secondary)] to-[var(--brand-primary)] flex items-center justify-center p-4">
        <style>{brandStyle}</style>
        <title>{branding.name} — Application</title>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} className="h-12 w-auto max-w-[180px] object-contain mx-auto mb-6" />
          ) : (
            <div className="w-14 h-14 bg-[var(--brand-primary)] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-lg">{branding.initials}</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-[#272727] mb-3">Not Accepting Applications</h1>
          <p className="text-[#a59494] leading-relaxed">
            We&apos;re not currently accepting applications. Please check back later.
          </p>
          <p className="text-xs text-[#a59494]/60 mt-6">{getBrandingFooter(branding)}</p>
        </div>
      </div>
    );
  }

  /* ── All Complete — Thank You screen ── */
  if (allDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-secondary)] to-[var(--brand-primary)] flex items-center justify-center p-4">
        <style>{brandStyle}</style>
        <title>{branding.name} — Application Complete</title>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-lg text-center">
          <div className="w-20 h-20 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#272727] mb-3">
            All Done{candidateFirstName ? `, ${candidateFirstName}` : ""}!
          </h1>
          <p className="text-[#a59494] text-lg leading-relaxed">
            We&apos;ve received everything — we&apos;ll be in touch soon!
          </p>
          <p className="text-sm text-[#a59494] mt-4">You can safely close this page.</p>
          <p className="text-xs text-[#a59494]/60 mt-6">{getBrandingFooter(branding)}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-secondary)] to-[var(--brand-primary)]">
      <style>{brandStyle}</style>
      <title>{branding.name} — Application</title>

      {/* Header */}
      <header className="bg-[var(--brand-secondary)] border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="h-10 w-auto max-w-[160px] object-contain" />
            ) : (
              <div className="w-10 h-10 bg-[var(--brand-primary)] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">{branding.initials}</span>
              </div>
            )}
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">{branding.name}</h1>
              <p className="text-white/50 text-xs">Complete your application and assessments below.</p>
            </div>
          </div>
          <div className="text-white/50 text-sm">
            {completedCount}/3 Complete
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[var(--brand-secondary)]/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((tab) => {
            // Only allow clicking completed tabs or the next one to do
            const isLocked = tab.key !== "application" && !completed.application;
            return (
              <button
                key={tab.key}
                onClick={() => !isLocked && setActiveTab(tab.key)}
                disabled={isLocked}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-[#272727] shadow-lg"
                    : isLocked
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {completed[tab.key] ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-current opacity-40" />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {activeTab === "application" && team && (
            <ApplicationForm
              teamId={team.id}
              alreadyDone={completed.application}
              onComplete={(cId: string, firstName: string) => {
                setCandidateId(cId);
                setCandidateFirstName(firstName);
                markComplete("application");
              }}
            />
          )}
          {activeTab === "disc" && candidateId && team && (
            <DISCForm
              candidateId={candidateId}
              teamId={team.id}
              alreadyDone={completed.disc}
              onComplete={() => markComplete("disc")}
            />
          )}
          {activeTab === "aq" && candidateId && team && (
            <AQForm
              candidateId={candidateId}
              teamId={team.id}
              alreadyDone={completed.aq}
              onComplete={() => markComplete("aq")}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-8 pb-4">
          {getBrandingFooter(branding)}
        </p>
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
  show_if?: { field_id: string; value: unknown };
}

function resolveFieldCondition(field: FormField): { field_id: string; value: unknown } | null {
  if (field.show_if) return field.show_if;
  if (field.conditionalOn) return { field_id: field.conditionalOn, value: true };
  return null;
}

function isFieldVisible(
  field: FormField,
  formValues: Record<string, string | boolean | string[]>
): boolean {
  const cond = resolveFieldCondition(field);
  if (!cond) return true;
  const parentValue = formValues[cond.field_id];
  return parentValue === cond.value;
}

function ApplicationForm({
  teamId,
  alreadyDone,
  onComplete,
}: {
  teamId: string;
  alreadyDone: boolean;
  onComplete: (candidateId: string, firstName: string) => void;
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

            const initial: Record<string, string | boolean | string[]> = {};
            for (const f of sorted) {
              if (f.type === "boolean") initial[f.id] = false;
              else if (f.type === "interested_in") initial[f.id] = [];
              else initial[f.id] = "";
            }
            setForm(initial);
          }
        }
      } catch {
        // Fall back to empty
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }

    loadConfig();
    return () => { cancelled = true; };
  }, [teamId]);

  const update = (key: string, value: string | boolean | string[]) => setForm((p) => ({ ...p, [key]: value }));

  if (alreadyDone) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="text-xl font-bold text-[#272727] mb-2">Application Submitted</h2>
        <p className="text-[#a59494]">Your application has been received. Move on to the next assessment.</p>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin w-6 h-6 border-3 border-[var(--brand-primary)]/30 border-t-[var(--brand-primary)] rounded-full mx-auto" />
        <p className="text-sm text-[#a59494] mt-3">Loading form...</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    for (const f of fields) {
      if (!f.required) continue;
      if (!isFieldVisible(f, form)) continue;
      const val = form[f.id];
      if (f.type === "interested_in") continue;
      if (f.type === "boolean") continue;
      if (!val || (typeof val === "string" && !val.trim())) {
        setErr("Please fill in all required fields.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/assessments/public-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, form_data: form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to submit application");
        return;
      }
      onComplete(data.candidate_id, data.first_name);
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const shortFields = fields.filter(
    (f) => ["text", "email", "tel", "number", "select"].includes(f.type) && !resolveFieldCondition(f)
  );
  const booleanFields = fields.filter((f) => f.type === "boolean");
  const textareaFields = fields.filter((f) => f.type === "textarea" && !resolveFieldCondition(f));
  const interestedInField = fields.find((f) => f.type === "interested_in");
  const conditionalFields = fields.filter((f) => resolveFieldCondition(f));

  return (
    <form onSubmit={handleSubmit} className="p-8">
      <h2 className="text-xl font-bold text-[#272727] mb-1">Application Form</h2>
      <p className="text-sm text-[#a59494] mb-6">Tell us about yourself and your goals.</p>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{err}</div>}

      {shortFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {shortFields.map((f) => (
            <DynamicField
              key={f.id}
              field={f}
              value={form[f.id] ?? ""}
              onChange={(v) => {
                update(f.id, v);
                for (const child of conditionalFields) {
                  const cond = resolveFieldCondition(child);
                  if (cond?.field_id === f.id && v !== cond.value) {
                    update(child.id, child.type === "boolean" ? false : "");
                  }
                }
              }}
            />
          ))}
        </div>
      )}

      {conditionalFields
        .filter((c) => {
          const cond = resolveFieldCondition(c);
          if (!cond) return false;
          const parent = fields.find((f) => f.id === cond.field_id);
          return parent && parent.type !== "boolean" && isFieldVisible(c, form);
        })
        .map((c) => (
          <div key={c.id} className="mb-4 ml-4 pl-4 border-l-2 border-[var(--brand-primary)]/20">
            <DynamicField
              field={c}
              value={form[c.id] ?? ""}
              onChange={(v) => update(c.id, v)}
            />
          </div>
        ))}

      {booleanFields.map((f) => {
        const childFields = conditionalFields.filter((c) => {
          const cond = resolveFieldCondition(c);
          return cond?.field_id === f.id;
        });
        return (
          <div key={f.id} className="mb-6 p-4 bg-[#f5f0f0] rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-11 h-6 rounded-full transition-colors relative ${form[f.id] ? "bg-[var(--brand-primary)]" : "bg-[#a59494]/40"}`}
                onClick={() => {
                  const newVal = !form[f.id];
                  update(f.id, newVal);
                  for (const child of childFields) {
                    const cond = resolveFieldCondition(child);
                    if (cond && newVal !== cond.value) {
                      update(child.id, child.type === "boolean" ? false : "");
                    }
                  }
                }}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[f.id] ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-medium text-[#272727]">
                {f.label}{f.required ? " *" : ""}
              </span>
            </label>
            {childFields.filter((child) => isFieldVisible(child, form)).map((child) => (
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
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[#f5f0f0] text-[#272727] hover:bg-[var(--brand-primary)]/10"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {textareaFields.length > 0 && (
        <div className="space-y-4 mb-8">
          {textareaFields.map((f) => (
            <TextareaField
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
        className="w-full py-3.5 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-dark)] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

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
      return <InputField label={label} type={field.type} value={value as string} onChange={(v) => onChange(v)} />;
    case "email":
      return <InputField label={label} type="email" value={value as string} onChange={(v) => onChange(v)} />;
    case "tel":
      return <InputField label={label} type="tel" value={value as string} onChange={(v) => onChange(v)} />;
    case "select":
      return <SelectField label={label} value={value as string} onChange={(v) => onChange(v)} options={field.options ?? []} />;
    case "textarea":
      return <TextareaField label={label} value={value as string} onChange={(v) => onChange(v)} />;
    default:
      return <InputField label={label} value={value as string} onChange={(v) => onChange(v)} />;
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
        <div className="w-16 h-16 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
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
            <h3 className="text-sm font-bold text-[var(--brand-primary)] uppercase tracking-wider mb-3 mt-6">
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
                          ? "bg-[var(--brand-primary)] text-white shadow-md"
                          : "bg-white text-[#272727] hover:bg-[var(--brand-primary)]/10 border border-[#a59494]/20"
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
        className="w-full py-3.5 mt-6 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-dark)] transition disabled:opacity-50"
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
        <div className="w-16 h-16 bg-[var(--brand-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
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

    const responses: Record<string, string> = {};
    for (let i = 1; i <= 28; i++) {
      const key = `g${i}`;
      responses[key] = mostResponses[key];
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
          <span className="w-3 h-3 rounded-full bg-[var(--brand-primary)]" /> MOST like me
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[var(--brand-secondary)]" /> LEAST like me
        </span>
        <span className="ml-auto">{totalAnswered}/28 complete</span>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DISC_GROUPS.map((group) => {
          const key = `g${group.id}`;
          const groupComplete = mostResponses[key] && leastResponses[key];
          return (
            <div key={group.id} className={`p-4 rounded-xl transition ${groupComplete ? "bg-[var(--brand-primary)]/5 ring-1 ring-[var(--brand-primary)]/20" : "bg-[#f5f0f0]"}`}>
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
                          ? "bg-[var(--brand-primary)] text-white shadow-md"
                          : isLeast
                            ? "bg-[var(--brand-secondary)] text-white shadow-md"
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
                              ? "bg-white text-[var(--brand-primary)] shadow"
                              : "border-2 border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
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
                              ? "bg-white text-[var(--brand-secondary)] shadow"
                              : "border-2 border-[var(--brand-secondary)]/30 text-[var(--brand-secondary)] hover:bg-[var(--brand-secondary)]/10"
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
        className="w-full py-3.5 mt-6 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-dark)] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : `Submit DISC Assessment (${totalAnswered}/28)`}
      </button>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════
   Shared Form Components
   ══════════════════════════════════════════════════════════════ */
function InputField({
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
        className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-transparent transition"
      />
    </div>
  );
}

function SelectField({
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
        className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-transparent transition bg-white"
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
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
        className="w-full px-3 py-2.5 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-transparent transition resize-none"
      />
    </div>
  );
}
