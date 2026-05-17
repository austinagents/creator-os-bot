-- PartnerLinks Phase 17: Settlement State Runtime Schema
-- Migration: 017_settlement_state_runtime_schema.sql
-- Safe to rerun (idempotent)
--
-- Purpose:
--   Adds additive settlement/risk/manual-approval state fields and ledger tables
--   needed for future settlement-aware claimability.
--
-- Important:
--   This migration does NOT enable live payouts, collect brand payments, release
--   claimability, apply refunds, change payout_status, or alter dashboard totals.
--   Settlement fields are observability/future-state infrastructure until a
--   central settlement eligibility service is implemented and explicitly enabled.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settlement_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  idempotency_key text not null,
  brand_id bigint references brands(id) on delete set null,
  shop_domain text,

  settlement_status text not null default 'settlement_pending',
  settlement_method text,
  currency text default 'USD' not null,
  gross_amount numeric(12, 2) default 0 not null,
  collected_amount numeric(12, 2) default 0 not null,

  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,

  settlement_authorized_at timestamptz,
  settlement_collected_at timestamptz,
  settlement_failed_at timestamptz,
  settlement_failure_reason text,

  manual_approved_at timestamptz,
  manual_approved_by text,
  manual_approval_reason text,

  reserve_covered_at timestamptz,
  reserve_ledger_id text,

  audit_notes text,
  metadata jsonb default '{}'::jsonb not null,

  constraint chk_settlement_batches_status
    check (settlement_status in (
      'settlement_pending',
      'settlement_authorized',
      'settlement_collected',
      'settlement_failed',
      'settlement_retrying',
      'settlement_disputed',
      'manual_approved',
      'reserve_covered',
      'reversed',
      'ignored'
    )),
  constraint chk_settlement_batches_method
    check (settlement_method is null or settlement_method in (
      'payment_intent',
      'stripe_invoice',
      'manual',
      'prepaid_reserve',
      'test'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_batches_idempotency_key
  ON settlement_batches(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_settlement_batches_brand_id
  ON settlement_batches(brand_id);

CREATE INDEX IF NOT EXISTS idx_settlement_batches_status
  ON settlement_batches(settlement_status);

CREATE INDEX IF NOT EXISTS idx_settlement_batches_shop_domain
  ON settlement_batches(shop_domain);

CREATE TABLE IF NOT EXISTS settlement_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  idempotency_key text not null,
  settlement_batch_id uuid references settlement_batches(id) on delete set null,

  brand_id bigint references brands(id) on delete set null,
  conversion_id bigint references conversions(id) on delete set null,
  creator_network_earning_id bigint references creator_network_earnings(id) on delete set null,
  brand_network_earning_id bigint references brand_network_earnings(id) on delete set null,

  item_type text not null,
  settlement_status text not null default 'settlement_pending',
  currency text default 'USD' not null,
  amount numeric(12, 2) default 0 not null,
  collected_amount numeric(12, 2) default 0 not null,

  settlement_collected_at timestamptz,
  settlement_failed_at timestamptz,
  settlement_failure_reason text,

  manual_approved_at timestamptz,
  manual_approved_by text,
  manual_approval_reason text,

  reserve_covered_at timestamptz,
  reserve_ledger_id text,

  risk_status text default 'unreviewed',
  risk_review_status text default 'not_reviewed',
  risk_notes text,

  audit_notes text,
  metadata jsonb default '{}'::jsonb not null,

  constraint chk_settlement_items_type
    check (item_type in (
      'direct_commission',
      'platform_fee',
      'creator_network_override',
      'brand_network_override',
      'manual_adjustment'
    )),
  constraint chk_settlement_items_status
    check (settlement_status in (
      'settlement_pending',
      'settlement_authorized',
      'settlement_collected',
      'settlement_failed',
      'settlement_retrying',
      'settlement_disputed',
      'manual_approved',
      'reserve_covered',
      'refund_pending',
      'reversed',
      'ignored'
    )),
  constraint chk_settlement_items_risk_status
    check (risk_status is null or risk_status in (
      'unreviewed',
      'low',
      'medium',
      'high',
      'hold',
      'cleared'
    )),
  constraint chk_settlement_items_risk_review_status
    check (risk_review_status is null or risk_review_status in (
      'not_reviewed',
      'pending_review',
      'approved',
      'held',
      'rejected'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_items_idempotency_key
  ON settlement_items(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_settlement_items_batch_id
  ON settlement_items(settlement_batch_id);

CREATE INDEX IF NOT EXISTS idx_settlement_items_brand_id
  ON settlement_items(brand_id);

CREATE INDEX IF NOT EXISTS idx_settlement_items_conversion_id
  ON settlement_items(conversion_id);

CREATE INDEX IF NOT EXISTS idx_settlement_items_creator_network_earning_id
  ON settlement_items(creator_network_earning_id);

CREATE INDEX IF NOT EXISTS idx_settlement_items_brand_network_earning_id
  ON settlement_items(brand_network_earning_id);

CREATE INDEX IF NOT EXISTS idx_settlement_items_status
  ON settlement_items(settlement_status);

CREATE INDEX IF NOT EXISTS idx_settlement_items_risk_status
  ON settlement_items(risk_status);

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS settlement_status text,
  ADD COLUMN IF NOT EXISTS settlement_batch_id uuid references settlement_batches(id) on delete set null,
  ADD COLUMN IF NOT EXISTS settlement_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_failure_reason text,
  ADD COLUMN IF NOT EXISTS manual_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_approved_by text,
  ADD COLUMN IF NOT EXISTS manual_approval_reason text,
  ADD COLUMN IF NOT EXISTS reserve_covered_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_ledger_id text,
  ADD COLUMN IF NOT EXISTS risk_status text,
  ADD COLUMN IF NOT EXISTS risk_review_status text,
  ADD COLUMN IF NOT EXISTS risk_notes text,
  ADD COLUMN IF NOT EXISTS reversal_status text,
  ADD COLUMN IF NOT EXISTS reversal_audit_notes text,
  ADD COLUMN IF NOT EXISTS settlement_audit_notes text;

ALTER TABLE creator_network_earnings
  ADD COLUMN IF NOT EXISTS settlement_status text,
  ADD COLUMN IF NOT EXISTS settlement_batch_id uuid references settlement_batches(id) on delete set null,
  ADD COLUMN IF NOT EXISTS settlement_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_failure_reason text,
  ADD COLUMN IF NOT EXISTS manual_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_approved_by text,
  ADD COLUMN IF NOT EXISTS manual_approval_reason text,
  ADD COLUMN IF NOT EXISTS reserve_covered_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_ledger_id text,
  ADD COLUMN IF NOT EXISTS risk_status text,
  ADD COLUMN IF NOT EXISTS risk_review_status text,
  ADD COLUMN IF NOT EXISTS risk_notes text,
  ADD COLUMN IF NOT EXISTS reversal_status text,
  ADD COLUMN IF NOT EXISTS reversal_audit_notes text,
  ADD COLUMN IF NOT EXISTS settlement_audit_notes text;

ALTER TABLE brand_network_earnings
  ADD COLUMN IF NOT EXISTS settlement_status text,
  ADD COLUMN IF NOT EXISTS settlement_batch_id uuid references settlement_batches(id) on delete set null,
  ADD COLUMN IF NOT EXISTS settlement_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_failure_reason text,
  ADD COLUMN IF NOT EXISTS manual_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_approved_by text,
  ADD COLUMN IF NOT EXISTS manual_approval_reason text,
  ADD COLUMN IF NOT EXISTS reserve_covered_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_ledger_id text,
  ADD COLUMN IF NOT EXISTS risk_status text,
  ADD COLUMN IF NOT EXISTS risk_review_status text,
  ADD COLUMN IF NOT EXISTS risk_notes text,
  ADD COLUMN IF NOT EXISTS reversal_status text,
  ADD COLUMN IF NOT EXISTS reversal_audit_notes text,
  ADD COLUMN IF NOT EXISTS settlement_audit_notes text;

CREATE INDEX IF NOT EXISTS idx_conversions_settlement_status
  ON conversions(settlement_status);

CREATE INDEX IF NOT EXISTS idx_conversions_settlement_batch_id
  ON conversions(settlement_batch_id);

CREATE INDEX IF NOT EXISTS idx_conversions_risk_status
  ON conversions(risk_status);

CREATE INDEX IF NOT EXISTS idx_conversions_reversal_status
  ON conversions(reversal_status);

CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_settlement_status
  ON creator_network_earnings(settlement_status);

CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_settlement_batch_id
  ON creator_network_earnings(settlement_batch_id);

CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_risk_status
  ON creator_network_earnings(risk_status);

CREATE INDEX IF NOT EXISTS idx_creator_network_earnings_reversal_status
  ON creator_network_earnings(reversal_status);

CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_settlement_status
  ON brand_network_earnings(settlement_status);

CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_settlement_batch_id
  ON brand_network_earnings(settlement_batch_id);

CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_risk_status
  ON brand_network_earnings(risk_status);

CREATE INDEX IF NOT EXISTS idx_brand_network_earnings_reversal_status
  ON brand_network_earnings(reversal_status);

COMMENT ON TABLE settlement_batches IS
  'PartnerLinks settlement batch ledger. Additive infrastructure only; does not collect money or release payouts by itself.';

COMMENT ON TABLE settlement_items IS
  'PartnerLinks settlement item ledger linking brand funding to conversions and network earning rows. Additive infrastructure only; claimability requires future eligibility service enforcement.';

COMMENT ON COLUMN conversions.settlement_status IS
  'Future settlement eligibility state. Non-null values must not be treated as payout approval without central settlement eligibility service enforcement.';

COMMENT ON COLUMN creator_network_earnings.settlement_status IS
  'Future settlement eligibility state. Non-null values must not be treated as payout approval without central settlement eligibility service enforcement.';

COMMENT ON COLUMN brand_network_earnings.settlement_status IS
  'Future settlement eligibility state. Non-null values must not be treated as payout approval without central settlement eligibility service enforcement.';

COMMENT ON COLUMN conversions.reversal_status IS
  'Future refund/reversal state marker. Additive observability only; this migration does not apply reversals or change payout_status.';

COMMENT ON COLUMN creator_network_earnings.reversal_status IS
  'Future refund/reversal state marker. Additive observability only; this migration does not apply reversals or change payout_status.';

COMMENT ON COLUMN brand_network_earnings.reversal_status IS
  'Future refund/reversal state marker. Additive observability only; this migration does not apply reversals or change payout_status.';

-- Migration complete
