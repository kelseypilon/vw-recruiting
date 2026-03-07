-- FP5: Settings, Pipeline, Group Interviews, Kanban, Onboarding, Dashboard schema changes

-- 1. Email Templates: system template protection + folders
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS folder_id uuid;

-- Mark existing seeded templates as system templates
UPDATE email_templates SET is_system_template = true WHERE trigger IS NOT NULL;

-- Email template folders table
CREATE TABLE IF NOT EXISTS email_template_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_template_folders_team
  ON email_template_folders(team_id);

ALTER TABLE email_templates
  ADD CONSTRAINT fk_email_templates_folder
  FOREIGN KEY (folder_id) REFERENCES email_template_folders(id) ON DELETE SET NULL;

-- 2. Candidates: ISA flag
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_isa boolean NOT NULL DEFAULT false;

-- 3. Configurable "Interested In" options per team
CREATE TABLE IF NOT EXISTS interested_in_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  label text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interested_in_options_team
  ON interested_in_options(team_id);

-- Seed default "Interested In" options for existing teams
INSERT INTO interested_in_options (team_id, label, order_index)
SELECT t.id, opt.label, opt.idx
FROM teams t
CROSS JOIN (VALUES
  ('Agent', 0),
  ('Admin/Staff', 1),
  ('ISA', 2)
) AS opt(label, idx)
ON CONFLICT DO NOTHING;

-- 4. Remove scorecard_visibility from users (keep column but we won't show it in profile)
-- Note: we keep the column for backward compat, just hide it from the profile form UI
