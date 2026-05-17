# PartnerLinks Reliability Audit

Purpose:

- Maintain a living, Git-friendly reliability record for PartnerLinks creator/referral/payout infrastructure.
- Track PASS/CHECK/FAIL findings from manual audits, scripts, production tests, and incidents.
- Preserve operational memory without creating autonomous mutation logic.

This file is implementation and reliability focused. Product philosophy belongs in `CHAT_HANDOFF.md`; current implementation status belongs in `PROJECT_STATUS.md`.

## Audit Principles

- Prefer deterministic attribution over fallback guessing.
- Prefer explicit creator/brand/resource scoping over implicit defaults.
- Preserve signed webhook verification.
- Preserve idempotent conversion creation.
- Preserve idempotent Stripe transfer and claim finalization behavior.
- Preserve strict separation between direct creator commissions, PartnerLinks platform fees, and network override rewards.
- Preserve the rule that network overrides are funded only from eligible downstream `platform_fee_amount`.
- Preserve the rule that entities do not earn network overrides from their own direct sales activity.
- Preserve safe failure over ambiguous execution.
- Never tie payout creation directly to raw click events.
- Never let audit tooling mutate production data unless explicitly approved and clearly test-scoped.

## Severity Classifications

- `SEV0`: Active money movement, attribution, auth, or data integrity failure affecting production users.
- `SEV1`: High-risk bug in payout routing, conversion idempotency, webhook verification, or ownership checks with plausible production impact.
- `SEV2`: Reliability gap, unsafe assumption, confusing diagnostics, or edge case that should be fixed before scale.
- `SEV3`: Documentation, observability, or workflow improvement.

## Status Labels

- `PASS`: Tested and behaving as expected.
- `CHECK`: Needs manual validation, broader sample size, or repeat test.
- `FAIL`: Confirmed incorrect behavior.
- `UNKNOWN`: Not yet inspected or insufficient evidence.
- `MITIGATED`: Risk remains known but has a guardrail or operational workaround.

## Current Reliability Snapshot

Last updated: 2026-05-16

- Stripe Connect route scoping:
  - `PASS`
  - `/stripe/connect/start`, `/stripe/connect/return`, `/stripe/connect/refresh`, `/earnings/claim`, and `/stripe/connect/debug?creator_code=...` use explicit creator context for sensitive Stripe behavior or Stripe diagnostics.
- Shopify deterministic attribution:
  - `PASS`
  - Cart/order attributes with `partnerlinks_ref`, `creator_code`, `brand_slug`, and `product_slug` have produced exact attribution without fallback.
- Creator economics:
  - `PASS`
  - Test conversion for `test-creator-04` produced direct commission and Level 1/2/3 network earnings with no Level 4.
- Economic architecture:
  - `CHECK`
  - Canonical economic model is documented in `system-audit/ECONOMIC_ARCHITECTURE.md`. Future settlement automation must implement the documented separation of direct commission, platform fee, and network overrides.
- Payout lifecycle:
  - `PASS`
  - `test-creator-04` completed Stripe test onboarding and successfully claimed direct commission through the real claim route.
- Duplicate webhook replay:
  - `PASS`
  - Signed duplicate Shopify webhook replay is idempotent: it returns safely, records duplicate diagnostics, and does not create duplicate conversions or earnings.
- Ambiguous fallback safety:
  - `PASS`
  - When deterministic Shopify attribution is missing and multiple recent clicks could match, attribution is skipped instead of guessed.
- Multi-creator convenience navigation:
  - `CHECK`
  - `/dashboard` and homepage dashboard navigation still use default/latest creator resolution for convenience. Sensitive payout routes are scoped, but UX can be confusing when one auth user owns multiple creators.

## Guaranteed Behaviors

These are permanent regression guarantees. Future changes must preserve them.

