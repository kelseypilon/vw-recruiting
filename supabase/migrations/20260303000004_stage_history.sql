-- =============================================================================
-- Stage History - tracks candidate stage transitions
-- =============================================================================
create table if not exists stage_history (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  from_stage    text,
  to_stage      text not null,
  changed_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists stage_history_candidate_id_idx on stage_history(candidate_id);
create index if not exists stage_history_created_at_idx on stage_history(created_at);
