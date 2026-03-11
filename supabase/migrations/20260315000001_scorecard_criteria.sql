-- Add criterion column for rubric-based scoring (separate from prompt scoring)
ALTER TABLE group_interview_scores ADD COLUMN IF NOT EXISTS criterion text;

-- Allow prompt_id to be null so criteria scores can exist without a prompt
ALTER TABLE group_interview_scores ALTER COLUMN prompt_id DROP NOT NULL;

-- Unique index for criteria-based scores (used by upsert onConflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gi_scores_criteria_unique
  ON group_interview_scores(session_id, candidate_id, criterion, evaluator_user_id)
  WHERE criterion IS NOT NULL;