- Duplicate Shopify order webhooks cannot create duplicate conversions.
- Duplicate Shopify order webhooks cannot create duplicate creator-network or brand-network earnings.
- Ambiguous attribution cannot create conversions, creator earnings, network earnings, or payout-eligible rows.
- Exact `partnerlinks_ref` attribution must win before any fallback logic.
- Webhook decisions must create diagnostics for both conversion and skipped outcomes.
- Stripe onboarding is creator-scoped and ownership-verified.
- Claim actions are creator-scoped and ownership-verified.
- Payout claims are idempotent by claim batch and Stripe transfer behavior.
- A successful claim creates one `creator_earning_claims` ledger row and one Stripe transfer per claim batch.
- Retry after a successful claim must not create a second transfer or duplicate claim ledger.
- Creator network economics stop after Level 3.
- Level 1 = 30%, Level 2 = 3%, Level 3 = 2%.
- Network earnings come only from `platform_fee_amount`, never from creator direct commission principal.
- No Level 4+ payout may be created.
- Entities may not earn network overrides from their own direct sales activity.
- Direct creator commission, PartnerLinks platform fee, and network override rewards must remain separate in ledgers, dashboards, settlement logic, and diagnostics.
- Live public payout claimability must not be based only on accounted earnings; it must require settlement-collected, explicit manual approval, or sufficient prepaid reserve status.

## Latest Audit Entries

### 2026-05-16 - Creator-Scoped Stripe Debug Hardening

- Severity: `SEV2`
- Status: `PASS`
- Impacted systems:
  - `GET /stripe/connect/debug`
  - `index.js`
- Finding:
  - Non-mutating Stripe debug visibility still used the old default/latest creator resolver.
- Root cause:
  - The route called `getSignedInCreator()` instead of resolving the explicit dashboard/requested creator.
- Mitigation:
  - Route now requires `creator_code`, resolves that exact creator, and verifies `creator.auth_user_id === authUser.id`.
- Safe behavior:
  - Missing or unauthorized creator context returns safe `403` JSON.
- Validation:
  - `node --check index.js`
  - `node --check services/stripeConnectService.js`

### 2026-05-16 - Creator System Reliability Matrix

- Severity: `SEV2`
- Status: `CHECK`
- Primary test identity:
  - `test-creator-04`
- Command:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04
```

- Result:
  - `PASS`: 11
  - `CHECK`: 3
  - `INFO`: 1
- Confirmed:
  - Exact `partnerlinks_ref` attribution for conversion `19`.
  - Direct commission `$2.70`.
  - Platform fee `$0.90`.
  - Level 1/2/3 earnings `$0.27`, `$0.03`, `$0.02`.
  - Claim ledger and Stripe test transfer for `test-creator-04`.
  - Ambiguous recent-click fallback skips attribution instead of guessing.
  - Duplicate Shopify webhook replay is idempotent and produces duplicate/skipped diagnostics.
  - Claim retry-after-success does not create a duplicate transfer or duplicate ledger.
- Remaining checks:
  - Failure recovery test in Stripe sandbox.

### 2026-05-16 - Economic Architecture Implementation Audit

- Severity: `SEV1`
- Status: `CHECK`
- Primary test identity:
  - `test-creator-04`
- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Read-only command:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04
```

- PASS:
  - Direct brand creator commission is created correctly for conversion `19`.
  - Direct commission is stored on `conversions` and separate from `creator_network_earnings`.
  - `platform_fee_amount` is stored separately on conversion `19`.
  - Level 1/2/3 creator network overrides are calculated from `platform_fee_amount`.
  - No Level 4+ creator-network override exists for the tested chain.
  - Source creator does not receive a network override from their own direct sale in the tested creator-chain path.
  - Direct commission was not reduced by network override payouts.
- CHECK:
  - Brand-origin network reward support is scaffolded but not proven end-to-end with test data.
  - Direct creator commission and network override money states are partly separated in dashboard data but still combined in lifecycle totals.
- GAP:
  - automated brand platform-fee collection is not built.
  - automated direct creator commission settlement from brands is not built.
  - settlement status is not yet a prerequisite for claimability.
  - refund/reversal and negative-balance ledgers are not built.
  - live Stripe payout automation is not enabled.
- Follow-up:
  - Add brand-origin economic test path.
  - Add own-activity exclusion regression report.
  - Define settlement status model before live public payout automation.

### 2026-05-16 - Settlement Status Model Defined

- Severity: `SEV1`
- Status: `CHECK`
- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Decision:
  - accounting states and settlement states must be separate.
  - live claimability should require `settlement_collected`, explicit manual approval, or sufficient prepaid reserve.
- Canonical states:
  - `attributed`
  - `settlement_pending`
  - `settlement_authorized`
  - `settlement_collected`
  - `settlement_failed`
  - `settlement_retrying`
  - `settlement_disputed`
  - `refund_pending`
  - `reversed`
  - `claimable`
  - `claimed`
