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

## Enforcement Labels

Use these labels to prevent confusing test coverage with runtime controls:

- `RUNTIME-ENFORCED`: app/schema currently enforces this behavior.
- `READ-ONLY DIAGNOSTIC`: test/report observes behavior only.
- `DOCUMENTED ARCHITECTURE ONLY`: documented target, not currently enforced.
- `PLANNED / NOT IMPLEMENTED`: not built yet.
- `MANUAL OPERATOR TASK`: requires human action.
- `BLOCKED / NO-GO`: unsafe until further runtime controls exist.

Test entries may prove `RUNTIME-ENFORCED` behavior, but a test entry alone does not create runtime enforcement.

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
- `ATTRIBUTION_HIJACKING`: cookie stuffing, forced attribution, extension/coupon override attempts.
- `COOKIE_STUFFING`: attribution set without genuine referral intent.
- `PARAM_INJECTION`: malformed referral/tracking/query param handling.
- `SQL_INJECTION`: backend query safety and raw SQL prevention.
- `PLUGIN_SQL_INJECTION`: plugin/app-style SQL injection risks in affiliate/referral tooling.
- `SMALL_PLATFORM_FRAGILITY`: risks that can materially damage or kill a smaller platform.
- `FAKE_ACCOUNT_REWARDS`: fake-account reward exploitation and signup/reward farming.
- `SYNTHETIC_NETWORK_METRICS`: fake creator/network/user metrics that inflate perceived value.
- `INCENTIVE_GAMING`: unsafe incentive design that rewards non-commerce or synthetic activity.
- `COMMS_COST_ABUSE`: SMS/email/invite cost abuse and referral messaging spam.
- `THIRD_PARTY_APP_RISK`: app/plugin fragility around merchant tokens, customer data, and payout logic.
- `DOCS_SOURCE_INTEGRITY`: source separation and hallucination prevention in risk/compliance docs.
- `WEBHOOK_IDEMPOTENCY`: HMAC, duplicate order prevention, diagnostics.
- `WEBHOOK_REPLAY`: duplicate webhook/payment event handling.
- `ECONOMICS`: direct commission, platform fee, Level 1/2/3, no Level 4.
- `NETWORK_ECONOMICS`: recruitment-only prevention, downstream platform-fee funding, self-override exclusion.
- `LINEAGE_INTEGRITY`: creator-origin, brand-origin, attribution, and payout lineage isolation.
- `SYNTHETIC_COMMERCE`: fake/circular/refund-loop order patterns and payout holds.
- `FAKE_IDENTITY_NETWORKS`: creator/brand/account clusters and synthetic identity patterns.
- `REFUND_REVERSAL`: refund/chargeback/reversal state and offset behavior.
- `REFUND_FRAUD`: refund loops, chargeback farming, stolen-card/collusion patterns.
- `SETTLEMENT_FAILURE`: failed brand funding and retry behavior.
- `PAYOUT_LIFECYCLE`: pending -> claimable -> claimed, claim batches, Stripe transfers.
- `PAYOUT_IDEMPOTENCY`: no duplicate transfers, no duplicate settlement/payout mutations.
- `SECURITY_ISOLATION`: cross-creator access, route scoping, no service-role exposure.
- `DIAGNOSTICS`: audit trail, debug commands/routes, operator clarity.
- `UI_GUARDRAIL`: universal product cards, dashboard visual consistency.
- `CREATOR_DISCLOSURE`: creator-facing compensation disclosure clarity.
- `REFERRAL_ABUSE`: fake account/referral spam/unsolicited outreach safeguards.
- `PRODUCT_VERIFICATION`: brand/store/product legitimacy and moderation.
- `SHOPIFY_APP_DATA_RISK`: Shopify app token/customer/order data minimization and breach response.
- `AUTHORIZATION_SCOPE_BUGS`: explicit resource ownership checks for creator/brand/admin actions.
- `STRIPE_CONNECT_FRAUD`: connected-account fraud, stolen-card/fake-transaction payout extraction.
- `AFFILIATE_NETWORK_LIABILITY`: platform liability for deceptive affiliate/creator promotion.
- `REFERRAL_MESSAGING_COMPLIANCE`: consent requirements for referral invite messaging.
- `AFFILIATE_LINK_HIJACKING`: attribution replacement by extensions/coupons/late redirects.
- `DATA_BREACH_RESPONSE`: secret exposure, debug route protection, rotation runbooks.
- `ADMIN_TOOLING_SAFETY`: admin/debug mutation guardrails and audit logs.
- `DASHBOARD_MONEY_CLARITY`: accounted vs funded vs claimable money-state clarity.

## Guaranteed Behaviors

Important:

