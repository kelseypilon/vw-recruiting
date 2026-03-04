-- =============================================================================
-- Interviews table - tracks scheduled interviews with candidates
-- =============================================================================
create table if not exists interviews (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  candidate_id  uuid not null references candidates(id) on delete cascade,
  interview_type text not null default 'Group Interview',
  scheduled_at  timestamptz,
  status        text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists interviews_team_id_idx on interviews(team_id);
create index if not exists interviews_candidate_id_idx on interviews(candidate_id);
create index if not exists interviews_scheduled_at_idx on interviews(scheduled_at);

-- Add evaluator scores reference to interview
alter table interview_scores add column if not exists interview_id uuid references interviews(id) on delete cascade;
