# PartnerLinks Test Matrix

Purpose:

- Define repeatable reliability tests for attribution, conversion, creator economics, payout routing, and diagnostics.
- Keep tests explicit, deterministic, and safe.
- Separate read-only checks from write/action tests.

## Test Modes

- `READ_ONLY`: Safe to run against production; no writes, no webhook sends, no Stripe transfers.
- `SANDBOX_ACTION`: Uses test-only creators, Shopify Bogus Gateway, or Stripe test mode. Requires explicit operator approval.
- `MANUAL_PRODUCTION_SAFE`: Uses real production routes but test data only. Requires operator review before execution.
- `DO_NOT_AUTOMATE`: Should remain manual or require a formal runbook before execution.

## Core Test Creators

- `test-creator-01`
- `test-creator-02`
- `test-creator-03`
- `test-creator-04`
- `test-creator-05`
- `test-creator-06`
- `test-creator-07`
- `test-creator-08`
- `test-creator-09`
- `test-creator-10`

Canonical chain:

```text
test-creator-01 -> test-creator-02 -> test-creator-03 -> test-creator-04
```

## Regression Categories

- `AUTH_SCOPE`: auth/session restoration, creator ownership, multi-creator auth users.
- `REFERRAL_ROUTE`: `/join`, `/r`, product routes, canonical lowercase codes.
- `ATTRIBUTION`: `partnerlinks_ref`, Shopify cart/order attributes, fallback behavior.
- `WEBHOOK_IDEMPOTENCY`: HMAC, duplicate order prevention, diagnostics.
- `ECONOMICS`: direct commission, platform fee, Level 1/2/3, no Level 4.
- `PAYOUT_LIFECYCLE`: pending -> claimable -> claimed, claim batches, Stripe transfers.
- `SECURITY_ISOLATION`: cross-creator access, route scoping, no service-role exposure.
- `DIAGNOSTICS`: audit trail, debug commands/routes, operator clarity.
- `UI_GUARDRAIL`: universal product cards, dashboard visual consistency.

## Read-Only Baseline

```bash
node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04
```

Expected:

- Reports test creator graph.
- Reports recent clicks and attribution sessions.
- Reports conversions and earnings.
- Reports claim ledger rows.
- Does not mutate data.
- Does not send webhooks.
- Does not create Stripe transfers.

## Tests

### AUTH_SCOPE-001 - Creator-Scoped Stripe Debug

- Mode: `READ_ONLY`
- Route:
  - `/stripe/connect/debug?creator_code=test-creator-04`
- Expected:
  - Requires signed-in auth user.
  - Requires explicit `creator_code`.
  - Verifies creator ownership by `auth_user_id`.
  - Shows only requested creator's Stripe state.
- Regression risk:
  - Debug route silently falls back to newest/default creator.
- Status:
  - `PASS`

### ATTRIBUTION-001 - Exact Shopify Attribution

- Mode: `MANUAL_PRODUCTION_SAFE`
- Test URL:
  - `/r/aria-wellness/test-creator-04/test-product`
- Expected:
  - Click/session persisted before redirect.
  - Shopify cart permalink includes order/cart attributes.
  - Webhook resolves `partnerlinks_ref`.
  - `fallback_used = false`.
  - Conversion created once.
- Status:
  - `PASS`

### ECONOMICS-001 - Level 1/2/3 Creator Network Earnings

- Mode: `READ_ONLY`
- Source conversion:
  - sale by `test-creator-04`
- Expected:
  - `test-creator-04` direct commission.
  - `test-creator-03` Level 1 = 30% of platform fee.
  - `test-creator-02` Level 2 = 3% of platform fee.
  - `test-creator-01` Level 3 = 2% of platform fee.
  - No Level 4.
- Status:
  - `PASS`

### WEBHOOK_IDEMPOTENCY-001 - Duplicate Shopify Orders Paid Replay

- Mode: `MANUAL_PRODUCTION_SAFE`
- Requires:
  - `SHOPIFY_WEBHOOK_SECRET`
  - exact signed replay script or Shopify replay event
- Expected:
  - HMAC accepted.
  - Existing `order_id` detected.
  - Diagnostic row records duplicate/skipped behavior.
  - No duplicate conversion.
  - No duplicate creator network earnings.
  - No duplicate brand network earnings.
- Status:
  - `CHECK`

### PAYOUT_LIFECYCLE-001 - Claim Retry After Success

- Mode: `SANDBOX_ACTION`
- Requires:
  - Stripe test mode only.
  - Explicit approval.
- Expected:
  - Retry after successful claim does not create a second Stripe transfer.
  - No duplicate claim ledger.
  - No claimed row loses `claim_batch_id`.
- Status:
  - `CHECK`

### ATTRIBUTION-002 - Multi-Creator Collision

- Mode: `MANUAL_PRODUCTION_SAFE`
- Scenario:
  - `test-creator-05` and `test-creator-06` click the same product close together.
  - Complete one checkout.
- Expected:
  - Exact cart/order attributes win when present.
  - If deterministic context is missing and fallback is ambiguous, skip instead of guessing.
- Status:
  - `CHECK`

## Test Case Template

~~~markdown
### CATEGORY-000 - Test Name

- Mode: `READ_ONLY`
- Systems:
  - routes/services/tables
- Setup:
  - Preconditions.
- Steps:
  1. Step one.
  2. Step two.
- Expected:
  - Expected behavior.
- Validation commands:

```bash
command here
```

- Status:
  - `UNKNOWN`
- Last run:
  - YYYY-MM-DD
- Notes:
  - Findings or follow-up.
~~~
