-- =============================================================================
-- INTERVIEW SCORECARD + GROUP INTERVIEW SYSTEM
-- Run in Supabase SQL Editor after 20260305000004_onboarding_rebuild.sql
-- =============================================================================

-- ─── 1A: ALTER interview_questions ─────────────────────────────────────────────
-- Existing columns: id, team_id, question_text, category, default_leader_id, is_active, order_index
-- Rename default_leader_id → user_id (null = shared team question)
ALTER TABLE interview_questions
  RENAME COLUMN default_leader_id TO user_id;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS interviewer_note text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─── 1B: interviewer_question_selections ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviewer_question_selections (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, question_id)
);

-- ─── 1C: interview_scorecards ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_scorecards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id        uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  interviewer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id        uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  answers             jsonb NOT NULL DEFAULT '[]'::jsonb,
  category_scores     jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score       numeric(3,2),
  recommendation      text,           -- 'strong_yes' | 'yes' | 'hold' | 'no'
  summary_notes       text,
  submitted_at        timestamptz,    -- NULL = draft, set = submitted (locked)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id, interviewer_user_id)
);

CREATE INDEX IF NOT EXISTS interview_scorecards_candidate_idx
  ON interview_scorecards(candidate_id);
CREATE INDEX IF NOT EXISTS interview_scorecards_interview_idx
  ON interview_scorecards(interview_id);

-- ─── 1D: group_interview_sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_interview_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title        text NOT NULL,
  session_date timestamptz,
  zoom_link    text,
  summary      text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 1E: group_interview_candidates (join table) ──────────────────────────────
CREATE TABLE IF NOT EXISTS group_interview_candidates (
  session_id   uuid NOT NULL REFERENCES group_interview_sessions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, candidate_id)
);

-- ─── 1F: group_interview_notes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_interview_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES group_interview_sessions(id) ON DELETE CASCADE,
  candidate_id    uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  author_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  note_text       text NOT NULL DEFAULT '',
  mentioned_ids   uuid[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_interview_notes_session_idx
  ON group_interview_notes(session_id);

-- ─── 1G: ALTER users + candidates ──────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS scorecard_visibility text NOT NULL DEFAULT 'after_submit';

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS interview_score numeric(3,2);

-- ─── 1H: Seed interview questions for VW team ─────────────────────────────────
-- Delete any existing VW questions first (clean slate)
DELETE FROM interview_questions
  WHERE team_id = '9bdd061b-8f89-4d08-bf19-bed29d129210';

-- Timeline & Rapport (5 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Timeline & Rapport',
   'Where did you grow up? Walk me through your life story from high school to now.', 1, true, 1),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Timeline & Rapport',
   'What did you do after high school? What was your first job?', 2, true, 2),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Timeline & Rapport',
   'What year did you get into real estate? How was your first year?', 3, true, 3),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Timeline & Rapport',
   'What are you most proud of in the business you''ve built?', 4, true, 4),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Timeline & Rapport',
   'What do you see as the biggest missing piece right now?', 5, true, 5);

-- Values - Joy (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Joy',
   'Everyone has a unique way of adding a spark of joy to their team. How would you describe your style, and can you give an example?', 1, true, 6),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Joy',
   'Can you share a moment that was challenging yet somehow turned into a positive experience? How did you contribute to that outcome?', 2, true, 7),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Joy',
   'Tell me about a day when things didn''t go as planned and how you turned it around — not just for yourself but for your team.', 3, true, 8);

-- Values - Ownership (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Ownership',
   'Describe a situation where you identified a problem at work before anyone else. What steps did you take?', 1, true, 9),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Ownership',
   'Share an example of a time when a project didn''t go as planned due to factors outside your control. How did you respond?', 2, true, 10),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Ownership',
   'Tell me about a goal that required significant effort or change. How did you achieve it, and what motivated you?', 3, true, 11);

-- Values - Grit (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Grit',
   'Tell me about a significant challenge or setback in your career. How did you deal with it and what kept you going?', 1, true, 12),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Grit',
   'Describe a long-term goal you worked on. How did you maintain focus when progress was slow?', 2, true, 13),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Values - Grit',
   'Share an experience where you had to go above and beyond to learn a new skill or adapt.', 3, true, 14);

-- Coachability (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Coachability',
   'How do you seek out feedback, and can you share how you''ve implemented a piece of advice recently?', 1, true, 15),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Coachability',
   'Describe a learning experience from a mentor that significantly influenced your work.', 2, true, 16),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Coachability',
   'Tell me about feedback that was challenging to accept. How did you respond and what was the outcome?', 3, true, 17);

-- Curiosity (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Curiosity',
   'What''s something new you''ve learned in real estate recently and how did you apply it?', 1, true, 18),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Curiosity',
   'How do you stay ahead in your industry? Give an example of how this knowledge benefited you.', 2, true, 19),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Curiosity',
   'What book are you currently reading? What were the last 2 books?', 3, true, 20);

