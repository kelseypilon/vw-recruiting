-- Add admin email fields to teams table
alter table teams
  add column if not exists admin_email text,
  add column if not exists admin_bcc boolean not null default true;

-- Add from_email to users table (for per-sender sending)
alter table users
  add column if not exists from_email text;

-- Seed 7 email templates for Vantage West team
insert into email_templates (team_id, name, trigger, subject, body, merge_tags, is_active)
values
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Application Received',
    'application_received',
    'Thanks for applying to {{team_name}}, {{first_name}}!',
    E'Hi {{first_name}},\n\nThank you for your interest in joining {{team_name}}! We''ve received your application and our team is reviewing it.\n\nWe''ll be in touch within the next few business days with next steps.\n\nBest regards,\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name"]'::jsonb,
    true
  ),
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Interview Invitation',
    'interview_scheduled',
    'Interview Scheduled — {{team_name}}',
    E'Hi {{first_name}},\n\nGreat news! We''d like to invite you to an interview with {{team_name}}.\n\nDetails:\n- Date: {{interview_date}}\n- Type: {{interview_type}}\n\nPlease confirm your availability by replying to this email.\n\nLooking forward to meeting you!\n\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name", "interview_date", "interview_type"]'::jsonb,
    true
  ),
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Group Interview Invite',
    'group_interview',
    'You''re Invited to a Group Interview — {{team_name}}',
    E'Hi {{first_name}},\n\nWe''re excited to invite you to our group interview session!\n\nDetails:\n- Date: {{group_interview_date}}\n- Zoom Link: {{zoom_link}}\n\nPlease join 5 minutes early and have your camera on. This is a great opportunity to learn about our team culture.\n\nSee you there!\n\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name", "group_interview_date", "zoom_link"]'::jsonb,
    true
  ),
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Offer Extended',
    'offer_extended',
    'Exciting News from {{team_name}}!',
    E'Hi {{first_name}},\n\nCongratulations! After careful consideration, we are thrilled to extend an offer for you to join {{team_name}}.\n\nWe believe you''ll be an incredible addition to our team. We''ll be sending over the formal offer details shortly.\n\nPlease don''t hesitate to reach out if you have any questions.\n\nWelcome aboard!\n\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name"]'::jsonb,
    true
  ),
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Rejection Notice',
    'rejection',
    'Update on Your Application — {{team_name}}',
    E'Hi {{first_name}},\n\nThank you for your interest in {{team_name}} and for taking the time to go through our process.\n\nAfter careful consideration, we''ve decided to move forward with other candidates at this time. This was a difficult decision as we had many strong applicants.\n\nWe encourage you to apply again in the future as new opportunities arise.\n\nWishing you the best,\n\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name"]'::jsonb,
    true
  ),
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Onboarding Welcome',
    'onboarding_started',
    'Welcome to {{team_name}}, {{first_name}}!',
    E'Hi {{first_name}},\n\nWelcome to the team! We''re so excited to have you on board at {{team_name}}.\n\nHere''s what to expect in your first week:\n1. Complete your onboarding checklist\n2. Meet the team\n3. Set up your accounts and tools\n\nYour onboarding coordinator will be reaching out shortly with more details.\n\nLet''s make great things happen!\n\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name"]'::jsonb,
    true
  ),
  (
    '9bdd061b-8f89-4d08-bf19-bed29d129210',
    'Follow-Up Check-In',
    'follow_up',
    'Checking In — {{team_name}}',
    E'Hi {{first_name}},\n\nI wanted to follow up and see how things are going with your application process.\n\nIf you have any questions about next steps or need any additional information, please don''t hesitate to reach out.\n\nLooking forward to hearing from you!\n\nBest,\n{{sender_name}}\n{{team_name}}',
    '["first_name", "last_name", "team_name", "sender_name"]'::jsonb,
    true
  )
on conflict do nothing;

-- Set admin email for the team
update teams
set admin_email = 'aj@vantagewestrealestate.com'
where id = '9bdd061b-8f89-4d08-bf19-bed29d129210';
