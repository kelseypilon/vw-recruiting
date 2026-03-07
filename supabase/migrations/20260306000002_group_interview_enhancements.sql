-- ============================================================
-- Migration: Group Interview Enhancements & User Profile
-- Date: 2026-03-06
--
-- Build 1: General Session Notes (general_notes on sessions)
-- Build 2: Group Interview Prompts (new table)
-- Build 3: User Profile fields (notification_preferences, photo_url)
-- ============================================================

-- ── 1A: Add general_notes to group_interview_sessions ────────
-- Separate from summary. General notes are live-edited by all
-- interviewers during the session, auto-saved with debounce.
ALTER TABLE group_interview_sessions
  ADD COLUMN IF NOT EXISTS general_notes text DEFAULT '';

-- ── 2A: Create group_interview_prompts table ─────────────────
-- Stores the default prompts/questions shown during group interviews.
-- These are NOT scored — just conversation prompts.
CREATE TABLE IF NOT EXISTS group_interview_prompts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  prompt_text   text NOT NULL,
  order_index   integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_interview_prompts_team_idx
  ON group_interview_prompts(team_id);

-- ── 2B: Seed default prompts ─────────────────────────────────
-- These will be inserted for the VW team on first use.
-- The app code will handle seeding per-team if no prompts exist.

-- ── 3A: Add user profile columns ─────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"email_reminders":true,"digest":false}'::jsonb;
