-- ============================================================
-- Migration: Roles, Onboarding Assignment & Task Scheduling
-- Date: 2026-03-06
--
-- Build 1: Role Permissions expansion (title field on users)
-- Build 2: Onboarding task assignment (default_assignee_id)
-- Build 3: Task scheduling (due_offset_days, start_date)
-- Build 4: Email notifications (uses existing schema)
-- ============================================================

-- ── 1A: Add title column to users ─────────────────────────────
-- Separate from role (permission role). Title = job title.
ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;

-- ── 1B: Add start_date to candidates ──────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS start_date date;

-- ── 1C: Add assignment + scheduling columns to onboarding_tasks
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS default_assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_offset_days integer,
  ADD COLUMN IF NOT EXISTS due_offset_anchor text NOT NULL DEFAULT 'start_date';

-- ── 1D: Add assigned_user_id to candidate_onboarding ──────────
-- New column alongside existing assigned_to.
-- On initialization, copies from onboarding_tasks.default_assignee_id.
ALTER TABLE candidate_onboarding
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- ── 1E: Backfill assigned_user_id from existing assigned_to ───
UPDATE candidate_onboarding
SET assigned_user_id = assigned_to
WHERE assigned_to IS NOT NULL AND assigned_user_id IS NULL;
