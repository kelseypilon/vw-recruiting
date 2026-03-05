-- Add new candidate profile fields
alter table candidates
  add column if not exists current_brokerage text,
  add column if not exists active_listings integer,
  add column if not exists website_url text,
  add column if not exists resume_url text;

-- Create storage bucket for resumes (run in Supabase dashboard if using hosted)
-- insert into storage.buckets (id, name, public) values ('resumes', 'resumes', true);
