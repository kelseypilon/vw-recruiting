-- =============================================================================
-- Seed 5 fake candidates across pipeline stages
-- =============================================================================

insert into candidates (
  team_id, first_name, last_name, email, phone,
  role_applied, is_licensed, years_experience, transactions_2024,
  current_role, heard_about, stage,
  disc_d, disc_i, disc_s, disc_c,
  disc_primary, disc_secondary, disc_meets_threshold,
  aq_raw, aq_normalized, aq_tier,
  composite_score, composite_verdict,
  created_at
) values
-- 1. New Lead - recent, unscored
(
  '00000000-0000-0000-0000-000000000001',
  'Sarah', 'Martinez', 'sarah.martinez@gmail.com', '(480) 555-0101',
  'Buyer Agent', true, 2.5, 8,
  'Agent at Keller Williams', 'LinkedIn Ad', 'New Lead',
  null, null, null, null,
  null, null, null,
  null, null, null,
  null, null,
  now() - interval '2 days'
),
-- 2. Application Sent - partially scored
(
  '00000000-0000-0000-0000-000000000001',
  'Marcus', 'Johnson', 'mjohnson@outlook.com', '(602) 555-0142',
  'Listing Agent', true, 5.0, 18,
  'Solo Agent', 'Referral from Nick', 'Application Sent',
  62, 48, 30, 25,
  'D', 'I', true,
  72.50, 78.00, 'Strong',
  null, null,
  now() - interval '5 days'
),
-- 3. Under Review - fully scored, strong hire
(
  '00000000-0000-0000-0000-000000000001',
  'Jessica', 'Chen', 'jchen.realty@gmail.com', '(480) 555-0278',
  'Buyer Agent', true, 7.0, 24,
  'Team Lead at RE/MAX', 'Instagram', 'Under Review',
  45, 58, 35, 28,
  'I', 'D', true,
  85.30, 88.00, 'Elite',
  82.45, 'Strong Hire',
  now() - interval '8 days'
),
-- 4. Group Interview - fully scored, moderate
(
  '00000000-0000-0000-0000-000000000001',
  'David', 'Thompson', 'david.t.realestate@gmail.com', '(623) 555-0399',
  'Showing Agent', false, 0.5, 0,
  'Outside Sales Rep', 'Job Board', 'Group Interview',
  38, 42, 52, 32,
  'S', 'I', false,
  65.00, 68.50, 'Developing',
  64.20, 'Consider',
  now() - interval '12 days'
),
-- 5. Not a Fit - scored, below threshold
(
  '00000000-0000-0000-0000-000000000001',
  'Ashley', 'Rivera', 'arivera22@yahoo.com', '(520) 555-0417',
  'Buyer Agent', false, 0.0, 0,
  'Retail Manager', 'Walk-in', 'Not a Fit',
  20, 30, 55, 60,
  'C', 'S', false,
  42.00, 45.00, 'Developing',
  38.50, 'No Hire',
  now() - interval '20 days'
);
