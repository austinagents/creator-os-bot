# PartnerLinks Economic Architecture

Purpose:

- Define the canonical PartnerLinks money model before additional payout automation, settlement automation, or public launch work.
- Make base earnings, platform fees, network override rewards, settlement assumptions, and anti-abuse rules impossible to confuse.
- Keep all future implementation aligned with deterministic Shopify/Stripe/affiliate-platform accounting patterns.

This is an architecture document. It does not describe every current implementation detail, and it does not authorize code changes by itself.

## Core Principle

PartnerLinks has two major economic layers:

1. Base earning systems
2. Network override systems

The network override system sits above the underlying earning systems.

Network overrides are not "creator referral commissions" in the narrow sense. They are an entity-based propagation economy. Current participants are mostly creators and brands, but the architecture must be able to support multiple entity types over time.

Potential entities:

- creators
- brands
- agencies
- communities
- managers
- other ecosystem participants

## Non-Negotiable Separation Rule

Network override earnings only come from eligible downstream PartnerLinks `platform_fee_amount`.

Network override earnings do not come from:

- creator direct commissions
- Shopify checkout revenue
- merchant gross revenue
- self-generated sales
- brand-funded affiliate commission principal

This separation must remain strict in:

- database ledgers
- service calculations
- dashboards
- payout eligibility
- operator diagnostics
- public/user-facing language
- future settlement automation

## Anti-Abuse Rule

Entities do not earn network override rewards from their own direct sales activity.

Network overrides only come from downstream entity activity.

This rule exists for:

- anti-abuse
- anti-self-referral farming
- accounting clarity
- auditability
- economic sanity
- payout integrity

Examples:

- Creator A drives their own attributed sale:
  - Creator A can earn direct brand creator commission.
  - Creator A does not earn a network override on their own activity.
- Creator A invites Creator B and Creator B drives an attributed sale:
  - Creator B can earn direct brand creator commission.
  - Creator A can earn a Level 1 network override from the eligible PartnerLinks platform fee.
- Brand A directly onboards Creator X and Creator X later drives attributed sales:
  - Creator X can earn direct brand creator commission.
  - Brand A can earn network override rewards as the origin sponsor if within the active level cap.

## Base Earning Systems

### 1. Direct Brand Creator Commission

This is the brand-defined affiliate commission.

Example:

- Brand offers 15% commission.
- Customer buys a $100 product.
- Direct attributed creator earns $15.

This is:

- brand-funded affiliate commission
- tied to direct attributed sale activity
- creator-owned allocation
- not PartnerLinks network earnings
- not funded from the PartnerLinks platform fee pool

Triggered by:

- creator directly generating attributed conversion activity

Paid by:

- brand affiliate program settlement system

Accounting identity:

```text
direct_creator_commission = order_value * creator_commission_rate
```

### 2. PartnerLinks Platform Fee

PartnerLinks charges a platform fee on attributed conversions.

Example:

- $100 order
- 5% platform fee
- $5 platform fee pool created

This creates:

- PartnerLinks platform fee revenue
- the only eligible source for network override rewards

Accounting identity:

```text
platform_fee_amount = order_value * platform_fee_rate
```

Important:

- The platform fee is separate from direct creator commission.
- Network override rewards are calculated from the platform fee pool only.
- Creator campaign commission principal must never be reduced to pay network overrides.

## Network Override System

Network override rewards are generated when downstream entities create attributed conversion activity.

Current finalized network structure:

- Level 1 Direct = 30%
- Level 2 Indirect = 3%
- Level 3 Extended = 2%
- Hard stop after Level 3

These percentages are percentages of eligible downstream PartnerLinks `platform_fee_amount`.

They are not percentages of:

- total PartnerLinks company revenue
- merchant gross revenue
- Shopify checkout revenue
- creator commissions

Accounting identities:

```text
level_1_override = platform_fee_amount * 30%
level_2_override = platform_fee_amount * 3%
level_3_override = platform_fee_amount * 2%
```

