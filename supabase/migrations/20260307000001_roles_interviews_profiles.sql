-- Migration: Role Management, Interview Interviewers, Avatars Storage
-- Supports: Custom roles, multi-interviewer assignment, group interview status, avatar uploads

-- 1. Drop restrictive CHECK constraint on users.role
--    Allows custom role names beyond the original ('owner', 'leader', 'member')
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add status column to group_interview_sessions
--    Enables session lifecycle: upcoming → in_progress → completed
ALTER TABLE group_interview_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'upcoming';

-- Add CHECK constraint for valid statuses (separate statement for IF NOT EXISTS compat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_interview_sessions_status_check'
  ) THEN
    ALTER TABLE group_interview_sessions
      ADD CONSTRAINT group_interview_sessions_status_check
      CHECK (status IN ('upcoming', 'in_progress', 'completed'));
  END IF;
END $$;

-- 3. Create interview_interviewers join table
--    Supports multiple interviewers assigned to a single interview
CREATE TABLE IF NOT EXISTS interview_interviewers (
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'interviewer',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_interviewers_user
  ON interview_interviewers(user_id);

-- 4. Create avatars storage bucket for profile photo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DO $$
BEGIN
  -- Public read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public avatar access' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public avatar access" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;

  -- Authenticated upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload avatars" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  -- Authenticated update (overwrite)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own avatars' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own avatars" ON storage.objects
      FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;
