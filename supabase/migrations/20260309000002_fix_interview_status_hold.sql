-- Fix: Add 'hold' to interviews.status CHECK constraint
-- The scorecard modal's "Hold" flow and the notification endpoint both
-- require status = 'hold', but the original constraint only allowed
-- ('scheduled', 'completed', 'cancelled', 'no_show').

ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'hold'));

-- Fix: Make notifications_log.team_id NOT NULL (it's always provided)
ALTER TABLE notifications_log ALTER COLUMN team_id SET NOT NULL;

-- Add partial unique indexes to prevent duplicate notifications at the DB level
-- (handles race conditions when two notification runs overlap)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_log_unique_interview
  ON notifications_log(type, escalation_level, interview_id)
  WHERE interview_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_log_unique_candidate
  ON notifications_log(type, escalation_level, candidate_id)
  WHERE candidate_id IS NOT NULL;
