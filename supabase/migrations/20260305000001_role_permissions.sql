-- =============================================================================
-- Role Permissions
-- =============================================================================
-- Stores configurable permissions for each role within a team.
-- One row per team/role pair. Permissions are a JSONB object of boolean flags.
--
-- NOTE: For the initial implementation, role permissions are stored in
-- teams.settings -> 'role_permissions' to avoid DDL requirements.
-- This table is provided for future migration to a dedicated table.
-- =============================================================================

create table if not exists role_permissions (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  role        text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (team_id, role)
);

create index if not exists role_permissions_team_id_idx on role_permissions(team_id);

-- Seed default permissions for VW team
insert into role_permissions (team_id, role, permissions) values
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Team Lead', '{"view_candidates":true,"edit_candidates":true,"send_emails":true,"manage_interviews":true,"manage_settings":true,"view_reports":true,"manage_members":true,"manage_templates":true}'::jsonb),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Leader', '{"view_candidates":true,"edit_candidates":true,"send_emails":true,"manage_interviews":true,"manage_settings":false,"view_reports":true,"manage_members":false,"manage_templates":false}'::jsonb),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Admin', '{"view_candidates":true,"edit_candidates":true,"send_emails":true,"manage_interviews":true,"manage_settings":true,"view_reports":true,"manage_members":true,"manage_templates":true}'::jsonb),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'Front Desk', '{"view_candidates":true,"edit_candidates":false,"send_emails":false,"manage_interviews":false,"manage_settings":false,"view_reports":false,"manage_members":false,"manage_templates":false}'::jsonb),
  ('9bdd061b-8f89-4d08-bf19-bed29d129210', 'VP Ops', '{"view_candidates":true,"edit_candidates":true,"send_emails":true,"manage_interviews":true,"manage_settings":true,"view_reports":true,"manage_members":true,"manage_templates":true}'::jsonb)
on conflict (team_id, role) do nothing;
