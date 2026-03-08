-- Group interview per-prompt scoring
CREATE TABLE IF NOT EXISTS group_interview_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES group_interview_sessions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES group_interview_prompts(id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (session_id, candidate_id, prompt_id, evaluator_user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_gi_scores_session ON group_interview_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_scores_candidate ON group_interview_scores(candidate_id);
