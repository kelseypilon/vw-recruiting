-- GHL Tags + Stage Protection
-- Sets ghl_tags on interview stages and adds is_protected column

-- ── 1. Add is_protected column to pipeline_stages ────────────────────
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

-- ── 2. Standardize ghl_tags to vw_ prefix ───────────────────────────
-- Update existing tags to use vw_ prefix for consistency
UPDATE pipeline_stages SET ghl_tag = 'vw_new_lead'
  WHERE ghl_tag = 'new-lead';
UPDATE pipeline_stages SET ghl_tag = 'vw_app_sent'
  WHERE ghl_tag = 'app-sent';
UPDATE pipeline_stages SET ghl_tag = 'vw_under_review'
  WHERE ghl_tag = 'under-review';
UPDATE pipeline_stages SET ghl_tag = 'vw_group_interview'
  WHERE ghl_tag = 'group-interview'
    OR (name ILIKE '%group%' AND (ghl_tag IS NULL OR ghl_tag = ''));
UPDATE pipeline_stages SET ghl_tag = 'vw_1on1_interview'
  WHERE ghl_tag = '1on1-interview'
    OR (name ILIKE '%1%1%' AND (ghl_tag IS NULL OR ghl_tag = ''));
UPDATE pipeline_stages SET ghl_tag = 'vw_offer'
  WHERE ghl_tag = 'offer';
UPDATE pipeline_stages SET ghl_tag = 'vw_onboarding'
  WHERE ghl_tag = 'onboarding';
UPDATE pipeline_stages SET ghl_tag = 'vw_not_fit'
  WHERE ghl_tag = 'not-a-fit';
UPDATE pipeline_stages SET ghl_tag = 'vw_hired'
  WHERE ghl_tag = 'hired';

-- ── 3. Mark protected stages ─────────────────────────────────────────
UPDATE pipeline_stages SET is_protected = true
  WHERE ghl_tag IN ('vw_new_lead', 'vw_1on1_interview', 'vw_group_interview', 'vw_onboarding', 'vw_not_fit');
