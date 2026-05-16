-- Migration: 009_stripe_connect_creators.sql
-- Purpose: Add creator Stripe Connect Express onboarding state.

ALTER TABLE creators ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS stripe_onboarding_status text DEFAULT 'not_connected';

CREATE INDEX IF NOT EXISTS idx_creators_stripe_account_id ON creators(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_creators_stripe_onboarding_status ON creators(stripe_onboarding_status);
