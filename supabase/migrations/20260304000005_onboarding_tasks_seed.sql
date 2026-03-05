-- =============================================================================
-- Section 9: Seed 14 Onboarding Tasks for VW Team + Clone for Reeves
-- =============================================================================

-- VW Team onboarding tasks (14 tasks covering the full new-agent onboarding)
insert into onboarding_tasks (team_id, title, owner_role, applies_to, timing, order_index, is_active)
values
  -- Day 1: Paperwork & Setup
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Sign Independent Contractor Agreement', 'admin', 'all', 'Day 1', 1, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Complete W-9 Tax Form', 'admin', 'all', 'Day 1', 2, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Set Up MLS Access & Credentials', 'admin', 'licensed', 'Day 1', 3, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Create Team Email Account', 'admin', 'all', 'Day 1', 4, true),

  -- Week 1: Systems & Tools
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'CRM Training & Account Setup (GHL)', 'leader', 'all', 'Week 1', 5, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Transaction Management Platform Setup', 'leader', 'all', 'Week 1', 6, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Order Business Cards & Name Badge', 'admin', 'all', 'Week 1', 7, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add to Team Communication Channels (Slack, GroupMe)', 'admin', 'all', 'Week 1', 8, true),

  -- Week 2: Training & Integration
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Complete Brand Guidelines & Marketing Orientation', 'leader', 'all', 'Week 2', 9, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Shadow Senior Agent on Showing or Listing Appointment', 'leader', 'all', 'Week 2', 10, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Set Up Professional Headshot Session', 'admin', 'all', 'Week 2', 11, true),

  -- Week 3-4: Ramp Up
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Complete DISC Assessment Review with Team Lead', 'leader', 'all', 'Week 3', 12, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Create Personal Agent Website / Landing Page', 'leader', 'all', 'Week 3', 13, true),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'First 30-Day Goal Setting Session with Team Lead', 'leader', 'all', 'Week 4', 14, true);

-- Reeves & Associates team onboarding tasks (same 14 tasks)
insert into onboarding_tasks (team_id, title, owner_role, applies_to, timing, order_index, is_active)
values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sign Independent Contractor Agreement', 'admin', 'all', 'Day 1', 1, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Complete W-9 Tax Form', 'admin', 'all', 'Day 1', 2, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Set Up MLS Access & Credentials', 'admin', 'licensed', 'Day 1', 3, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Create Team Email Account', 'admin', 'all', 'Day 1', 4, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CRM Training & Account Setup (GHL)', 'leader', 'all', 'Week 1', 5, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Transaction Management Platform Setup', 'leader', 'all', 'Week 1', 6, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Order Business Cards & Name Badge', 'admin', 'all', 'Week 1', 7, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Add to Team Communication Channels (Slack, GroupMe)', 'admin', 'all', 'Week 1', 8, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Complete Brand Guidelines & Marketing Orientation', 'leader', 'all', 'Week 2', 9, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Shadow Senior Agent on Showing or Listing Appointment', 'leader', 'all', 'Week 2', 10, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Set Up Professional Headshot Session', 'admin', 'all', 'Week 2', 11, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Complete DISC Assessment Review with Team Lead', 'leader', 'all', 'Week 3', 12, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Create Personal Agent Website / Landing Page', 'leader', 'all', 'Week 3', 13, true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'First 30-Day Goal Setting Session with Team Lead', 'leader', 'all', 'Week 4', 14, true);
