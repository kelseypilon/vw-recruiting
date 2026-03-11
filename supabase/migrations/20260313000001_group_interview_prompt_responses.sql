-- ────────────────────────────────────────────────────────────────
-- group_interview_prompt_responses
--   Per-candidate, per-prompt, per-evaluator text responses
--   within a group interview session.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_interview_prompt_responses (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        uuid NOT NULL REFERENCES group_interview_sessions(id) ON DELETE CASCADE,
  candidate_id      uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  prompt_id         uuid NOT NULL REFERENCES group_interview_prompts(id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_text     text NOT NULL DEFAULT '',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (session_id, candidate_id, prompt_id, evaluator_user_id)
);

-- ────────────────────────────────────────────────────────────────
-- group_interview_evaluations
--   Universal scorecard: one record per evaluator per candidate.
--   Auto-saves, pre-populates everywhere, supports lock/unlock.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_interview_evaluations (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id      uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id           uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  overall_score     numeric(3,1) CHECK (overall_score >= 1 AND overall_score <= 10),
  recommendation    text CHECK (recommendation IN ('strong_yes', 'yes', 'hold', 'no')),
  summary_notes     text DEFAULT '',
  is_locked         boolean DEFAULT false,
  locked_at         timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (candidate_id, evaluator_user_id)
);
