-- Add group interview settings to teams table
alter table teams
  add column if not exists group_interview_zoom_link text,
  add column if not exists group_interview_date timestamptz;
