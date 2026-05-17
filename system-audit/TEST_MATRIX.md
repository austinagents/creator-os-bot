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

## Guaranteed Behaviors

- `REG-AUTH-001`: Sensitive Stripe routes must require explicit `creator_code` scoping and ownership verification.
- `REG-AUTH-002`: Dashboard claim eligibility must compare the active dashboard creator `auth_user_id` to the signed-in auth user, not the default/latest creator.
- `REG-ATTRIBUTION-001`: Exact `partnerlinks_ref` attribution must win before fallback.
- `REG-ATTRIBUTION-002`: Ambiguous recent-click fallback must skip attribution instead of guessing.
- `REG-WEBHOOK-001`: Duplicate Shopify order webhook replay must return safely and create duplicate/skipped diagnostics without creating another conversion.
- `REG-PAYOUT-001`: Claim flow must create one `creator_earning_claims` ledger row and one Stripe transfer per claim batch.
- `REG-PAYOUT-002`: Claim retry-after-success must not create a second transfer or duplicate ledger.
- `REG-ECONOMICS-001`: Level 1 = 30%, Level 2 = 3%, Level 3 = 2%, and no Level 4+ payout.
- `REG-ECONOMICS-002`: Source entity must not earn network override from its own direct sale activity.
- `REG-ECONOMICS-003`: Network override rewards must be funded only from eligible downstream `platform_fee_amount`.
- `REG-SETTLEMENT-001`: Live claimability must not be based only on `claimable_at`.

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

- Regression ID:
  - `REG-AUTH-001`
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

- Regression ID:
  - `REG-ATTRIBUTION-001`
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

- Regression ID:
  - `REG-ECONOMICS-001`
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

### ECONOMICS-002 - Own-Activity Network Override Exclusion

- Regression ID:
  - `REG-ECONOMICS-002`
- Mode: `READ_ONLY`
- Source conversion:
  - sale by `test-creator-04`
- Expected:
  - `test-creator-04` receives direct commission if attributed.
  - `test-creator-04` does not receive a creator-network earning row for their own direct sale.
  - no entity earns network override from its own direct sale activity.
- Status:
  - `PASS` for tested creator-chain path.

### ECONOMICS-003 - Platform Fee Only Network Override Source

- Regression ID:
  - `REG-ECONOMICS-003`
- Mode: `READ_ONLY`
- Source conversion:
  - conversion `19`
- Expected:
  - network override rows use `platform_fee_amount`, not `order_value`.
  - network override rows use `platform_fee_amount`, not `commission_amount`.
  - direct creator commission is not reduced by network override rewards.
- Status:
  - `PASS`

### ECONOMICS-004 - Brand-Origin Network Override

- Mode: `MANUAL_PRODUCTION_SAFE`
- Systems:
  - `/join/brand/:brandId`
  - `creators.invited_by_brand_id`
  - `brand_network_earnings`
  - `createNetworkEarningsForConversion`
- Expected:
  - brand-origin sponsor can receive network override only when downstream creator activity occurs within Level 1/2/3 cap.
  - brand-origin reward comes only from `platform_fee_amount`.
  - brand-origin sponsor does not receive direct affiliate commission.
- Status:
  - `CHECK`
- Notes:
  - Schema/service paths exist, but no end-to-end brand-origin economic test has proven this path.

### ECONOMICS-005 - Settlement Gating Before Live Payouts

- Mode: `DO_NOT_AUTOMATE`
- Systems:
  - future brand settlement collection
  - future platform fee settlement ledger
  - claimability rules
- Expected:
  - network override claimability should account for collected/eligible platform fees before live payout automation.
  - direct creator commission claimability should account for brand-funded settlement source.
  - refund/reversal/negative-balance behavior should be explicit and ledgered.
- Status:
  - `UNKNOWN`
- Notes:
  - Not implemented. Must be designed before live public settlement automation.

### WEBHOOK_IDEMPOTENCY-001 - Duplicate Shopify Orders Paid Replay

