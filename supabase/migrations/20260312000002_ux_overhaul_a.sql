-- Fix 1: Missing DB columns for UX Overhaul A
-- resume_url and resume_filename on candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_filename text;

-- licensed_status on candidates (Yes / No / In Course)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS licensed_status text;

-- meeting_link on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_link text;

-- Ensure office_address exists on teams (may already exist from prior migration)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS office_address text;
