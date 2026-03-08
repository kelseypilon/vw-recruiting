-- =============================================================================
-- VW Recruiting Platform - Initial Schema
-- =============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- =============================================================================
-- TEAMS
-- =============================================================================
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- USERS
-- =============================================================================
create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references teams(id) on delete cascade,
  email            text not null unique,
  name             text not null,
  role             text not null check (role in ('owner', 'leader', 'member')),
  permissions      jsonb not null default '{}'::jsonb,
  receives_digest  boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists users_team_id_idx on users(team_id);

-- =============================================================================
-- CANDIDATES
-- =============================================================================
create table if not exists candidates (
  id                    uuid primary key default gen_random_uuid(),
  team_id               uuid not null references teams(id) on delete cascade,
  first_name            text not null,
  last_name             text not null,
  email                 text,
  phone                 text,
  role_applied          text,
  is_licensed           boolean,
  years_experience      numeric(4,1),
  transactions_2024     integer,
  "current_role"        text,
  heard_about           text,
  stage                 text not null default 'New Lead',

  -- DISC scores
  disc_d                integer,
  disc_i                integer,
  disc_s                integer,
  disc_c                integer,
  disc_primary          text,
  disc_secondary        text,
  disc_meets_threshold  boolean,

  -- AQ scores
  aq_raw                numeric(5,2),
  aq_normalized         numeric(5,2),
  aq_tier               text,

  -- Composite scoring
  composite_score       numeric(6,2),
  composite_verdict     text,

  app_submitted_at      timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists candidates_team_id_idx on candidates(team_id);
create index if not exists candidates_stage_idx on candidates(stage);
create index if not exists candidates_email_idx on candidates(email);

-- =============================================================================
-- DISC QUESTIONS
-- =============================================================================
create table if not exists disc_questions (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  question_number integer not null,
  option_a        text not null,
  option_b        text not null,
  option_c        text not null,
  option_d        text not null,
  letter_a        text not null check (letter_a in ('D','I','S','C')),
  letter_b        text not null check (letter_b in ('D','I','S','C')),
  letter_c        text not null check (letter_c in ('D','I','S','C')),
  letter_d        text not null check (letter_d in ('D','I','S','C')),
  is_active       boolean not null default true,
  unique (team_id, question_number)
);

create index if not exists disc_questions_team_id_idx on disc_questions(team_id);

-- =============================================================================
-- DISC RESPONSES
-- =============================================================================
create table if not exists disc_responses (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  question_id   uuid not null references disc_questions(id) on delete cascade,
  most_letter   text not null check (most_letter in ('D','I','S','C')),
  least_letter  text not null check (least_letter in ('D','I','S','C')),
  unique (candidate_id, question_id)
);

create index if not exists disc_responses_candidate_id_idx on disc_responses(candidate_id);

-- =============================================================================
-- AQ QUESTIONS
-- =============================================================================
create table if not exists aq_questions (
  id              uuid primary key default gen_random_uuid(),
  question_number integer not null unique,
  question_text   text not null,
  is_active       boolean not null default true
);

-- =============================================================================
-- AQ RESPONSES
-- =============================================================================
create table if not exists aq_responses (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  question_id   uuid not null references aq_questions(id) on delete cascade,
  score         integer not null check (score between 0 and 5),
  unique (candidate_id, question_id)
);

create index if not exists aq_responses_candidate_id_idx on aq_responses(candidate_id);

-- =============================================================================
-- PIPELINE STAGES
-- =============================================================================
create table if not exists pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  name         text not null,
  order_index  integer not null,
  ghl_tag      text,
  color        text,
  is_active    boolean not null default true,
  unique (team_id, order_index)
);

create index if not exists pipeline_stages_team_id_idx on pipeline_stages(team_id);

-- =============================================================================
-- INTERVIEW QUESTIONS
-- =============================================================================
create table if not exists interview_questions (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references teams(id) on delete cascade,
  question_text     text not null,
  category          text,
  default_leader_id uuid references users(id) on delete set null,
  is_active         boolean not null default true,
  order_index       integer not null default 0
);

create index if not exists interview_questions_team_id_idx on interview_questions(team_id);

-- =============================================================================
-- SCORING CRITERIA
-- =============================================================================
create table if not exists scoring_criteria (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  name            text not null,
  weight_percent  numeric(5,2) not null check (weight_percent >= 0 and weight_percent <= 100),
  min_threshold   numeric(5,2),
  order_index     integer not null default 0
);

create index if not exists scoring_criteria_team_id_idx on scoring_criteria(team_id);

-- =============================================================================
-- INTERVIEW SCORES
-- =============================================================================
create table if not exists interview_scores (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  evaluator_id  uuid not null references users(id) on delete cascade,
  criterion_id  uuid not null references scoring_criteria(id) on delete cascade,
  score         numeric(5,2) not null,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (candidate_id, evaluator_id, criterion_id)
);

create index if not exists interview_scores_candidate_id_idx on interview_scores(candidate_id);
create index if not exists interview_scores_evaluator_id_idx on interview_scores(evaluator_id);

-- =============================================================================
-- CANDIDATE NOTES
-- =============================================================================
create table if not exists candidate_notes (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  author_id     uuid not null references users(id) on delete cascade,
  note_text     text not null,
  created_at    timestamptz not null default now()
);

create index if not exists candidate_notes_candidate_id_idx on candidate_notes(candidate_id);

-- =============================================================================
-- ONBOARDING TASKS
-- =============================================================================
create table if not exists onboarding_tasks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  title        text not null,
  owner_role   text not null,
  applies_to   text,
  timing       text,
  order_index  integer not null default 0,
  is_active    boolean not null default true
);

create index if not exists onboarding_tasks_team_id_idx on onboarding_tasks(team_id);

-- =============================================================================
-- CANDIDATE ONBOARDING
-- =============================================================================
create table if not exists candidate_onboarding (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  task_id       uuid not null references onboarding_tasks(id) on delete cascade,
  assigned_to   uuid references users(id) on delete set null,
  due_date      date,
  completed_at  timestamptz,
  notes         text,
  unique (candidate_id, task_id)
);

create index if not exists candidate_onboarding_candidate_id_idx on candidate_onboarding(candidate_id);

-- =============================================================================
-- EMAIL TEMPLATES
-- =============================================================================
create table if not exists email_templates (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  name       text not null,
  trigger    text,
  subject    text not null,
  body       text not null,
  merge_tags jsonb not null default '[]'::jsonb,
  is_active  boolean not null default true
);

create index if not exists email_templates_team_id_idx on email_templates(team_id);

-- =============================================================================
-- WEBHOOK LOG
-- =============================================================================
create table if not exists webhook_log (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  direction   text not null check (direction in ('inbound', 'outbound')),
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

create index if not exists webhook_log_team_id_idx on webhook_log(team_id);
create index if not exists webhook_log_created_at_idx on webhook_log(created_at);

-- =============================================================================
-- GHL TAG MAP
-- =============================================================================
create table if not exists ghl_tag_map (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  stage_id    uuid references pipeline_stages(id) on delete cascade,
  ghl_tag     text not null,
  direction   text not null check (direction in ('inbound', 'outbound', 'both')),
  unique (team_id, ghl_tag, direction)
);

create index if not exists ghl_tag_map_team_id_idx on ghl_tag_map(team_id);
