-- Fix Leader role permissions for Reeves & Associates team
-- Ensures Leader role can see all nav items (Candidates, Interviews, Group Interviews,
-- Onboarding, Settings) and has correct default permissions.

UPDATE teams
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{role_permissions,Leader}',
  '{
    "view_candidates": true,
    "edit_candidates": true,
    "send_emails": true,
    "manage_interviews": true,
    "manage_settings": true,
    "view_reports": true,
    "manage_members": false,
    "manage_templates": false,
    "manage_scorecards": true,
    "manage_onboarding": true,
    "view_onboarding": true,
    "view_interview_notes": true
  }'::jsonb,
  true
)
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