No Level 4+ reward may be created.

### Creator Invites Creator

Example:

- Creator A invites Creator B.
- Creator B later generates attributed sales.
- Creator B earns direct brand creator commission.
- Creator A earns Level 1 network override from the eligible PartnerLinks platform fee.

### Brand Invites Creator

Example:

- Brand A invites Creator X.
- Creator X later generates attributed sales for any eligible brand.
- Creator X earns direct brand creator commission.
- Brand A earns network override rewards as an origin sponsor.

Important:

- Brand A is not earning affiliate commission in this scenario.
- Brand A is earning network override rewards for onboarding productive entities into the ecosystem.
- Creator-invites-creator and brand-invites-creator should be modeled consistently as entity propagation, even if current tables separate creator and brand earning ledgers.

## Full Money Flow

### 1. Customer Checkout

- Customer pays the Shopify merchant directly.
- Shopify handles checkout/payment rails.
- PartnerLinks does not intercept checkout funds.
- Merchant initially receives gross revenue.

### 2. Shopify Responsibilities

Shopify is responsible for:

- OAuth/store connection
- product access
- order access
- attribution persistence through Shopify-supported fields where possible
- webhook registration
- signed `orders/paid` webhook as conversion source of truth

PartnerLinks should use Shopify-supported mechanisms first:

- cart attributes
- order note attributes
- `ref`
- signed webhooks
- order ids
- Shopify Admin order fields

### 3. PartnerLinks Responsibilities

PartnerLinks is responsible for:

- referral link generation
- click/session tracking
- deterministic attribution
- ambiguous fallback rejection
- conversion creation
- direct commission accounting
- platform fee accounting
- network override accounting
- diagnostics/auditability
- payout ledger integrity
- idempotency
- safe failure behavior

PartnerLinks should not:

- guess when attribution is ambiguous
- create payouts from raw clicks
- treat creator commissions as PartnerLinks-owned platform revenue
- assume custody of checkout funds
- silently subsidize network rewards from creator principal

### 4. Stripe Responsibilities

Stripe is responsible for:

- creator onboarding
- Stripe Connect payout rails
- creator payout transfers
- future automated settlement collection from brands
- payout lifecycle management

Current implementation:

- Stripe Connect Express onboarding exists.
- Stripe test-mode transfers exist for claim testing.
- Live payout automation is not enabled.

Future implementation must preserve:

- idempotency
- creator-scoped ownership checks
- claim ledgers
- transfer recovery
- safe failure before money movement

## Settlement Architecture

Automated settlement is not fully built yet. This section defines the target architecture that future work must satisfy.

Main settlement rule:

```text
accounted earnings are not necessarily funded earnings
```

Before live public payout automation, PartnerLinks must distinguish:

- attributed conversion activity
- recorded economic obligations
- brand-funded settlement
- claimable creator/network balances
- claimed/payout-transferred balances

No live payout should become claimable unless settlement/funding is safe under the rules below.

### Settlement Buckets

Each attributed conversion can create three economically separate amounts:

1. Direct creator affiliate commission
2. PartnerLinks platform fee
3. Network override rewards funded from the platform fee

These must remain:

- operationally separate
- economically separate
- auditably separate
- visually separate in dashboards and ledgers

### Platform Fee Collection

Target:

- PartnerLinks automatically collects platform fees from brands through a settlement mechanism.
- Collection must be idempotent and tied to conversion/order identity.
- Collection should happen before payout of network override rewards when nonpayment risk matters.

Recommended Stripe model:

- Use a saved brand payment method through Stripe SetupIntent for off-session settlement.
- Use Stripe PaymentIntents or invoices for settlement collection.
- For public beta, prefer a small reserve/prepaid balance or manual approval gate over immediate unrestricted automated payouts.
- Keep Stripe Billing/invoices as a strong option for brand statements, retries, and accounting clarity.
- Use PaymentIntents when per-order or batch charge control is more important than subscription/invoice semantics.

