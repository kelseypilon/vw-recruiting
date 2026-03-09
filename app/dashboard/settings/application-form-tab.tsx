"use client";

import { useState, useEffect, useCallback } from "react";
import type { ApplicationFormField } from "@/lib/types";
import { DEFAULT_FORM_FIELDS, FIELD_TYPE_LABELS } from "@/lib/default-form-fields";

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

  // Show toast
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // Save to API
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

  // Reset to original
  function handleReset() {
    setFields([...originalFields]);
    setEditingFieldId(null);
  }

  // Reset to defaults
  function handleResetDefaults() {
    setFields([...DEFAULT_FORM_FIELDS]);
    setEditingFieldId(null);
  }

  // Toggle required
  function toggleRequired(id: string) {
    setFields((prev) =>
      prev.map((f) => (f.id === id && !f.locked ? { ...f, required: !f.required } : f))
    );
  }

  // Delete field
  function deleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  // Start inline label edit
  function startEditing(field: ApplicationFormField) {
    setEditingFieldId(field.id);
    setEditLabel(field.label);
  }

  // Save inline label edit
  function finishEditing(id: string) {
    if (editLabel.trim()) {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, label: editLabel.trim() } : f))
      );
    }
    setEditingFieldId(null);
  }

  // Add new field
  function handleAddField() {
    if (!newField.label.trim()) return;
    if (fields.length >= 20) {
      showToast("Maximum 20 fields allowed");
      return;
    }
    // Generate an ID from the label
    const baseId = newField.label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    let id = `custom_${baseId}`;
    // Ensure uniqueness
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

    setFields((prev) => [...prev, field]);
    setNewField({ label: "", type: "text", required: false, options: "" });
    setAddingField(false);
    showToast("Field added — save to apply changes");
  }

  // Edit options for select fields inline
  function updateFieldOptions(id: string, optionsStr: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, options: optionsStr.split(",").map((o) => o.trim()).filter(Boolean) }
          : f
      )
    );
  }

  // Drag and drop
  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
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
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-[#a59494] hover:text-[#272727] transition"
            >
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
          // Skip fields that are conditional and their parent is false/missing
          const isConditional = !!field.conditionalOn;
          const parentField = isConditional
            ? fields.find((f) => f.id === field.conditionalOn)
            : null;

          return (
            <div
              key={field.id}
              draggable={!field.locked}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
                dragOverIdx === idx
                  ? "border-[var(--brand-primary,#1c759e)] bg-[var(--brand-primary,#1c759e)]/5"
                  : "border-[#a59494]/15 bg-white hover:bg-[#f5f0f0]/50"
              } ${field.locked ? "opacity-80" : "cursor-grab"} ${
                isConditional ? "ml-8 border-l-2 border-l-[#a59494]/20" : ""
              }`}
            >
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
                {editingFieldId === field.id ? (
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
                {isConditional && parentField && (
                  <p className="text-[10px] text-[#a59494] mt-0.5">
                    Shown when &quot;{parentField.label}&quot; is enabled
                  </p>
                )}
                {/* Inline options editor for select fields */}
                {field.type === "select" && editingFieldId === field.id && (
                  <input
                    value={field.options?.join(", ") ?? ""}
                    onChange={(e) => updateFieldOptions(field.id, e.target.value)}
                    placeholder="Option 1, Option 2, ..."
                    className="w-full mt-1 px-2 py-0.5 text-xs border border-[#a59494]/30 rounded focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1c759e)]"
                  />
                )}
              </div>

              {/* Type Badge */}
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f0f0] text-[#a59494] uppercase tracking-wide shrink-0">
                {FIELD_TYPE_LABELS[field.type] ?? field.type}
              </span>

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
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="tel">Phone</option>
                <option value="number">Number</option>
                <option value="boolean">Toggle (Yes/No)</option>
                <option value="select">Dropdown</option>
                <option value="textarea">Long Text</option>
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

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(e) => setNewField((p) => ({ ...p, required: e.target.checked }))}
              className="accent-[var(--brand-primary,#1c759e)]"
            />
            <span className="text-sm text-[#272727]">Required field</span>
          </label>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAddingField(false)}
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
