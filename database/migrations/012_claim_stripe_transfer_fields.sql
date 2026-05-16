-- Migration: 012_claim_stripe_transfer_fields.sql
-- Purpose: Store Stripe test transfer metadata for creator earning claims.
-- Run manually in the Supabase SQL Editor. Do not execute automatically.

ALTER TABLE creator_earning_claims
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_status text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_creator_earning_claims_stripe_transfer_id ON creator_earning_claims(stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_creator_earning_claims_stripe_transfer_status ON creator_earning_claims(stripe_transfer_status);
