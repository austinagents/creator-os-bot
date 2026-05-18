-- PartnerLinks Shopify expiring offline token metadata
-- Migration: 020_shopify_expiring_offline_tokens.sql
-- Safe to rerun (idempotent)
-- Additive only. Does not modify payouts, settlement, claims, conversions, earnings, or attribution rows.

ALTER TABLE shopify_stores
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS granted_scopes text,
  ADD COLUMN IF NOT EXISTS token_type text default 'offline_expiring',
  ADD COLUMN IF NOT EXISTS token_last_refreshed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shopify_stores_access_token_expires_at
  ON shopify_stores(access_token_expires_at);

CREATE INDEX IF NOT EXISTS idx_shopify_stores_refresh_token_expires_at
  ON shopify_stores(refresh_token_expires_at);

COMMENT ON COLUMN shopify_stores.refresh_token IS
  'Shopify expiring offline refresh token. Sensitive credential; server-side only.';

COMMENT ON COLUMN shopify_stores.access_token_expires_at IS
  'Expiration timestamp for the current Shopify Admin API access token.';

COMMENT ON COLUMN shopify_stores.refresh_token_expires_at IS
  'Expiration timestamp for the current Shopify refresh token.';

COMMENT ON COLUMN shopify_stores.granted_scopes IS
  'Scopes returned by Shopify when the shop token was issued/refreshed.';

COMMENT ON COLUMN shopify_stores.token_type IS
  'Shopify token mode. Expected current value: offline_expiring.';

COMMENT ON COLUMN shopify_stores.token_last_refreshed_at IS
  'Last time PartnerLinks refreshed this Shopify access token.';

-- Migration complete
