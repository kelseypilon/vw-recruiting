-- =============================================================================
-- ONBOARDING REBUILD: Schema changes, reseed tasks, new email templates
-- =============================================================================

-- ─── 1A: Add new columns to onboarding_tasks ────────────────────────────────
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS hire_type text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS done_by text,
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS email_template_key text,
  ADD COLUMN IF NOT EXISTS notes text;

-- ─── 1B: Add hire_type to candidates ────────────────────────────────────────
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hire_type text;

-- ─── 1C: Delete old VW tasks (cascades to candidate_onboarding) ─────────────
DELETE FROM onboarding_tasks
WHERE team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210';

-- ─── 1D: Insert new VW onboarding tasks (~67 tasks) ────────────────────────

-- STAGE 1 — HIRING (done_by: VP Ops)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, email_template_key, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Expectation Email & LOI', 'agent', 'stage_1_hiring', 'VP Ops', 'email', 'expectation_email', 1, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Letter of Intent', 'agent', 'stage_1_hiring', 'VP Ops', 'email', 'letter_of_intent', 2, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Signed Position Agreement', 'both', 'stage_1_hiring', 'VP Ops', 'manual', NULL, 3, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'New Agent/Employee Detail Form', 'both', 'stage_1_hiring', 'VP Ops', 'manual', NULL, 4, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Training with AJ/Nick/Krista (approx 6 weeks)', 'agent', 'stage_1_hiring', 'VP Ops', 'manual', NULL, 5, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Email to Team — New Hire!', 'both', 'stage_1_hiring', 'VP Ops', 'email', 'team_new_hire', 6, true, 'admin');

-- STAGE 2 — LEADERSHIP PRE-ONBOARDING (done_by: VP Ops / Admin)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, email_template_key, notes, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Intro Phone Call to new Agent/Employee', 'both', 'stage_2_leadership', 'VP Ops', 'manual', NULL, NULL, 7, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Intro Email to new Agent/Employee', 'both', 'stage_2_leadership', 'VP Ops', 'email', 'intro_email_new_agent', 'Attach BCFSA, AIR Package, Policy Manual, FINTRAC', 8, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Intro Email to admin/team (book boardroom)', 'both', 'stage_2_leadership', 'VP Ops', 'email', 'intro_email_admin_team', NULL, 9, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Email to AJ/Nick — add to next Zoom meeting', 'both', 'stage_2_leadership', 'VP Ops', 'email', 'zoom_meeting_notify', NULL, 10, true, 'admin');

-- STAGE 3 — ACCOUNT SET UP (done_by: Makenna / Admin)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, action_url, email_template_key, notes, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Gmail / Google Workspace', 'both', 'stage_3_accounts', 'Makenna', 'external_link', 'https://admin.google.com', NULL, NULL, 11, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Google Calendar — invite to appropriate meetings', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 12, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Google Business Manager', 'agent', 'stage_3_accounts', 'Makenna', 'external_link', NULL, NULL, NULL, 13, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Google Drive — shared drives + agent folder', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 14, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Google Groups', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 15, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Follow Up Boss', 'both', 'stage_3_accounts', 'Makenna', 'external_link', 'https://app.followupboss.com', NULL, NULL, 16, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'MyLTSA', 'both', 'stage_3_accounts', 'Makenna', 'external_link', 'https://apps.ltsa.ca/login', NULL, NULL, 17, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Open to Close (OTC)', 'both', 'stage_3_accounts', 'Makenna', 'external_link', NULL, NULL, NULL, 18, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Teachable — Add New User', 'both', 'stage_3_accounts', 'Makenna', 'external_link', NULL, NULL, 'FLAG: integrate with Teachable API later', 19, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Zoom', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 20, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Docusign', 'agent', 'stage_3_accounts', 'Makenna', 'external_link', NULL, NULL, NULL, 21, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Bomb Bomb', 'agent', 'stage_3_accounts', 'Makenna', 'external_link', 'https://login.bombbomb.com/', NULL, NULL, 22, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Skyslope', 'employee', 'stage_3_accounts', 'Makenna', 'external_link', NULL, NULL, NULL, 23, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Canva', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 24, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Adobe', 'employee', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 25, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Slack', 'employee', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 26, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Really Trusted', 'both', 'stage_3_accounts', 'Makenna', 'external_link', 'https://app.reallytrusted.com/registrations/new', NULL, NULL, 27, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Eli Report', 'both', 'stage_3_accounts', 'Makenna', 'external_link', NULL, NULL, NULL, 28, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', '1Password', 'employee', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 29, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Float', 'employee', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 30, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Sentrikey', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 31, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Matrix', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 32, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Lonewolf (payroll)', 'employee', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 33, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Matterport', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, NULL, 34, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Whatsapp Groups', 'both', 'stage_3_accounts', 'Makenna', 'manual', NULL, NULL, 'Family Main, Banter, After Hours Leads, Coming Soon, PM/Sales, Open House', 35, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Send Welcome Email with all passwords', 'both', 'stage_3_accounts', 'Makenna', 'email', NULL, 'onboarding_started', NULL, 36, true, 'admin');

