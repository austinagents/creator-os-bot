# PartnerLinks Reliability Audit

Purpose:

- Maintain a living, Git-friendly reliability record for PartnerLinks creator/referral/payout infrastructure.
- Track PASS/CHECK/FAIL findings from manual audits, scripts, production tests, and incidents.
- Preserve operational memory without creating autonomous mutation logic.

This file is implementation and reliability focused. Product philosophy belongs in `CHAT_HANDOFF.md`; current implementation status belongs in `PROJECT_STATUS.md`.

## Classification Guardrail

Reliability claims in this file must be interpreted by label:

- `RUNTIME-ENFORCED`: current code/schema actively enforces the behavior.
- `READ-ONLY DIAGNOSTIC`: current tooling exposes visibility only; it does not enforce or mutate.
- `DOCUMENTED ARCHITECTURE ONLY`: reliability principle or target design, not current enforcement.
- `PLANNED / NOT IMPLEMENTED`: future work.
- `MANUAL OPERATOR TASK`: requires human action outside the app runtime.
- `BLOCKED / NO-GO`: not safe for live payouts or public money movement.

If an entry lacks an explicit enforcement label, treat it as evidence or documentation, not a live financial control.

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
- Treat affiliate/referral abuse, synthetic commerce, disclosure risk, and settlement failure as product safety risks, not later compliance cleanup.
- Preserve the distinction:
  - `conversion_created` does not mean `safe_to_pay`.

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
  - Classification: `RUNTIME-ENFORCED`
  - `/stripe/connect/start`, `/stripe/connect/return`, `/stripe/connect/refresh`, `/earnings/claim`, and `/stripe/connect/debug?creator_code=...` use explicit creator context for sensitive Stripe behavior or Stripe diagnostics.
- Shopify deterministic attribution:
  - `PASS`
  - Classification: `RUNTIME-ENFORCED`
  - Cart/order attributes with `partnerlinks_ref`, `creator_code`, `brand_slug`, and `product_slug` have produced exact attribution without fallback.
- Creator economics:
  - `PASS`
  - Classification: `RUNTIME-ENFORCED` for current creator-origin Level 1/2/3 calculations; `DOCUMENTED ARCHITECTURE ONLY` for broader entity economics.
  - Test conversion for `test-creator-04` produced direct commission and Level 1/2/3 network earnings with no Level 4.
- Economic architecture:
  - `CHECK`
  - Classification: `DOCUMENTED ARCHITECTURE ONLY` except where explicitly reflected in current services/tables.
  - Canonical economic model is documented in `system-audit/ECONOMIC_ARCHITECTURE.md`. Future settlement automation must implement the documented separation of direct commission, platform fee, and network overrides.
- Payout lifecycle:
  - `PASS`
  - Classification: `RUNTIME-ENFORCED` for sandbox/test claim idempotency and payout-mode guard; `UNSAFE FOR LIVE PAYOUTS` until settlement gates exist.
  - `test-creator-04` completed Stripe test onboarding and successfully claimed direct commission through the real claim route.
- Duplicate webhook replay:
  - `PASS`
  - Classification: `RUNTIME-ENFORCED`
  - Signed duplicate Shopify webhook replay is idempotent: it returns safely, records duplicate diagnostics, and does not create duplicate conversions or earnings.
- Ambiguous fallback safety:
  - `PASS`
  - Classification: `RUNTIME-ENFORCED`
  - When deterministic Shopify attribution is missing and multiple recent clicks could match, attribution is skipped instead of guessed.
- Multi-creator convenience navigation:
  - `CHECK`
  - Classification: `RUNTIME-ENFORCED` for sensitive routes; `PLANNED / NOT IMPLEMENTED` for broader UX simplification.
  - `/dashboard` and homepage dashboard navigation still use default/latest creator resolution for convenience. Sensitive payout routes are scoped, but UX can be confusing when one auth user owns multiple creators.

## Enforcement Boundary Summary

`RUNTIME-ENFORCED`:

- HMAC verification for Shopify `orders/paid`.
- exact `partnerlinks_ref` matching before fallback.
- ambiguous fallback skip behavior.
- duplicate conversion prevention.
- creator-scoped Stripe/claim routes.
- payout-mode fail-closed guard.
- current creator-origin Level 1/2/3 network economics.
- lineage dual-binding guard in normal invite binding.