Collection cadence options:

- Per-order settlement:
  - strongest order-level funding traceability.
  - more payment attempts and higher operational noise.
  - best for small controlled beta if order volume is low and exactness matters.
- Daily batch settlement:
  - fewer charges, clearer daily statement.
  - introduces batch-level allocation logic.
  - good default once order volume grows.
- Weekly batch settlement:
  - fewer charges, lower operational friction.
  - longer credit exposure and slower claimability.
  - safer only with reserves or manual approval.
- Prepaid/reserve balance:
  - safest for PartnerLinks and creators.
  - brand funds a reserve before payouts become claimable.
  - requires balance tracking and top-up rules.
- Manual approval gate:
  - safest operational MVP.
  - least automated.
  - best when validating economics with first brands.

Recommended public beta model:

- Start with manual approval gate plus reserve/prepaid or per-order settlement.
- Do not allow automatic live creator/network payouts from merely recorded conversions.
- Claimability should require settlement status that proves funds are safe or explicitly approved.

Reason:

- PartnerLinks is still validating refund, settlement, and payout recovery behavior.
- A conservative beta model prevents hidden credit exposure and accidental unfunded payout obligations.

### Creator Commission Funding

Target:

- Direct creator commissions are brand-funded affiliate obligations.
- PartnerLinks may calculate and report them.
- Future automated routing must clarify whether funds are pulled from brands, transferred through Stripe Connect, or settled outside PartnerLinks.

Important:

- Direct creator commission is not PartnerLinks platform revenue.
- Direct creator commission is not the source of network override rewards.

Claimability requirement:

- Direct creator commission should not become live-payout claimable until the brand-funded commission amount is collected, reserved, or explicitly approved under a manual beta process.

### Network Override Funding

Target:

- Network override rewards are funded only from collected/eligible `platform_fee_amount`.
- Network rewards should not become claimable before settlement is sufficiently safe.

Required guardrail:

```text
network_override_pool <= eligible_collected_platform_fee_amount
```

Claimability requirement:

- Network override rewards should not become live-payout claimable until the related platform fee is collected, reserved, or explicitly approved under a manual beta process.

## Canonical Settlement States

Settlement states describe funding safety and money movement readiness. These are distinct from attribution status and from payout transfer status.

### Conversion/Earning Settlement States

- `attributed`
  - conversion attribution has been resolved and economic amounts have been calculated.
  - not yet funded.
- `settlement_pending`
  - waiting for brand funding attempt, batch close, reserve check, or manual approval.
- `settlement_authorized`
  - funding method/reserve/manual approval indicates likely funding, but cash is not fully collected/available.
- `settlement_collected`
  - funding has been collected or reserved sufficiently for the relevant obligation.
- `settlement_failed`
  - brand funding attempt failed.
- `settlement_retrying`
  - automatic or manual retry flow is active.
- `settlement_disputed`
  - settlement, charge, order, or brand obligation is under dispute/review.
- `refund_pending`
  - Shopify refund/partial refund/dispute is pending economic adjustment.
- `reversed`
  - economic amount has been reversed or offset through ledger entries.
- `claimable`
  - eligible to enter claim flow after pending/reserve/funding checks.
- `claimed`
  - claimed internally and linked to a claim batch/payout flow.

Recommended invariant:

```text
claimable requires settlement_collected OR explicit_manual_approval OR sufficient_prepaid_reserve
```

### State Flow

Recommended default flow:

```text
attributed
-> settlement_pending
-> settlement_authorized
-> settlement_collected
-> claimable
-> claimed
```

Failure/review branches:

```text
settlement_pending -> settlement_failed -> settlement_retrying -> settlement_collected
settlement_pending -> settlement_disputed
settlement_collected -> refund_pending -> reversed
claimed -> refund_pending -> negative_balance_or_offset
```

## Claimability Gating

Claimability gating is the rule set that determines whether an accounted earning can become payable.

