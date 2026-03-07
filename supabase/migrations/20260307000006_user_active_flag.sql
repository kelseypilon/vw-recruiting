-- Add is_active flag to users for soft-delete (deactivation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
