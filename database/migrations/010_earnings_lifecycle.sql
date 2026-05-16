-- Migration: 010_earnings_lifecycle.sql
-- Purpose: Add payout lifecycle state for direct commissions and network earnings.
-- Run manually in the Supabase SQL Editor. Do not execute automatically.

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS claimable_at timestamptz;

ALTER TABLE creator_network_earnings
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS claimable_at timestamptz;

ALTER TABLE brand_network_earnings
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS claimable_at timestamptz;

UPDATE conversions
SET claimable_at = COALESCE(claimable_at, created_at + interval '24 hours')
WHERE claimable_at IS NULL;

UPDATE creator_network_earnings
SET claimable_at = COALESCE(claimable_at, created_at + interval '24 hours')
WHERE claimable_at IS NULL;

UPDATE brand_network_earnings
SET claimable_at = COALESCE(claimable_at, created_at + interval '24 hours')
WHERE claimable_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversions_payout_status ON conversions(payout_status);
CREATE INDEX IF NOT EXISTS idx_conversions_claimable_at ON conversions(claimable_at);
CREATE INDEX IF NOT EXISTS idx_conversions_creator_payout_status ON conversions(creator_id, payout_status);

CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_payout_status ON creator_network_earnings(payout_status);
CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_claimable_at ON creator_network_earnings(claimable_at);
CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_creator_payout_status ON creator_network_earnings(earning_creator_id, payout_status);

CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_payout_status ON brand_network_earnings(payout_status);
CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_claimable_at ON brand_network_earnings(claimable_at);
CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_brand_payout_status ON brand_network_earnings(earning_brand_id, payout_status);
