-- ============================================================
-- Assessment System: application, AQ (CORE), DISC submissions
-- ============================================================

-- ── New columns on candidates ──────────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_total integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_c integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_o integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_r integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aq_score_e integer;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS disc_profile_label text;

-- ── Application submissions ────────────────────────────────
CREATE TABLE IF NOT EXISTS application_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  team_id          uuid NOT NULL REFERENCES teams(id),
  full_name        text,
  email            text,
  phone            text,
  city             text,
  "current_role"   text,
  years_experience integer,
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
CREATE INDEX IF NOT EXISTS idx_app_sub_team      ON application_submissions(team_id);

-- ── AQ (Adversity Quotient / CORE) submissions ────────────
CREATE TABLE IF NOT EXISTS aq_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES teams(id),
  responses    jsonb NOT NULL DEFAULT '{}',
  score_c      integer, -- Commitment
  score_o      integer, -- Ownership
  score_r      integer, -- Reach
  score_e      integer, -- Endurance
  total_score  integer, -- (C+O+R+E) x 2
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aq_sub_candidate ON aq_submissions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_aq_sub_team      ON aq_submissions(team_id);

-- ── DISC submissions ───────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_disc_sub_team      ON disc_submissions(team_id);
