-- Update Interview Invitation template with new content and merge tags
-- for the pre-send email preview flow
update email_templates
set
  subject = 'Your Interview with {{team_name}}',
  body = E'Hi {{first_name}},\n\nWe''re excited to move forward with you! You''ve been selected for a {{interview_type}} interview with {{leader_name}}.\n\nPlease use the link below to book a time that works for you:\n{{booking_link}}\n\nIf you have any questions in the meantime, don''t hesitate to reach out.\n\nLooking forward to connecting!\n\n{{team_name}}',
  merge_tags = '["first_name", "last_name", "interview_type", "leader_name", "booking_link", "team_name"]'::jsonb
where team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  and trigger = 'interview_scheduled';
