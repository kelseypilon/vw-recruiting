"use client";

import { useState, useEffect, useCallback } from "react";
import type { ApplicationFormField } from "@/lib/types";
import { DEFAULT_FORM_FIELDS, FIELD_TYPE_LABELS } from "@/lib/default-form-fields";

/* ── Helpers ───────────────────────────────────────────────────── */

/** Resolve both legacy conditionalOn and new show_if into a normalized show_if */
function resolveShowIf(field: ApplicationFormField): ApplicationFormField["show_if"] {
  if (field.show_if) return field.show_if;
  if (field.conditionalOn) return { field_id: field.conditionalOn, value: true };
  return undefined;
}

/** Compute a human-readable condition label */
function conditionLabel(
  showIf: NonNullable<ApplicationFormField["show_if"]>,
  fields: ApplicationFormField[]
): string {
  const parent = fields.find((f) => f.id === showIf.field_id);
  if (!parent) return "";
  const valStr =
    typeof showIf.value === "boolean"
      ? showIf.value
        ? "Yes"
        : "No"
      : String(showIf.value);
  return `${parent.label} = ${valStr}`;
}

/** Editable field types (excludes interested_in which is special) */
const EDITABLE_TYPES: ApplicationFormField["type"][] = [
  "text",
  "email",
  "tel",
  "number",
  "date",
  "boolean",
  "select",
  "textarea",
];

/* ── Component ─────────────────────────────────────────────────── */

interface Props {
  teamId: string;
}

