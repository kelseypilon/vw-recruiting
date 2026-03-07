-- Add virtual/in-person booking URLs + meeting link to users
-- Add office_address to teams

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS virtual_booking_url text,
  ADD COLUMN IF NOT EXISTS inperson_booking_url text,
  ADD COLUMN IF NOT EXISTS virtual_meeting_link text;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS office_address text;

-- Migrate existing google_booking_url → virtual_booking_url for users who have it set
UPDATE users
SET virtual_booking_url = google_booking_url
WHERE google_booking_url IS NOT NULL AND google_booking_url != '';
