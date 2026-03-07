-- Add branding columns to teams table for SaaS / white-label support
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS branding_mode text NOT NULL DEFAULT 'vantage'
    CHECK (branding_mode IN ('vantage', 'white_label', 'custom')),
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#1c759e',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text NOT NULL DEFAULT '#272727',
  ADD COLUMN IF NOT EXISTS brand_show_powered_by boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slug text;

-- Create unique index on slug for public team-branding lookups
CREATE UNIQUE INDEX IF NOT EXISTS teams_slug_idx ON teams(slug) WHERE slug IS NOT NULL;

-- Seed existing Vantage West team (assumes slug matches)
UPDATE teams
SET branding_mode = 'vantage',
    brand_name = 'Vantage West Realty',
    brand_primary_color = '#1c759e',
    brand_secondary_color = '#272727',
    brand_show_powered_by = false,
    slug = 'vantage-west'
WHERE name ILIKE '%vantage%west%';
