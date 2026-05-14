-- PartnerLinks Phase 6: Brand Setup Fields
-- Migration: 006_brand_setup_fields.sql
-- Safe to rerun (idempotent)

ALTER TABLE brands ADD COLUMN IF NOT EXISTS creator_commission_rate numeric;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS platform_fee_rate numeric;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;

-- Migration complete