- Regression ID:
  - `REG-WEBHOOK-001`
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
  - `PASS`

### PAYOUT_LIFECYCLE-001 - Claim Retry After Success

- Regression ID:
  - `REG-PAYOUT-002`
- Mode: `SANDBOX_ACTION`
- Requires:
  - Stripe test mode only.
  - Explicit approval.
- Expected:
  - Retry after successful claim does not create a second Stripe transfer.
  - No duplicate claim ledger.
  - No claimed row loses `claim_batch_id`.
- Status:
  - `PASS`

### PAYOUT_LIFECYCLE-002 - Claim Ledger And Stripe Transfer Per Batch

- Regression ID:
  - `REG-PAYOUT-001`
- Mode: `SANDBOX_ACTION`
- Requires:
  - Stripe test mode only.
  - Explicit approval.
- Expected:
  - Claim flow reserves eligible rows.
  - One `creator_earning_claims` row is created per claim batch.
  - One Stripe transfer is created per claim batch.
  - Claimed earnings keep `claim_batch_id` and `claimed_at`.
- Status:
  - `PASS`

### PAYOUT_LIFECYCLE-003 - Settlement-Aware Claimability Gate

- Regression ID:
  - `REG-PAYOUT-003`
- Mode: `READ_ONLY / FUTURE_IMPLEMENTATION_REQUIRED`
- Systems:
  - `services/earningsLifecycleService.js`
  - `services/creatorDashboardService.js`
  - `index.js`
  - `conversions`
  - `creator_network_earnings`
  - `brand_network_earnings`
- Expected:
  - Live claimable balances require one of:
    - `settlement_collected`
    - `explicit_manual_approval`
    - `sufficient_prepaid_reserve`
  - `claimable_at` alone is not enough for live payout eligibility.
  - Dashboard Claim earnings cannot execute against unfunded rows.
- Current result:
  - `CHECK`
  - Current implementation is time-based and sandbox-safe only.
  - `promoteClaimableEarningsForCreator()` promotes rows by `claimable_at`.
  - `/earnings/claim` is creator-scoped but not settlement-scoped.
- Required before live payouts:
  - settlement fields.
  - settlement eligibility service.
  - claim promotion/reservation queries that require settlement eligibility.
  - mode/feature flag or manual approval gate.

### SETTLEMENT-001 - Live Claimability Must Not Be Claimable-At Only

- Regression ID:
  - `REG-SETTLEMENT-001`
- Mode: `STATIC / ROUTE_GUARD`
- Systems:
  - `PAYOUT_MODE`
  - `/earnings/claim`
  - Creator Dashboard Claim earnings UI
- Expected:
  - Missing or unknown `PAYOUT_MODE` blocks claims.
  - Default `PAYOUT_MODE=claims_disabled` blocks claims.
  - `manual_approval` blocks claims until approval schema/service exists.
  - `settlement_gated` blocks claims until settlement schema/service exists.
  - `sandbox_time_based` allows current time-based claim behavior only with `STRIPE_SECRET_KEY=sk_test_...`.
  - Live claimability must not be based only on `claimable_at`.
- Status:
  - `PASS`
- Validation:

```bash
node --check index.js
node --check config/config/env.js
node --check services/earningsLifecycleService.js
node --check services/creatorDashboardService.js
```

### ATTRIBUTION-002 - Multi-Creator Collision

- Regression ID:
  - `REG-ATTRIBUTION-002`
- Mode: `MANUAL_PRODUCTION_SAFE`
- Scenario:
  - `test-creator-05` and `test-creator-06` click the same product close together.
  - Complete one checkout.
- Expected:
  - Exact cart/order attributes win when present.
  - If deterministic context is missing and fallback is ambiguous, skip instead of guessing.
  - No conversion, creator earnings, or network earnings are created from an ambiguous fallback decision.
  - `shopify_attribution_events` records `decision = skipped`, `unmatched_reason = ambiguous_recent_click_fallback`, `attribution_source = unmatched`, and `attribution_confidence = none`.
- Status:
  - `PASS`

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