-- Work Ethic (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Work Ethic',
   'What does your current morning routine look like? Walk me through a typical workday.', 1, true, 21),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Work Ethic',
   'Give an example of a time you worked under extreme pressure. How did you handle it?', 2, true, 22),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Work Ethic',
   'Share a time you went above and beyond what was expected. What motivated you?', 3, true, 23);

-- Intelligence (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Intelligence',
   'Discuss a project where you had to apply analytical skills to achieve success.', 1, true, 24),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Intelligence',
   'Would you describe yourself as more book smart or street smart?', 2, true, 25),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Intelligence',
   'What would you say is your unique genius? Bottom third, mid pack, or top third?', 3, true, 26);

-- Prior Success (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Prior Success',
   'Tell me about a time you exceeded sales targets. What strategies did you use?', 1, true, 27),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Prior Success',
   'What accomplishment are you most proud of professionally, and why?', 2, true, 28),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Prior Success',
   'Describe a professional challenge you overcame that you initially thought was out of your reach.', 3, true, 29);

-- Passion (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Passion',
   'What aspect of working in real estate excites you most, and why?', 1, true, 30),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Passion',
   'How do you maintain enthusiasm during tough times?', 2, true, 31),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Passion',
   'What drives you professionally and how do you stay passionate?', 3, true, 32);

-- Adaptability (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Adaptability',
   'Tell me about a time an unexpected market change affected your work. How did you adapt?', 1, true, 33),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Adaptability',
   'How do you adjust your sales strategy in response to customer feedback or market trends?', 2, true, 34),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Adaptability',
   'Share a time you had to adapt quickly to a change at work.', 3, true, 35);

-- Emotional Intelligence (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Emotional Intelligence',
   'How do you navigate workplace conflicts while maintaining positive relationships?', 1, true, 36),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Emotional Intelligence',
   'Describe a situation where your empathy led to a breakthrough in communication.', 2, true, 37),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Emotional Intelligence',
   'Describe a time you managed a highly emotional situation at work. How did you handle it?', 3, true, 38);

-- Resilience (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Resilience',
   'After a setback, how do you reassess and move forward?', 1, true, 39),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Resilience',
   'What strategies do you use to stay motivated during prolonged challenges?', 2, true, 40),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Resilience',
   'Describe a situation where you faced significant failure. How did you overcome it?', 3, true, 41);

-- Confidence (3 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Confidence',
   'How do you prepare to feel confident in new or challenging situations?', 1, true, 42),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Confidence',
   'Give an example of a time your confidence significantly impacted a positive outcome.', 2, true, 43),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Confidence',
   'How do you maintain confidence under pressure or in unfamiliar situations?', 3, true, 44);

-- Closing (5 questions)
INSERT INTO interview_questions (team_id, user_id, category, question_text, sort_order, is_active, order_index)
VALUES
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Closing',
   'What do our values mean to you? (RESULTS, WORLD-CLASS, TEAMWORK, JOY, CLIENT FIRST, OWNERSHIP, MASTERY)', 1, true, 45),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Closing',
   'If we were having this conversation a year from now and you were really happy — what would have to have happened personally and professionally?', 2, true, 46),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Closing',
   'At what lengths are you willing to go to make that happen?', 3, true, 47),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Closing',
   'How do you feel about accountability and how it contributes to business success?', 4, true, 48),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', NULL, 'Closing',
   'What questions do you have for us?', 5, true, 49);

-- ─── 1I: Seed interview tips in teams.settings ─────────────────────────────────
UPDATE teams
SET settings = settings || '{
  "interview_tips": [
    "Build Rapport Early — Start with light open-ended questions to make the candidate comfortable.",
    "Use Behavioral Interview Techniques — Ask candidates to describe past experiences and how they handled specific situations.",
    "Listen Actively — Nod, maintain eye contact, summarize their points to show understanding.",
    "Create a No-Right-Answer Environment — Emphasize there are no right or wrong answers to reduce anxiety.",
    "Follow-Up for Depth — Ask follow-up questions to dive deeper into initial responses.",
    "Share Your Experiences — Brief personal shares can encourage candidates to open up.",
    "Use the Silence Technique — After a candidate answers, don''t rush to fill silence — let them expand.",
    "Avoid Leading Questions — Frame questions so they don''t lead the candidate to a particular answer.",
    "Observe Non-Verbal Cues — Body language often reveals confidence, passion, and resilience.",
    "Encourage Reflection — Ask candidates to reflect on experiences and how they''ve grown.",
    "Close Positively — End on a positive note, thanking the candidate for their time."
  ]
}'::jsonb
WHERE id = '9bdd061b-8f89-4d08-bf19-bed29d129210';