### Direct Creator Commission Claimability

Direct creator commission can become claimable only when:

- attribution is deterministic or accepted under safe rules.
- duplicate order protection is satisfied.
- pending/review window has elapsed.
- brand-funded direct commission is collected, reserved, or manually approved.
- no refund/dispute block exists.
- creator payout account is eligible when payout claim is attempted.

### Network Override Claimability

Network override rewards can become claimable only when:

- downstream conversion is valid and not duplicate.
- attribution is deterministic or safely accepted.
- platform fee is collected, reserved, or manually approved.
- network level is within Level 1/2/3.
- earning entity is not the source entity for its own direct sale.
- no refund/dispute block exists.

### Brand-Origin Network Reward Claimability

Brand-origin rewards can become claimable only when:

- brand-origin relationship is proven.
- downstream activity is valid and within Level 1/2/3 cap.
- platform fee is collected/reserved/approved.
- the earning brand is not receiving a direct affiliate commission.
- settlement and refund windows are satisfied.

## Separate Money Ledgers

Future implementation should separate ledgers for:

- direct creator commissions
  - brand-funded affiliate obligations.
- PartnerLinks platform fees
  - platform revenue/fee pool.
- creator network override rewards
  - platform-fee-funded rewards to upstream creators.
- brand-origin network rewards
  - platform-fee-funded rewards to origin brands/entities.
- claim batches
  - grouped payout claim intent and transfer finalization.
- settlement collections
  - brand payment/reserve/invoice/payment-intent records.
- refunds/reversals
  - immutable adjustments and offsets.

Required design principle:

- Ledger rows should be appended or status-updated with audit metadata.
- Historical economic rows should not be silently deleted or rewritten.
- Reversals should be explicit rows/events where possible.

### Reserve And Pending Windows

Current:

- Earnings use pending -> claimable -> claimed lifecycle.
- A pending window exists before earnings become claimable.

Target:

- Pending windows should account for:
  - refund risk
  - failed settlement risk
  - fraud/review risk
  - webhook replay/idempotency risk

Open questions:

- whether direct creator commissions and network overrides use the same pending window
- whether platform fee collection must succeed before network overrides become claimable
- how to handle partial refunds before and after claim

### Refund Assumptions

Not fully implemented yet.

Target behavior:

- Refunds should adjust or reverse affected economic ledgers.
- If already claimed, reversal should create an offset/negative balance rather than deleting historical records.
- Refunds must not silently mutate immutable audit history.

### Failed Settlement Assumptions

Not fully implemented yet.

Target behavior:

- If platform fee collection fails, network override rewards should remain pending, blocked, reversed, or marked for review.
- The system must not pay network overrides from uncollected or unsafe platform fee funds unless explicitly designed and documented as a PartnerLinks credit risk decision.

### Failed Payout Assumptions

Current:

- Claim ledger and Stripe transfer metadata exist.
- Test-mode transfer flow has recovery-oriented structure.

Target behavior:

- Failed payouts should keep claim ledger records.
- Failed transfer attempts should be visible to operators.
- Retrying a failed payout must not duplicate successful transfers.

### Negative Balance Assumptions

Not fully implemented yet.

Target behavior:

- Negative balances should be explicit ledger entries.
- No silent deletion or mutation of historical earnings.
- Claimability should account for outstanding negative balances.

## Dashboard And Ledger Presentation

Creators may eventually see:

- Direct Creator Earnings
- Network Override Earnings
- Pending
- Claimable
- Claimed

These must not be conflated.

Recommended presentation:

- Direct Creator Earnings:
  - brand-funded affiliate commission
- Network Override Earnings:
  - PartnerLinks platform-fee-funded override rewards
- Pending:
  - not yet safe/eligible to claim
- Claimable:
  - eligible for claim/payout flow
- Claimed:
  - internally claimed and/or payout initiated

Dashboard language must avoid suggesting:

