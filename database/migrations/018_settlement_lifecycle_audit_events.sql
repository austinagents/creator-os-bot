-- PartnerLinks Phase 18: Settlement Lifecycle Audit Events
-- Migration: 018_settlement_lifecycle_audit_events.sql
-- Safe to rerun (idempotent)
--
-- Purpose:
--   Adds additive settlement lifecycle audit infrastructure for future
--   reconciliation, operator review, funding attempts, manual approvals,
--   reserve coverage, and settlement state transitions.
--
-- Important:
--   This migration does NOT collect money, charge brands, release payouts,
--   mark earnings claimable, apply refunds, create Stripe transfers, or mutate
--   existing conversion/earning/claim rows. It only creates audit/reporting
--   infrastructure for future controlled settlement workflows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settlement_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,

  idempotency_key text not null,
  event_type text not null,
  event_status text not null default 'recorded',
  source_system text not null default 'operator',

  settlement_batch_id uuid references settlement_batches(id) on delete set null,
  settlement_item_id uuid references settlement_items(id) on delete set null,

  brand_id bigint references brands(id) on delete set null,
  shop_domain text,

  financial_table text,
  conversion_id bigint references conversions(id) on delete set null,
  creator_network_earning_id bigint references creator_network_earnings(id) on delete set null,
  brand_network_earning_id bigint references brand_network_earnings(id) on delete set null,
  creator_earning_claim_id uuid references creator_earning_claims(id) on delete set null,
  financial_reversal_event_id bigint references financial_reversal_events(id) on delete set null,

  from_status text,
  to_status text,
  transition_allowed boolean default true not null,
  transition_reason text,

  operator_actor text,
  operator_notes text,

  -- Store only minimal non-sensitive evidence. Do not store customer payment
  -- data, full Shopify payloads, full Stripe payloads, secrets, tokens, card
  -- details, or unnecessary customer PII.
  evidence jsonb default '{}'::jsonb not null,
  metadata jsonb default '{}'::jsonb not null,

  constraint chk_settlement_audit_event_type
    check (event_type in (
      'batch_created',
      'batch_status_transition',
      'item_created',
      'item_status_transition',
      'funding_attempt_created',
      'funding_attempt_updated',
      'manual_approval_recorded',
      'reserve_coverage_recorded',
      'reversal_linked',
      'payout_gate_evaluated',
      'operator_note',
      'diagnostic_observed'
    )),
  constraint chk_settlement_audit_event_status
    check (event_status in (
      'recorded',
      'observed',
      'planned',
      'ignored',
      'failed'
    )),
  constraint chk_settlement_audit_source_system
    check (source_system in (
      'app',
      'operator',
      'stripe',
      'shopify',
      'admin',
      'manual',
      'system_test'
    )),
  constraint chk_settlement_audit_financial_table
    check (financial_table is null or financial_table in (
      'conversions',
      'creator_network_earnings',
      'brand_network_earnings',
      'creator_earning_claims',
      'financial_reversal_events',
      'financial_reversal_items',
      'settlement_batches',
      'settlement_items'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_audit_events_idempotency_key
  ON settlement_audit_events(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_batch_id
  ON settlement_audit_events(settlement_batch_id);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_item_id
  ON settlement_audit_events(settlement_item_id);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_brand_id
  ON settlement_audit_events(brand_id);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_shop_domain
  ON settlement_audit_events(shop_domain);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_event_type
  ON settlement_audit_events(event_type);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_event_status
  ON settlement_audit_events(event_status);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_conversion_id
  ON settlement_audit_events(conversion_id);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_creator_network_earning_id
  ON settlement_audit_events(creator_network_earning_id);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_brand_network_earning_id
  ON settlement_audit_events(brand_network_earning_id);

CREATE INDEX IF NOT EXISTS idx_settlement_audit_events_reversal_event_id
  ON settlement_audit_events(financial_reversal_event_id);

COMMENT ON TABLE settlement_audit_events IS
  'PartnerLinks settlement lifecycle audit trail. Additive observability only; does not collect money, release payouts, or mutate financial rows by itself.';

COMMENT ON COLUMN settlement_audit_events.idempotency_key IS
  'Unique deterministic key for settlement lifecycle audit observations/transitions. Replays must not create duplicate audit events.';

COMMENT ON COLUMN settlement_audit_events.evidence IS
  'Minimal non-sensitive evidence only. Do not store secrets, tokens, card data, full webhook payloads, or unnecessary customer PII.';

COMMENT ON COLUMN settlement_audit_events.transition_allowed IS
  'Whether the observed/planned transition is allowed by the documented settlement state machine. Diagnostic only until enforcement is explicitly implemented.';

-- Migration complete
