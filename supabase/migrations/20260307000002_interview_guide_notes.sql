-- Interview Guide Notes
-- Per-question notes written during the Interview Guide sub-tab.
-- Separate from scorecards — these are conversation notes, not ratings.

CREATE TABLE IF NOT EXISTS interview_guide_notes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_text    text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),

  UNIQUE(candidate_id, question_id, author_user_id)
);

CREATE INDEX IF NOT EXISTS guide_notes_candidate_idx
  ON interview_guide_notes(candidate_id);

CREATE INDEX IF NOT EXISTS guide_notes_question_idx
  ON interview_guide_notes(question_id);
