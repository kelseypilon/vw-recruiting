-- FP7 — Runtime Failures + Data Model Bug Fixes
-- This migration fixes constraints, types, seed issues, and schema inconsistencies.

-- ─── Bug #18: interview status CHECK — already fixed in 20260309000002 ────
-- 'hold' was already added. No action needed.

-- ─── Bug #45/#46: numeric overflow on scores ────────────────────────────
-- overall_score and interview_score are numeric(3,2) which overflows at 10.00
ALTER TABLE interview_scorecards ALTER COLUMN overall_score TYPE numeric(5,2);
ALTER TABLE candidates ALTER COLUMN interview_score TYPE numeric(5,2);

-- ─── Bug #47: years_experience type mismatch ────────────────────────────
-- Form sends text like "3-5" but column is integer
ALTER TABLE application_submissions ALTER COLUMN years_experience TYPE text;

-- ─── Bug #48: webhook_log missing columns ───────────────────────────────
-- CREATE TABLE IF NOT EXISTS silently skipped adding new columns
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS response_code integer;
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS error_message text;

-- ─── Bug #70: users.email uniqueness ────────────────────────────────────
-- Same person on multiple teams fails with current UNIQUE(email)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT users_team_email_unique UNIQUE (team_id, email);

-- ─── Bug #71: AQ response range ────────────────────────────────────────
-- Column is actually called "score", not "response_value"
-- Currently allows 0 but scale is 1-5
ALTER TABLE aq_responses DROP CONSTRAINT IF EXISTS aq_responses_score_check;
ALTER TABLE aq_responses ADD CONSTRAINT aq_responses_score_check
  CHECK (score BETWEEN 1 AND 5);

-- ─── Bug #74: assessment UNIQUE constraints ─────────────────────────────
-- Prevent duplicate submissions per candidate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_submissions_candidate_unique'
  ) THEN
    ALTER TABLE application_submissions ADD CONSTRAINT app_submissions_candidate_unique UNIQUE (candidate_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aq_submissions_candidate_unique'
  ) THEN
    ALTER TABLE aq_submissions ADD CONSTRAINT aq_submissions_candidate_unique UNIQUE (candidate_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'disc_submissions_candidate_unique'
  ) THEN
    ALTER TABLE disc_submissions ADD CONSTRAINT disc_submissions_candidate_unique UNIQUE (candidate_id);
  END IF;
END $$;

-- ─── Bug #49: seed team ID mismatch ─────────────────────────────────────
-- Initial seed used 00000000-0000-0000-0000-000000000001 but all later
-- migrations reference 9bdd061b-8f89-4d08-bf19-bed29d129210.
-- Update the initial seed team UUID if it still exists.
UPDATE teams
  SET id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND NOT EXISTS (SELECT 1 FROM teams WHERE id = '9bdd061b-8f89-4d08-bf19-bed29d129210');

-- Also update referencing rows in users, candidates, etc.
UPDATE users SET team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  WHERE team_id = '00000000-0000-0000-0000-000000000001';
UPDATE candidates SET team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  WHERE team_id = '00000000-0000-0000-0000-000000000001';
UPDATE pipeline_stages SET team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  WHERE team_id = '00000000-0000-0000-0000-000000000001';
UPDATE scoring_criteria SET team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  WHERE team_id = '00000000-0000-0000-0000-000000000001';

-- ─── Bug #50: missing team_id in interviewer_selections seed ────────────
-- The INSERT was missing the required team_id column.
-- Fix: re-run with team_id included (ON CONFLICT DO NOTHING is safe)
INSERT INTO interviewer_question_selections (user_id, question_id, team_id)
SELECT u.id, q.id, '9bdd061b-8f89-4d08-bf19-bed29d129210'
FROM users u
CROSS JOIN interview_questions q
WHERE u.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.is_active = true
ON CONFLICT DO NOTHING;

-- ─── Bug #44: hire_type vs hire_track ambiguity ─────────────────────────
-- hire_track (with CHECK constraint) is the canonical column.
-- hire_type remains for backward compatibility — sync any out-of-sync rows.
UPDATE onboarding_tasks SET hire_track = hire_type
  WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;
UPDATE candidates SET hire_track = hire_type
  WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;

-- Add stage_entered_at to candidates if not present (for Part 2 stage tracking)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;
-- Backfill stage_entered_at from the latest stage_history entry
UPDATE candidates c
  SET stage_entered_at = sh.created_at
  FROM (
    SELECT DISTINCT ON (candidate_id) candidate_id, created_at
    FROM stage_history
    ORDER BY candidate_id, created_at DESC
  ) sh
  WHERE c.id = sh.candidate_id AND c.stage_entered_at IS NULL;
-- For candidates with no stage_history, fall back to created_at
UPDATE candidates SET stage_entered_at = created_at WHERE stage_entered_at IS NULL;