`READ-ONLY DIAGNOSTIC`:

- `shopify_attribution_events`.
- Discord `/shopify_attribution_debug`.
- `productionSafetyTest.js` report modes.
- route-risk report.
- refund/reversal table presence reports.

`DOCUMENTED ARCHITECTURE ONLY` / `PLANNED / NOT IMPLEMENTED`:

- automated settlement collection.
- settlement-aware live claim promotion.
- refund/chargeback enforcement.
- negative balance offsets.
- payout clawbacks.
- synthetic-commerce risk scoring.
- daily threat intelligence scans.

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
- Creators may not be accidentally dual-bound to both creator-origin and brand-origin lineage through normal invite/signup flows.
- Direct creator commission, PartnerLinks platform fee, and network override rewards must remain separate in ledgers, dashboards, settlement logic, and diagnostics.
- Live public payout claimability must not be based only on accounted earnings; it must require settlement-collected, explicit manual approval, or sufficient prepaid reserve status.
- Failed settlement cannot release claimability.
- Refunds after payout must create offset/reversal records, not silent deletion.
- Duplicate webhooks cannot create duplicate settlement items.
- Manual approval must be auditable.
- No payout may be released just because a conversion exists.
- Recruitment alone cannot generate PartnerLinks revenue or network payouts.
- Creator-facing UX must not obscure that links may create compensation.
- PartnerLinks must not send referral messages to third parties without proper consent and safeguards.

## Platform Safety Risk Model

PartnerLinks must defend against real affiliate/referral/creator reward failure modes:

- attribution hijacking / cookie stuffing.
- cookie stuffing / affiliate attribution fraud.
- affiliate network liability for deceptive affiliates.
- last-click, extension, and coupon attribution theft.
- synthetic commerce.
- fake account/referral abuse.
- Shopify app data exposure risk.
- authorization / resource-scoping bugs.
- Stripe Connect / platform payout fraud.
- recruitment-only economics risk.
- duplicate webhook/payment replay.
- payout leakage and unfunded earnings.
- refunds, chargebacks, and reversals.
- failed brand settlement.
- creator disclosure/compliance risk.
- unsolicited referral messaging.
- referral messaging legal risk.
- FTC endorsement/disclosure risk.
- UI/UX money-state confusion.
- referral param injection / malicious tracking params.
- SQL injection / backend query safety.
- synthetic identity networks / fake creator farms.
- product and brand verification risk.
- affiliate link hijacking / attribution replacement.
- data breach / secret exposure.
- refund fraud / chargeback farming.
- internal tooling / admin abuse.
- small/mid-size platform fragility.
- affiliate/plugin SQL injection.
- fake account/reward exploitation.
- synthetic network/user metrics.
- incentive-plan gaming.
- SMS/communication cost abuse.
- third-party app/plugin fragility.
- AI/research/documentation hallucination.

Platform safety rule:

```text
conversion_created != safe_to_pay
```

Payout requires:

- deterministic attribution.
- acceptable commerce quality.
- settlement/funding safety.
- refund/reversal handling.
- explicit payout eligibility.

Additional security regression categories:

- `PARAM_INJECTION`
- `SQL_INJECTION`
- `COOKIE_STUFFING`
- `AFFILIATE_NETWORK_LIABILITY`
- `FAKE_IDENTITY_NETWORKS`
- `PRODUCT_VERIFICATION`
- `SHOPIFY_APP_DATA_RISK`
- `AUTHORIZATION_SCOPE_BUGS`
- `STRIPE_CONNECT_FRAUD`
- `REFERRAL_MESSAGING_COMPLIANCE`
- `AFFILIATE_LINK_HIJACKING`
- `DATA_BREACH_RESPONSE`
- `REFUND_FRAUD`
- `ADMIN_TOOLING_SAFETY`
- `SMALL_PLATFORM_FRAGILITY`
- `PLUGIN_SQL_INJECTION`
- `FAKE_ACCOUNT_REWARDS`
- `SYNTHETIC_NETWORK_METRICS`
- `INCENTIVE_GAMING`
- `COMMS_COST_ABUSE`
- `THIRD_PARTY_APP_RISK`
- `DOCS_SOURCE_INTEGRITY`

## Latest Audit Entries

### 2026-05-17 - Creator/Brand Lineage Dual-Binding Guard

