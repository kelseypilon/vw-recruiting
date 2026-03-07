-- Seed interviewer_question_selections for all team members
-- This gives every team member all active questions in their personal set by default
-- so they don't need to manually activate each question one by one.

INSERT INTO interviewer_question_selections (user_id, question_id)
SELECT u.id, q.id
FROM users u
CROSS JOIN interview_questions q
WHERE u.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210'
  AND q.is_active = true
ON CONFLICT DO NOTHING;
