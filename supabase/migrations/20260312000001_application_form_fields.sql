-- Add custom_fields jsonb column to candidates for storing non-standard form data
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';

-- Seed default application form fields into teams.settings for the Vantage West team
-- Other teams will get defaults on first access via the API
UPDATE teams
SET settings = jsonb_set(
  COALESCE(settings, '{}'),
  '{application_form_fields}',
  '[
    {"id": "first_name", "label": "First Name", "type": "text", "required": true, "locked": true, "order": 0},
    {"id": "last_name", "label": "Last Name", "type": "text", "required": true, "locked": true, "order": 1},
    {"id": "email", "label": "Email", "type": "email", "required": true, "locked": true, "order": 2},
    {"id": "phone", "label": "Phone", "type": "tel", "required": true, "locked": false, "order": 3},
    {"id": "city", "label": "City / Location", "type": "text", "required": true, "locked": false, "order": 4},
    {"id": "years_experience", "label": "Years of Experience", "type": "select", "required": true, "locked": false, "order": 5, "options": ["0-1", "1-3", "3-5", "5-10", "10+"]},
    {"id": "currently_licensed", "label": "Do you have a real estate license?", "type": "boolean", "required": false, "locked": false, "order": 6},
    {"id": "license_number", "label": "License Number", "type": "text", "required": false, "locked": false, "order": 7, "conditionalOn": "currently_licensed"},
    {"id": "referral_source", "label": "How did you hear about us?", "type": "select", "required": false, "locked": false, "order": 8, "options": ["Referral", "Social Media", "Job Board", "Website", "Other"]},
    {"id": "hours_per_week", "label": "Hours per week you can commit?", "type": "select", "required": true, "locked": false, "order": 9, "options": ["20-30", "30-40", "40-50", "50+"]},
    {"id": "why_real_estate", "label": "Why do you want to be in real estate?", "type": "textarea", "required": true, "locked": false, "order": 10},
    {"id": "why_vantage", "label": "Why this company specifically?", "type": "textarea", "required": true, "locked": false, "order": 11},
    {"id": "biggest_achievement", "label": "What is your biggest professional achievement?", "type": "textarea", "required": true, "locked": false, "order": 12},
    {"id": "one_year_goal", "label": "Where do you want to be in 1 year?", "type": "textarea", "required": true, "locked": false, "order": 13},
    {"id": "interested_in", "label": "Interested In", "type": "interested_in", "required": false, "locked": false, "order": 14}
  ]'::jsonb
)
WHERE slug = 'vantage-west';
