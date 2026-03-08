-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  CATCH-UP SQL — Run in Supabase SQL Editor                      ║
-- ║  Covers migrations: 20260310000001 through 20260311000002       ║
-- ║  Safe to re-run (uses IF NOT EXISTS / IF EXISTS throughout)     ║
-- ╚═══════════════════════════════════════════════════════════════════╝


-- ═══════════════════════════════════════════════════════════════════
-- 1. FP5: Settings, Pipeline, Group Interviews (20260310000001)
-- ═══════════════════════════════════════════════════════════════════

-- Email Templates: system template protection + folders
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS folder_id uuid;

UPDATE email_templates SET is_system_template = true WHERE trigger IS NOT NULL AND is_system_template = false;

CREATE TABLE IF NOT EXISTS email_template_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_template_folders_team ON email_template_folders(team_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_email_templates_folder'
  ) THEN
    ALTER TABLE email_templates
      ADD CONSTRAINT fk_email_templates_folder
      FOREIGN KEY (folder_id) REFERENCES email_template_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Candidates: ISA flag
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_isa boolean NOT NULL DEFAULT false;

-- Configurable "Interested In" options per team
CREATE TABLE IF NOT EXISTS interested_in_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  label text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interested_in_options_team ON interested_in_options(team_id);

INSERT INTO interested_in_options (team_id, label, order_index)
SELECT t.id, opt.label, opt.idx
FROM teams t
CROSS JOIN (VALUES ('Agent', 0), ('Admin/Staff', 1), ('ISA', 2)) AS opt(label, idx)
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 2. Google OAuth + Email Tracking (20260310000002)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_access_token text,
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS google_email text;

CREATE TABLE IF NOT EXISTS candidate_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  gmail_message_id text,
  gmail_thread_id text,
  subject text,
  body_snippet text,
  from_address text,
  to_address text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_emails_candidate ON candidate_emails(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_emails_thread ON candidate_emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_candidate_emails_team ON candidate_emails(team_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. FP7: Runtime Fixes (20260311000001)
-- ═══════════════════════════════════════════════════════════════════

-- Numeric overflow fix on scores (3,2 -> 5,2)
ALTER TABLE interview_scorecards ALTER COLUMN overall_score TYPE numeric(5,2);
ALTER TABLE candidates ALTER COLUMN interview_score TYPE numeric(5,2);

-- years_experience type mismatch (integer -> text)
ALTER TABLE application_submissions ALTER COLUMN years_experience TYPE text;

-- webhook_log missing columns
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS response_code integer;
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS error_message text;

-- users.email uniqueness: team-scoped instead of global
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_team_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_team_email_unique UNIQUE (team_id, email);
  END IF;
END $$;

-- AQ response range fix
ALTER TABLE aq_responses DROP CONSTRAINT IF EXISTS aq_responses_score_check;
ALTER TABLE aq_responses ADD CONSTRAINT aq_responses_score_check CHECK (score BETWEEN 1 AND 5);

-- Assessment UNIQUE constraints (prevent duplicates)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_submissions_candidate_unique') THEN
    ALTER TABLE application_submissions ADD CONSTRAINT app_submissions_candidate_unique UNIQUE (candidate_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aq_submissions_candidate_unique') THEN
    ALTER TABLE aq_submissions ADD CONSTRAINT aq_submissions_candidate_unique UNIQUE (candidate_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disc_submissions_candidate_unique') THEN
    ALTER TABLE disc_submissions ADD CONSTRAINT disc_submissions_candidate_unique UNIQUE (candidate_id);
  END IF;
END $$;

-- hire_type vs hire_track sync
UPDATE onboarding_tasks SET hire_track = hire_type
  WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;
UPDATE candidates SET hire_track = hire_type
  WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;

-- stage_entered_at for candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;
UPDATE candidates c
  SET stage_entered_at = sh.created_at
  FROM (
    SELECT DISTINCT ON (candidate_id) candidate_id, created_at
    FROM stage_history
    ORDER BY candidate_id, created_at DESC
  ) sh
  WHERE c.id = sh.candidate_id AND c.stage_entered_at IS NULL;
UPDATE candidates SET stage_entered_at = created_at WHERE stage_entered_at IS NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 4. Group Interview Per-Prompt Scoring (20260311000002) — NEW
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_interview_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES group_interview_sessions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES group_interview_prompts(id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (session_id, candidate_id, prompt_id, evaluator_user_id)
);
CREATE INDEX IF NOT EXISTS idx_gi_scores_session ON group_interview_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_scores_candidate ON group_interview_scores(candidate_id);


-- ═══════════════════════════════════════════════════════════════════
-- ✅ Done! All migrations applied.
-- ═══════════════════════════════════════════════════════════════════
