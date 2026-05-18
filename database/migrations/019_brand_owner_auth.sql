-- Migration: 019_brand_owner_auth.sql
-- Purpose:
--   Add explicit brand owner/admin ownership records for brand setup/admin routes.
--   This is an additive auth-scoping foundation only.
--   It does NOT charge brands, collect settlement, release payouts, or mutate earnings.

CREATE TABLE IF NOT EXISTS brand_owners (
  id bigserial primary key,
  brand_id bigint not null references brands(id) on delete cascade,
  auth_user_id uuid not null,
  email text,
  role text not null default 'owner',
  source_system text not null default 'shopify_oauth',
  shop_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint brand_owners_role_check check (role in ('owner', 'admin')),
  constraint brand_owners_source_system_check check (source_system in ('shopify_oauth', 'manual_operator', 'migration', 'test'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_owners_brand_auth_unique
  ON brand_owners(brand_id, auth_user_id);

CREATE INDEX IF NOT EXISTS idx_brand_owners_auth_user_id
  ON brand_owners(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_brand_owners_brand_id
  ON brand_owners(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_owners_active_brand_auth
  ON brand_owners(brand_id, auth_user_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE brand_owners IS
  'Explicit brand owner/admin association for brand setup/admin route scoping. Presence grants scoped brand admin access only; it is not funding proof and does not authorize payouts.';

COMMENT ON COLUMN brand_owners.auth_user_id IS
  'Supabase Auth user id for the signed-in brand owner/admin. Kept server-side only.';

COMMENT ON COLUMN brand_owners.revoked_at IS
  'When set, this owner/admin association must not grant brand admin access.';
