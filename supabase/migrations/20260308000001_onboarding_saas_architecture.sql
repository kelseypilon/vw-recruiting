-- ============================================================
-- Migration: Onboarding Automation + Integrations + SaaS Architecture
-- ============================================================

-- ── Pre-flight: teams.plan column ─────────────────────────────
ALTER TABLE teams ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'pro'
  CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));

-- ── Pre-flight: users.is_super_admin ──────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Set super admins
UPDATE users SET is_super_admin = true WHERE email IN ('kelsey@kelseypilon.com', 'kelseylpilon@gmail.com');

-- ── Part 1: Business Unit + Hire Track ────────────────────────

-- Teams: business_units JSONB array
ALTER TABLE teams ADD COLUMN IF NOT EXISTS business_units jsonb NOT NULL DEFAULT '["Residential", "Commercial"]';

-- Candidates: business_unit + hire_track
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS business_unit text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hire_track text NOT NULL DEFAULT 'agent';

-- Pipeline stages: hire_track
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS hire_track text NOT NULL DEFAULT 'all'
  CHECK (hire_track IN ('agent', 'employee', 'all'));

-- Onboarding tasks: hire_track (replacing hire_type usage scope)
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS hire_track text NOT NULL DEFAULT 'agent'
  CHECK (hire_track IN ('agent', 'employee', 'both'));

-- Migrate existing onboarding_tasks hire_type data to hire_track
UPDATE onboarding_tasks SET hire_track = hire_type WHERE hire_type IS NOT NULL AND hire_type != '';

-- Onboarding tasks: automation_key for integration-backed tasks
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS automation_key text;

-- ── Part 2: Integrations ──────────────────────────────────────

-- Teams: integrations JSONB config
ALTER TABLE teams ADD COLUMN IF NOT EXISTS integrations jsonb NOT NULL DEFAULT '{}';

-- ── Part 6: GHL Webhook ─────────────────────────────────────

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

-- ── Part 7: Invite-Only Access System ─────────────────────────

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

-- Seed Vantage West team with defaults
UPDATE teams
SET business_units = '["Residential", "Commercial"]',
    plan = 'pro'
WHERE slug = 'vantage-west';