export default function ApplicationFormTab({ teamId }: Props) {
  const [fields, setFields] = useState<ApplicationFormField[]>([]);
  const [originalFields, setOriginalFields] = useState<ApplicationFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({
    label: "",
    type: "text" as ApplicationFormField["type"],
    required: false,
    options: "",
    showConditional: false,
    condFieldId: "",
    condValue: "" as string | boolean,
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Load form fields from settings
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_form_fields", payload: { team_id: teamId } }),
        });
        const data = await res.json();
        const loaded = (data.fields as ApplicationFormField[] | null) ?? DEFAULT_FORM_FIELDS;
        const sorted = [...loaded].sort((a, b) => a.order - b.order);
        setFields(sorted);
        setOriginalFields(sorted);
      } catch {
        setFields([...DEFAULT_FORM_FIELDS]);
        setOriginalFields([...DEFAULT_FORM_FIELDS]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [teamId]);

  const hasChanges = JSON.stringify(fields) !== JSON.stringify(originalFields);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // ── CRUD helpers ────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const ordered = fields.map((f, i) => ({ ...f, order: i }));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_form_fields",
          payload: { team_id: teamId, fields: ordered },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to save");
        return;
      }
      setOriginalFields(ordered);
      setFields(ordered);
      showToast("Form fields saved!");
    } catch {
      showToast("Network error");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setFields([...originalFields]);
    setEditingFieldId(null);
  }

  async function handleResetDefaults() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_form_fields",
          payload: { team_id: teamId },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to reset");
        return;
      }
      const resetFields = (data.fields as ApplicationFormField[]) ?? [...DEFAULT_FORM_FIELDS];
      setFields(resetFields);
      setOriginalFields(resetFields);
      setEditingFieldId(null);
      showToast("Form reset to defaults!");
    } catch {
      // Fallback: reset locally if API fails
      setFields([...DEFAULT_FORM_FIELDS]);
      setOriginalFields([...DEFAULT_FORM_FIELDS]);
      setEditingFieldId(null);
      showToast("Reset to defaults (local)");
    } finally {
      setSaving(false);
    }
  }

  function toggleRequired(id: string) {
    setFields((prev) =>
      prev.map((f) => (f.id === id && !f.locked ? { ...f, required: !f.required } : f))
    );
  }

  function deleteField(id: string) {
    // Also remove show_if references pointing to this field
    setFields((prev) =>
      prev
        .filter((f) => f.id !== id)
        .map((f) => {
          const si = resolveShowIf(f);
          if (si?.field_id === id) {
            return { ...f, show_if: undefined, conditionalOn: undefined };
          }
          return f;
        })
    );
  }

  function startEditing(field: ApplicationFormField) {
    setEditingFieldId(field.id);
    setEditLabel(field.label);
  }

  function finishEditing(id: string) {
    if (editLabel.trim()) {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, label: editLabel.trim() } : f))
      );
    }
    setEditingFieldId(null);
  }

  // Update field type
  function updateFieldType(id: string, newType: ApplicationFormField["type"]) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id || f.locked) return f;
        const updated = { ...f, type: newType };
        // Clear options when changing away from select
        if (newType !== "select") {
          delete updated.options;
        } else if (!updated.options) {
          updated.options = [];
        }
        return updated;
      })
    );
  }

  // Toggle show_if on an existing field
  function toggleShowIf(id: string, enabled: boolean) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        if (enabled) {
          const firstOther = prev.find((o) => o.id !== id && !resolveShowIf(o));
          return {
            ...f,
            show_if: { field_id: firstOther?.id ?? "", value: true },
            conditionalOn: undefined,
          };
        }
        return { ...f, show_if: undefined, conditionalOn: undefined };
      })
    );
  }

  // Update show_if field_id
  function updateShowIfField(id: string, parentId: string) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const parent = prev.find((p) => p.id === parentId);
        let defaultVal: unknown = true;
        if (parent?.type === "select" && parent.options?.length) {
          defaultVal = parent.options[0];
        } else if (parent?.type === "boolean") {
          defaultVal = true;
        } else {
          defaultVal = "";
        }
        return { ...f, show_if: { field_id: parentId, value: defaultVal }, conditionalOn: undefined };
      })
    );
  }

  // Update show_if value
  function updateShowIfValue(id: string, value: unknown) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.show_if) return f;
        return { ...f, show_if: { ...f.show_if, value } };
      })
    );
  }

  // Update options inline
  function updateFieldOptions(id: string, optionsStr: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, options: optionsStr.split(",").map((o) => o.trim()).filter(Boolean) }
          : f
      )
    );
  }

  // Add new field
  function handleAddField() {
    if (!newField.label.trim()) return;
    if (fields.length >= 20) {
      showToast("Maximum 20 fields allowed");
      return;
    }
    const baseId = newField.label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    let id = `custom_${baseId}`;
    let counter = 1;
    while (fields.find((f) => f.id === id)) {
      id = `custom_${baseId}_${counter++}`;
    }

    const field: ApplicationFormField = {
      id,
      label: newField.label.trim(),
      type: newField.type,
      required: newField.required,
      locked: false,
      order: fields.length,
    };
    if (newField.type === "select" && newField.options.trim()) {
      field.options = newField.options.split(",").map((o) => o.trim()).filter(Boolean);
    }
    if (newField.showConditional && newField.condFieldId) {
      field.show_if = { field_id: newField.condFieldId, value: newField.condValue };
    }

    setFields((prev) => [...prev, field]);
    setNewField({ label: "", type: "text", required: false, options: "", showConditional: false, condFieldId: "", condValue: "" });
    setAddingField(false);
    showToast("Field added — save to apply changes");
  }

  // Drag and drop
  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const updated = [...fields];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setFields(updated.map((f, i) => ({ ...f, order: i })));
    setDragIdx(null);
    setDragOverIdx(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Value editor for the condition ──────────────────────────

  function ConditionValueInput({
    parentField,
    value,
    onChange,
  }: {
    parentField: ApplicationFormField | undefined;
    value: unknown;
    onChange: (v: unknown) => void;
  }) {
    if (!parentField) return null;
    if (parentField.type === "boolean") {
      return (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value === "true")}
          className="px-2 py-1 text-xs border border-[#a59494]/30 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)]"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    if (parentField.type === "select" && parentField.options?.length) {
      return (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="px-2 py-1 text-xs border border-[#a59494]/30 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)]"
        >
          {parentField.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder="value"
        className="px-2 py-1 text-xs border border-[#a59494]/30 rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)] w-24"
      />
    );
  }

  // ── Parent field selector for conditions ────────────────────

  function parentFieldsForCondition(fieldId: string) {
    return fields.filter((f) => f.id !== fieldId && f.type !== "interested_in" && f.type !== "textarea");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[#272727]">Application Form Fields</h2>
          <p className="text-sm text-[#a59494] mt-0.5">
            Customize the fields candidates see on the application form. Drag to reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button onClick={handleReset} className="px-3 py-1.5 text-sm text-[#a59494] hover:text-[#272727] transition">
              Discard
            </button>
          )}
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-sm border border-[#a59494]/30 rounded-lg text-[#a59494] hover:text-[#272727] hover:border-[#272727]/30 transition"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-1.5 bg-[var(--brand-primary,#1c759e)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-1">
        {fields.map((field, idx) => {
          const showIf = resolveShowIf(field);
          const isConditional = !!showIf;
          const isEditing = editingFieldId === field.id;

          return (
            <div
              key={field.id}
              draggable={!field.locked}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`rounded-xl border transition ${
                dragOverIdx === idx
                  ? "border-[var(--brand-primary,#1c759e)] bg-[var(--brand-primary,#1c759e)]/5"
                  : "border-[#a59494]/15 bg-white hover:bg-[#f5f0f0]/50"
              } ${field.locked ? "opacity-80" : "cursor-grab"} ${
                isConditional ? "ml-8 border-l-2 border-l-[var(--brand-primary,#1c759e)]/30" : ""
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Drag Handle */}
                <div className={`text-[#a59494] ${field.locked ? "invisible" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="18" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="18" r="1.5" fill="currentColor" />
                  </svg>
                </div>

                {/* Label (inline editable) */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={() => finishEditing(field.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishEditing(field.id);
                        if (e.key === "Escape") setEditingFieldId(null);
                      }}
                      className="w-full px-2 py-0.5 text-sm border border-[var(--brand-primary,#1c759e)] rounded focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => !field.locked && startEditing(field)}
                      className={`text-sm font-medium text-[#272727] truncate block text-left ${
                        field.locked ? "cursor-default" : "hover:text-[var(--brand-primary,#1c759e)]"
                      }`}
                    >
                      {field.label}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </button>
                  )}
                  {isConditional && !isEditing && (
                    <p className="text-[10px] text-[#a59494] mt-0.5">
                      ↳ shown when {conditionLabel(showIf!, fields)}
                    </p>
                  )}
                </div>

                {/* Type selector (editable for non-locked, non-interested_in) */}
                {!field.locked && field.type !== "interested_in" ? (
                  <select
                    value={field.type}
                    onChange={(e) => updateFieldType(field.id, e.target.value as ApplicationFormField["type"])}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f0f0] text-[#a59494] uppercase tracking-wide shrink-0 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)] appearance-none pr-5 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%228%22%20height%3D%225%22%20viewBox%3D%220%200%208%205%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M4%205L0%200h8L4%205z%22%20fill%3D%22%23a59494%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_6px_center]"
                  >
                    {EDITABLE_TYPES.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f0f0] text-[#a59494] uppercase tracking-wide shrink-0">
                    {FIELD_TYPE_LABELS[field.type] ?? field.type}
                  </span>
                )}

                {/* Locked badge */}
                {field.locked && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#272727]/5 text-[#272727]/50 uppercase tracking-wide shrink-0">
                    Locked
                  </span>
                )}

                {/* Required toggle */}
                {!field.locked && (
                  <button
                    onClick={() => toggleRequired(field.id)}
                    title={field.required ? "Make optional" : "Make required"}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full transition shrink-0 ${
                      field.required
                        ? "bg-[var(--brand-primary,#1c759e)]/10 text-[var(--brand-primary,#1c759e)]"
                        : "bg-[#f5f0f0] text-[#a59494] hover:text-[#272727]"
                    }`}
                  >
                    {field.required ? "Required" : "Optional"}
                  </button>
                )}

                {/* Delete button */}
                {!field.locked && (
                  <button
                    onClick={() => deleteField(field.id)}
                    title="Remove field"
                    className="text-[#a59494] hover:text-red-500 transition shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded editor (shown when editing) */}
              {isEditing && !field.locked && (
                <div className="px-4 pb-3 space-y-2 border-t border-[#a59494]/10 pt-2">
                  {/* Options editor for select fields */}
                  {field.type === "select" && (
                    <div>
                      <label className="block text-[10px] font-medium text-[#a59494] uppercase tracking-wide mb-1">
                        Dropdown Options (comma-separated)
                      </label>
                      <input
                        value={field.options?.join(", ") ?? ""}
                        onChange={(e) => updateFieldOptions(field.id, e.target.value)}
                        placeholder="Option 1, Option 2, ..."
                        className="w-full px-2 py-1 text-xs border border-[#a59494]/30 rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)]"
                      />
                    </div>
                  )}

                  {/* Show conditionally toggle */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                          isConditional ? "bg-[var(--brand-primary,#1c759e)]" : "bg-[#a59494]/30"
                        }`}
                        onClick={() => toggleShowIf(field.id, !isConditional)}
                      >
                        <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                          isConditional ? "translate-x-4" : "translate-x-0.5"
                        }`} />
                      </div>
                      <span className="text-xs text-[#272727]">Show conditionally</span>
                    </label>

                    {isConditional && showIf && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[#a59494]">when</span>
                        <select
                          value={showIf.field_id}
                          onChange={(e) => updateShowIfField(field.id, e.target.value)}
                          className="px-2 py-1 text-xs border border-[#a59494]/30 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)]"
                        >
                          <option value="">Select field...</option>
                          {parentFieldsForCondition(field.id).map((pf) => (
                            <option key={pf.id} value={pf.id}>{pf.label}</option>
                          ))}
                        </select>
                        <span className="text-[#a59494]">=</span>
                        <ConditionValueInput
                          parentField={fields.find((f) => f.id === showIf.field_id)}
                          value={showIf.value}
                          onChange={(v) => updateShowIfValue(field.id, v)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Field */}
      {!addingField ? (
        <button
          onClick={() => setAddingField(true)}
          disabled={fields.length >= 20}
          className="mt-4 w-full py-3 border-2 border-dashed border-[#a59494]/20 rounded-xl text-sm text-[#a59494] hover:border-[var(--brand-primary,#1c759e)]/40 hover:text-[var(--brand-primary,#1c759e)] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Custom Field {fields.length >= 20 && "(max 20)"}
        </button>
      ) : (
        <div className="mt-4 p-4 border border-[var(--brand-primary,#1c759e)]/20 rounded-xl bg-[var(--brand-primary,#1c759e)]/5">
          <h3 className="text-sm font-semibold text-[#272727] mb-3">Add New Field</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-[#272727] mb-1">Label</label>
              <input
                value={newField.label}
                onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
                placeholder="e.g. LinkedIn Profile"
                className="w-full px-3 py-2 text-sm border border-[#a59494]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1c759e)]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#272727] mb-1">Type</label>
              <select
                value={newField.type}
                onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value as ApplicationFormField["type"] }))}
                className="w-full px-3 py-2 text-sm border border-[#a59494]/30 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1c759e)]/40"
              >
                {EDITABLE_TYPES.map((t) => (
                  <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {newField.type === "select" && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-[#272727] mb-1">Options (comma-separated)</label>
              <input
                value={newField.options}
                onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full px-3 py-2 text-sm border border-[#a59494]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1c759e)]/40"
              />
            </div>
          )}

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(e) => setNewField((p) => ({ ...p, required: e.target.checked }))}
              className="accent-[var(--brand-primary,#1c759e)]"
            />
            <span className="text-sm text-[#272727]">Required field</span>
          </label>

          {/* Show conditionally toggle for new field */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newField.showConditional}
                onChange={(e) => setNewField((p) => ({ ...p, showConditional: e.target.checked, condFieldId: "", condValue: "" }))}
                className="accent-[var(--brand-primary,#1c759e)]"
              />
              <span className="text-sm text-[#272727]">Show conditionally</span>
            </label>

            {newField.showConditional && (
              <div className="flex items-center gap-2 mt-2 ml-5">
                <span className="text-xs text-[#a59494]">Show when</span>
                <select
                  value={newField.condFieldId}
                  onChange={(e) => {
                    const parentId = e.target.value;
                    const parent = fields.find((f) => f.id === parentId);
                    let defVal: string | boolean = "";
                    if (parent?.type === "boolean") defVal = true;
                    else if (parent?.type === "select" && parent.options?.length) defVal = parent.options[0];
                    setNewField((p) => ({ ...p, condFieldId: parentId, condValue: defVal }));
                  }}
                  className="px-2 py-1 text-xs border border-[#a59494]/30 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)]"
                >
                  <option value="">Select field...</option>
                  {fields
                    .filter((f) => f.type !== "interested_in" && f.type !== "textarea")
                    .map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                </select>
                {newField.condFieldId && (() => {
                  const parent = fields.find((f) => f.id === newField.condFieldId);
                  if (!parent) return null;
                  return (
                    <>
                      <span className="text-xs text-[#a59494]">=</span>
                      {parent.type === "boolean" ? (
                        <select
                          value={String(newField.condValue)}
                          onChange={(e) => setNewField((p) => ({ ...p, condValue: e.target.value === "true" }))}
                          className="px-2 py-1 text-xs border border-[#a59494]/30 rounded bg-white"
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : parent.type === "select" && parent.options?.length ? (
                        <select
                          value={String(newField.condValue)}
                          onChange={(e) => setNewField((p) => ({ ...p, condValue: e.target.value }))}
                          className="px-2 py-1 text-xs border border-[#a59494]/30 rounded bg-white"
                        >
                          {parent.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={String(newField.condValue)}
                          onChange={(e) => setNewField((p) => ({ ...p, condValue: e.target.value }))}
                          placeholder="value"
                          className="px-2 py-1 text-xs border border-[#a59494]/30 rounded w-24"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setAddingField(false);
                setNewField({ label: "", type: "text", required: false, options: "", showConditional: false, condFieldId: "", condValue: "" });
              }}
              className="px-3 py-1.5 text-sm text-[#a59494] hover:text-[#272727] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddField}
              disabled={!newField.label.trim()}
              className="px-4 py-1.5 bg-[var(--brand-primary,#1c759e)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-40"
            >
              Add Field
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#272727] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}