- that network rewards come from creator commissions
- that PartnerLinks owns creator commission principal
- that payout is guaranteed before settlement/review
- that an entity can earn network overrides from its own direct sales

## Accounting Principles

PartnerLinks economic systems must use Shopify/Stripe/affiliate-platform style accounting:

- deterministic accounting
- signed event trust
- explicit entity ownership
- immutable auditability
- idempotent payout behavior
- safe failure instead of guessing
- no ambiguous revenue ownership
- no hidden subsidy assumptions
- no payout before settlement if unsafe
- regression-protected financial behavior

## Current Implementation Notes

Current tables include:

- `conversions`
- `creator_network_earnings`
- `brand_network_earnings`
- `creator_earning_claims`

Current limitations:

- entity-based network abstraction is not fully generalized yet.
- creator and brand network earnings are separate tables.
- direct creator commission and network override earnings both flow into creator dashboard earnings today, but should remain conceptually and visually separate.
- automated brand settlement collection is not fully implemented.
- refund/negative-balance handling is not fully implemented.
- live Stripe payouts are not enabled.

## Current Economic Implementation Audit

Last read-only audit: 2026-05-16

Primary test actor:

- `test-creator-04`
- Creator id `13`
- Parent chain:
  - `test-creator-01 -> test-creator-02 -> test-creator-03 -> test-creator-04`
- Confirmed conversion:
  - `conversions.id = 19`
  - `order_id = shopify:partnerlinks-test.myshopify.com:6548682670254`

### Direct Brand Creator Commission

- Status: `PASS`
- Evidence:
  - `order_value = 18`
  - `commission_rate = 15`
  - `commission_amount = 2.70`
  - `payout_status = claimed`
  - `claim_batch_id` and `claimed_at` were preserved through claim lifecycle.
- Confirmed behavior:
  - direct commission is stored on `conversions`.
  - direct commission is separate from `creator_network_earnings`.
  - direct commission was not reduced by Level 1/2/3 network override payouts.
- Current limitation:
  - direct creator commission settlement source is accounted but not fully automated. The system currently calculates and can pay through Stripe test-mode claim flow, but production settlement collection from the brand is not implemented.

### PartnerLinks Platform Fee

- Status: `PASS` for accounting, `GAP` for settlement collection.
- Evidence:
  - `platform_fee_amount = 0.90` on conversion `19`.
  - all creator-network override rows for conversion `19` use `platform_fee_amount = 0.90`.
- Confirmed behavior:
  - platform fee is stored separately from direct commission.
  - network override rows calculate from platform fee, not from order gross or creator commission.
- Current limitation:
  - automatic platform-fee collection from brands is not implemented.
  - platform fee settlement status is not yet modeled as a prerequisite to network override claimability.

### Creator To Creator Network Overrides

- Status: `PASS`
- Evidence:
  - Level 1:
    - earning creator: `test-creator-03`
    - source creator: `test-creator-04`
    - rate: 30%
    - amount: `0.27`
  - Level 2:
    - earning creator: `test-creator-02`
    - source creator: `test-creator-04`
    - rate: 3%
    - amount: `0.03`
  - Level 3:
    - earning creator: `test-creator-01`
    - source creator: `test-creator-04`
    - rate: 2%
    - amount: `0.02`
  - no Level 4+ rows exist.
- Confirmed behavior:
  - upstream creators do not receive direct creator commission.
  - source creator does not receive a network override from their own direct sale.
  - overrides come only from `platform_fee_amount`.
  - rates are capped at Level 3.

### Brand To Creator Network Overrides

- Status: `PARTIALLY BUILT / NOT FULLY PROVEN`
- Implemented pieces:
  - `creators.invited_by_brand_id`
  - `creators.brand_referred_at`
  - `brand_network_earnings`
  - `/join/brand/:brandId` sets `partnerlinks_brand_invite_id` cookie.
  - auth callback can call `bindCreatorToBrandOrigin`.
  - `createNetworkEarningsForConversion` can create a `brand_network_earnings` row if a creator chain reaches a creator with `invited_by_brand_id` within the three-level cap.
