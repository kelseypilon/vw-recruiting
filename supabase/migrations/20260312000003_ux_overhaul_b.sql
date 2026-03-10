-- UX Overhaul B: Add private_notes and is_submitted to interview_scorecards

-- Add private_notes column for per-interviewer private notes
ALTER TABLE interview_scorecards
  ADD COLUMN IF NOT EXISTS private_notes text;

-- Add is_submitted boolean column (derived from submitted_at but convenient for queries)
ALTER TABLE interview_scorecards
  ADD COLUMN IF NOT EXISTS is_submitted boolean NOT NULL DEFAULT false;

-- Backfill is_submitted from submitted_at
UPDATE interview_scorecards
  SET is_submitted = true
  WHERE submitted_at IS NOT NULL AND is_submitted = false;

-- Add private_notes column to interview_guide_notes for per-user private notes
ALTER TABLE interview_guide_notes
  ADD COLUMN IF NOT EXISTS private_notes text;
