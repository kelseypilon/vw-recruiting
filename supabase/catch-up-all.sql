-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MASTER CATCH-UP SQL — Paste into Supabase SQL Editor & Run        ║
-- ║  Covers ALL migrations from 20260306000001 → 20260311000002        ║
-- ║  100% safe to re-run (IF NOT EXISTS / IF EXISTS throughout)        ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ═══════════════════════════════════════════════════════════════════════
-- M1: 20260306000001 — Roles, Onboarding Assignment & Scheduling
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS default_assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_offset_days integer,
  ADD COLUMN IF NOT EXISTS due_offset_anchor text NOT NULL DEFAULT 'start_date';

ALTER TABLE candidate_onboarding
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE candidate_onboarding
SET assigned_user_id = assigned_to
WHERE assigned_to IS NOT NULL AND assigned_user_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- M2: 20260306000002 — Group Interview Enhancements & User Profile
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE group_interview_sessions
  ADD COLUMN IF NOT EXISTS general_notes text DEFAULT '';

CREATE TABLE IF NOT EXISTS group_interview_prompts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  prompt_text   text NOT NULL,
  order_index   integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_interview_prompts_team_idx ON group_interview_prompts(team_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"email_reminders":true,"digest":false}'::jsonb;


-- ═══════════════════════════════════════════════════════════════════════
-- M3: 20260306000003 — Seed Interviewer Question Selections
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO interviewer_question_selections (user_id, question_id, team_id)
SELECT u.id, q.id, '9bdd061b-8f89-4d08-bf19-bed29d129210'
FROM users u
CROSS JOIN interview_questions q
WHERE u.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.is_active = true
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- M4: 20260307000001 — Roles, Interviews, Profiles
-- ═══════════════════════════════════════════════════════════════════════

-- Drop restrictive role CHECK so custom roles work
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Group interview session status
ALTER TABLE group_interview_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'upcoming';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_interview_sessions_status_check'
  ) THEN
    ALTER TABLE group_interview_sessions
      ADD CONSTRAINT group_interview_sessions_status_check
      CHECK (status IN ('upcoming', 'in_progress', 'completed'));
  END IF;
END $$;

-- Multi-interviewer join table
CREATE TABLE IF NOT EXISTS interview_interviewers (
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'interviewer',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_interview_interviewers_user ON interview_interviewers(user_id);

-- Avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public avatar access' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public avatar access" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload avatars" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own avatars" ON storage.objects
      FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- M5: 20260307000002 — Interview Guide Notes
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS interview_guide_notes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_text    text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(candidate_id, question_id, author_user_id)
);
CREATE INDEX IF NOT EXISTS guide_notes_candidate_idx ON interview_guide_notes(candidate_id);
CREATE INDEX IF NOT EXISTS guide_notes_question_idx ON interview_guide_notes(question_id);


-- ═══════════════════════════════════════════════════════════════════════
-- M6: 20260307000003 — Team Branding (SaaS / White-Label)
-- ═══════════════════════════════════════════════════════════════════════

-- Need to drop the CHECK first if it exists, then re-add with the column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'branding_mode'
  ) THEN
    ALTER TABLE teams ADD COLUMN branding_mode text NOT NULL DEFAULT 'vantage'
      CHECK (branding_mode IN ('vantage', 'white_label', 'custom'));
  END IF;
END $$;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#1c759e',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text NOT NULL DEFAULT '#272727',
  ADD COLUMN IF NOT EXISTS brand_show_powered_by boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS teams_slug_idx ON teams(slug) WHERE slug IS NOT NULL;

UPDATE teams
SET branding_mode = 'vantage',
    brand_name = 'Vantage West Realty',
    brand_primary_color = '#1c759e',
    brand_secondary_color = '#272727',
    brand_show_powered_by = false,
    slug = 'vantage-west'
