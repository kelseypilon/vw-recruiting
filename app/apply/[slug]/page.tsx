"use client";

import { useState, useEffect, use, useCallback } from "react";
import { resolveTeamBranding, getBrandingFooter } from "@/lib/branding";
import type { TeamBranding } from "@/lib/types";
import { AQ_QUESTIONS, AQ_CATEGORY_LABELS } from "@/lib/aq-questions";

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
        const res = await fetch(`/api/teams/by-slug?slug=${encodeURIComponent(teamSlug)}`, { cache: "no-store" });
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
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center">
        <style>{brandStyle}</style>
        <div className="animate-spin w-8 h-8 border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center p-4">
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
    { key: "disc", label: "Work Style Assessment" },
    { key: "aq", label: "Problem-Solving Assessment" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <style>{brandStyle}</style>
      <title>{branding.name} — Application</title>

      {/* Header */}
      <header className="bg-[var(--brand-secondary)] border-b border-white/10 px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.name} className="h-10 w-auto max-w-[160px] object-contain" />
              ) : (
                <div className="w-10 h-10 bg-[var(--brand-primary)] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{branding.initials}</span>
                </div>
              )}
              <h1 className="text-white font-bold text-lg tracking-tight">{branding.name}</h1>
            </div>
            <div className="text-white/50 text-sm">
              {completedCount}/3 Complete
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            Thanks for joining us at our Career Info Night. We&apos;re excited to learn more about you.
            Please take the next 10–15 minutes to complete your application and a couple of short
            assessments that help us better understand your working style and strengths.
          </p>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[var(--brand-secondary)]/10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-1.5 bg-[#272727]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
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
                      ? "bg-[#e0e0e0] text-[#a59494]/50 cursor-not-allowed"
                      : "bg-white/60 text-[#272727]/60 hover:bg-white/80"
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
        <p className="text-center text-[#a59494]/60 text-xs mt-8 pb-4">
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
  type: "text" | "email" | "tel" | "number" | "date" | "boolean" | "select" | "textarea" | "interested_in";
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
        const res = await fetch(`/api/assessments/form-config?team_id=${teamId}`, { cache: "no-store" });
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

  // ── Build render groups: top-level fields in sort_order, sub-questions inline ──
  const subQuestionsByParent: Record<string, FormField[]> = {};
  const topLevelFields: FormField[] = [];

  for (const f of fields) {
    const cond = resolveFieldCondition(f);
    if (cond) {
      if (!subQuestionsByParent[cond.field_id]) subQuestionsByParent[cond.field_id] = [];
      subQuestionsByParent[cond.field_id].push(f);
    } else {
      topLevelFields.push(f);
    }
  }

  // Helper: update parent and clear children when parent value changes
  function updateParent(f: FormField, v: string | boolean) {
    update(f.id, v);
    const children = subQuestionsByParent[f.id];
    if (children) {
      for (const child of children) {
        const cond = resolveFieldCondition(child);
        if (cond && v !== cond.value) {
          update(child.id, child.type === "boolean" ? false : "");
        }
      }
    }
  }

  // Group consecutive "short" top-level fields (non-textarea, non-boolean, non-interested_in)
  // into grid batches; textareas, booleans, and fields with children break the grid.
  type Segment =
    | { kind: "grid"; items: FormField[] }
    | { kind: "block"; field: FormField; children: FormField[] };

  const segments: Segment[] = [];
  let currentGrid: FormField[] = [];

  function flushGrid() {
    if (currentGrid.length > 0) {
      segments.push({ kind: "grid", items: [...currentGrid] });
      currentGrid = [];
    }
  }

  for (const f of topLevelFields) {
    const hasChildren = (subQuestionsByParent[f.id] ?? []).length > 0;
    const isShort = ["text", "email", "tel", "number", "date", "select"].includes(f.type);

    if (f.type === "textarea" || f.type === "boolean" || f.type === "interested_in" || hasChildren) {
      flushGrid();
      segments.push({ kind: "block", field: f, children: subQuestionsByParent[f.id] ?? [] });
    } else if (isShort) {
      currentGrid.push(f);
    } else {
      flushGrid();
      segments.push({ kind: "block", field: f, children: [] });
    }
  }
  flushGrid();

  return (
    <form onSubmit={handleSubmit} className="p-8 sm:p-10">
      <h2 className="text-xl font-bold text-[#272727] mb-2">Candidate Details</h2>
      <p className="text-sm text-[#a59494] mb-8">Tell us about yourself and your goals.</p>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-8">{err}</div>}

      <div className="space-y-6 mb-10">
        {segments.map((seg) => {
          if (seg.kind === "grid") {
            return (
              <div key={`grid-${seg.items[0].id}`} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {seg.items.map((f) => (
                  <DynamicField
                    key={f.id}
                    field={f}
                    value={form[f.id] ?? ""}
                    onChange={(v) => updateParent(f, v)}
                  />
                ))}
              </div>
            );
          }

          const { field: f, children } = seg;

          // Boolean toggle field
          if (f.type === "boolean") {
            return (
              <div key={f.id} className="p-4 bg-[#f5f0f0] rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative ${form[f.id] ? "bg-[var(--brand-primary)]" : "bg-[#a59494]/40"}`}
                    onClick={() => updateParent(f, !form[f.id])}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[f.id] ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm font-medium text-[#272727]">
                    {f.label}{f.required ? " *" : ""}
                  </span>
                </label>
                {children.filter((c) => isFieldVisible(c, form)).map((child) => (
                  <div key={child.id} className="mt-3 pl-6">
                    <DynamicField field={child} value={form[child.id] ?? ""} onChange={(v) => update(child.id, v)} />
                  </div>
                ))}
              </div>
            );
          }

          // Interested-in tag picker
          if (f.type === "interested_in" && interestedInOptions.length > 0) {
            return (
              <div key={f.id}>
                <label className="block text-sm font-medium text-[#272727] mb-2">{f.label}</label>
                <div className="flex flex-wrap gap-2">
                  {interestedInOptions.map((opt) => {
                    const selected = Array.isArray(form[f.id]) && (form[f.id] as string[]).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const current = (form[f.id] as string[]) || [];
                          update(f.id, selected ? current.filter((id) => id !== opt.id) : [...current, opt.id]);
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
            );
          }

          // Regular block field (select/text with children, or textarea)
          return (
            <div key={f.id}>
              <DynamicField
                field={f}
                value={form[f.id] ?? ""}
                onChange={(v) => updateParent(f, v)}
              />
              {children.filter((c) => isFieldVisible(c, form)).map((child) => (
                <div key={child.id} className="pl-6 mt-3 border-l-2 border-[var(--brand-primary)]/20">
                  <DynamicField field={child} value={form[child.id] ?? ""} onChange={(v) => update(child.id, v)} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3.5 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-dark)] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Continue to Next Step"}
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
    case "date":
      return <InputField label={label} type="date" value={value as string} onChange={(v) => onChange(v)} />;
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
        <h2 className="text-xl font-bold text-[#272727] mb-2">Problem-Solving Assessment Complete</h2>
        <p className="text-[#a59494]">Your problem-solving assessment has been recorded.</p>
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

  return (
    <form onSubmit={handleSubmit} className="p-8">
      <h2 className="text-xl font-bold text-[#272727] mb-1">Problem-Solving Assessment</h2>
      <p className="text-sm text-[#a59494] italic mb-4">
        Imagine the following events as if they were happening right now. Then circle the number that represents your answer to each of the related questions.
      </p>
      <p className="text-xs text-[#a59494] mb-6">{answeredCount}/20 answered</p>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{err}</div>}

      <div className="space-y-4">
        {AQ_QUESTIONS.map((q, idx) => (
          <div key={q.id} className="p-4 bg-[#f5f0f0] rounded-xl">
            <p className="text-sm text-[#272727] font-bold mb-1">
              {idx + 1}. {q.text}
            </p>
            <p className="text-sm text-[#272727]/70 italic mb-3">
              {q.prompt}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#a59494] font-medium shrink-0 w-[100px] text-right hidden sm:block">{q.scaleLeft}</span>
              <span className="text-xs text-[#a59494] font-medium sm:hidden mb-1 block w-full">← {q.scaleLeft}</span>
              <div className="flex gap-2 flex-1 justify-center">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setResponses((p) => ({ ...p, [q.id]: val }))}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      responses[q.id] === val
                        ? "bg-[var(--brand-primary)] text-white shadow-md scale-110"
                        : "bg-white text-[#272727] hover:bg-[var(--brand-primary)]/10 border border-[#a59494]/20"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[#a59494] font-medium shrink-0 w-[120px] hidden sm:block">{q.scaleRight}</span>
              <span className="text-xs text-[#a59494] font-medium sm:hidden mt-1 block w-full text-right">{q.scaleRight} →</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving || answeredCount < 20}
        className="w-full py-3.5 mt-6 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-dark)] transition disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Submit"}
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
        <h2 className="text-xl font-bold text-[#272727] mb-2">Work Style Assessment Complete</h2>
        <p className="text-[#a59494]">Your work style profile has been recorded.</p>
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
      <h2 className="text-xl font-bold text-[#272727] mb-1">Work Style Assessment</h2>
      <p className="text-sm text-[#272727] font-semibold mb-2 bg-[#f5f0f0] rounded-lg px-4 py-3">
        For each group of 4 words, select the one that feels <strong>MOST</strong> like you and the one that feels <strong>LEAST</strong> like you. Please answer based on what feels most natural, rather than how you think you should respond.
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
        {saving ? "Submitting..." : "Continue to Next Step"}
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
      <label className="block text-sm font-medium text-[#272727] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-transparent transition"
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
      <label className="block text-sm font-medium text-[#272727] mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-transparent transition bg-white"
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
      <label className="block text-sm font-medium text-[#272727] mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-lg border border-[#a59494]/30 text-sm text-[#272727] placeholder:text-[#a59494] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-transparent transition resize-none"
      />
    </div>
  );
}
