-- =============================================================================
-- VW Recruiting Platform - Seed Data
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TEAM
-- -----------------------------------------------------------------------------
insert into teams (id, name, slug, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'Vantage West Realty',
  'vantage-west',
  '{
    "timezone": "America/Phoenix",
    "disc_threshold": { "primary_min": 50, "secondary_min": 35 },
    "aq_thresholds": { "elite": 85, "strong": 70, "developing": 55 },
    "composite_thresholds": { "strong_hire": 80, "hire": 65, "consider": 50 }
  }'::jsonb
);

-- -----------------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------------
insert into users (id, team_id, email, name, role, permissions, receives_digest)
values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'aj@vantagewestrealty.com',
    'AJ',
    'owner',
    '{"can_edit_settings": true, "can_manage_users": true, "can_view_all": true, "can_delete": true}'::jsonb,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'nick@vantagewestrealty.com',
    'Nick',
    'leader',
    '{"can_edit_settings": false, "can_manage_users": false, "can_view_all": true, "can_delete": false}'::jsonb,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'krista@vantagewestrealty.com',
    'Krista',
    'leader',
    '{"can_edit_settings": false, "can_manage_users": false, "can_view_all": true, "can_delete": false}'::jsonb,
    true
  );

-- -----------------------------------------------------------------------------
-- PIPELINE STAGES
-- -----------------------------------------------------------------------------
insert into pipeline_stages (team_id, name, order_index, ghl_tag, color, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'New Lead',        1, 'new-lead',        '#6B7280', true),
  ('00000000-0000-0000-0000-000000000001', 'Application Sent',2, 'app-sent',        '#3B82F6', true),
  ('00000000-0000-0000-0000-000000000001', 'Under Review',    3, 'under-review',    '#8B5CF6', true),
  ('00000000-0000-0000-0000-000000000001', 'Group Interview', 4, 'group-interview', '#F59E0B', true),
  ('00000000-0000-0000-0000-000000000001', '1on1 Interview',  5, '1on1-interview',  '#EF4444', true),
  ('00000000-0000-0000-0000-000000000001', 'Offer',           6, 'offer',           '#10B981', true),
  ('00000000-0000-0000-0000-000000000001', 'Onboarding',      7, 'onboarding',      '#059669', true),
  ('00000000-0000-0000-0000-000000000001', 'Not a Fit',       8, 'not-a-fit',       '#DC2626', true);

-- -----------------------------------------------------------------------------
-- SCORING CRITERIA (19 criteria from spec)
-- -----------------------------------------------------------------------------
insert into scoring_criteria (team_id, name, weight_percent, min_threshold, order_index)
values
  -- Mindset & Drive (35%)
  ('00000000-0000-0000-0000-000000000001', 'Coachability & Humility',          8.00, 6.0,  1),
  ('00000000-0000-0000-0000-000000000001', 'Resilience & Grit',                7.00, 6.0,  2),
  ('00000000-0000-0000-0000-000000000001', 'Goal Orientation & Drive',         7.00, 6.0,  3),
  ('00000000-0000-0000-0000-000000000001', 'Growth Mindset',                   7.00, 5.0,  4),
  ('00000000-0000-0000-0000-000000000001', 'Accountability',                   6.00, 5.0,  5),

  -- Communication & People Skills (25%)
  ('00000000-0000-0000-0000-000000000001', 'Verbal Communication',             7.00, 6.0,  6),
  ('00000000-0000-0000-0000-000000000001', 'Active Listening',                 6.00, 5.0,  7),
  ('00000000-0000-0000-0000-000000000001', 'Emotional Intelligence',           6.00, 5.0,  8),
  ('00000000-0000-0000-0000-000000000001', 'Relationship Building',            6.00, 5.0,  9),

  -- Business Acumen & Real Estate Knowledge (20%)
  ('00000000-0000-0000-0000-000000000001', 'Market Awareness',                 5.00, null, 10),
  ('00000000-0000-0000-0000-000000000001', 'Sales Process Understanding',      5.00, 5.0,  11),
  ('00000000-0000-0000-0000-000000000001', 'Financial Literacy',               5.00, null, 12),
  ('00000000-0000-0000-0000-000000000001', 'Tech Savviness',                   5.00, null, 13),

  -- Culture & Team Fit (12%)
  ('00000000-0000-0000-0000-000000000001', 'Mission & Values Alignment',       4.00, 5.0,  14),
  ('00000000-0000-0000-0000-000000000001', 'Collaboration',                    4.00, 5.0,  15),
  ('00000000-0000-0000-0000-000000000001', 'Professionalism',                  4.00, 5.0,  16),

  -- Execution & Structure (8%)
  ('00000000-0000-0000-0000-000000000001', 'Follow-through & Reliability',     3.00, 5.0,  17),
  ('00000000-0000-0000-0000-000000000001', 'Time Management & Organization',   3.00, null, 18),
  ('00000000-0000-0000-0000-000000000001', 'Commitment to Long-term Success',  2.00, null, 19);
