-- PartnerLinks Phase 4: Web Auth Creator Binding
-- Migration: 004_web_auth_creators.sql
-- Safe to rerun (idempotent)

ALTER TABLE creators ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS signup_source text;

CREATE INDEX IF NOT EXISTS idx_creators_auth_user_id ON creators(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_creators_email ON creators(email);

-- Migration complete