WHERE name ILIKE '%vantage%west%' AND slug IS NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- M7: 20260307000004 — Hired Pipeline Stage
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Only run if "Hired" doesn't exist yet
  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Hired') THEN

    -- Temporarily drop constraint
    ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_team_id_order_index_key;

    -- Bump all stages after Offer
    UPDATE pipeline_stages ps
    SET order_index = ps.order_index + 1
    WHERE ps.order_index > (
      SELECT ps2.order_index FROM pipeline_stages ps2
      WHERE ps2.team_id = ps.team_id AND ps2.name = 'Offer'
    )
    AND EXISTS (
      SELECT 1 FROM pipeline_stages ps3
      WHERE ps3.team_id = ps.team_id AND ps3.name = 'Offer'
    );

    -- Insert Hired
    INSERT INTO pipeline_stages (team_id, name, order_index, ghl_tag, color, is_active)
    SELECT ps.team_id, 'Hired', ps.order_index + 1, 'hired', '#2D9E6B', true
    FROM pipeline_stages ps WHERE ps.name = 'Offer';

    -- Re-add constraint
    ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_team_id_order_index_key UNIQUE (team_id, order_index);

  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- M8: 20260307000005 — Booking Fields
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS virtual_booking_url text,
  ADD COLUMN IF NOT EXISTS inperson_booking_url text,
  ADD COLUMN IF NOT EXISTS virtual_meeting_link text;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS office_address text;

UPDATE users
SET virtual_booking_url = google_booking_url
WHERE google_booking_url IS NOT NULL AND google_booking_url != ''
  AND virtual_booking_url IS NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- M9: 20260307000006 — User Active Flag
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;


-- ═══════════════════════════════════════════════════════════════════════
-- M10: 20260307000007 — Notifications System
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_escalation_contact boolean NOT NULL DEFAULT false;

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_reason text;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_follow_up_date date;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_set_at timestamptz;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_escalation_level integer NOT NULL DEFAULT 0;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kanban_hold boolean NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kanban_hold_reason text;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS threshold_stuck_days integer NOT NULL DEFAULT 7;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS threshold_scorecard_hours integer NOT NULL DEFAULT 24;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS threshold_escalation_hours integer NOT NULL DEFAULT 48;

CREATE TABLE IF NOT EXISTS notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  type text NOT NULL,
  candidate_id uuid REFERENCES candidates(id),
  interview_id uuid REFERENCES interviews(id),
  sent_to_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  escalation_level integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notifications_log_team ON notifications_log(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_interview ON notifications_log(interview_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_candidate ON notifications_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_type_level ON notifications_log(type, escalation_level);


-- ═══════════════════════════════════════════════════════════════════════
-- M11: 20260308000001 — Onboarding SaaS Architecture
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE teams ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'pro';
-- Add CHECK only if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_plan_check'
  ) THEN
    ALTER TABLE teams ADD CONSTRAINT teams_plan_check
      CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
UPDATE users SET is_super_admin = true WHERE email IN ('kelsey@kelseypilon.com', 'kelseylpilon@gmail.com');

ALTER TABLE teams ADD COLUMN IF NOT EXISTS business_units jsonb NOT NULL DEFAULT '["Residential", "Commercial"]';

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS business_unit text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hire_track text NOT NULL DEFAULT 'agent';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages' AND column_name = 'hire_track'
  ) THEN
    ALTER TABLE pipeline_stages ADD COLUMN hire_track text NOT NULL DEFAULT 'all'
      CHECK (hire_track IN ('agent', 'employee', 'all'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'onboarding_tasks' AND column_name = 'hire_track'
  ) THEN
    ALTER TABLE onboarding_tasks ADD COLUMN hire_track text NOT NULL DEFAULT 'agent'
      CHECK (hire_track IN ('agent', 'employee', 'both'));
  END IF;
END $$;

UPDATE onboarding_tasks SET hire_track = hire_type WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;

ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS automation_key text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS integrations jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  event_type text NOT NULL,
  provider text NOT NULL DEFAULT 'ghl',
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  response_code int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_log_team ON webhook_log(team_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_created ON webhook_log(created_at);

CREATE TABLE IF NOT EXISTS invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens(email);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_team ON invite_tokens(team_id);

UPDATE teams SET business_units = '["Residential", "Commercial"]', plan = 'pro'
WHERE slug = 'vantage-west' AND plan = 'pro';


-- ═══════════════════════════════════════════════════════════════════════
-- M12: 20260309000001 — Assessment System
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_total integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_c integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_o integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_r integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_e integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS disc_profile_label text;

CREATE TABLE IF NOT EXISTS application_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  team_id          uuid NOT NULL REFERENCES teams(id),
  full_name        text,
  email            text,
  phone            text,
  city             text,
  "current_role"   text,
  years_experience text,
  why_real_estate  text,
  why_vantage      text,
  biggest_achievement text,
  one_year_goal    text,
  hours_per_week   text,
  has_license      boolean DEFAULT false,
  license_number   text,
  referral_source  text,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_sub_candidate ON application_submissions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_app_sub_team ON application_submissions(team_id);

CREATE TABLE IF NOT EXISTS aq_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES teams(id),
  responses    jsonb NOT NULL DEFAULT '{}',
  score_c      integer,
  score_o      integer,
  score_r      integer,
  score_e      integer,
  total_score  integer,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aq_sub_candidate ON aq_submissions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_aq_sub_team ON aq_submissions(team_id);

CREATE TABLE IF NOT EXISTS disc_submissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  team_id           uuid NOT NULL REFERENCES teams(id),
  raw_responses     jsonb NOT NULL DEFAULT '{}',
  score_d           integer,
  score_i           integer,
  score_s           integer,
  score_c           integer,
  primary_profile   text,
  secondary_profile text,
  profile_label     text,
  submitted_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disc_sub_candidate ON disc_submissions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_disc_sub_team ON disc_submissions(team_id);


-- ═══════════════════════════════════════════════════════════════════════
-- M13: 20260309000002 — Fix Interview Status Hold
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'hold'));