- Current evidence:
  - latest `test-creator-04` report shows `Brand Network Earnings (0)`.
- Architecture gap:
  - brand-origin economics are scaffolded but not validated end-to-end with test data.
  - brand-origin payout/claim/settlement lifecycle is not implemented at the same maturity as creator claims.
  - no generalized entity ledger exists yet; creator and brand network earnings are still separate tables.

### Settlement

- Status: `NOT BUILT / ARCHITECTURE GAP`
- Current behavior:
  - Shopify checkout pays merchant directly.
  - PartnerLinks records conversions and earnings.
  - Stripe test-mode creator claim transfer works for test payout lifecycle.
- Not built:
  - automated brand platform-fee collection.
  - automated direct creator commission collection from brands.
  - settlement status gating before claimability.
  - refund/reversal ledger behavior.
  - negative balance behavior.
  - failed settlement retry behavior.
  - production/live Stripe transfer flow.

### Safety And Abuse Rules

- Status: `PASS` for creator-chain test path, `GAP` for broader entity enforcement.
- Confirmed:
  - no Level 4+ creator-network earnings.
  - no network override for source creator's own direct sale in the tested path.
  - no payout from ambiguous attribution in validated regression memory.
  - no duplicate conversion/earnings from duplicate webhook replay in validated regression memory.
  - exact attribution wins before fallback.
- Remaining work:
  - add explicit regression test/report for own-activity exclusion.
  - add brand-origin end-to-end test before claiming brand-as-entity support.
  - add settlement status before live payout automation.

### Current Contradictions Or Tensions

- Dashboard/service aggregation:
  - `creatorDashboardService` separately exposes direct commission and network earnings, but lifecycle totals such as pending/claimable/claimed combine direct commission and creator-network earnings.
  - This is acceptable for current testing, but before public launch the UI should make direct creator earnings and network override earnings visually distinct in all money states.
- Claim flow:
  - `creator_earning_claims` stores separate `direct_commission_amount` and `network_earning_amount`, but both can be claimed in one creator claim batch.
  - This is operationally convenient, but settlement automation must ensure each component is funded safely before claimability.
- Settlement:
  - Current Stripe test transfer proves payout mechanics, not production funding.
  - Future live claims must not assume platform fees or direct commissions have been collected unless settlement status says so.

## Future Implementation Requirements

Before automated settlement or broader public launch:

- define exact brand settlement collection mechanism.
- define claimability rules based on settlement status.
- define refund/reversal ledger behavior.
- define negative balance behavior.
- decide how direct creator commissions and network overrides settle separately.
- preserve Level 1/2/3 network cap.
- preserve own-activity exclusion for network overrides.
- preserve idempotent claim and transfer behavior.
- preserve diagnostics for every conversion/skipped/settled/claimed/reversed event.

## Required Future Schema And Service Changes

Do not implement automatically from this document. These are architecture requirements for future work.

### Proposed Tables

- `brand_payment_methods`
  - brand id
  - Stripe customer id
  - default payment method id
  - status
  - created/updated timestamps
- `settlement_batches`
  - brand id
  - cadence
  - period start/end
  - status
  - total direct commission amount
  - total platform fee amount
  - total network override amount
  - Stripe invoice/payment intent ids
  - retry metadata
- `settlement_items`
  - conversion id
  - brand id
  - earning row references
  - item type: direct commission, platform fee, network override
  - amount
  - status
  - settlement batch id
- `refund_reversal_events`
  - Shopify refund/order id
  - conversion id
  - affected earning ids
  - reversal/offset amounts
  - status
  - reason
- `brand_reserve_balances`
  - brand id
  - current reserve balance
  - minimum required balance
  - top-up status
- `settlement_audit_events`
  - event type
  - impacted entity
  - before/after status
  - Stripe/Shopify ids
  - diagnostic payload