- Some guarantees are already `RUNTIME-ENFORCED`.
- Some guarantees are `DOCUMENTED ARCHITECTURE ONLY` or `PLANNED / NOT IMPLEMENTED` until future settlement/refund/risk systems are built.
- Live payout safety claims are `BLOCKED / NO-GO` unless a guarantee explicitly says it is runtime-enforced today.

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
- `REG-LINEAGE-001`: A creator cannot be accidentally dual-bound to both brand-origin and creator-origin lineage.
- `REG-SETTLEMENT-001`: Live claimability must not be based only on `claimable_at`.
- `REG-SETTLEMENT-002`: No payout before `settlement_collected`, `manual_approved`, or `reserve_covered`.
- `REG-SETTLEMENT-003`: Failed settlement cannot create claimable earnings.
- `REG-SETTLEMENT-004`: Refunds after payout create offset/reversal records, not silent deletion.
- `REG-SETTLEMENT-005`: Claim retries cannot create duplicate Stripe transfers.
- `REG-SETTLEMENT-006`: Duplicate webhooks cannot create duplicate settlement items.
- `REG-SETTLEMENT-007`: Manual approval must be auditable.
- `REG-SAFETY-001`: No live payout is released just because a conversion exists.
- `REG-SAFETY-002`: Recruitment alone cannot generate PartnerLinks revenue or network payouts.
- `REG-SAFETY-003`: Creator-facing UX must not obscure that links may create compensation.
- `REG-SAFETY-004`: PartnerLinks must not send referral messages to third parties without proper consent and safeguards.
- `REG-SAFETY-005`: Dashboard money states must distinguish accounted earnings from funded/claimable earnings.
- `REG-SAFETY-006`: Referral/tracking params must not become injection surfaces.
- `REG-SAFETY-007`: PartnerLinks must not store/log unnecessary customer or payment-sensitive data.
- `REG-SAFETY-008`: Every sensitive creator/brand action must use explicit scoped ownership checks.
- `REG-SAFETY-009`: New creators, brands, and high-risk activity must not be able to instantly extract payouts.
- `REG-SAFETY-010`: Refunded or charged-back orders must create reversal/offset records, not silent deletion.
- `REG-SAFETY-011`: PartnerLinks must not rely on third-party onboarding alone as fraud approval.
- `REG-SAFETY-012`: Creator/brand promotional abuse must have takedown and audit workflow.
- `REG-SAFETY-013`: Incentive systems must not reward synthetic accounts or non-commerce actions.
- `REG-METRICS-001`: PartnerLinks network value metrics must be tied to commerce, not raw signups.
- `REG-COMMS-001`: Referral messaging cannot create unbounded platform cost or legal exposure.
- `REG-DATA-001`: PartnerLinks must not store/log unnecessary customer/payment-sensitive data.
- `REG-DOCS-001`: Risk/compliance docs must separate verified facts, assumptions, and internal opinions.
- `REG-SECURITY-001`: Malformed tracking params must not create unsafe SQL, unsafe rendered output, or trusted attribution.
- `REG-SECURITY-002`: User-controlled referral params must never reach raw SQL or expose service-role credentials.
- `REG-SECURITY-003`: Synthetic identity clusters must not bypass payout holds, settlement gates, or commerce quality review.
- `REG-SECURITY-004`: Public/featured brands and products must be verified or admin-approved before broad creator promotion.
- `REG-SECURITY-005`: Low-confidence or late attribution cannot replace exact deterministic `partnerlinks_ref`.
- `REG-SECURITY-006`: Secrets and sensitive payout/admin credentials must not be exposed to client code, public logs, or unprotected debug routes.
- `REG-SECURITY-007`: Refund-heavy or chargeback-linked activity must remain reviewable and blocked from bypassing settlement/refund gates.
- `REG-SECURITY-008`: Admin/debug tooling must be read-only by default and audited when mutating.

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

### LINEAGE-001 - No Accidental Dual Origin Binding

- Regression ID:
  - `REG-LINEAGE-001`
- Mode: `READ_ONLY / FUTURE_TESTS_REQUIRED`
- Systems:
  - `/join/:creatorCode`
  - `/join/brand/:brandSlug`
  - `bindCreatorToInviteSession()`
  - `bindCreatorToBrandOrigin()`
  - `creators.parent_creator_id`
  - `creators.invited_by_brand_id`
- Expected:
  - creator-origin binding only sets `parent_creator_id` when `parent_creator_id` is null and `invited_by_brand_id` is null.
  - brand-origin binding only sets `invited_by_brand_id` when `parent_creator_id` is null and `invited_by_brand_id` is null.
  - a creator cannot become both brand-origin and creator-origin through normal signup/invite flows.
  - any deliberate reassignment must be a separate audited admin workflow.
- Status:
  - `CHECK`

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

### SETTLEMENT-002 - Funding Gate Before Payout

- Regression ID:
  - `REG-SETTLEMENT-002`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - No earning can enter live payout claim flow unless its settlement item is `settlement_collected`, `manual_approved`, or `reserve_covered`.
- Status:
  - `UNKNOWN`
- Notes:
  - Current protective `PAYOUT_MODE` blocks live claims until this exists.

### SETTLEMENT-003 - Failed Settlement Cannot Release Claimability

- Regression ID:
  - `REG-SETTLEMENT-003`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - `settlement_failed` and `settlement_retrying` rows remain non-claimable.
  - creator dashboard shows pending/on hold, not claimable.
- Status:
  - `UNKNOWN`

### SETTLEMENT-004 - Refund After Payout Creates Offset

- Regression ID:
  - `REG-SETTLEMENT-004`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - claimed rows remain historically intact.
  - refund creates `offset_required` / negative-balance ledger rows.
  - no silent deletion or destructive mutation.
- Status:
  - `UNKNOWN`

### SETTLEMENT-005 - Claim Retry Idempotency Under Settlement State Machine

- Regression ID:
  - `REG-SETTLEMENT-005`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - claim retry cannot create duplicate Stripe transfers.
  - existing claim batch and transfer id are reused during recovery.
- Current related coverage:
  - `REG-PAYOUT-001`
  - `REG-PAYOUT-002`
- Status:
  - `PASS` for current sandbox claim flow.
  - `UNKNOWN` for future settlement-gated implementation.

### SETTLEMENT-006 - Duplicate Webhook Cannot Duplicate Settlement Items

