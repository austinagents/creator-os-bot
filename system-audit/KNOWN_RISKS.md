# PartnerLinks Known Risks

Purpose:

- Track reliability, attribution, payout, security, and UX risks that are known but not yet fully eliminated.
- Keep risk language precise and operational.

## Risk Severity

- `SEV0`: Active production integrity issue.
- `SEV1`: Could create wrong payouts, wrong attribution, duplicate money movement, or unauthorized mutation.
- `SEV2`: Could confuse operators/users or create unsafe assumptions before scale.
- `SEV3`: Documentation, workflow, or observability improvement.

## Active Risks

### RISK-001 - Multi-Creator Convenience Navigation

- Severity: `SEV2`
- Category: `AUTH_SCOPE`
- Status: `OPEN`
- Impacted systems:
  - `/dashboard`
  - homepage signed-in creator state
  - signed-in invite redirects
- Description:
  - One auth user can own multiple creators. Sensitive payout routes are now creator-scoped, but some convenience navigation still selects the newest/default creator.
- Safe current behavior:
  - Stripe start/return/refresh/debug and claim routes verify explicit ownership.
- Risk:
  - User/operator confusion when dashboard navigation opens a different creator than expected.
- Recommended mitigation:
  - Add creator selection/account switcher or deterministic default policy.

### RISK-002 - Duplicate Webhook Replay Not Yet Fully Executed

- Severity: `SEV2`
- Category: `WEBHOOK_IDEMPOTENCY`
- Status: `MITIGATED`
- Description:
  - Duplicate order protection exists in code and signed replay has validated idempotent behavior.
- Safe current behavior:
  - Webhook verifies HMAC.
  - Conversion order ids use `shopify:{shop_domain}:{order_id}`.
  - Duplicate diagnostics path exists.
  - Duplicate replay returns safely and does not create duplicate conversions or duplicate earnings.
- Recommended mitigation:
  - Keep `REG-WEBHOOK-001` in the regression matrix and rerun before major webhook changes.

### RISK-003 - Stripe Transfer Failure Recovery Needs Sandbox Drill

- Severity: `SEV1`
- Category: `PAYOUT_LIFECYCLE`
- Status: `OPEN`
- Description:
  - Claim finalization includes recovery patterns, but a controlled sandbox failure drill has not been fully performed.
- Safe current behavior:
  - Stripe transfers require test key guard during current MVP.
  - Claim ledger and claim batch reservation exist.
- Recommended mitigation:
  - Design an explicit sandbox-only failure recovery drill before live payout plans.

### RISK-004 - Lazy Claimable Promotion Can Confuse Reports

- Severity: `SEV3`
- Category: `PAYOUT_LIFECYCLE`
- Status: `OPEN`
- Description:
  - Earnings can remain `pending` after `claimable_at` passes until dashboard/service logic promotes them.
- Safe current behavior:
  - Dashboard aggregation promotes claimable rows when accessed.
- Recommended mitigation:
  - Make reports explicitly show pending rows that are past `claimable_at`.

### RISK-005 - Product Card Layout Regression

- Severity: `SEV2`
- Category: `UI_GUARDRAIL`
- Status: `WATCH`
- Description:
  - Shopify-backed products previously drifted from the universal product card layout.
- Safe current behavior:
  - Universal product card layout is documented and enforced in UI rules.
- Recommended mitigation:
  - Never create separate Shopify/test product card rows, badges, or metadata.

### RISK-006 - Ambiguous Fallback Must Stay Strict

- Severity: `SEV1`
- Category: `ATTRIBUTION`
- Status: `WATCH`
- Description:
  - Recent-click fallback is useful only as a low-confidence emergency path. If broadened, it could misattribute sales when multiple creators promote the same product.
- Safe current behavior:
  - Ambiguous fallback skips attribution instead of guessing.
  - Skipped ambiguous decisions create diagnostic rows.
  - No conversion or earnings are created from ambiguous fallback.
- Recommended mitigation:
  - Preserve `REG-ATTRIBUTION-002`.
  - Do not loosen fallback without a deterministic Shopify-supported attribution source.

### RISK-007 - Payout Retry Must Stay Idempotent

- Severity: `SEV1`
- Category: `PAYOUT_LIFECYCLE`
- Status: `WATCH`
- Description:
  - Payout retries can become dangerous if claim batch, ledger, or Stripe transfer recovery behavior regresses.
- Safe current behavior:
  - Claim retry-after-success does not create a duplicate transfer or duplicate ledger.
  - Claimed rows remain linked to claim batch ids.
- Recommended mitigation:
  - Preserve `REG-PAYOUT-001` and `REG-PAYOUT-002`.
  - Keep live payout plans blocked until sandbox failure recovery is drilled.

### RISK-008 - Settlement Is Accounted But Not Collected

- Severity: `SEV1`
- Category: `ECONOMICS`, `PAYOUT_LIFECYCLE`
- Status: `OPEN`
- Description:
  - PartnerLinks currently records direct commission, platform fee, and network override amounts, but automated brand platform-fee collection and direct creator commission funding are not fully built.
