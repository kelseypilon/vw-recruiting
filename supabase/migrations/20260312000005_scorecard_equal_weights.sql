-- ============================================================
-- Scorecard Criteria: Equal Weighting (5.2% each × 19 = 98.8%)
-- ============================================================
-- Updates all 19 scoring criteria to equal weight of 5.2%.
-- Total intentionally sums to 98.8% (not 100%).

UPDATE scoring_criteria
SET weight_percent = 5.20;
