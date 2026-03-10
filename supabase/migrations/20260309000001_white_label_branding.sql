-- White-Label Branding: Add favicon_url column to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS favicon_url text;

-- Add branding fields to the settings API whitelist (handled in code, not DB)