- Beta recommendation:
  - manual approval gate plus reserve/prepaid or per-order settlement.
- GAP:
  - settlement tables/services/jobs are not built yet.
  - current test-mode claimability is still based on pending-window/lifecycle mechanics, not brand settlement status.

### 2026-05-16 - Settlement-Aware Claimability Code Audit

- Severity: `SEV1`
- Status: `CHECK`
- Impacted systems:
  - `services/trackingService.js`
  - `services/creatorNetworkService.js`
  - `services/earningsLifecycleService.js`
  - `services/creatorDashboardService.js`
  - `index.js`
  - `conversions`
  - `creator_network_earnings`
  - `brand_network_earnings`
  - `creator_earning_claims`
- Trigger:
  - New canonical invariant:
    - `claimable requires settlement_collected OR explicit_manual_approval OR sufficient_prepaid_reserve`
- Finding:
  - Current implementation remains time-window based.
  - New conversion and network earning rows receive `payout_status = pending` and `claimable_at = getClaimableAt()`.
  - `resolveLifecycleStatus()` treats `claimable_at <= now` as claimable.
  - `promoteClaimableEarningsForCreator()` updates rows to `claimable` based on `claimable_at`.
  - `getCreatorDashboardByCode()` calls promotion on dashboard load.
  - `renderCreatorEarningsLifecycle()` enables Claim earnings when owner, Stripe payouts, and `claimableEarnings > 0` are true.
  - `POST /earnings/claim` is creator-scoped but not settlement-scoped.
- Expected behavior:
  - Sandbox/test mode may use time-window claimability to validate mechanics.
  - Live payout automation must require settlement collection, explicit manual approval, or sufficient prepaid reserve.
- Actual behavior:
  - Current code has no settlement gate before claimability or claim execution.
- Safety status:
  - Safe for current Stripe test-mode reliability testing.
  - Unsafe for live creator payouts without settlement gates.
- Minimal future mitigation:
  - Add settlement status/manual approval/reserve fields.
  - Add central settlement eligibility service.
  - Modify promotion and reservation logic to require settlement eligibility.
  - Keep `claimable_at` as a review-window timestamp, not proof of funding.
- Validation:
  - Read-only code audit.
  - No runtime behavior changed.
- Follow-up:
  - Add feature flag or mode gate before live payout work.
  - Recommended beta behavior is manual approval or collected/reserve-funded settlement before claims.

### 2026-05-16 - Payout Mode Fail-Closed Claim Guard

- Severity: `SEV1`
- Status: `PASS`
- Regression ID:
  - `REG-SETTLEMENT-001`
- Impacted systems:
  - `config/config/env.js`
  - `index.js`
  - `/earnings/claim`
  - Creator Dashboard Claim earnings UI
- Trigger:
  - Current claimability is time-based and must not accidentally become live payout eligibility.
- Finding:
  - A minimal protective `PAYOUT_MODE` gate now blocks claim execution before `claimCreatorEarnings()` unless sandbox conditions are explicit.
- Implemented behavior:
  - default `PAYOUT_MODE` is `claims_disabled`.
  - unknown or missing mode blocks claims.
  - `claims_disabled` blocks claims.
  - `manual_approval` blocks claims until approval schema/service exists.
  - `settlement_gated` blocks claims until settlement schema/service exists.
  - `sandbox_time_based` allows the current claim flow only when `STRIPE_SECRET_KEY` starts with `sk_test_`.
- Dashboard behavior:
  - Claim button is disabled when payout mode blocks claims.
  - Dashboard shows a clear unavailable-until-settlement/approval message.
- Validation:
  - `node --check index.js`
  - `node --check config/config/env.js`
  - `node --check services/earningsLifecycleService.js`
  - `node --check services/creatorDashboardService.js`
- Follow-up:
  - Implement manual approval or settlement-gated claimability before live claims.

## Audit Entry Template

```markdown
### YYYY-MM-DD - Short Finding Title

- Severity: `SEV2`
- Status: `CHECK`
- Impacted systems:
  - route/service/table/script
- Trigger:
  - What prompted the audit or incident?
- Finding:
  - What was observed?
- Expected behavior:
  - What should happen?
- Actual behavior:
  - What happened?
- Root cause:
  - Known or suspected cause.
- Mitigation:
  - What changed or what guardrail exists?
- Validation:
  - Exact commands/tests run.
- Follow-up:
  - Remaining work.
```