- Severity: `SEV1`
- Status: `MITIGATED`
- Impacted systems:
  - `services/creatorNetworkService.js`
  - `/join/:creatorCode`
  - `/join/brand/:brandSlug`
  - `creators.parent_creator_id`
  - `creators.invited_by_brand_id`
- Finding:
  - `bindCreatorToBrandOrigin()` already refused brand-origin binding when creator-origin lineage existed, but `bindCreatorToInviteSession()` did not explicitly refuse creator-origin binding when brand-origin lineage existed.
- Mitigation:
  - creator-origin invite binding now reads `invited_by_brand_id`.
  - creator-origin invite binding skips safely if `parent_creator_id` or `invited_by_brand_id` is already set.
  - update guard also requires `invited_by_brand_id IS NULL` so concurrent/stale state fails closed.
- Regression rule:
  - `REG-LINEAGE-001`: A creator cannot be accidentally dual-bound to both brand-origin and creator-origin lineage.
- Validation:
  - `node --check services/creatorNetworkService.js`
  - `node --check index.js`

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

### 2026-05-16 - Post-Payout-Mode Attribution And Conversion Read-Only Validation

- Severity: `SEV1`
- Status: `PASS`
- Primary test identity:
  - `test-creator-04`
- Trigger:
  - Verify attribution/conversion behavior still works after adding the `PAYOUT_MODE` fail-closed claim guard.
