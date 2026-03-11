-- Widen group_interview_scores.score CHECK from 1-5 to 1-10
ALTER TABLE group_interview_scores DROP CONSTRAINT IF EXISTS group_interview_scores_score_check;
ALTER TABLE group_interview_scores ADD CONSTRAINT group_interview_scores_score_check
  CHECK (score >= 1 AND score <= 10);