- Safe current behavior:
  - Stripe transfer flow is test-mode only.
  - Economic architecture now documents that platform-fee-funded network rewards should not be paid from uncollected or unsafe funds unless explicitly accepted as credit risk.
- Unsafe assumption:
  - Do not assume recorded `platform_fee_amount` means collected/settled platform fee cash exists.
  - Do not assume direct creator commission has been funded by the brand.
- Recommended mitigation:
  - Define settlement collection mechanism, settlement status, refund/reversal behavior, and claimability gates before live public payout automation.
  - Canonical claimability invariant:
    - `claimable requires settlement_collected OR explicit_manual_approval OR sufficient_prepaid_reserve`.

### RISK-009 - Brand-Origin Network Economics Are Scaffolded But Not Proven

- Severity: `SEV2`
- Category: `ECONOMICS`
- Status: `OPEN`
- Description:
  - Brand-origin fields and service paths exist, but no end-to-end test has proven brand-origin network rewards from a brand-onboarded creator conversion.
- Safe current behavior:
  - Current `test-creator-04` report shows no brand-network earnings.
  - Creator-chain economics are proven separately.
- Unsafe assumption:
  - Do not claim brand-as-network-entity support is production-proven yet.
- Recommended mitigation:
  - Create a controlled brand-origin test actor and validate `brand_network_earnings` before using this in public claims or dashboards.

### RISK-010 - Money-State UI Can Conflate Direct And Network Earnings

- Severity: `SEV2`
- Category: `UI_GUARDRAIL`, `ECONOMICS`
- Status: `OPEN`
- Description:
  - Dashboard data exposes direct commission and network earnings separately, but pending/claimable/claimed totals combine both.
- Safe current behavior:
  - `creator_earning_claims` stores `direct_commission_amount` and `network_earning_amount` separately.
- Unsafe assumption:
  - Do not assume creators will understand which earnings are brand-funded direct commission vs platform-fee-funded network overrides without clearer UI.
- Recommended mitigation:
  - Before public launch, make direct earnings and network override earnings visually distinct across pending, claimable, claimed, and lifetime states.

### RISK-011 - Refunds And Reversals Are Not Ledgered

- Severity: `SEV1`
- Category: `ECONOMICS`, `PAYOUT_LIFECYCLE`
- Status: `OPEN`
- Description:
  - Shopify refunds, chargebacks, and reversals do not yet have a complete immutable ledger/offset model.
- Safe current behavior:
  - Public live payout automation is not enabled.
  - Settlement architecture now requires refund/reversal handling before broader live settlement.
- Unsafe assumption:
  - Do not assume a paid/claimed earning can be silently edited after a refund.
- Recommended mitigation:
  - Add refund/reversal ledger events and negative balance behavior before public live payout automation.

### RISK-012 - Claimability Currently Does Not Require Settlement Status

- Severity: `SEV1`
- Category: `PAYOUT_LIFECYCLE`, `ECONOMICS`
- Status: `OPEN`
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
- Description:
  - Current test-mode lifecycle can promote earnings from pending to claimable based on `claimable_at`, but settlement status tables/gates are not implemented yet.
  - `recordConversion()` and network earning row builders assign a future `claimable_at`.
  - `resolveLifecycleStatus()` treats elapsed `claimable_at` as claimable.
  - `promoteClaimableEarningsForCreator()` updates direct conversion and creator-network rows to `claimable` based on time.
  - `getCreatorDashboardByCode()` invokes promotion when a dashboard loads.
  - `/earnings/claim` claims creator-scoped rows but does not verify settlement collection, explicit manual approval, or prepaid reserve.
- Safe current behavior:
  - Current Stripe transfers are test-mode only.
  - Stripe/claim routes are creator-scoped and ownership-verified.
  - Claim idempotency and transfer recovery behavior are preserved for sandbox testing.
- Unsafe assumption:
  - Do not enable live payout automation assuming pending-window claimability proves brand funding.
  - Do not treat `claimable_at` as proof that creator commission or platform-fee-funded network overrides have been collected.
- Recommended mitigation:
  - Add settlement status fields and settlement-aware claimability promotion before live payouts.
  - Add a central settlement eligibility service.
  - Keep current behavior only behind `PAYOUT_MODE=sandbox_time_based` with a Stripe test key or an explicit manual beta approval gate.
  - Block live claims unless `settlement_collected`, `explicit_manual_approval`, or `sufficient_prepaid_reserve` is true.
- Current mitigation:
  - `PAYOUT_MODE` now defaults to `claims_disabled`.
  - `/earnings/claim` blocks unless `PAYOUT_MODE=sandbox_time_based` and `STRIPE_SECRET_KEY` starts with `sk_test_`.
  - `manual_approval` and `settlement_gated` are recognized but blocked until their schemas/services exist.

## Risk Entry Template

```markdown
### RISK-000 - Title

- Severity: `SEV2`
- Category: `CATEGORY`
- Status: `OPEN`
- Impacted systems:
  - route/service/table
- Description:
  - What can go wrong?
- Safe current behavior:
  - What protects us today?
- Unsafe assumption:
  - What should not be assumed?
- Recommended mitigation:
  - What should happen next?
- Owner:
  - TBD
```
