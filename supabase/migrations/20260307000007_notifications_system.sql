-- Part 1: Database changes for post-interview handoff + notification system

-- Users: escalation contact flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_escalation_contact boolean NOT NULL DEFAULT false;

-- Interviews: hold fields
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_reason text;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_follow_up_date date;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_set_at timestamptz;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS hold_escalation_level integer NOT NULL DEFAULT 0;

-- Candidates: kanban hold fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kanban_hold boolean NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kanban_hold_reason text;

-- Teams: notification threshold settings
ALTER TABLE teams ADD COLUMN IF NOT EXISTS threshold_stuck_days integer NOT NULL DEFAULT 7;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS threshold_scorecard_hours integer NOT NULL DEFAULT 24;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS threshold_escalation_hours integer NOT NULL DEFAULT 48;

-- Notifications log table
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
