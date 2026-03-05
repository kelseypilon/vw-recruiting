-- =============================================================================
-- Section 8: Reeves & Associates Team + Data
-- =============================================================================

-- Team
insert into teams (id, name, slug, settings, admin_email, admin_bcc)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Reeves & Associates',
  'reeves-associates',
  '{
    "timezone": "America/Phoenix",
    "disc_threshold": { "primary_min": 50, "secondary_min": 35 },
    "aq_thresholds": { "elite": 85, "strong": 70, "developing": 55 },
    "composite_thresholds": { "strong_hire": 80, "hire": 65, "consider": 50 }
  }'::jsonb,
  'erin@reevesassociates.com',
  true
) on conflict (id) do nothing;

-- Users
insert into users (id, team_id, email, name, role, permissions, receives_digest)
values
  (
    'a1b2c3d4-0000-0000-0000-000000000010',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'erin@reevesassociates.com',
    'Erin Reeves',
    'owner',
    '{"can_edit_settings": true, "can_manage_users": true, "can_view_all": true, "can_delete": true}'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0000-0000-0000-000000000011',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'mike@reevesassociates.com',
    'Mike Reeves',
    'leader',
    '{"can_edit_settings": false, "can_manage_users": false, "can_view_all": true, "can_delete": false}'::jsonb,
    true
  )
on conflict (id) do nothing;

-- Pipeline Stages (same structure, new team)
insert into pipeline_stages (team_id, name, order_index, ghl_tag, color, is_active)
values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'New Lead',        1, 'new-lead',        '#6B7280', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Application Sent',2, 'app-sent',        '#3B82F6', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Under Review',    3, 'under-review',    '#8B5CF6', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group Interview', 4, 'group-interview', '#F59E0B', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1on1 Interview',  5, '1on1-interview',  '#EF4444', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Offer',           6, 'offer',           '#10B981', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Onboarding',      7, 'onboarding',      '#059669', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Not a Fit',       8, 'not-a-fit',       '#DC2626', true);

-- Scoring Criteria (clone from VW)
insert into scoring_criteria (team_id, name, weight_percent, min_threshold, order_index)
values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Coachability & Humility',          8.00, 6.0,  1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Resilience & Grit',                7.00, 6.0,  2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Goal Orientation & Drive',         7.00, 6.0,  3),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Growth Mindset',                   7.00, 5.0,  4),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Accountability',                   6.00, 5.0,  5),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Verbal Communication',             7.00, 6.0,  6),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Active Listening',                 6.00, 5.0,  7),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Emotional Intelligence',           6.00, 5.0,  8),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Relationship Building',            6.00, 5.0,  9),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Market Awareness',                 5.00, null, 10),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sales Process Understanding',      5.00, 5.0,  11),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Financial Literacy',               5.00, null, 12),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tech Savviness',                   5.00, null, 13),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Mission & Values Alignment',       4.00, 5.0,  14),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Collaboration',                    4.00, 5.0,  15),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Professionalism',                  4.00, 5.0,  16),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Follow-through & Reliability',     3.00, 5.0,  17),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Time Management & Organization',   3.00, null, 18),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Commitment to Long-term Success',  2.00, null, 19);

-- Email Templates (clone from VW)
insert into email_templates (team_id, name, trigger, subject, body, merge_tags, is_active)
values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Application Received', 'application_received',
   'Thanks for applying, {{first_name}}!',
   E'Hi {{first_name}},\n\nThank you for your interest in joining Reeves & Associates! We''ve received your application and our team is reviewing it.\n\nWe''ll be in touch within the next few business days with next steps.\n\nBest,\n{{sender_name}}\nReeves & Associates',
   ARRAY['first_name','last_name','sender_name','team_name'], true),

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Interview Invitation', 'interview_scheduled',
   'Interview Invitation — Reeves & Associates',
   E'Hi {{first_name}},\n\nWe''d love to learn more about you! We''re inviting you to interview with our team.\n\nPlease let us know your availability and we''ll get something scheduled.\n\nLooking forward to meeting you,\n{{sender_name}}',
   ARRAY['first_name','last_name','sender_name','team_name'], true),

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Group Interview Invite', 'group_interview',
   'You''re Invited — Group Interview at Reeves & Associates',
   E'Hi {{first_name}},\n\nCongratulations on making it to our group interview round!\n\nPlease join us for our upcoming group session. Details will be shared shortly.\n\nSee you there,\n{{sender_name}}',
   ARRAY['first_name','last_name','sender_name','team_name'], true),

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Offer Extended', 'offer_extended',
   'Welcome to the Team, {{first_name}}!',
   E'Hi {{first_name}},\n\nWe''re thrilled to extend an offer for you to join Reeves & Associates!\n\nWe believe you''ll be a fantastic addition to our team. Let''s schedule a time to go over the details.\n\nCongratulations,\n{{sender_name}}',
   ARRAY['first_name','last_name','sender_name','team_name'], true),

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Rejection Notice', 'rejection',
   'Update on Your Application — Reeves & Associates',
   E'Hi {{first_name}},\n\nThank you for taking the time to interview with Reeves & Associates. After careful consideration, we''ve decided to move forward with other candidates at this time.\n\nWe wish you the very best in your career.\n\nSincerely,\n{{sender_name}}',
   ARRAY['first_name','last_name','sender_name','team_name'], true),

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Onboarding Welcome', 'onboarding_start',
   'Welcome Aboard, {{first_name}}!',
   E'Hi {{first_name}},\n\nWelcome to Reeves & Associates! We''re excited to have you on the team.\n\nYou''ll be receiving onboarding materials shortly. In the meantime, please don''t hesitate to reach out with any questions.\n\nWelcome aboard,\n{{sender_name}}',
   ARRAY['first_name','last_name','sender_name','team_name'], true),

  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Follow-Up Check-In', null,
   'Checking In — {{first_name}}',
   E'Hi {{first_name}},\n\nJust checking in to see how things are going. We want to make sure you have everything you need.\n\nFeel free to reach out anytime.\n\nBest,\n{{sender_name}}',
   ARRAY['first_name','last_name','sender_name','team_name'], true);

-- Seed a couple candidates for Reeves team
insert into candidates (team_id, first_name, last_name, email, phone, role_applied, stage, is_licensed, years_experience, created_at)
values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Rachel', 'Adams', 'rachel.adams@email.com', '(480) 555-9012', 'Buyer''s Agent', 'New Lead', true, 3, now() - interval '1 day'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tom', 'Bradley', 'tom.bradley@email.com', '(602) 555-3456', 'Listing Agent', 'Under Review', true, 7, now() - interval '6 days'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Nina', 'Castillo', 'nina.castillo@email.com', '(480) 555-7890', 'Buyer''s Agent', 'Application Sent', false, 0, now() - interval '3 days');
