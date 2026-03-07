-- Add "Hired" pipeline stage between "Offer" and "Onboarding" for all teams.
-- Must handle the unique constraint on (team_id, order_index) by bumping stages
-- in descending order to avoid transient conflicts.

BEGIN;

-- Temporarily drop the unique constraint so we can reorder safely
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_team_id_order_index_key;

-- Bump all stages after "Offer" by 1 for every team
UPDATE pipeline_stages ps
SET order_index = ps.order_index + 1
WHERE ps.order_index > (
  SELECT ps2.order_index
  FROM pipeline_stages ps2
  WHERE ps2.team_id = ps.team_id AND ps2.name = 'Offer'
)
AND EXISTS (
  SELECT 1 FROM pipeline_stages ps3
  WHERE ps3.team_id = ps.team_id AND ps3.name = 'Offer'
);

-- Insert "Hired" at Offer's order_index + 1 for every team
INSERT INTO pipeline_stages (team_id, name, order_index, ghl_tag, color, is_active)
SELECT
  ps.team_id,
  'Hired',
  ps.order_index + 1,
  'hired',
  '#2D9E6B',
  true
FROM pipeline_stages ps
WHERE ps.name = 'Offer'
  AND NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps2
    WHERE ps2.team_id = ps.team_id AND ps2.name = 'Hired'
  );

-- Re-add the unique constraint
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_team_id_order_index_key UNIQUE (team_id, order_index);

COMMIT;