- Commands:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04
node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548682670254 --creator-code test-creator-04
node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548718420142
node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:7659900000001
```

- Confirmed deterministic conversion:
  - `order_id = shopify:partnerlinks-test.myshopify.com:6548682670254`
  - `conversion_id = 19`
  - `matched_creator_code = test-creator-04`
  - `matched_product_slug = test-product`
  - `attribution_source = partnerlinks_ref`
  - `attribution_confidence = exact`
  - `fallback_used = false`
  - `click_id = 24`
  - `session_id = bd837fcf-3a53-4372-811e-e9a082b137f5`
- Confirmed economics:
  - direct commission = `2.70`
  - `platform_fee_amount = 0.90`
  - Level 1 `test-creator-03` = `0.27`
  - Level 2 `test-creator-02` = `0.03`
  - Level 3 `test-creator-01` = `0.02`
  - no Level 4+ rows.
- Confirmed duplicate replay safety:
  - `order_id = shopify:partnerlinks-test.myshopify.com:6548718420142`
  - original diagnostic `decision = conversion_created`
  - duplicate diagnostics `id = 10` and `id = 11`
  - duplicate diagnostics `decision = duplicate_skipped`
  - `duplicate_order = true`
  - no duplicate conversion groups found.
  - no duplicate creator-network or brand-network earning keys found.
- Confirmed ambiguous fallback safety:
  - `order_id = shopify:partnerlinks-test.myshopify.com:7659900000001`
  - diagnostic `id = 12`
  - `decision = skipped`
  - `unmatched_reason = ambiguous_recent_click_fallback`
  - `attribution_source = unmatched`
  - `attribution_confidence = none`
  - no conversion found for the ambiguous order.
  - no creator-network or brand-network earnings found for the ambiguous order.
- Result:
  - `PAYOUT_MODE` claim guard did not break referral click persistence, attribution sessions, exact partnerlinks_ref attribution, conversion creation, direct commission creation, platform fee accounting, Level 1/2/3 network earnings, duplicate webhook idempotency, or ambiguous fallback skip behavior.
- No controlled writes executed:
  - no new clicks.
  - no webhook replays.
  - no conversions.
  - no payouts.

### 2026-05-16 - Brand Settlement Automation Architecture Defined

- Severity: `SEV1`
- Status: `CHECK`
- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Trigger:
  - Automated brand funding is the next unresolved system after attribution, conversion creation, network earnings, payout safety, duplicate replay, ambiguous fallback, and payout mode fail-closed behavior were validated.
- Architecture decision:
  - each brand gets a Stripe Customer.
  - saved brand payment method is collected through SetupIntent.
  - settlement is tracked through `settlement_batches` and `settlement_items`.
  - direct commission, platform fee, and network override obligations are separate settlement items.
  - claimability releases only when the relevant item is collected, manually approved, or reserve-covered.
- Settlement options:
  - per-order PaymentIntent for maximum traceability in controlled beta.
  - daily batch settlement as the likely early-production default.
  - weekly batch only for trusted brands or reserve-backed terms.
  - Stripe Billing/invoices for daily/weekly brand statements, retries, and accounting clarity.
  - prepaid/reserve balance for fastest safe creator claimability.
- Safest controlled-beta model:
  - Stripe Customer + SetupIntent.
  - earnings remain settlement pending.
  - operator reviews first conversions.
  - release claimability only through per-order collection, reserve coverage, or explicit manual approval.
- Required before live automation:
  - settlement tables.
  - brand billing service.
  - settlement service.
  - refund/reversal ledger.
  - failed payment retry/alert flow.
  - operator diagnostics for blocking settlement items.
- Validation:
  - documentation-only architecture pass.
  - no runtime behavior changed.

### 2026-05-16 - Canonical Settlement State Machine Defined

- Severity: `SEV1`
- Status: `CHECK`
- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Trigger:
  - Settlement must be explicit and regression-testable before any settlement code exists.
- Defined states:
  - `attributed`
  - `settlement_pending`
  - `settlement_authorized`
  - `settlement_collected`
  - `settlement_failed`
  - `settlement_retrying`
  - `settlement_disputed`
  - `refund_pending`
  - `reversed`
  - `manual_approved`
  - `reserve_covered`
  - `claimable`
  - `claim_reserved`
  - `claimed`
  - `claim_failed`
  - `offset_required`
- Required path coverage:
  - happy path.
  - duplicate/replay.
  - ambiguous attribution.
  - failed brand settlement.
  - refund before payout.
  - refund after payout.
  - manual approval.
  - prepaid reserve.
  - claim lifecycle.
  - brand-origin network override.
  - creator-origin network override.
- New regression guarantees:
  - `REG-SETTLEMENT-002`: no payout before `settlement_collected`, `manual_approved`, or `reserve_covered`.
  - `REG-SETTLEMENT-003`: failed settlement cannot create claimable earnings.
  - `REG-SETTLEMENT-004`: refunds after payout create offset/reversal records, not silent deletion.
  - `REG-SETTLEMENT-005`: claim retries cannot create duplicate Stripe transfers.
  - `REG-SETTLEMENT-006`: duplicate webhooks cannot create duplicate settlement items.
  - `REG-SETTLEMENT-007`: manual approval must be auditable.
- Validation:
  - documentation-only state-machine pass.
  - no runtime behavior changed.
- Follow-up:
  - future settlement implementation must enforce legal transitions and emit audit events for every transition.

### 2026-05-16 - Affiliate/Referral Platform Safety Risk Model Added

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - PartnerLinks must explicitly defend against known affiliate/referral failure modes before public launch.
- Added risk categories:
  - `ATTRIBUTION_HIJACKING`
  - `SYNTHETIC_COMMERCE`
  - `REFUND_REVERSAL`
  - `SETTLEMENT_FAILURE`
  - `PAYOUT_IDEMPOTENCY`
  - `CREATOR_DISCLOSURE`
  - `REFERRAL_ABUSE`
  - `DASHBOARD_MONEY_CLARITY`
  - `WEBHOOK_REPLAY`
  - `NETWORK_ECONOMICS`
- Core operating model:
  - Shopify is the checkout/order source.
  - PartnerLinks is attribution/accounting/network-economics infrastructure.
  - Stripe is the payout and settlement rail.
  - direct creator commission is brand-funded.
  - network overrides are funded only from eligible downstream PartnerLinks `platform_fee_amount`.
- Added/expanded risks:
  - attribution hijacking/cookie stuffing.
  - extension/coupon attribution theft.
  - synthetic commerce.
  - referral/fake account abuse.
  - MLM/recruitment-only legal risk.
  - duplicate webhook/payment replay.
  - payout leakage/unfunded earnings.
  - refund/chargeback/reversal leakage.
  - creator disclosure risk.
  - unsolicited referral messaging risk.
  - dashboard money-state confusion.
- Validation:
  - documentation/risk-modeling pass only.
  - no runtime behavior changed.

### 2026-05-16 - Security Exploit And Platform Abuse Risk Model Added

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - PartnerLinks must explicitly model exploit, hacking, and platform abuse patterns seen in affiliate systems, creator reward systems, marketplaces, gig platforms, and payout infrastructure.
- Added risk categories:
  - `PARAM_INJECTION`
  - `SQL_INJECTION`
  - `FAKE_IDENTITY_NETWORKS`
  - `PRODUCT_VERIFICATION`
  - `AFFILIATE_LINK_HIJACKING`
  - `DATA_BREACH_RESPONSE`
  - `REFUND_FRAUD`
  - `ADMIN_TOOLING_SAFETY`
- Required defenses documented:
  - sanitize, validate, length-limit, escape, and log suspicious tracking params.
  - no raw user-controlled SQL.
  - service-role keys remain server-side only.
  - monitor identity clusters and abnormal network growth.
  - verify public brands/products before broad promotion.
  - exact deterministic attribution cannot be replaced by late/low-confidence sources.
  - secrets must not leak through logs/debug/client code.
  - refund-heavy behavior must remain reviewable.
  - admin/debug tools are read-only by default and audited when mutating.
- Validation:
  - documentation/risk-modeling pass only.
  - no runtime behavior changed.

### 2026-05-16 - Deep Fraud, Abuse, And Catastrophic-Risk Model Added

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - PartnerLinks must explicitly model the real-world failures that have damaged affiliate networks, marketplaces, Shopify apps, referral systems, and payout platforms.
- Real-world patterns incorporated:
  - cookie stuffing / improper affiliate attribution.
  - affiliate network liability for deceptive affiliates.
  - coupon/browser extension attribution hijacking.
  - synthetic commerce and marketplace payout fraud.
  - fake account and reward farming.
  - Shopify app/provider data exposure.
  - authorization/resource-scoping bugs.
  - Stripe Connect/platform payout fraud.
  - referral messaging legal risk.
  - FTC endorsement/disclosure risk.
  - SQL/parameter injection in affiliate systems.
  - refund/chargeback farming.
- Added/expanded categories:
  - `COOKIE_STUFFING`
  - `AFFILIATE_NETWORK_LIABILITY`
  - `SHOPIFY_APP_DATA_RISK`
  - `AUTHORIZATION_SCOPE_BUGS`
  - `STRIPE_CONNECT_FRAUD`
  - `REFERRAL_MESSAGING_COMPLIANCE`
- Added regression rules:
  - `REG-SAFETY-006` through `REG-SAFETY-012`.
- Core safety restatement:
  - no payout just because a conversion exists.
  - no third-party onboarding result is sufficient fraud approval.
  - sensitive creator/brand actions require explicit scoped ownership.
  - PartnerLinks must minimize customer/payment-sensitive data and protect all tokens/secrets.
- Validation:
  - documentation/risk-modeling pass only.
  - no runtime behavior changed.

### 2026-05-16 - Small Platform Fragility Risk Model Added

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - PartnerLinks must assume that a single serious exploit, fake-account loop, payout leak, or data exposure could materially damage or kill the company.
- Scope:
  - smaller platforms.
  - Shopify apps.
  - affiliate/referral plugins.
  - early-stage fintech and creator reward companies.
- Source-backed patterns incorporated from project research:
  - affiliate software SQL injection.
  - fake account/reward exploitation.
  - fake user metrics and synthetic network value.
  - incentive-plan gaming.
  - SMS/communication cost abuse.
  - third-party app/plugin fragility.
  - AI/research/documentation hallucination risk.
- Added categories:
  - `SMALL_PLATFORM_FRAGILITY`
  - `PLUGIN_SQL_INJECTION`
  - `FAKE_ACCOUNT_REWARDS`
  - `SYNTHETIC_NETWORK_METRICS`
  - `INCENTIVE_GAMING`
  - `COMMS_COST_ABUSE`
  - `THIRD_PARTY_APP_RISK`
  - `DOCS_SOURCE_INTEGRITY`
- Added regression rules:
  - `REG-SAFETY-013`
  - `REG-METRICS-001`
  - `REG-COMMS-001`
  - `REG-DATA-001`
  - `REG-DOCS-001`
- Regression ID note:
  - requested incentive-gaming rule was not assigned to `REG-SAFETY-010` because that ID is already reserved for refund/chargeback reversal integrity.
- Validation:
  - documentation/risk-modeling pass only.
  - no runtime behavior changed.

### 2026-05-17 - Failure-Condition Financial Correctness Layer Defined

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - Happy-path referral attribution, direct commission accounting, Level 1/2/3 network propagation, collision handling, duplicate webhook idempotency, lineage isolation, and sandbox claim flow are proven.
  - The next reliability layer is financial correctness when commerce, settlement, or payout assumptions fail.
- Impacted systems:
  - `conversions`
  - `creator_network_earnings`
  - `brand_network_earnings`
  - `creator_earning_claims`
  - future `settlement_batches`
  - future `settlement_items`
  - future `refund_reversal_events`
  - future `earning_reversal_items`
  - future risk/hold ledgers.
- Findings:
  - Refund, chargeback, partial refund, post-payout reversal, failed settlement, synthetic-commerce hold, and brand-origin economic proof paths must be explicit before public beta.
  - `conversion_created` is not equivalent to `safe_to_pay`.
  - Current payout protection is fail-closed for live mode through `PAYOUT_MODE`, but refund/reversal and settlement eligibility ledgers are not built.
- Required invariants:
  - full or partial refunds reverse direct creator commission and all platform-fee-derived network overrides proportionally.
  - post-payout refunds create offset/negative-balance records, not silent edits or deletion.
  - chargebacks and disputes hold claimability until resolved or manually approved.
  - live claim promotion requires `settlement_collected`, `manual_approved`, or `reserve_covered`.
  - duplicate refund, settlement, replay, and transfer events must be idempotent.
  - synthetic commerce and risk holds cannot create payout eligibility; they can only block or require review.
- Brand-origin economics:
  - onboarding lineage is proven.
  - brand-origin network earnings still need end-to-end validation from downstream real commerce.
  - future proof must show platform-fee-only funding, no self-generated override, no creator-origin contamination, and settlement gating.
- Recommended implementation sequence:
  1. Extend read-only reliability reports in `scripts/productionSafetyTest.js`.
  2. Add refund/reversal schema and diagnostics.
  3. Add settlement item schema and central eligibility service.
  4. Add manual approval and reserve coverage gates.
  5. Add Shopify refund/dispute webhook ingestion.
  6. Add risk holds and operator review queue.
- Validation:
  - documentation/architecture pass only.
  - no runtime behavior changed.
  - no payout math, Stripe logic, settlement logic, or deploy action changed.

### 2026-05-17 - Financial Failure Implementation Sequence Approved

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - PartnerLinks is ready to begin controlled implementation planning for financial-failure infrastructure.
- Decision:
  - implement in small isolated phases, with refund/reversal ledger infrastructure first.
  - do not start with payout clawbacks, Stripe reversals, negative-balance collection, settlement automation, or risk scoring.
- Approved order:
  1. Refund / reversal ledger infrastructure.
  2. Settlement-state runtime schema.
  3. Read-only invariant reporting expansion.
  4. Controlled-beta synthetic-commerce detection.
  5. Read-only threat intelligence / audit monitor.
  6. Replay / idempotency hardening across refunds, reversals, settlements, claims, and transfers.
- Minimal first runtime patch:
  - additive migration for `financial_reversal_events` and `financial_reversal_items`.
  - immutable audit rows only.
  - no automatic money movement.
  - no automatic payout mutation.
  - no dashboard balance changes until explicit reversal application logic is reviewed.
- Migration safety rules:
  - additive-only first.
  - no destructive SQL.
  - no historical backfill required.
  - unique idempotency key for reversal events.
  - no full customer/payment payload storage.
- Required validation:
  - migration SQL pasted for manual Supabase execution.
  - read-only `productionSafetyTest.js` before and after.
  - `node --check` for any touched JS.
  - docs updated with new invariants and rollback/disable behavior.
- Validation:
  - documentation/sequencing pass only.
  - no runtime behavior changed.

### 2026-05-17 - Migration 016 Financial Reversal Ledger Created

- Severity: `SEV1`
- Status: `CHECK`
- Trigger:
  - first approved controlled runtime patch for financial-failure infrastructure.
- File:
  - `database/migrations/016_financial_reversal_ledger.sql`
- Scope:
  - additive-only schema infrastructure.
  - creates `financial_reversal_events`.
  - creates `financial_reversal_items`.
- Safety boundary:
  - no dashboard total changes.
  - no `payout_status` changes.
  - no Stripe reversals.
  - no payout clawbacks.
  - no negative-balance collection.
  - no claim logic changes.
  - no settlement logic changes.
  - no attribution logic changes.
- Financial-safety features:
  - unique reversal event `idempotency_key`.
  - source system and source event tracking.
  - links to affected conversion/network/brand/claim rows where applicable.
  - `offset_required` and `offset_status` for future negative-balance/offset behavior.
  - minimal non-sensitive evidence field.
- Operational status:
  - migration created locally.
  - SQL not run automatically.
  - requires manual Supabase SQL Editor execution when approved.
- Validation:
  - `git diff --check`.
  - no runtime JS touched.

### 2026-05-17 - Controlled Real-Money Attribution-Only Beta Readiness Audit

- Severity: `SEV1`
- Status: `CHECK`
- GO / NO-GO:
  - real-money attribution/accounting-only beta: `GO WITH MANUAL OWNER CHECKS`.
  - live creator payouts: `NO-GO`.
- Environment safety:
  - production recommendation remains `PAYOUT_MODE=claims_disabled`.
  - missing `PAYOUT_MODE` defaults to `claims_disabled`.
  - `sandbox_time_based` is safe only with a Stripe test key.
  - local development currently reports `PAYOUT_MODE=sandbox_time_based` and Stripe key mode `test`; this is not the production recommendation.
  - claim route checks the payout-mode gate before `claimCreatorEarnings()`.
- Shopify readiness:
  - `orders/paid` handler uses raw-body HMAC verification.
  - duplicate order idempotency is already validated for conversion creation.
  - product referrals persist attribution through Shopify cart/order attributes.
  - `shopify_attribution_events` provides operator diagnostics.
- Required Shopify topics for beta/app readiness:
  - `orders/paid`.
  - refund handling next through `refunds/create` or current equivalent refund/order update strategy.
  - compliance/privacy topics later for app review: `customers/data_request`, `customers/redact`, `shop/redact`.
- Refund/reversal readiness:
  - `financial_reversal_events` exists and is readable.
  - `financial_reversal_items` exists and is readable.
  - both tables currently contain `0` rows.
  - migration 016 is observability/accounting only and does not enforce reversals.
- Settlement readiness:
  - current runtime accounts earnings but does not prove funding.
  - live claimability remains blocked until `settlement_collected`, manual approval, or reserve coverage exists.
- Validation:
  - read-only Supabase count/read checks.
  - `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`.
  - no data mutation, deploy, push, or live payout action.

### 2026-05-17 - Read-Only Operator Reporting Expansion

- Severity: `SEV2`
- Status: `CHECK`
- Impacted systems:
  - `scripts/productionSafetyTest.js`
- Finding:
  - Added read-only report modes so operators can inspect attribution, economics, lineage, refund/reversal readiness, settlement readiness, risk signals, and route-risk assumptions without mutating financial rows.
- New report modes:
  - `--order-report`
  - `--actor-matrix`
  - `--lineage-report`
  - `--economic-report`
  - `--refund-report`
  - `--settlement-report`
  - `--risk-report`
  - `--route-risk-report`
- Lookup inputs:
  - `--order-id`
  - `--partnerlinks-ref`
  - `--creator-code`
  - `--brand-id`
  - `--shop-domain`
- Safety boundary:
  - Reports only read Supabase rows and local route source.
  - Reports do not apply refunds, change payout status, create claims, create Stripe transfers, change settlement state, or mutate conversion/earning rows.
- Validation:
  - `node --check scripts/productionSafetyTest.js`
  - `git diff --check`
  - Supabase-backed reports completed read-only:
    - `--report --matrix-report`
    - `--actor-matrix --lineage-report --economic-report --refund-report --settlement-report --risk-report --route-risk-report`
    - `--order-report --order-id shopify:partnerlinks-test.myshopify.com:6549690941614`
- Result:
  - No data mutation, deploy, push, live payout, settlement enforcement, refund application, or Stripe transfer occurred.
  - New reports confirmed zero dual-lineage rows, zero self-parent rows, zero circular lineage findings, zero Level 4+ findings, zero self-generated network override findings, readable empty reversal tables, and exact `partnerlinks_ref` attribution for the tested order.

### 2026-05-17 - Diagnostic-Only Shopify Refund Capture And Settlement Schema Proposal

- Severity: `SEV1`
- Status: `CHECK`
- Impacted systems:
  - `POST /webhooks/shopify/refunds-create`
  - `services/shopifyWebhookService.js`
  - `financial_reversal_events`
  - `financial_reversal_items`
  - `database/migrations/017_settlement_state_runtime_schema.sql`
  - `scripts/productionSafetyTest.js`
- Classification:
  - refund webhook HMAC verification: `RUNTIME-ENFORCED`
  - reversal event/item capture: `RUNTIME-ENFORCED` for diagnostics only
  - reversal application: `PLANNED / NOT IMPLEMENTED`
  - settlement schema: `PLANNED / NOT IMPLEMENTED` until migration is manually run
  - live payout release: `BLOCKED / NO-GO`
- Finding:
  - Added a diagnostic-only Shopify refund webhook endpoint that captures refund/reversal observability without mutating payout, claimability, dashboard, settlement, or Stripe transfer state.
  - Added an additive settlement state migration proposal for future settlement batches/items and row-level settlement/risk/manual-approval metadata.
  - Added read-only idempotency reporting for conversion, network earning, reversal, settlement item, claim transfer, and duplicate webhook diagnostics.
- Safety boundary:
  - Refund webhook verifies Shopify HMAC.
  - Refund capture uses a deterministic idempotency key.
  - Evidence is intentionally minimal and non-sensitive.
  - `financial_reversal_items` are written only when the source conversion can be matched safely.
  - No refund enforcement or payout offset is applied.
- Validation:
  - `node --check index.js`
  - `node --check services/shopifyWebhookService.js`
  - `node --check scripts/productionSafetyTest.js`
- Follow-up:
  - Manually review and run migration 017 only after approval.
  - Register Shopify refund webhook only when ready for diagnostic capture.
  - Later build explicit reversal enforcement as a separate, gated patch.

### 2026-05-17 - Duplicate Conversion Idempotency Classification

- Severity: `SEV2`
- Status: `CHECK`
- Impacted systems:
  - `scripts/productionSafetyTest.js`
  - `conversions`
- Finding:
  - The idempotency report now classifies duplicate conversion order ids by namespace/source.
  - `shopify:*` duplicate order ids remain `FAIL` launch blockers.
  - non-Shopify/manual/test duplicates are labeled as hygiene findings unless linked to earnings, claims, payouts, reversals, settlement items, or network rows.
- Known historical hygiene item:
  - `test-network-001` conversion ids `2` and `3`.
  - created `2026-05-13`.
  - `source=manual`, `notes=network test`.
  - brand `8` / creator `4`.
  - no Shopify attribution events, network earnings, reversal rows, claim rows, claimed state, or reserved payout batch.
- Safety finding:
  - Current Shopify conversion safety remains clean: `11` Shopify conversions and `0` duplicate Shopify order ids.
- Validation:
  - `node scripts/productionSafetyTest.js --dry-run --idempotency-report`
  - `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`

### 2026-05-17 - Settlement-Aware Claimability Gate

- Severity: `SEV1`
- Status: `CHECK`
- Impacted systems:
  - `services/payoutModeService.js`
  - `services/earningsLifecycleService.js`
  - `services/creatorDashboardService.js`
  - `/earnings/claim`
  - Creator Dashboard earnings display
- Finding:
  - Claimability now routes through a payout-mode gate instead of assuming `claimable_at` is sufficient in every mode.
  - `claims_disabled` and unknown/missing modes fail closed.
  - `sandbox_time_based` keeps current sandbox behavior only with `sk_test_`.
  - `manual_approval` only permits rows explicitly marked manual-approved.
  - `settlement_gated` only permits rows marked settlement-collected or reserve-covered.
- Safety boundary:
  - Production remains `claims_disabled`.
  - Stripe transfer creation remains test-mode guarded.
  - No live payouts, settlement collection, refund enforcement, payout math changes, or claim ledger schema changes were introduced.
- Dashboard result:
  - Creator Dashboard now separates Accounted earnings, Pending settlement, Claimable earnings, and Claimed earnings.
- Validation:
  - `node --check index.js`
  - `node --check services/payoutModeService.js`
  - `node --check services/earningsLifecycleService.js`
  - `node --check services/creatorDashboardService.js`
  - `node scripts/productionSafetyTest.js --dry-run --settlement-report`
  - `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`

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
