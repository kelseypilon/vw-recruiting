-- Bugfix batch: addresses multiple issues found during audit
-- 1. Add auth_id column to users (needed for invite acceptance flow)
-- 2. Fix super-admin create_team role to use 'owner' not 'Team Lead'
--    (handled in application code, not SQL)

-- Bug 1: users.auth_id column does not exist but is used in invite acceptance
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL;