### Proposed Columns

- `conversions.settlement_status`
- `conversions.settlement_batch_id`
- `conversions.direct_commission_settlement_status`
- `conversions.platform_fee_settlement_status`
- `conversions.refund_status`
- `creator_network_earnings.settlement_status`
- `creator_network_earnings.settlement_batch_id`
- `brand_network_earnings.settlement_status`
- `brand_network_earnings.settlement_batch_id`
- `creator_earning_claims.settlement_check_status`

### Proposed Services

- `settlementService`
  - creates settlement batches.
  - calculates brand obligations.
  - updates settlement states.
  - blocks claimability if funding is unsafe.
- `brandBillingService`
  - manages Stripe customer/payment method/setup intent.
  - creates PaymentIntents or invoices.
  - handles retries.
- `refundReversalService`
  - processes Shopify refunds/chargebacks.
  - creates offset/negative balance events.
  - blocks or reverses claimability.
- `settlementDiagnosticsService`
  - exposes operator views for settlement, retry, and reversal status.

### Proposed Jobs

- daily settlement batch creation.
- settlement retry worker.
- reserve balance/top-up checker.
- refund/reversal processor.
- stale settlement alert job.
- claimability promotion job that checks settlement status before marking earnings claimable.

### Stripe Objects

- SetupIntent:
  - collect brand payment method for future off-session settlement.
- Customer:
  - represent paying brand.
- PaymentIntent:
  - collect per-order or batch settlement.
- Invoice / Stripe Billing:
  - optional daily/weekly brand settlement statement.
- Transfer:
  - creator payout through Stripe Connect.
- Idempotency keys:
  - required for all settlement collection and payout transfer operations.

