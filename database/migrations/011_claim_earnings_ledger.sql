-- Migration: 011_claim_earnings_ledger.sql
-- Purpose: Add internal claim ledger metadata for creator earnings.
-- Run manually in the Supabase SQL Editor. Do not execute automatically.

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_batch_id uuid;

ALTER TABLE creator_network_earnings
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_batch_id uuid;

ALTER TABLE brand_network_earnings
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_batch_id uuid;

CREATE TABLE IF NOT EXISTS creator_earning_claims (
  id uuid primary key,
  created_at timestamptz default now() not null,
  creator_id bigint references creators(id) on delete cascade,
  direct_commission_amount numeric default 0 not null,
  network_earning_amount numeric default 0 not null,
  total_claimed_amount numeric default 0 not null,
  currency text default 'USD',
  stripe_account_id text,
  status text default 'claimed' not null,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_conversions_claim_batch_id ON conversions(claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_conversions_claimed_at ON conversions(claimed_at);

CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_claim_batch_id ON creator_network_earnings(claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_claimed_at ON creator_network_earnings(claimed_at);

CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_claim_batch_id ON brand_network_earnings(claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_claimed_at ON brand_network_earnings(claimed_at);

CREATE INDEX IF NOT EXISTS idx_creator_earning_claims_creator_id ON creator_earning_claims(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earning_claims_created_at ON creator_earning_claims(created_at);
CREATE INDEX IF NOT EXISTS idx_creator_earning_claims_status ON creator_earning_claims(status);