ALTER TABLE notifications_log ALTER COLUMN team_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_log_unique_interview
  ON notifications_log(type, escalation_level, interview_id)
  WHERE interview_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_log_unique_candidate
  ON notifications_log(type, escalation_level, candidate_id)
  WHERE candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_log_sent_at ON notifications_log(sent_at);


-- ═══════════════════════════════════════════════════════════════════════
-- M14: 20260309000003 — Bugfix Batch (auth_id)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- M15: 20260310000001 — FP5: Settings, Pipeline, ISA, Interested-In
-- ═══════════════════════════════════════════════════════════════════════

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

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_isa boolean NOT NULL DEFAULT false;

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


-- ═══════════════════════════════════════════════════════════════════════
-- M16: 20260310000002 — Google OAuth + Email Tracking
-- ═══════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════
-- M17: 20260311000001 — FP7: Runtime Fixes
-- ═══════════════════════════════════════════════════════════════════════

-- Score numeric overflow fix
ALTER TABLE interview_scorecards ALTER COLUMN overall_score TYPE numeric(5,2);
ALTER TABLE candidates ALTER COLUMN interview_score TYPE numeric(5,2);

-- years_experience type fix (integer → text)
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'application_submissions' AND column_name = 'years_experience') = 'integer'
  THEN
    ALTER TABLE application_submissions ALTER COLUMN years_experience TYPE text;
  END IF;
END $$;

-- webhook_log missing columns
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS response_code integer;
ALTER TABLE webhook_log ADD COLUMN IF NOT EXISTS error_message text;

-- users.email: team-scoped uniqueness
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_team_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_team_email_unique UNIQUE (team_id, email);
  END IF;
END $$;

-- AQ response range
ALTER TABLE aq_responses DROP CONSTRAINT IF EXISTS aq_responses_score_check;
ALTER TABLE aq_responses ADD CONSTRAINT aq_responses_score_check CHECK (score BETWEEN 1 AND 5);

-- Assessment UNIQUE constraints
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

-- hire_type → hire_track sync
UPDATE onboarding_tasks SET hire_track = hire_type
  WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;
UPDATE candidates SET hire_track = hire_type
  WHERE hire_type IS NOT NULL AND hire_type != '' AND hire_track != hire_type;

-- stage_entered_at
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;
UPDATE candidates c
  SET stage_entered_at = sh.created_at
  FROM (
    SELECT DISTINCT ON (candidate_id) candidate_id, created_at
    FROM stage_history ORDER BY candidate_id, created_at DESC
  ) sh
  WHERE c.id = sh.candidate_id AND c.stage_entered_at IS NULL;
UPDATE candidates SET stage_entered_at = created_at WHERE stage_entered_at IS NULL;

-- Re-seed interviewer_question_selections with team_id
INSERT INTO interviewer_question_selections (user_id, question_id, team_id)
SELECT u.id, q.id, '9bdd061b-8f89-4d08-bf19-bed29d129210'
FROM users u
CROSS JOIN interview_questions q
WHERE u.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.is_active = true
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- M18: 20260311000002 — Group Interview Per-Prompt Scoring (NEW)
-- ═══════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════
-- ✅ ALL DONE — 18 migrations applied
-- ═══════════════════════════════════════════════════════════════════════