- Regression ID:
  - `REG-SETTLEMENT-006`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - duplicate Shopify webhook creates duplicate/skipped diagnostic only.
  - no second conversion.
  - no second earnings.
  - no duplicate settlement batch/item rows.
- Current related coverage:
  - duplicate conversion/earnings behavior is `PASS`.
- Status:
  - `UNKNOWN` for future settlement item tables.

### SETTLEMENT-007 - Manual Approval Auditability

- Regression ID:
  - `REG-SETTLEMENT-007`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - manual approval records who approved, when, amount, reason, affected rows, and accepted risk note.
  - manual approval cannot be silent or anonymous.
- Status:
  - `UNKNOWN`

### SAFETY-001 - Conversion Is Not Safe-To-Pay

- Regression ID:
  - `REG-SAFETY-001`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - `conversion_created` rows do not become live-payout claimable without deterministic attribution, commerce quality checks, settlement/funding safety, refund/reversal handling, and payout eligibility.
- Status:
  - `CHECK`
- Current guard:
  - `PAYOUT_MODE` defaults claims to disabled.

### SAFETY-002 - Recruitment Alone Cannot Pay

- Regression ID:
  - `REG-SAFETY-002`
- Mode: `READ_ONLY / FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - creator signups/invites alone create no payable network earnings.
  - network earnings require downstream attributed commerce and eligible `platform_fee_amount`.
- Status:
  - `PASS` for current creator-network implementation.
  - `UNKNOWN` for future brand-origin/future entity types.

### SAFETY-003 - Creator Disclosure UX

- Regression ID:
  - `REG-SAFETY-003`
- Mode: `UI_REVIEW`
- Expected:
  - creator-facing pages/share tools do not hide that referral links may create compensation.
  - onboarding includes disclosure reminder before public launch.
- Status:
  - `UNKNOWN`

### SAFETY-004 - Consent-Aware Referral Messaging

- Regression ID:
  - `REG-SAFETY-004`
- Mode: `DESIGN_REVIEW`
- Expected:
  - PartnerLinks does not send referral SMS/email/invites to third parties without consent safeguards.
  - outreach automation requires explicit review before implementation.
- Status:
  - `UNKNOWN`

### SAFETY-005 - Dashboard Money-State Clarity

- Regression ID:
  - `REG-SAFETY-005`
- Mode: `UI_REVIEW`
- Expected:
  - dashboard separates Direct Creator Earnings vs Network Override Earnings.
  - dashboard separates Accounted vs Funded vs Claimable vs Claimed.
  - disabled claim states explain settlement/approval/reserve requirements.
- Status:
  - `CHECK`
- Current guard:
  - claim button is disabled when payout mode blocks claims.
  - deeper money-state language refinement remains before public launch.

### SAFETY-006 - Referral Param Injection Safety

- Regression ID:
  - `REG-SAFETY-006`
- Mode: `STATIC_REVIEW / FUTURE_TESTS_REQUIRED`
- Real-world pattern:
  - Affiliate/referral platforms and plugins have been attacked through public tracking params, malformed query strings, and injection-prone referral identifiers.
- Expected:
  - `creator_code`, `brand_slug`, `product_slug`, `partnerlinks_ref`, `sub_id`, and UTM params are validated, length-limited, normalized, and escaped before rendering or query use.
  - malformed params are rejected or logged as suspicious.
  - raw tracking params cannot become trusted attribution or backend query fragments.
- Status:
  - `CHECK` for documented rule.
  - `UNKNOWN` for full malicious-input regression suite.

### SAFETY-007 - Shopify App Data Minimization

- Regression ID:
  - `REG-SAFETY-007`
- Mode: `STATIC_REVIEW / FUTURE_TESTS_REQUIRED`
- Real-world pattern:
  - Shopify ecosystem incidents show third-party apps/providers can become the weak point for customer/order data exposure.
- Expected:
  - PartnerLinks uses least-privilege Shopify scopes.
  - unnecessary customer/payment-sensitive data is not stored.
  - full webhook/customer/order payloads are not logged unless explicitly required for incident review.
  - Shopify tokens and webhook secrets have rotation procedures.
- Status:
  - `CHECK` for documented rule.
  - `UNKNOWN` for full data-minimization audit.

### SAFETY-008 - Sensitive Action Ownership Scoping

- Regression ID:
  - `REG-SAFETY-008`
- Mode: `STATIC_REVIEW / ROUTE_REVIEW`
- Real-world pattern:
  - Marketplace and SaaS authorization bugs often come from missing resource scoping or implicit default objects.
- Expected:
  - sensitive creator/brand actions use explicit `creator_code`, `brand_id`, or equivalent resource context.
  - ownership is verified before mutation or sensitive debug visibility.
  - no payout, Stripe, settlement, or admin mutation path relies on newest/default creator fallback.
- Current related coverage:
  - `REG-AUTH-001`
  - `REG-AUTH-002`
- Status:
  - `PASS` for current Stripe/claim routes.
  - `CHECK` for broader future route-risk audits.

### SAFETY-009 - New Actor Payout Extraction Hold

- Regression ID:
  - `REG-SAFETY-009`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Real-world pattern:
  - Marketplace and payout platforms face fake accounts, stolen-card transactions, and rapid payout extraction before chargebacks or risk reviews mature.
- Expected:
  - new creators/brands/high-risk spikes cannot instantly extract payouts.
  - first payout, abnormal velocity, duplicate payout identities, or new-brand activity can trigger holds/manual review.
  - Stripe Connect onboarding alone is not treated as fraud approval.
- Status:
  - `CHECK` for `PAYOUT_MODE` fail-closed.
  - `UNKNOWN` for future risk-hold implementation.

### SAFETY-010 - Refund / Chargeback Reversal Integrity

- Regression ID:
  - `REG-SAFETY-010`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Real-world pattern:
  - Marketplaces and delivery platforms experience refund loops, false claims, stolen cards, and post-payout losses.
- Expected:
  - refunded or charged-back orders create reversal/offset rows.
  - paid earnings are never silently deleted.
  - refund-heavy activity is reviewable and can block future claims.
- Current related coverage:
  - `REG-SETTLEMENT-004`
- Status:
  - `UNKNOWN` until refund/reversal ledgers and Shopify refund webhooks are built.

### SAFETY-011 - Third-Party Onboarding Is Not Fraud Approval

- Regression ID:
  - `REG-SAFETY-011`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Real-world pattern:
  - Stripe Connect accounts can still be fraudulent or used with fake/stolen-card commerce, even when onboarding succeeds.
- Expected:
  - Stripe onboarding confirms payout rail readiness, not creator quality.
  - Shopify OAuth confirms store connection, not product safety.
  - payout eligibility still depends on settlement, risk, refund, and review gates.
- Status:
  - `CHECK` for documented rule.
  - `UNKNOWN` for automated risk scoring/review workflows.

### SAFETY-012 - Promotional Abuse Takedown Workflow

- Regression ID:
  - `REG-SAFETY-012`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Real-world pattern:
  - Affiliate networks can face liability for deceptive affiliate claims and undisclosed endorsements.
- Expected:
  - creator/brand promotional abuse can be reported, reviewed, suspended, and audited.
  - unsafe brand/product promotion can be removed from public surfaces.
  - creator disclosure requirements are visible before scale.
- Status:
  - `UNKNOWN`

### SAFETY-013 - Incentive Gaming Prevention

- Regression ID:
  - `REG-SAFETY-013`
- Mode: `DESIGN_REVIEW / FUTURE_TESTS_REQUIRED`
- Real-world pattern:
  - Incentive systems can create catastrophic internal or user behavior when rewards are tied to account creation, vanity metrics, or unsafe growth rather than real value.
- Note:
  - `REG-SAFETY-010` is already reserved for refund/chargeback reversal integrity. Incentive-gaming prevention is tracked under `REG-SAFETY-013` to avoid a duplicate regression ID.
- Expected:
  - incentives are tied to attributed, settled commerce rather than account creation.
  - abnormal creator/brand onboarding spikes are reviewable.
  - manual overrides have audit trails.
  - creator rewards cannot be gamed through self-generated loops.
- Status:
  - `CHECK` for current no-signup-payout behavior.
  - `UNKNOWN` for future internal/operator incentive policy.

### METRICS-001 - Network Value Metrics Require Commerce

- Regression ID:
  - `REG-METRICS-001`
- Mode: `DESIGN_REVIEW / FUTURE_TESTS_REQUIRED`
- Real-world pattern:
  - Companies built around user-network value can collapse when raw user/network counts are inflated, fake, or treated as economic value.
- Expected:
  - PartnerLinks never treats creator count or invite count alone as economic value.
  - dashboards and operator metrics distinguish network size from productive network.
  - investor/operator reporting is tied to attributed, settled commerce.
- Status:
  - `UNKNOWN`

### COMMS-001 - Referral Messaging Cost And Consent Control

- Regression ID:
  - `REG-COMMS-001`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Real-world pattern:
  - SMS toll fraud, fake signup loops, and unsolicited referral messaging can create direct cost and legal exposure.
- Expected:
  - automated SMS referral/invite tools are avoided during beta.
  - future email/SMS sends are rate-limited and consent-aware.
  - invite-send velocity is monitored.
  - public signup has bot-protection before paid messaging is attached.
- Status:
  - `CHECK` because no automated SMS/email invite system is currently built.

### DATA-001 - Customer And Payment Data Minimization

- Regression ID:
  - `REG-DATA-001`
- Mode: `STATIC_REVIEW / FUTURE_TESTS_REQUIRED`
- Real-world pattern:
  - small Shopify/affiliate apps can become the weakest security link because they handle merchant tokens, tracking data, order data, and payout logic.
- Expected:
  - least-privilege Shopify scopes.
  - no unnecessary customer data storage.
  - Shopify tokens and Supabase service role protected server-side.
  - debug routes locked/read-only.
  - key rotation runbook exists.
- Current related coverage:
  - `REG-SAFETY-007`
  - `REG-SECURITY-006`
- Status:
  - `CHECK`

### DOCS-001 - Risk Documentation Source Integrity

- Regression ID:
  - `REG-DOCS-001`
- Mode: `DOCUMENTATION_REVIEW`
- Real-world pattern:
  - AI-assisted research and documentation can introduce hallucinated facts or fabricated citations.
- Expected:
  - risk/compliance docs distinguish verified facts, user-provided research examples, internal assumptions, and implementation decisions.
  - legal/compliance copy is not treated as legal advice.
  - public/legal/compliance claims are source-backed before publication.
- Status:
  - `CHECK`

### SECURITY-001 - Malformed Referral Param Handling

- Regression ID:
  - `REG-SECURITY-001`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - malformed `creator_code`, `partnerlinks_ref`, `product_slug`, `brand_slug`, UTM, and `sub_id` values are normalized, length-limited, rejected, escaped, or logged as suspicious.
  - malformed params cannot become trusted attribution.
- Status:
  - `UNKNOWN`

### SECURITY-002 - Backend Query Safety

- Regression ID:
  - `REG-SECURITY-002`
- Mode: `STATIC_REVIEW / FUTURE_TESTS_REQUIRED`
- Expected:
  - no raw user-controlled SQL.
  - route params are validated before query use.
  - Supabase service role stays server-side only.
- Status:
  - `CHECK`

### SECURITY-003 - Synthetic Identity Network Review

- Regression ID:
  - `REG-SECURITY-003`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - duplicate payout methods, Stripe accounts, tax ids, IP/device clusters, and abnormal network growth can be flagged.
  - new/high-risk creator payouts can be held for review.
- Status:
  - `UNKNOWN`

### SECURITY-004 - Brand/Product Verification

- Regression ID:
  - `REG-SECURITY-004`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - public/featured brands and products require verification/admin approval.
  - unsafe brands/products can be suspended with audit trail.
- Status:
  - `UNKNOWN`

### SECURITY-005 - Affiliate Link Hijacking Resistance

- Regression ID:
  - `REG-SECURITY-005`
- Mode: `READ_ONLY / FUTURE_TESTS_REQUIRED`
- Expected:
  - exact `partnerlinks_ref` wins before fallback.
  - low-confidence fallback cannot override deterministic attribution.
  - attribution replacement attempts are visible in diagnostics.
- Current related coverage:
  - `REG-ATTRIBUTION-001`
- Status:
  - `PASS` for exact partnerlinks_ref precedence.
  - `UNKNOWN` for explicit replacement-attempt diagnostics.

### SECURITY-006 - Secret Exposure And Debug Route Protection

- Regression ID:
  - `REG-SECURITY-006`
- Mode: `STATIC_REVIEW / FUTURE_TESTS_REQUIRED`
- Expected:
  - secrets are not logged.
  - service keys are not exposed client-side.
  - debug routes are protected and scoped.
  - secret rotation runbook exists.
- Status:
  - `CHECK`

### SECURITY-007 - Refund Fraud Review Gate

- Regression ID:
  - `REG-SECURITY-007`
- Mode: `FUTURE_IMPLEMENTATION_REQUIRED`
- Expected:
  - refund-heavy or chargeback-linked activity is reviewable.
  - suspicious refund patterns cannot bypass settlement/refund gates.
- Status:
  - `UNKNOWN`

### SECURITY-008 - Admin Tooling Safety

- Regression ID:
  - `REG-SECURITY-008`
- Mode: `STATIC_REVIEW / FUTURE_TESTS_REQUIRED`
- Expected:
  - debug routes are read-only by default.
  - mutating scripts require explicit flags/approval.
  - admin actions are audited.
- Status:
  - `CHECK`

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
- Last read-only confirmation:
  - 2026-05-16
  - ambiguous order `shopify:partnerlinks-test.myshopify.com:7659900000001`
  - diagnostic `id = 12`
  - `decision = skipped`
  - `unmatched_reason = ambiguous_recent_click_fallback`
  - no conversion or earnings created.

### ATTRIBUTION-003 - Post-Payout-Mode Exact Attribution Regression

- Regression ID:
  - `REG-ATTRIBUTION-001`
- Mode: `READ_ONLY`
- Command:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548682670254 --creator-code test-creator-04
```