-- STAGE 3 — OTHER TASKS (done_by: Admin / Front Desk / Krista)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, notes, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Order Atomic Habits Book', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 37, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Printer/Scanner Set Up', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 38, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Order Office Keys/Building FOB/Bathroom Key', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 39, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add to VW Contacts List', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 40, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add Birthday to Calendar', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 41, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Order Temporary Business Cards', 'agent', 'stage_3_accounts', 'Admin', 'manual', NULL, 42, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add name to Team Meeting Presentations in Drive', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 43, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Notify Answering Service', 'both', 'stage_3_accounts', 'Admin', 'manual', 'Phone 1-800-667-7588', 44, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add to Team Email Lists', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 45, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add/Remove from Birthday & Celebration List', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 46, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Book Contracts/Compliance Sitdown', 'both', 'stage_3_accounts', 'Krista', 'manual', NULL, 47, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Tracking Spreadsheet — Add to Validation Tab', 'agent', 'stage_3_accounts', 'Admin', 'manual', NULL, 48, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Inform of parking rules', 'both', 'stage_3_accounts', 'Admin', 'manual', NULL, 49, true, 'admin');

-- STAGE 4 — OFFICE ONBOARDING (done_by: Front Desk)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, notes, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Office Walkthrough & Intro to team members', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 50, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Kitchen run through (advise on clean up standards)', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 51, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Printer Tutorial', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 52, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Wifi Password — Teamwork', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 53, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Boardroom 101', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 54, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Drop Desk set up', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 55, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Book Headshot with Sheldon', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 56, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Create Email Signature (temporary, update after headshot)', 'agent', 'stage_4_office', 'Front Desk', 'manual', NULL, 57, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Notify AJ''s EA — schedule VTO meeting 4 weeks after start', 'both', 'stage_4_office', 'Front Desk', 'manual', NULL, 58, true, 'admin');

-- STAGE 5 — AFTER HEADSHOTS (done_by: Front Desk / VP Ops)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Add headshot & bio to VW Website', 'both', 'stage_5_headshots', 'Front Desk', 'manual', 59, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Update Meet the CX Team Presentation Slide & Handout', 'employee', 'stage_5_headshots', 'VP Ops', 'manual', 60, true, 'admin');

-- STAGE 6 — PAYROLL (done_by: VP Ops)
INSERT INTO onboarding_tasks (team_id, title, hire_type, stage, done_by, action_type, order_index, is_active, owner_role)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Collect: New Agent/Employee Detail Form, Void Cheque/Direct Deposit Form', 'both', 'stage_6_payroll', 'VP Ops', 'manual', 61, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'BCFSA Application for Representatives', 'agent', 'stage_6_payroll', 'VP Ops', 'manual', 62, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'License Transfer Form (if applicable)', 'agent', 'stage_6_payroll', 'VP Ops', 'manual', 63, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Association of Interior Realtors Package', 'agent', 'stage_6_payroll', 'VP Ops', 'manual', 64, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Signed Policy and Procedure Manual', 'agent', 'stage_6_payroll', 'VP Ops', 'manual', 65, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Signed VW FINTRAC Policy Manual', 'agent', 'stage_6_payroll', 'VP Ops', 'manual', 66, true, 'admin'),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Lonewolf payroll set up', 'employee', 'stage_6_payroll', 'VP Ops', 'manual', 67, true, 'admin');

-- ─── 1E: Insert placeholder email templates for new trigger keys ────────────
INSERT INTO email_templates (team_id, name, trigger, subject, body, merge_tags, is_active)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Expectation Email & LOI', 'expectation_email',
   'Expectations & Letter of Intent — {{team_name}}',
   E'Hi {{first_name}},\n\nPlease find attached the Expectation Email and Letter of Intent for your review.\n\nIf you have any questions, don''t hesitate to reach out.\n\nBest,\n{{sender_name}}\n{{team_name}}',
   '["first_name","last_name","team_name","sender_name"]'::jsonb, true),

  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Letter of Intent', 'letter_of_intent',
   'Letter of Intent — {{team_name}}',
   E'Hi {{first_name}},\n\nPlease find attached the Letter of Intent for your review and signature.\n\nLooking forward to having you on the team!\n\nBest,\n{{sender_name}}\n{{team_name}}',
   '["first_name","last_name","team_name","sender_name"]'::jsonb, true),

  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Team New Hire Announcement', 'team_new_hire',
   'New Hire Announcement — {{first_name}} {{last_name}}',
   E'Team,\n\nPlease join me in welcoming {{first_name}} {{last_name}} to {{team_name}}!\n\nMore details to follow.\n\nBest,\n{{sender_name}}',
   '["first_name","last_name","team_name","sender_name"]'::jsonb, true),

  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Intro Email to New Agent/Employee', 'intro_email_new_agent',
   'Welcome! Introduction from {{team_name}}',
   E'Hi {{first_name}},\n\nWelcome to {{team_name}}! We are so excited to have you join us.\n\nPlease find attached the following documents for your review:\n- BCFSA Information\n- AIR Package\n- Policy Manual\n- FINTRAC Policy\n\nPlease review these before your first day. Don''t hesitate to reach out with any questions.\n\nBest,\n{{sender_name}}\n{{team_name}}',
   '["first_name","last_name","team_name","sender_name"]'::jsonb, true),

  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Intro Email to Admin/Team', 'intro_email_admin_team',
   'New Team Member Starting — Please Book Boardroom',
   E'Team,\n\n{{first_name}} {{last_name}} will be starting soon. Please book the boardroom for their orientation.\n\nThanks,\n{{sender_name}}',
   '["first_name","last_name","team_name","sender_name"]'::jsonb, true),

  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Zoom Meeting Notification', 'zoom_meeting_notify',
   'Please Add {{first_name}} {{last_name}} to Next Zoom Meeting',
   E'Hi,\n\nPlease add {{first_name}} {{last_name}} to the next team Zoom meeting.\n\nThanks,\n{{sender_name}}',
   '["first_name","last_name","team_name","sender_name"]'::jsonb, true)

ON CONFLICT DO NOTHING;