### Stripe/Webhook Events To Consider

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.dispute.created`
- `charge.refunded`
- Connect transfer-related events where relevant.

### Diagnostics

Operators must be able to answer:

- Is this conversion attributed?
- Has direct creator commission been funded?
- Has platform fee been collected?
- Are network overrides funded by collected platform fees?
- Why is an earning pending, blocked, claimable, claimed, reversed, or disputed?
- Which Stripe object proves settlement?
- Which Shopify event triggered conversion/refund?
- Which claim batch paid or attempted to pay this earning?

## Settlement-Aware Claimability Implementation Audit

Date: 2026-05-16

Current implementation status:

- `SAFE FOR SANDBOX / TEST MODE ONLY`
- `UNSAFE FOR LIVE PAYOUT AUTOMATION WITHOUT SETTLEMENT GATES`

Current code paths that treat earnings as claimable:

- `services/trackingService.js`
  - `recordConversion()`
  - creates direct creator commission rows in `conversions`.
  - sets `payout_status = pending`.
  - sets `claimable_at = getClaimableAt()`.
  - This is time-based and does not record whether the brand-funded direct commission or platform fee has been collected.
- `services/creatorNetworkService.js`
  - `buildCreatorEarningRow()`
  - creates `creator_network_earnings` rows.
  - sets `payout_status = pending`.
  - sets `claimable_at = getClaimableAt()`.
  - This is time-based and does not verify collected platform fee.
- `services/creatorNetworkService.js`
  - `buildBrandEarningRow()`
  - creates `brand_network_earnings` rows.
  - sets `payout_status = pending`.
  - sets `claimable_at = getClaimableAt()`.
  - This is time-based and does not verify collected platform fee.
- `services/earningsLifecycleService.js`
  - `resolveLifecycleStatus()`
  - returns `claimable` when `payout_status = claimable` or when `claimable_at <= now`.
  - This treats elapsed time as claimability.
- `services/earningsLifecycleService.js`
  - `sumLifecycleAmounts()`
  - calculates pending, claimable, claimed, and lifetime totals from `resolveLifecycleStatus()`.
  - Dashboard balances inherit the same time-based claimability assumption.
- `services/earningsLifecycleService.js`
  - `promoteClaimableEarningsForCreator()`
  - updates `conversions` and `creator_network_earnings` from `pending` to `claimable` when `claimable_at <= now`.
  - This is the main promotion path and is not settlement-aware.
- `services/creatorDashboardService.js`
  - `getCreatorDashboardByCode()`
  - calls `promoteClaimableEarningsForCreator()` when a dashboard loads.
  - Dashboard access can therefore mutate time-eligible rows into `claimable`.
- `index.js`
  - `renderCreatorEarningsLifecycle()`
  - enables the Claim earnings button when:
    - active dashboard owner is signed in.
    - Stripe status is `payouts_enabled`.
    - `claimableEarnings > 0`.
  - This does not check settlement state.
- `index.js`
  - `POST /earnings/claim`
  - verifies explicit creator ownership and Stripe payout status.
  - calls `claimCreatorEarnings()`.
  - This route is creator-scoped but not settlement-scoped.
- `services/earningsLifecycleService.js`
  - `claimCreatorEarnings()`
  - promotes claimable rows, reserves rows, creates `creator_earning_claims`, creates a Stripe test transfer, and finalizes rows as claimed.
  - It does not verify `settlement_collected`, manual approval, or prepaid reserve.

Current safety interpretation:

- This behavior is acceptable only for sandbox/test validation because Stripe transfer creation is test-mode guarded.
- This behavior must not be used for live payout automation.
- The current system proves attribution, economics, claim reservation, Stripe test transfer, and idempotent claim mechanics.
- The current system does not prove brand-funded settlement safety.

Live claimability invariant:

```text
claimable requires settlement_collected OR explicit_manual_approval OR sufficient_prepaid_reserve
```

Minimal future architecture change:

- Add settlement status fields to the earning rows that can become claimable.
  - direct creator commission settlement status on `conversions`.
  - platform fee settlement status on `conversions`.
  - settlement status on `creator_network_earnings`.
  - settlement status on `brand_network_earnings`.
- Add explicit manual approval fields where beta operations need a human release gate.
- Add reserve-balance fields or ledger rows where prepaid/reserve funding is used.
- Replace time-only promotion with a central settlement eligibility service.
- Update claim reservation queries to reserve only settlement-eligible rows.
- Keep `claimable_at` as a risk/review-window timestamp, not as the sole source of funding safety.

Recommended beta-safe behavior:

- Keep current claim flow available only in sandbox/test mode.
- Add a feature flag before live payout work:
  - implemented as `PAYOUT_MODE=sandbox_time_based|claims_disabled|manual_approval|settlement_gated`
- In public beta, use one of:
  - manual approval gate.
  - collected per-order settlement.
  - prepaid/reserve balance.
- Block live claims unless the selected gate is satisfied.

Implemented protective payout mode:

- Environment variable:
  - `PAYOUT_MODE`
- Allowed values:
  - `sandbox_time_based`
  - `claims_disabled`
  - `manual_approval`
  - `settlement_gated`
- Default:
  - `claims_disabled`
- Fail-closed behavior:
  - missing or unknown payout mode blocks claims.
  - `claims_disabled` blocks claims.
  - `manual_approval` blocks claims until approval schema/service exists.
  - `settlement_gated` blocks claims until settlement schema/service exists.
  - `sandbox_time_based` allows the existing time-window claim flow only when `STRIPE_SECRET_KEY` starts with `sk_test_`.
- Current production recommendation:
  - leave production at `claims_disabled` until settlement or manual approval gates are implemented.
- Regression rule:
  - `REG-SETTLEMENT-001`: live claimability must not be based only on `claimable_at`.

Dashboard wording risk:

- Current dashboard labels say:
  - `Pending Earnings`
  - `Claimable Earnings`
  - `Claim earnings`
- These can make accounted earnings look funded.
- Before public launch, creator-facing copy should distinguish:
  - accounted earnings.
  - settlement pending earnings.
  - approved/funded claimable earnings.
  - claimed/paid history.