- Expected:
  - exact `partnerlinks_ref` attribution still resolves.
  - conversion and direct commission still exist.
  - Level 1/2/3 network earnings still exist.
  - no Level 4+ network earnings exist.
  - payout-mode claim guard does not affect attribution/conversion code paths.
- Status:
  - `PASS`
- Last run:
  - 2026-05-16
- Confirmed:
  - `conversion_id = 19`
  - `attribution_source = partnerlinks_ref`
  - `attribution_confidence = exact`
  - `fallback_used = false`
  - direct commission = `2.70`
  - platform fee = `0.90`
  - Level 1/2/3 = `0.27`, `0.03`, `0.02`.

### WEBHOOK_IDEMPOTENCY-002 - Post-Payout-Mode Duplicate Replay Diagnostics

- Regression ID:
  - `REG-WEBHOOK-001`
- Mode: `READ_ONLY`
- Command:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548718420142
```

- Expected:
  - duplicate replay diagnostics are visible.
  - duplicate order does not create a second conversion.
  - duplicate order does not create duplicate creator-network or brand-network earnings.
- Status:
  - `PASS`
- Last run:
  - 2026-05-16
- Confirmed:
  - duplicate diagnostic events `10` and `11`.
  - `decision = duplicate_skipped`.
  - `duplicate_order = true`.
  - no duplicate conversion groups found.
  - no duplicate earning keys found.

### REFUND-001 - Full Refund Before Payout Reverses All Earnings

- Regression IDs:
  - `REG-SETTLEMENT-004`
  - `REG-SAFETY-010`
- Mode: `FUTURE_CONTROLLED`
- Systems:
  - future Shopify refund webhook.
  - future `refund_reversal_events`.
  - future `earning_reversal_items`.
- Setup:
  - attributed conversion exists.
  - direct commission and Level 1/2/3 overrides are accounted but not claimed.
- Expected:
  - direct creator commission is reversed.
  - platform fee settlement item is reversed.
  - Level 1/2/3 creator-network overrides are reversed.
  - brand-origin network reward is reversed if present.
  - no claimable earnings remain for the refunded amount.
- Status:
  - `UNKNOWN`
- Notes:
  - Not implemented. Required before public live settlement/payout automation.

### REFUND-002 - Partial Refund Reverses Proportional Earnings

- Regression IDs:
  - `REG-SETTLEMENT-004`
  - `REG-SAFETY-010`
- Mode: `FUTURE_CONTROLLED`
- Expected:
  - reversal percentage is calculated from eligible refunded order amount.
  - direct commission and platform-fee-derived overrides are reduced proportionally.
  - remaining non-refunded portion keeps its settlement state.
- Status:
  - `UNKNOWN`

### REFUND-003 - Refund After Payout Creates Offset

- Regression IDs:
  - `REG-SETTLEMENT-004`
  - `REG-SAFETY-010`
- Mode: `FUTURE_CONTROLLED`
- Expected:
  - original claim ledger remains immutable.
  - reversal records are created.
  - creator balance receives `offset_required` / negative-balance treatment.
  - future earnings offset the paid reversal or operator review is required.
- Status:
  - `UNKNOWN`

### SETTLEMENT-008 - Claim Promotion Requires Funding Evidence

- Regression IDs:
  - `REG-SETTLEMENT-001`
  - `REG-SETTLEMENT-002`
  - `REG-SAFETY-001`
- Mode: `FUTURE_CONTROLLED`
- Expected:
  - earning rows cannot become live-claimable unless one of these is true:
    - `settlement_collected`
    - `manual_approved`
    - `reserve_covered`
  - failed, retrying, disputed, refund-pending, or risk-held settlement rows remain non-claimable.
- Status:
  - `UNKNOWN`
- Current guard:
  - `PAYOUT_MODE` blocks live claims unless explicit sandbox/test conditions are present.

### BRAND_ORIGIN_ECON-001 - Brand-Origin Network Reward From Downstream Commerce

- Regression IDs:
  - `REG-ECONOMICS-001`
  - `REG-LINEAGE-001`
  - `REG-SETTLEMENT-002`
- Mode: `FUTURE_CONTROLLED`
- Setup:
  - brand invites creator through `/join/brand/:brandSlug`.
  - creator signs up and receives `invited_by_brand_id`.
  - creator later generates deterministic attributed conversion.
- Expected:
  - `brand_network_earnings` row is created only from eligible downstream `platform_fee_amount`.
  - no direct creator commission is redirected to the brand.
  - no creator-origin parent is added.
  - no self-generated override is created.
  - settlement gate applies before payable status.
- Status:
  - `UNKNOWN`
- Current state:
  - brand-origin onboarding lineage is proven.
  - end-to-end brand-origin economics are not yet proven.

### RISK-001 - Synthetic Commerce Hold Blocks Claimability

- Regression IDs:
  - `REG-SAFETY-009`
  - `REG-SECURITY-003`
  - `REG-SECURITY-007`
- Mode: `FUTURE_CONTROLLED`
- Expected:
  - high refund rate, suspicious velocity, duplicate payout methods, duplicate Stripe accounts, or repeated buyer/order patterns create a risk hold.
  - held earnings do not become claimable until reviewed/released.
  - risk status never creates payout eligibility by itself.
- Status:
  - `UNKNOWN`

### INVARIANT-001 - Read-Only Financial Invariant Report

- Proposed command:

```bash
node scripts/productionSafetyTest.js --actor-matrix --economic-report --lineage-report --settlement-report --refund-report --risk-report --idempotency-report
```

- Expected checks:
  - no Level 4+.
  - no duplicate conversion order ids.
  - no duplicate network earning keys.
  - no self-generated network override.
  - no dual brand/creator lineage.
  - no ambiguous attribution conversion.
  - no payout-mode bypass.
  - no live claimable earnings without settlement, approval, or reserve.
  - no refunded conversion still payable.
  - no duplicate settlement item.
  - no duplicate claim transfer.
  - no unsafe admin/debug mutation route.
- Status:
  - `PROPOSED`

### IMPLEMENTATION_SEQUENCE-001 - Refund Ledger Comes Before Payout Mutation

- Regression IDs:
  - `REG-REFUND-001`
  - `REG-SETTLEMENT-001`
  - `REG-INVARIANT-001`
- Mode: `REVIEW`
- Expected:
  - first runtime financial-failure patch is additive reversal ledger infrastructure.
  - no Stripe reversal, negative-balance collection, automatic clawback, or payout mutation is bundled into the first patch.
  - migration is safe to run manually and does not rewrite existing conversion/earning/claim rows.
- Status:
  - `PROPOSED`

### REFUND_SCHEMA-001 - Reversal Event Idempotency

- Regression IDs:
  - `REG-REFUND-001`
  - `REG-INVARIANT-001`
- Mode: `FUTURE_READ_ONLY`
- Expected:
  - `financial_reversal_events.idempotency_key` is unique.
  - replaying the same refund/dispute/reversal signal cannot create duplicate reversal event rows.
  - duplicate reversal signals remain explainable in diagnostics.
- Status:
  - `READY_FOR_MANUAL_SQL`
- Implementation artifact:
  - `database/migrations/016_financial_reversal_ledger.sql`
- Notes:
  - migration creates a unique index on `financial_reversal_events.idempotency_key`.
  - SQL has not been run in Supabase yet.

### REFUND_SCHEMA-002 - Reversal Items Link To Original Financial Rows

- Regression IDs:
  - `REG-REFUND-001`
- Mode: `FUTURE_READ_ONLY`
- Expected:
  - reversal items can link to the original conversion, creator network earning, brand network earning, or claim ledger row.
  - item type clearly distinguishes direct commission, platform fee, creator-network override, brand-network override, and claim offset.
  - offset-required rows preserve the original claimed/paid history.
- Status:
  - `READY_FOR_MANUAL_SQL`
- Implementation artifact:
  - `database/migrations/016_financial_reversal_ledger.sql`
- Notes:
  - migration adds nullable links to `conversions`, `creator_network_earnings`, `brand_network_earnings`, `creator_earning_claims`, `creators`, and `brands`.
  - migration is observability/accounting only and does not apply reversals.

### SETTLEMENT_SCHEMA-001 - Settlement Status Fields Are Non-Granting By Default

- Regression IDs:
  - `REG-SETTLEMENT-001`
  - `REG-SETTLEMENT-002`
- Mode: `FUTURE_READ_ONLY`
- Expected:
  - added settlement fields do not make rows claimable by themselves.
  - unknown, null, failed, retrying, disputed, refund-pending, or risk-held status blocks live claimability.
  - only settlement eligibility service can later promote live claimability.
- Status:
  - `UNKNOWN`

### RISK_SCHEMA-001 - Risk Holds Block But Do Not Pay

- Regression IDs:
  - `REG-SETTLEMENT-008`
  - `REG-SAFETY-009`
- Mode: `FUTURE_READ_ONLY`
- Expected:
  - risk review can hold earnings/claims.
  - risk review cannot itself make earnings payable.
  - risk release still requires settlement, manual approval, or reserve coverage.
- Status:
  - `UNKNOWN`

### BETA_READINESS-001 - Real-Money Attribution-Only Beta

- Mode: `READ_ONLY_AND_MANUAL_OWNER_CHECKS`
- Status:
  - `CHECK`
- GO / NO-GO:
  - attribution/accounting-only beta: `GO WITH MANUAL OWNER CHECKS`.
  - live creator payouts: `NO-GO`.
- Preconditions:
  - production `PAYOUT_MODE=claims_disabled`.
  - `orders/paid` webhook active.
  - `SHOPIFY_WEBHOOK_SECRET` configured.
  - product referral link routes through PartnerLinks and Shopify cart/order attributes.
- Expected:
  - real Shopify order creates attribution diagnostics.
  - conversion is created exactly once.
  - direct commission and `platform_fee_amount` are accounted.
  - Level 1/2/3 network rows are created where applicable.
  - no claim/live payout can execute in production.
- Validation command:

```bash
node scripts/productionSafetyTest.js --dry-run --report --matrix-report
```

- Last audit:
  - 2026-05-17
- Result:
  - no new invariant, payout, lineage, or attribution regressions found.

### BETA_READINESS-002 - Refund/Reversal Infrastructure Present But Non-Enforcing

- Mode: `READ_ONLY`
- Status:
  - `PASS`
- Expected:
  - `financial_reversal_events` exists.
  - `financial_reversal_items` exists.
  - both tables are readable.
  - both tables may be empty until refund ingestion exists.
  - no dashboard/payout/settlement behavior changes from table existence alone.
- Last audit:
  - 2026-05-17
- Result:
  - both tables exist and currently contain `0` rows.

### BETA_READINESS-003 - Live Payouts Remain Fail-Closed

- Mode: `READ_ONLY`
- Status:
  - `PASS`
- Expected:
  - production recommendation is `PAYOUT_MODE=claims_disabled`.
  - `sandbox_time_based` only allows claims with `sk_test_`.
  - live key plus sandbox mode blocks claims.
  - unknown/missing mode blocks claims.
- Last audit:
  - 2026-05-17
- Result:
  - code path confirms fail-closed payout gate.

### BETA_READINESS-004 - Read-Only Operator Reports

- Mode: `READ_ONLY`
- Status:
  - `CHECK`
- Expected:
  - operators can inspect attribution and economics by Shopify order id, `partnerlinks_ref`, creator code, brand id, or shop domain.
  - reports expose conversion, direct commission, platform fee, Level 1/2/3 network rows, duplicate/skipped diagnostics, claim batches, reversal rows, payout-mode gate state, and route-risk categories.
  - reports do not mutate conversion, earnings, payout, Stripe, settlement, or reversal state.
- Validation commands:

```bash
node --check scripts/productionSafetyTest.js
node scripts/productionSafetyTest.js --dry-run --order-report --order-id shopify:partnerlinks-test.myshopify.com:{order_id}
node scripts/productionSafetyTest.js --dry-run --actor-matrix --lineage-report --economic-report --refund-report --settlement-report --risk-report --route-risk-report
```

- Last audit:
  - 2026-05-17
- Result:
  - syntax validation passed.
  - Supabase-backed execution completed read-only on 2026-05-17.
  - order report for `shopify:partnerlinks-test.myshopify.com:6549690941614` showed exact `partnerlinks_ref` attribution, direct commission, platform fee, Level 1/2 network rows, no claim batch, and no reversal rows.
  - actor/economic/lineage/refund/settlement/risk/route-risk report completed without mutation.

### REFUND_REVERSAL-002 - Diagnostic-Only Shopify Refund Capture

- Mode: `MANUAL_PRODUCTION_SAFE`
- Classification:
  - `RUNTIME-ENFORCED` for HMAC verification and idempotent diagnostic capture.
  - `PLANNED / NOT IMPLEMENTED` for reversal enforcement.
- Status:
  - `CHECK`
- Expected:
  - `POST /webhooks/shopify/refunds-create` rejects invalid HMAC.
  - valid refund webhooks create one `financial_reversal_events` row per idempotency key.
  - reversal items are created only when the original conversion can be safely matched.
  - duplicate refund webhook delivery does not create duplicate reversal events.
  - no `payout_status`, `claimable_at`, dashboard total, Stripe transfer, or settlement state is changed.
- Validation commands:

```bash
node --check index.js
node --check services/shopifyWebhookService.js
node scripts/productionSafetyTest.js --dry-run --refund-report --idempotency-report
```

- Last audit:
  - 2026-05-17
- Result:
  - code path added; live refund webhook replay/Shopify delivery still requires operator-controlled test.

### SETTLEMENT-002 - Additive Settlement Schema Proposal

- Mode: `READ_ONLY`
- Classification:
  - `PLANNED / NOT IMPLEMENTED` until migration is manually run.
  - `DOCUMENTED ARCHITECTURE ONLY` until settlement eligibility service exists.
- Status:
  - `CHECK`
- Expected:
  - migration 017 creates settlement batches/items and settlement/risk metadata fields.
  - migration does not release payouts or change claimability.
  - reports can detect whether settlement tables/columns exist.
- Validation commands:

```bash
node scripts/productionSafetyTest.js --dry-run --settlement-report
```

- Last audit:
  - 2026-05-17
- Result:
  - migration file created locally; SQL was not run automatically.

### SETTLEMENT-003 - Runtime Settlement-Aware Claimability Gate

- Mode: `READ_ONLY`
- Classification:
  - `RUNTIME-ENFORCED`
- Status:
  - `CHECK`
- Expected:
  - `claims_disabled` blocks all claims.
  - unknown/missing payout mode blocks all claims.
  - `sandbox_time_based` requires `sk_test_` and uses `claimable_at`.
  - `manual_approval` requires `sk_test_` and only permits manually approved rows.
  - `settlement_gated` requires `sk_test_` and only permits settlement-collected or reserve-covered rows.
  - dashboard separates Accounted, Pending settlement, Claimable, and Claimed earnings.
  - no live Stripe transfer path is enabled.
- Validation commands:

```bash
node --check index.js
node --check services/payoutModeService.js
node --check services/earningsLifecycleService.js
node --check services/creatorDashboardService.js
node scripts/productionSafetyTest.js --dry-run --settlement-report
```

- Last audit:
  - 2026-05-17
- Result:
  - implemented as a payout-mode/row-level eligibility gate; live payouts remain NO-GO.

### IDEMPOTENCY-002 - Financial Failure Idempotency Report

- Mode: `READ_ONLY`
- Classification:
  - `READ-ONLY DIAGNOSTIC`
- Status:
  - `CHECK`
- Expected:
  - report checks duplicate Shopify conversion order ids as hard failures.
  - report labels non-Shopify/manual/test duplicate conversion order ids as hygiene findings unless linked to financial side effects.
  - report checks duplicate creator-network and brand-network earning keys.
  - report checks duplicate reversal event idempotency keys.
  - report checks duplicate settlement item idempotency keys when settlement tables exist.
  - report checks duplicate Stripe transfer ids in claim ledger.
  - report shows duplicate webhook replay diagnostics when present.
- Validation commands:

```bash
node scripts/productionSafetyTest.js --dry-run --idempotency-report
```

- Last audit:
  - 2026-05-17
- Result:
  - report added; run before enabling any financial-failure mutation systems.
  - known historical manual duplicate `test-network-001` is classified as manual/test hygiene, not a Shopify launch blocker.
  - `shopify:*` duplicate order ids remain `FAIL`.

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
## Settlement Lifecycle Phase 1 Tests

Status: READ-ONLY DIAGNOSTIC

Required commands:

- `node scripts/productionSafetyTest.js --dry-run --settlement-report --idempotency-report`
- `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`

Expected results:

- `settlement_batches` is visible.
- `settlement_items` is visible.
- `settlement_audit_events` is visible after migration `018` is manually applied.
- duplicate `settlement_items.idempotency_key` count is zero.
- duplicate `settlement_audit_events.idempotency_key` count is zero after migration `018` is manually applied.
- live creator payouts remain NO-GO.
- no report mutates conversion, earning, claim, settlement, reversal, or payout rows.

Regression IDs:

- REG-SETTLEMENT-008: Settlement lifecycle audit events must be idempotent and must not release payouts by themselves.
- REG-SETTLEMENT-009: Settlement diagnostics must distinguish read-only visibility from runtime-enforced funding collection.

## Operator Draft Settlement Batch Tests

Status: READ-ONLY DIAGNOSTIC / EXPLICIT MANUAL MUTATION ONLY

Required dry-run command:

- `node scripts/settlementBatchOperator.js --dry-run --report --brand-id 9`

Expected dry-run result:

- Prints proposed batch key.
- Prints included conversions.
- Prints included creator network earnings.
- Prints included brand network earnings.
- Prints proposed settlement items.
- Does not create rows.
- Does not call Stripe.
- Does not mutate existing financial rows.

Optional write command after explicit approval only:

- `node scripts/settlementBatchOperator.js --create-draft --brand-id 9 --operator <name> --notes <text>`

Expected write result:

- Creates or reuses one idempotent `settlement_batches` row.
- Creates missing idempotent `settlement_items`.
- Creates missing idempotent `settlement_audit_events`.
- Leaves all created rows pending/draft-style.
- Leaves `payout_status`, claimability, Stripe state, and existing financial rows unchanged.

Regression IDs:

- REG-SETTLEMENT-010: Draft settlement batch creation must not mutate existing financial rows.
- REG-SETTLEMENT-011: Draft settlement items must be idempotent by source financial row and item type.
- REG-SETTLEMENT-012: Draft settlement batch creation must not imply funding collection or payout eligibility.
