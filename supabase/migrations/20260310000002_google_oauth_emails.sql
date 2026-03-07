-- Google Workspace OAuth columns on users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_access_token text,
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS google_email text;

-- Candidate email tracking table for Gmail reply threading
CREATE TABLE IF NOT EXISTS candidate_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  gmail_message_id text,
  gmail_thread_id text,
  subject text,
  body_snippet text,
  from_address text,
  to_address text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_emails_candidate ON candidate_emails(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_emails_thread ON candidate_emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_candidate_emails_team ON candidate_emails(team_id);
