# PartnerLinks Economic Architecture

Purpose:

- Define the canonical PartnerLinks money model before additional payout automation, settlement automation, or public launch work.
- Make base earnings, platform fees, network override rewards, settlement assumptions, and anti-abuse rules impossible to confuse.
- Keep all future implementation aligned with deterministic Shopify/Stripe/affiliate-platform accounting patterns.

This is an architecture document. It does not describe every current implementation detail, and it does not authorize code changes by itself.

## Runtime Enforcement Boundary

This file is mostly `DOCUMENTED ARCHITECTURE ONLY` unless an item is explicitly listed as currently implemented.

`RUNTIME-ENFORCED` today:

- attributed Shopify `orders/paid` conversion ingestion.
- deterministic `partnerlinks_ref` attribution before fallback.
- duplicate conversion prevention for Shopify order ids.
- direct creator commission accounting on attributed conversions.
- `platform_fee_amount` accounting on attributed conversions.
- current creator-origin Level 1/2/3 network earnings from `platform_fee_amount`.
- hard stop after Level 3 in current creator-origin network logic.
- payout-mode gate before claims.
- `financial_reversal_events` and `financial_reversal_items` tables exist as additive ledger infrastructure.

`READ-ONLY DIAGNOSTIC` today:

- attribution decisions in `shopify_attribution_events`.
- production safety reports for orders, economics, refunds, settlement readiness, risk, lineage, and routes.

`DOCUMENTED ARCHITECTURE ONLY` / `PLANNED / NOT IMPLEMENTED`:

- automatic brand settlement collection.
- settlement-aware live claim promotion.
- refund/chargeback enforcement.
- payout clawbacks.
- negative balance offsets.
- synthetic-commerce risk scoring and risk holds.
- automated threat intelligence scanning.
- live creator payout release.

Additive infrastructure now proposed or present:

- `financial_reversal_events` / `financial_reversal_items` exist as diagnostic-only reversal ledger infrastructure.
- `POST /webhooks/shopify/refunds-create` captures Shopify refund events into reversal ledger rows without applying reversals.
- migration `017_settlement_state_runtime_schema.sql` proposes `settlement_batches`, `settlement_items`, and settlement/risk metadata fields.
- none of these release live claimability or prove funding by themselves.

`UNSAFE FOR LIVE PAYOUTS`:

- any payout flow based only on `claimable_at` or accounted conversion rows.
- any payout flow before `settlement_collected`, `manual_approved`, or `reserve_covered` exists and is enforced.

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

### Brand Settlement Automation Architecture

Goal:

- Automatically fund:
  1. direct creator commissions.
  2. PartnerLinks platform fees.
  3. network override rewards funded from eligible platform fees.
- Preserve the invariant:

```text
No creator or network payout becomes live-claimable until settlement is collected, manually approved, or covered by prepaid reserve.
```

#### Brand Stripe Customer

Each brand should have a Stripe Customer controlled by PartnerLinks.

Purpose:

- represent the brand billing identity.
- attach saved payment methods.
- support invoices, PaymentIntents, receipts, retries, and settlement auditability.

Recommended fields:

- `brands.stripe_customer_id`
- `brands.billing_email`
- `brands.billing_status`
- `brands.default_payment_method_id`

Security and operations:

- never expose brand payment method ids in public UI.
- use Stripe-hosted or Stripe.js SetupIntent flows for payment method collection.
- keep service-role and Stripe secret usage server-side only.

#### Brand Payment Method Setup

Use Stripe SetupIntent for saved off-session payment methods.

Flow:

1. Brand connects Shopify.
2. Brand completes initial setup.
3. Brand adds payment method through SetupIntent.
4. PartnerLinks stores:
   - Stripe customer id.
   - default payment method id.
   - setup status.
5. Future settlement can charge off-session according to the selected settlement cadence.

Why SetupIntent:

- standard Stripe pattern for saving payment methods.
- avoids collecting card/bank details directly.
- supports future off-session PaymentIntent or invoice payments.

#### PaymentIntent vs Stripe Billing / Invoice

PaymentIntent is better when:

- settlement is per order.
- exact control over idempotency and conversion/order identity is most important.
- operator wants one payment attempt per conversion or per compact batch.
- beta volume is low.

Stripe Billing / invoice is better when:

- settlement is daily or weekly.
- brands need clear statements.
- retries, payment status, and receipt/accounting workflows should be delegated to Stripe.
- many orders should roll into one charge.

Recommended path:

- Controlled beta:
  - start with manual approval plus either prepaid reserve or per-order PaymentIntent.
- Early production:
  - move to daily settlement batches.
  - use Stripe invoices or batch PaymentIntents depending on operational preference.
- Higher-volume brands:
  - use reserve/prepaid balance plus daily/weekly reconciliation.

#### Per-Order vs Daily/Weekly Batch Settlement

Per-order settlement:

- Pros:
  - strongest conversion-to-charge traceability.
  - easiest to reason about claimability for each conversion.
  - lowest credit exposure when charge succeeds before claimability.
- Cons:
  - many payment attempts.
  - more noisy for brands.
  - more payment failure events.
- Best use:
  - controlled beta or low-volume brands.

Daily batch settlement:

- Pros:
  - practical default for real commerce volume.
  - creates one daily brand statement.
  - reduces payment attempt noise.
- Cons:
  - requires `settlement_batches` and `settlement_items` allocation logic.
  - claimability waits until batch collection succeeds or reserve covers obligations.
- Best use:
  - recommended default after beta.

Weekly batch settlement:

- Pros:
  - lowest brand payment noise.
  - easier accounting summary.
- Cons:
  - longer credit exposure.
  - slower creator claimability unless reserve exists.
- Best use:
  - trusted brands with reserve balance or explicit terms.

Prepaid/reserve balance:

- Pros:
  - safest for creators and PartnerLinks.
  - earnings can become claimable when reserve coverage is sufficient.
  - reduces failed settlement risk.
- Cons:
  - requires reserve ledger, top-up rules, and operator visibility.
  - can add onboarding friction.
- Best use:
  - controlled beta brands with meaningful payout volume.

#### Settlement Batch Model

`settlement_batches` should represent a funding attempt or funding period for a brand.

Recommended fields:

- `id`
- `created_at`
- `updated_at`
- `brand_id`
- `shop_domain`
- `cadence`
  - `per_order`
  - `daily`
  - `weekly`
  - `manual`
  - `reserve_top_up`
- `period_start`
- `period_end`
- `status`
  - `draft`
  - `pending`
  - `authorized`
  - `collected`
  - `failed`
  - `retrying`
  - `disputed`
  - `partially_reversed`
  - `reversed`
  - `manually_approved`
- `currency`
- `direct_commission_total`
- `platform_fee_total`
- `network_override_total`
- `gross_settlement_total`
- `reserve_applied_amount`
- `manual_approved_at`
- `manual_approved_by`
- `stripe_customer_id`
- `stripe_payment_intent_id`
- `stripe_invoice_id`
- `stripe_charge_id`
- `idempotency_key`
- `attempt_count`
- `next_retry_at`
- `last_error`
- `notes`

Batch status meaning:

- `draft`: calculated but not attempted.
- `pending`: ready to charge or waiting for payment method.
- `authorized`: payment intent/invoice created or payment method confirmed, but not collected.
- `collected`: funds collected or sufficient reserve applied.
- `failed`: latest collection attempt failed.
- `retrying`: retry schedule active.
- `disputed`: payment/order/refund dispute blocks claimability.
- `manually_approved`: human operator accepts settlement risk for beta/manual operations.

#### Settlement Item Model

`settlement_items` should represent the exact economic obligation being funded.

Recommended fields:

- `id`
- `created_at`
- `updated_at`
- `settlement_batch_id`
- `brand_id`
- `conversion_id`
- `order_id`
- `earning_table`
  - `conversions`
  - `creator_network_earnings`
  - `brand_network_earnings`
- `earning_id`
- `item_type`
  - `direct_creator_commission`
  - `platform_fee`
  - `creator_network_override`
  - `brand_network_override`
  - `refund_reversal`
  - `reserve_application`
- `amount`
- `currency`
- `status`
  - `settlement_pending`
  - `settlement_authorized`
  - `settlement_collected`
  - `settlement_failed`
  - `settlement_retrying`
  - `settlement_disputed`
  - `refund_pending`
  - `reversed`
  - `manually_approved`
- `funding_source`
  - `payment_intent`
  - `invoice`
  - `reserve`
  - `manual_approval`
- `funding_reference_id`
- `claimability_released_at`
- `refund_reversal_event_id`
- `notes`

Important:

- One conversion may create multiple settlement items.
- Direct commission and platform fee must be separate items.
- Network override items must be tied to the platform fee settlement source.
- Claimability should be released at item level, not by a broad brand-level flag.

#### Claimability Release Rules

Direct creator commission can become live-claimable only when:

- the matching direct commission settlement item is `settlement_collected`, or
- the item is `manually_approved`, or
- sufficient reserve has been applied to that item.

Creator-network override can become live-claimable only when:

- the platform fee funding item for the source conversion is collected/approved/reserve-covered, and
- the creator-network override settlement item is collected/approved/reserve-covered, and
- no refund/dispute block exists.

Brand-network override can become live-claimable only when:

- the same platform-fee funding rule is satisfied, and
- brand-origin earning payout/settlement behavior is explicitly implemented.

Global claim release rule:

```text
claimable_row = accounted_row
  AND pending_window_elapsed
  AND deterministic_or_accepted_attribution
  AND duplicate_guard_satisfied
  AND settlement_item_safe
  AND no_refund_or_dispute_block
```

#### Refund And Reversal Handling

Shopify refund and chargeback handling must create explicit reversal records.

Before payout:

- mark affected settlement items as `refund_pending` or `reversed`.
- reduce or block claimability.
- do not delete original conversion/economic rows.

After payout:

- create negative balance or offset ledger rows.
- preserve original claim batch and Stripe transfer records.
- do not silently mutate claimed rows.
- apply future earnings offsets or manual recovery workflow.

Recommended tables:

- `refund_reversal_events`
- `refund_reversal_items`
- `entity_negative_balances`

Refund event fields:

- Shopify order id.
- Shopify refund id.
- conversion id.
- affected earning ids.
- original amount.
- reversed amount.
- status.
- reason.
- operator notes.

#### Failed Brand Payment Retries

When brand settlement payment fails:

- settlement batch becomes `settlement_failed`.
- items remain `settlement_pending` or `settlement_failed`.
- affected earnings must not become claimable.
- operator/admin alert is created.
- retry state is scheduled.

Retry policy:

- attempt 1 immediately or at batch close.
- retry after a short interval.
- retry again after 24 hours.
- after final retry, mark brand `settlement_blocked` or `billing_attention_required`.

Brand account consequences:

- pause new claimability for that brand.
- optionally keep tracking conversions but mark economics as settlement blocked.
- alert operators before disabling referral links.

Never:

- create creator payouts from failed brand settlement unless explicit manual approval accepts the credit risk.

#### Reserve / Prepaid Balance Option

Reserve balance model:

- brand prepays or maintains a reserve.
- settlement items draw down reserve when eligible.
- claimability can be released when reserve coverage is sufficient.
- reserve top-ups can be automatic through PaymentIntent or invoice.

Reserve fields:

- `brand_reserve_balances.brand_id`
- `available_balance`
- `reserved_balance`
- `minimum_required_balance`
- `currency`
- `top_up_status`
- `last_top_up_at`

Reserve ledger:

- `brand_reserve_ledger`
  - deposits.
  - applications to settlement items.
  - refunds/reversals.
  - adjustments.
  - top-up failures.

Recommended beta usage:

- use reserve/prepaid for brands where creator payouts need to be faster than daily settlement collection.
- otherwise use manual approval or per-order settlement.

#### Operator/Admin Visibility

Operators need settlement diagnostics before public launch.

Minimum admin views/commands:

- latest settlement batches.
- settlement batch detail by id.
- settlement status by Shopify order id.
- settlement status by conversion id.
- failed settlement queue.
- brand billing status.
- reserve balance by brand.
- items blocking claimability.
- refund/reversal queue.

Required diagnostic fields:

- brand id/name.
- shop domain.
- conversion id/order id.
- direct commission amount.
- platform fee amount.
- network override amount.
- batch id.
- item statuses.
- Stripe customer/payment intent/invoice ids.
- failure reason.
- retry count/next retry.
- manual approval status.

Discord/operator usage:

- Discord should remain an operator shortcut layer.
- Add slash commands only for diagnostics/manual review, not public brand UX.

#### Safest Controlled-Beta Model

Recommended first live-ish beta:

1. Brand connects Shopify.
2. Brand adds payment method through Stripe SetupIntent.
3. PartnerLinks records conversions and economic obligations.
4. Earnings remain settlement pending.
5. Operator reviews first conversions.
6. Either:
   - collect per-order PaymentIntent, or
   - apply prepaid reserve, or
   - manually approve a small test payout.
7. Claimability releases only for approved/collected/reserve-covered items.
8. Creator can claim through existing Stripe Connect flow.

Why this is safest:

- avoids unfunded live claims.
- keeps idempotent payout system intact.
- lets first brands be monitored closely.
- avoids building complex invoice automation before economics are proven at small scale.
- creates audit trails for every funded/approved earning.

Recommended next implementation order:

1. brand Stripe Customer + SetupIntent onboarding.
2. settlement tables and item ledger.
3. manual approval release path.
4. per-order PaymentIntent collection path.
5. claimability promotion from settlement-safe items only.
6. refund/reversal ledger.
7. daily batch/invoice automation.

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

## Canonical Settlement Lifecycle State Machine

Date: 2026-05-16

Purpose:

- Make every settlement, funding, claim, refund, and recovery path explicit before settlement code is built.
- Preserve financial-infrastructure standards:
  - deterministic transitions.
  - explicit fund ownership.
  - idempotent operations.
  - trusted event sources.
  - auditable ledgers.
  - safe failure modes.
  - no ambiguous payout states.

Core invariant:

```text
No creator or network payout becomes live-claimable until settlement is collected, manually approved, or reserve-covered.
```

### State Definitions

Each state below must be represented by ledger rows and audit events before live settlement automation.

#### `attributed`

- Meaning:
  - Shopify order paid event was received and attribution was resolved.
- Trigger:
  - signed Shopify `orders/paid` webhook.
- Transition owner:
  - Shopify webhook ingestion service.
- Required evidence:
  - valid Shopify HMAC.
  - Shopify order id.
  - shop domain.
  - deterministic attribution source or accepted fallback decision.
  - duplicate order guard result.
- Required ledger rows:
  - `shopify_attribution_events`
  - `conversions`
- Required diagnostics:
  - attribution source.
  - attribution confidence.
  - fallback usage.
  - duplicate status.
- Creator visible:
  - yes, as accounted conversion/earnings.
- Claimable:
  - no.
- Operator action:
  - none unless attribution confidence is not exact/high.

#### `settlement_pending`

- Meaning:
  - economic obligation is accounted but not funded.
- Trigger:
  - conversion/economic row creation.
  - settlement batch/item creation.
- Transition owner:
  - settlement service.
- Required evidence:
  - conversion id.
  - item type.
  - amount.
  - brand id.
- Required ledger rows:
  - `settlement_items`
  - optional `settlement_batches`
- Required diagnostics:
  - item status.
  - reason pending.
- Creator visible:
  - yes, as pending settlement/accounted earnings.
- Claimable:
  - no.
- Operator action:
  - review if item remains pending beyond expected window.

#### `settlement_authorized`

- Meaning:
  - payment method/invoice/payment intent/reserve check suggests funding is likely, but funds are not fully collected.
- Trigger:
  - PaymentIntent created/authorized.
  - invoice finalized.
  - reserve earmarked but not applied.
- Transition owner:
  - brand billing service or settlement service.
- Required evidence:
  - Stripe PaymentIntent or invoice id.
  - authorization/reserve reference.
- Required ledger rows:
  - `settlement_batches`
  - `settlement_items`
  - `settlement_audit_events`
- Required diagnostics:
  - Stripe object id.
  - authorization status.
- Creator visible:
  - optionally, as pending settlement.
- Claimable:
  - no, unless explicitly combined with reserve coverage/manual approval.
- Operator action:
  - monitor stale authorizations.

#### `settlement_collected`

- Meaning:
  - brand-funded obligation has been collected or sufficiently funded.
- Trigger:
  - Stripe `payment_intent.succeeded`.
  - Stripe `invoice.paid`.
  - confirmed internal collection event.
- Transition owner:
  - Stripe webhook handler and settlement service.
- Required evidence:
  - Stripe event id.
  - PaymentIntent/invoice/charge id.
  - amount collected.
  - idempotency key.
- Required ledger rows:
  - settled `settlement_batch`
  - settled `settlement_items`
  - `settlement_audit_events`
- Required diagnostics:
  - collected amount.
  - matched items.
  - any over/under collection.
- Creator visible:
  - yes, as funded/approved claimable soon or claimable.
- Claimable:
  - yes after pending/review window and no refund/dispute block.
- Operator action:
  - review only if partial or mismatched collection.

#### `settlement_failed`

- Meaning:
  - brand payment attempt failed.
- Trigger:
  - Stripe `payment_intent.payment_failed`.
  - Stripe `invoice.payment_failed`.
  - payment method missing/invalid.
- Transition owner:
  - Stripe webhook handler and settlement service.
- Required evidence:
  - Stripe failure event.
  - error code/message.
  - affected batch/items.
- Required ledger rows:
  - failed `settlement_batch`
  - failed/pending `settlement_items`
  - `settlement_audit_events`
- Required diagnostics:
  - failure reason.
  - retry eligibility.
- Creator visible:
  - yes, as pending settlement or on hold.
- Claimable:
  - no.
- Operator action:
  - alert brand/operator.
  - inspect retry plan.
  - possibly pause claimability for brand.

#### `settlement_retrying`

- Meaning:
  - failed settlement is on an active retry schedule.
- Trigger:
  - retry job scheduled or operator retry initiated.
- Transition owner:
  - settlement retry worker or operator.
- Required evidence:
  - previous failed attempt.
  - retry count.
  - next retry timestamp.
- Required ledger rows:
  - `settlement_batches`
  - `settlement_items`
  - `settlement_audit_events`
- Required diagnostics:
  - retry count.
  - next retry.
- Creator visible:
  - yes, as pending settlement/on hold.
- Claimable:
  - no.
- Operator action:
  - monitor retry exhaustion.

#### `settlement_disputed`

- Meaning:
  - settlement or underlying order/payment is disputed/review-blocked.
- Trigger:
  - Stripe dispute event.
  - Shopify chargeback/refund review.
  - operator dispute flag.
- Transition owner:
  - Stripe/Shopify webhook handler or operator.
- Required evidence:
  - dispute/refund/review event id.
  - affected order/conversion/items.
- Required ledger rows:
  - `settlement_audit_events`
  - optional `refund_reversal_events`
- Required diagnostics:
  - dispute reason.
  - affected amounts.
- Creator visible:
  - yes, as on hold/needs review.
- Claimable:
  - no.
- Operator action:
  - required.

#### `refund_pending`

- Meaning:
  - Shopify refund/partial refund/chargeback may affect accounted or paid earnings.
- Trigger:
  - Shopify refund webhook.
  - Stripe refund/dispute event.
- Transition owner:
  - refund reversal service.
- Required evidence:
  - Shopify refund id or Stripe event id.
  - affected order/conversion.
  - refund amount.
- Required ledger rows:
  - `refund_reversal_events`
  - `refund_reversal_items`
  - `settlement_audit_events`
- Required diagnostics:
  - before/after amounts.
- Creator visible:
  - yes, as on hold or reversal pending.
- Claimable:
  - no for affected unclaimed rows.
- Operator action:
  - review if after payout or partial allocation is complex.

#### `reversed`

- Meaning:
  - earning/settlement item has been reversed or offset before claim.
- Trigger:
  - refund/reversal service finalizes adjustment before payout.
- Transition owner:
  - refund reversal service.
- Required evidence:
  - refund/reversal event.
  - affected earning ids.
- Required ledger rows:
  - original rows preserved.
  - reversal rows or status update.
  - audit event.
- Required diagnostics:
  - reversal amount.
  - reason.
- Creator visible:
  - yes, as reversed/adjusted earnings.
- Claimable:
  - no.
- Operator action:
  - none unless disputed.

#### `manual_approved`

- Meaning:
  - operator explicitly approves claimability despite incomplete automated settlement.
- Trigger:
  - authorized operator action.
- Transition owner:
  - operator/admin tool.
- Required evidence:
  - operator id.
  - timestamp.
  - reason.
  - approved amount.
  - accepted risk note.
- Required ledger rows:
  - `settlement_items`
  - `settlement_audit_events`
- Required diagnostics:
  - who/when/why.
- Creator visible:
  - yes, as approved/claimable.
- Claimable:
  - yes after any pending/review window and no refund/dispute block.
- Operator action:
  - required to enter state.

#### `reserve_covered`

- Meaning:
  - prepaid reserve balance covers the settlement item.
- Trigger:
  - reserve application to item.
- Transition owner:
  - settlement service or reserve ledger service.
- Required evidence:
  - reserve balance before/after.
  - reserve ledger id.
  - applied amount.
- Required ledger rows:
  - `brand_reserve_ledger`
  - `settlement_items`
  - `settlement_audit_events`
- Required diagnostics:
  - reserve coverage amount.
  - remaining reserve.
- Creator visible:
  - yes, as funded/claimable once review window clears.
- Claimable:
  - yes after pending/review window and no refund/dispute block.
- Operator action:
  - monitor low reserve alerts.

#### `claimable`

- Meaning:
  - earning is eligible to enter claim flow.
- Trigger:
  - settlement item reaches `settlement_collected`, `manual_approved`, or `reserve_covered`.
  - pending/review window has elapsed.
  - no refund/dispute block exists.
- Transition owner:
  - settlement-aware claimability promotion job.
- Required evidence:
  - eligible settlement item.
  - risk window check.
  - duplicate guard check.
- Required ledger rows:
  - earning row.
  - settlement item.
  - audit event.
- Required diagnostics:
  - why claimability was released.
- Creator visible:
  - yes.
- Claimable:
  - yes.
- Operator action:
  - none unless manual approval path.

#### `claim_reserved`

- Meaning:
  - claimable rows are reserved into one idempotent claim batch.
- Trigger:
  - creator submits claim.
- Transition owner:
  - earnings lifecycle service.
- Required evidence:
  - signed-in creator ownership.
  - Stripe payouts enabled.
  - payout mode allows claim.
  - settlement gate passed.
- Required ledger rows:
  - `creator_earning_claims`
  - earning rows with `claim_batch_id`
- Required diagnostics:
  - claim batch id.
  - reserved rows.
- Creator visible:
  - yes, as processing.
- Claimable:
  - already reserved; not available for another claim.
- Operator action:
  - monitor stuck reservations.

#### `claimed`

- Meaning:
  - claim completed and payout transfer/ledger finalized.
- Trigger:
  - Stripe transfer succeeds or approved payout ledger finalizes.
- Transition owner:
  - earnings lifecycle service and Stripe transfer service.
- Required evidence:
  - Stripe transfer id.
  - claim batch id.
  - claimed_at timestamps.
- Required ledger rows:
  - `creator_earning_claims`
  - claimed earning rows.
- Required diagnostics:
  - transfer status.
  - claimed amount.
- Creator visible:
  - yes, as claimed/paid or processing depending transfer status.
- Claimable:
  - no; already claimed.
- Operator action:
  - none unless transfer status later fails/disputes.

#### `claim_failed`

- Meaning:
  - claim attempt failed before completion.
- Trigger:
  - Stripe transfer error.
  - DB finalization error.
  - validation failure.
- Transition owner:
  - earnings lifecycle service.
- Required evidence:
  - error message/code.
  - claim batch id if created.
  - transfer id if one exists.
- Required ledger rows:
  - claim row if created.
  - audit event.
  - reserved rows either recoverable or safely released.
- Required diagnostics:
  - failure point.
  - retry safety status.
- Creator visible:
  - yes, as failed/try later if safe.
- Claimable:
  - depends on recovery status.
- Operator action:
  - required if Stripe transfer succeeded but DB finalization failed.

#### `offset_required`

- Meaning:
  - refund/reversal occurred after payout, requiring future offset or negative balance.
- Trigger:
  - refund after `claimed`.
- Transition owner:
  - refund reversal service.
- Required evidence:
  - original claim batch.
  - transfer id.
  - refund/reversal event.
- Required ledger rows:
  - `entity_negative_balances`
  - `refund_reversal_events`
  - `settlement_audit_events`
- Required diagnostics:
  - offset amount.
  - affected future earnings.
- Creator visible:
  - yes, as adjustment/offset with careful language.
- Claimable:
  - no for reversed amount; future claimability may net against offset.
- Operator action:
  - review significant negative balances.

### Legal State Transitions

Normal path:

```text
attributed
-> settlement_pending
-> settlement_authorized
-> settlement_collected
-> claimable
-> claim_reserved
-> claimed
```

Manual approval path:

```text
attributed
-> settlement_pending
-> manual_approved
-> claimable
-> claim_reserved
-> claimed
```

Reserve path:

```text
attributed
-> settlement_pending
-> reserve_covered
-> claimable
-> claim_reserved
-> claimed
```

Failed settlement path:

```text
settlement_pending
-> settlement_failed
-> settlement_retrying
-> settlement_collected
-> claimable
```

Dispute/refund before payout:

```text
settlement_pending|settlement_authorized|settlement_collected|claimable
-> refund_pending
-> reversed
```

Refund after payout:

```text
claimed
-> refund_pending
-> offset_required
```

Claim failure:

```text
claimable
-> claim_reserved
-> claim_failed
-> claimable
```

Only if safe to release reservation.

Stripe transfer succeeded but DB finalization failed:

```text
claim_reserved
-> claim_failed
-> operator_recovery
-> claimed
```

The original transfer id and claim batch id must be reused. No duplicate transfer.

### Happy Path

```text
Shopify order paid
-> signed webhook verified
-> attribution resolved
-> duplicate guard passes
-> conversion created
-> direct commission accounted
-> platform_fee_amount accounted
-> Level 1/2/3 network overrides calculated
-> settlement items created
-> brand payment collected
-> settlement_collected
-> earnings become claimable
-> creator claims
-> claim_reserved
-> Stripe transfer succeeds
-> claimed
```

Required diagnostics:

- webhook attribution event.
- conversion/economic rows.
- settlement batch/item rows.
- Stripe collection event.
- claim batch.
- Stripe transfer id.

### Duplicate / Replay Path

```text
Shopify retries webhook
-> duplicate order detected
-> duplicate_skipped diagnostic
-> no second conversion
-> no second earnings
-> no settlement duplicate
-> no payout duplicate
```

Required behavior:

- return 200 safely.
- create diagnostic row.
- preserve original conversion and settlement rows.
- do not create duplicate settlement items.

### Ambiguous Attribution Path

```text
Shopify order has no deterministic attribution
-> multiple recent clicks exist
-> recent-click fallback is ambiguous
-> skipped diagnostic
-> no conversion
-> no earnings
-> no settlement
-> no payout
```

Required behavior:

- safe failure over guessing.
- return 200 to Shopify.
- diagnostic includes `unmatched_reason = ambiguous_recent_click_fallback`.

### Failed Brand Settlement Path

```text
conversion created/accounted
-> settlement_pending
-> brand payment fails
-> settlement_failed
-> retry scheduled
-> settlement_retrying
-> settlement_collected OR operator intervention
```

Rules:

- no claimable earnings until funded, manually approved, or reserve-covered.
- retries must be idempotent.
- operator alert required after failure and retry exhaustion.

### Refund / Reversal Paths

Before payout:

```text
conversion/accounted earnings exist
-> refund detected
-> refund_pending
-> reversed
-> no payout
```

After payout:

```text
claimed payout exists
-> refund detected
-> refund_pending
-> offset_required
-> future earnings offset OR manual recovery
```

Rules:

- never silently delete conversion/earning/claim rows.
- preserve original claim and transfer history.
- create explicit reversal/offset ledgers.

### Manual Approval Path

```text
operator reviews item
-> manual_approved
-> claimable
```

Required audit:

- operator id.
- timestamp.
- reason.
- amount.
- accepted risk note.
- affected conversion/earning ids.

Manual approval must be exceptional, visible, and reviewable.

### Prepaid Reserve Path

```text
brand funds reserve
-> reserve ledger increases
-> attributed conversion creates settlement item
-> reserve applied
-> reserve_covered
-> claimable
```

Rules:

- reserve ledger decreases when applied.
- low reserve alerts are required.
- reserve must be item-applied, not vague brand-level confidence.

### Claim Lifecycle

```text
claimable
-> claim_reserved
-> Stripe transfer attempt
-> claimed OR claim_failed
```

Rules:

- one claim batch id per claim attempt.
- one Stripe transfer per claim batch.
- retry after success must recover existing transfer.
- failed transfer should safely release or preserve reservations depending failure point.
- DB finalization failure after transfer success requires operator recovery, not a new transfer.

### Brand-Origin Network Override Path

```text
brand invites creator
-> creator generates attributed sales
-> brand-origin network override calculated from downstream platform_fee_amount
-> settlement/funding gate applies
-> claimable only when collected/approved/reserve-covered
```

Rules:

- brand-origin reward is not affiliate commission.
- brand-origin reward is from downstream `platform_fee_amount`.
- no self-generated override.
- Level 1/2/3 cap still applies.
- brand-origin payout/credit path must be explicitly implemented before public use.

### Creator-Origin Network Override Path

```text
creator invites creator
-> downstream creator generates attributed sales
-> Level 1/2/3 calculated from platform_fee_amount
-> settlement/funding gate applies
-> claimable only when collected/approved/reserve-covered
```

Rules:

- Level 1 = 30%.
- Level 2 = 3%.
- Level 3 = 2%.
- no Level 4+.
- source creator does not earn network override from their own direct sale.
- direct creator commission is not reduced by network overrides.

### UX State Mapping

Creator-facing terms:

- `Accounted earnings`
  - conversion/economic rows exist.
  - not guaranteed payable yet.
- `Pending settlement`
  - awaiting brand funding, reserve coverage, or manual approval.
- `Claimable earnings`
  - funded/approved/reserve-covered and eligible to claim.
- `Claimed earnings`
  - internally claimed and linked to payout/claim history.
- `On hold`
  - settlement failed, disputed, or under review.
- `Reversed earnings`
  - adjusted due to refund/reversal.
- `Offset required`
  - prior payout needs future offset.

Brand-facing terms:

- `Attributed sales`
- `Creator commission owed`
- `PartnerLinks platform fee`
- `Settlement pending`
- `Settlement collected`
- `Payment failed`
- `Reserve balance`
- `Refund/reversal adjustment`

Operator/admin terms:

- `Needs review`
- `Settlement failed`
- `Retrying`
- `Manual approval requested`
- `Reserve low`
- `Claim blocked`
- `Offset required`
- `Duplicate skipped`
- `Ambiguous attribution skipped`

Avoid:

- saying unfunded/accounted earnings are guaranteed.
- saying pending earnings are available to withdraw.
- blending direct commission and network override source of funds without labels.

### Settlement Regression Rules

- `REG-SETTLEMENT-001`: live claimability cannot be based only on `claimable_at`.
- `REG-SETTLEMENT-002`: no payout before `settlement_collected`, `manual_approved`, or `reserve_covered`.
- `REG-SETTLEMENT-003`: failed settlement cannot create claimable earnings.
- `REG-SETTLEMENT-004`: refunds after payout create offset/reversal records, not silent deletion.
- `REG-SETTLEMENT-005`: claim retries cannot create duplicate Stripe transfers.
- `REG-SETTLEMENT-006`: duplicate webhooks cannot create duplicate settlement items.
- `REG-SETTLEMENT-007`: manual approval must be auditable.

### Required Future Implementation Plan

Tables:

- `brand_payment_methods`
- `settlement_batches`
- `settlement_items`
- `settlement_audit_events`
- `refund_reversal_events`
- `refund_reversal_items`
- `brand_reserve_balances`
- `brand_reserve_ledger`
- `entity_negative_balances`

Columns:

- `conversions.direct_commission_settlement_status`
- `conversions.platform_fee_settlement_status`
- `conversions.refund_status`
- `conversions.settlement_batch_id`
- `creator_network_earnings.settlement_status`
- `creator_network_earnings.settlement_item_id`
- `brand_network_earnings.settlement_status`
- `brand_network_earnings.settlement_item_id`
- `creator_earning_claims.settlement_check_status`

Services:

- `brandBillingService`
- `settlementService`
- `settlementEligibilityService`
- `refundReversalService`
- `reserveLedgerService`
- `settlementDiagnosticsService`

Jobs:

- settlement batch builder.
- settlement collection worker.
- settlement retry worker.
- settlement-aware claimability promoter.
- refund/reversal processor.
- reserve top-up checker.
- stale settlement alert job.

Stripe events:

- `setup_intent.succeeded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Shopify events:

- `orders/paid`
- refunds webhook.
- order cancelled webhook if relevant.

Admin/operator surfaces:

- settlement batch list/detail.
- settlement item lookup by order/conversion.
- failed settlement queue.
- manual approval screen.
- reserve balance screen.
- refund/reversal queue.
- claim recovery screen.

Discord diagnostics:

- settlement status by order id.
- failed settlement list.
- claimability blocker lookup.
- reserve balance lookup.
- manual approval audit lookup.

`productionSafetyTest.js` additions:

- `--settlement-state-report --order-id <order_id>`
- `--settlement-item-report --conversion-id <id>`
- `--refund-reversal-report --order-id <order_id>`
- `--manual-approval-report`
- `--reserve-report --brand-id <brand_id>`
- `--claimability-gate-report --creator-code <creator_code>`

## Platform Safety And Abuse Model

Date: 2026-05-16

PartnerLinks must be built around known affiliate/referral/creator reward failure modes. The platform is not just a referral URL generator; it is economic infrastructure.

Core rule:

```text
conversion_created does not mean safe_to_pay
```

Live payout eligibility requires:

- deterministic attribution is proven.
- commerce quality is acceptable.
- brand settlement/funding is safe.
- refund/reversal risk is handled.
- payout eligibility is explicitly allowed.

### Attribution Hijacking / Cookie Stuffing

Risk:

- a bad actor attempts to steal attribution without creating real referral value.

Defenses:

- deterministic `partnerlinks_ref`.
- Shopify cart/order attributes.
- exact attribution before fallback.
- no payout from raw click/cookie alone.
- ambiguous attribution skips.
- diagnostics for skipped/unmatched attribution.
- no broad recent-click guessing.

Regression:

- Ambiguous attribution cannot create conversion, earnings, settlement, or payout.

### Last-Click / Extension / Coupon Attribution Theft

Risk:

- extension/coupon/late-stage redirect overwrites the real creator.

Defenses:

- preserve first-party `partnerlinks_ref` through cart/order attributes.
- log attribution source/confidence.
- low-confidence fallback cannot override exact attribution.

Regression:

- exact `partnerlinks_ref` always wins before fallback.

### Synthetic Commerce Activity

Risk:

- fake orders, circular purchases, refund loops, stolen cards, low-quality incentive orders, or creator/buyer collusion generate artificial commissions.

Defenses:

- settlement-aware claimability.
- no payout before `settlement_collected`, `manual_approved`, or `reserve_covered`.
- pending/review windows.
- future Shopify fraud/risk signal ingestion.
- suspicious velocity detection.
- manual review queue.
- payout holds for new/high-risk patterns.
- negative balance / `offset_required` after refunds.

Regression:

- no live payout is released just because a conversion exists.

### Referral / Fake Account Abuse

Risk:

- duplicate creator accounts, fake invited creators, or identity clusters farm network rewards.

Nuance:

- self-owned accounts are not automatically bad if real commerce is generated.
- synthetic commerce and payout loops are the real risk.

Defenses:

- no network overrides from self-generated direct sales.
- no signup/recruitment-only rewards.
- network rewards only from downstream attributed `platform_fee_amount`.
- no Level 4+.
- future monitoring of duplicate payout methods, Stripe accounts, tax ids, devices, IPs, and abnormal graph patterns.

Regression:

- recruitment alone cannot generate PartnerLinks revenue or network payouts.

### MLM / Recruitment-Only Legal Risk

Risk:

- multi-level rewards become dangerous when rewards are based on recruitment rather than real retail commerce.

Defenses:

- no payout for signups alone.
- no payout from recruitment alone.
- network overrides only from eligible downstream `platform_fee_amount` generated by real attributed sales.
- hard Level 3 stop.
- no self-generated network override.
- clear distinction between direct creator commission and network override rewards.

Regression:

- network overrides are funded only by eligible downstream `platform_fee_amount`.

### Duplicate Webhook / Payment Replay

Risk:

- duplicate Shopify/Stripe events create duplicate financial mutations.

Defenses:

- signed webhook verification.
- duplicate order guard.
- duplicate/skipped diagnostics.
- no duplicate conversions/earnings.
- idempotent claim batches.
- Stripe transfer idempotency.

Future defenses:

- settlement item idempotency.
- brand charge idempotency.
- refund/reversal idempotency.

Regression:

- duplicate webhooks cannot create duplicate financial mutations.

### Payout Leakage / Unfunded Earnings

Risk:

- creators are paid before brand funds commission/platform fee settlement.

Defenses:

- `PAYOUT_MODE` fail-closed.
- production default `claims_disabled`.
- `sandbox_time_based` only with `sk_test_`.
- accounted earnings separated from funded earnings.
- future `settlement_batches` and `settlement_items`.

Regression:

- live claimability cannot be based only on `claimable_at`.

### Refunds / Chargebacks / Reversals

Risk:

- orders refund after commissions are recorded or paid.

Defenses to build:

- `refund_reversal_events`.
- `refund_pending`, `reversed`, `offset_required`.
- no payout if refund occurs before claim.
- negative balance or future earnings offset after payout.
- creator-facing reversal language.

Regression:

- refunds after payout create offset/reversal records, not silent deletion.

### Creator Disclosure / Compliance Risk

Risk:

- creators promote products without disclosing compensation or affiliate relationship.

Defenses to build:

- creator onboarding disclosure reminder.
- affiliate disclosure best-practice copy.
- brand/creator terms.
- product link/share UI disclosure reminder where appropriate.
- avoid misleading organic-only language.

Regression:

- creator-facing UX must not obscure that links may create compensation.

### Unsolicited Referral Messaging Risk

Risk:

- referral systems send unsolicited SMS/email or encourage spam.

Defenses:

- no unsolicited platform-sent SMS/email without proper consent.
- consent-aware invite tools.
- avoid automated spammy invite messaging.
- document referral messaging rules before outreach automation.

Regression:

- PartnerLinks should not send referral messages to third parties without proper consent and safeguards.

### UI/UX Money Confusion

Risk:

- creators/brands misunderstand pending, accounted, funded, claimable, claimed, reversed, direct earnings, and network override earnings.

Defenses:

- separate Direct Creator Earnings vs Network Override Earnings.
- separate Accounted vs Funded vs Claimable.
- clear disabled claim reasons.
- no UI suggesting unfunded/accounted earnings are guaranteed payable.
- operator diagnostics for every money state.

Regression:

- dashboard money states must clearly distinguish accounted earnings from funded/claimable earnings.

### Deep Platform Safety Expansion

PartnerLinks must model the catastrophic-risk cases that have hurt mature affiliate, marketplace, Shopify app, and payout platforms. These risks are economic architecture concerns, not only compliance tasks.

#### Cookie Stuffing / Improper Affiliate Attribution

- Real-world pattern:
  - public reporting around eBay affiliate fraud described cookie stuffing that allegedly generated tens of millions in improper affiliate commissions.
- Economic rule:
  - raw clicks/cookies are not economic evidence.
  - `partnerlinks_ref` plus Shopify-supported cart/order attributes are the durable attribution evidence.
  - ambiguous fallback creates no conversion, settlement, or payout.

#### Affiliate Network Liability / Promotional Abuse

- Real-world pattern:
  - FTC v. LeadClick showed that affiliate networks can be liable for deceptive affiliate claims.
- Economic rule:
  - unsafe creator/brand promotion must be reportable, reviewable, suspendable, and auditable.
  - public creator/brand/product surfaces require moderation ability before scale.
  - creator disclosure requirements are part of the economic system because undisclosed compensation can create regulatory risk.

#### Shopify App Data Risk

- Real-world pattern:
  - Shopify apps/providers can become data exposure weak points.
- Economic rule:
  - PartnerLinks should store the minimum order/customer data required for attribution, settlement, diagnostics, and support.
  - full customer/order payload logging is not a default diagnostic strategy.
  - Shopify tokens, webhook secrets, and app credentials require least-privilege handling and rotation procedures.

#### Authorization Scope Bugs

- Real-world pattern:
  - resource-scoping flaws can grant access to the wrong store/account/creator/brand.
- Economic rule:
  - every sensitive creator/brand route requires explicit resource context and ownership verification.
  - no payout, settlement, Stripe, or admin path may depend on newest/default creator assumptions.

#### Stripe Connect / Platform Payout Fraud

- Real-world pattern:
  - connected accounts can still be fraudulent and may attempt payout extraction before chargebacks arrive.
- Economic rule:
  - Stripe onboarding means payout rail readiness, not fraud approval.
  - new creators, new brands, large first payouts, refund-heavy behavior, and suspicious identity clusters need hold/review paths.
  - live claimability still requires settlement collected, manual approval, or reserve coverage.

#### Referral Messaging And Disclosure Risk

- Real-world pattern:
  - referral messaging and endorsement systems can create legal exposure when consent or compensation disclosure is missing.
- Economic rule:
  - PartnerLinks should not send referral SMS/email without consent safeguards.
  - creator-facing UX should make compensation relationships clear.
  - invite automation and share tooling require disclosure/messaging review before public scale.

#### SQL / Parameter Injection

- Real-world pattern:
  - affiliate systems and plugins have historically had SQL injection vulnerabilities, often through public referral params.
- Economic rule:
  - `creator_code`, `brand_slug`, `product_slug`, `partnerlinks_ref`, `sub_id`, and UTM values are user-controlled.
  - these params must be validated, length-limited, escaped when rendered, and kept out of raw SQL.

#### Refund / Chargeback Farming

- Real-world pattern:
  - marketplaces and reward systems face refund loops, false claims, stolen-card orders, and post-payout losses.
- Economic rule:
  - refunded/charged-back orders create reversal or offset records.
  - paid earnings are never silently deleted.
  - refund-heavy activity can hold future claimability.

Additional regression rules:

- `REG-SAFETY-006`: Referral/tracking params must not become injection surfaces.
- `REG-SAFETY-007`: PartnerLinks must not store/log unnecessary customer or payment-sensitive data.
- `REG-SAFETY-008`: Every sensitive creator/brand action must use explicit scoped ownership checks.
- `REG-SAFETY-009`: New creators/brands/high-risk activity should not be able to instantly extract payouts.
- `REG-SAFETY-010`: Refunded or charged-back orders must create reversal/offset records, not silent deletion.
- `REG-SAFETY-011`: PartnerLinks must not rely on third-party onboarding alone as fraud approval.
- `REG-SAFETY-012`: Creator/brand promotional abuse must have takedown and audit workflow.

## Financial Failure Conditions Architecture

This section defines the canonical failure-condition model before refund, chargeback, settlement, or live payout automation is built.

Core invariant:

- `conversion_created` does not mean `safe_to_pay`.
- Accounted earnings are not necessarily funded earnings.
- Money cannot remain permanently earned if the underlying commerce reverses.
- No live payout can be claimable unless funding is proven by `settlement_collected`, `manual_approved`, or `reserve_covered`.

### Refund / Chargeback / Reversal Lifecycle

Required future states:

- `refund_pending`: Shopify refund/dispute signal received; affected earnings are frozen from claim promotion.
- `reversal_pending`: system is calculating direct commission, platform fee, creator network, and brand-origin reversal impact.
- `reversed`: earnings were not paid and have been reversed from payable balances.
- `offset_required`: earnings were already claimed/paid; future earnings must offset the reversed amount or operator review is required.
- `chargeback_review`: chargeback/dispute signal needs operator review before release or reversal.

Required future ledgers:

- `refund_reversal_events`
  - source event id, Shopify order id, conversion id, refund amount, refund percentage, reason, evidence payload hash, created_at.
- `earning_reversal_items`
  - direct commission reversal rows.
  - Level 1/2/3 creator-network override reversal rows.
  - brand-origin network override reversal rows.
  - platform-fee settlement reversal rows.
- `creator_balance_offsets`
  - creator id, amount, source reversal item, status, applied_to_future_claim_batch_id.

Canonical paths:

- Full refund before payout:
  - freeze affected conversion and earning rows.
  - create reversal items for direct commission, platform fee, creator network overrides, and brand-origin rewards.
  - mark affected earnings `reversed`.
  - no payout or settlement release.
- Full refund after payout:
  - never delete paid rows.
  - create reversal and offset records.
  - set creator/network balance to `offset_required`.
  - apply future earnings offsets or require operator intervention.
- Partial refund before payout:
  - calculate refund ratio against eligible order subtotal.
  - reduce unpaid direct commission and platform-fee-derived overrides proportionally.
  - mark remaining funded portion according to settlement state.
- Partial refund after payout:
  - create proportional offset records only for the refunded portion.
  - keep original claim ledger immutable.
- Chargeback/dispute before payout:
  - move related rows to hold/review.
  - do not allow claimability until dispute is resolved or manually approved.
- Chargeback/dispute after payout:
  - create `offset_required` records and operator risk event.
  - future earnings may be held until offset clears.

### Settlement-Aware Claim Promotion Plan

Current sandbox behavior:

- `claimable_at` and payout lifecycle support test-mode validation.
- `PAYOUT_MODE=sandbox_time_based` with a Stripe test key preserves sandbox claim testing.

Required live behavior:

- A central settlement eligibility service must decide whether each earning row can become live-claimable.
- Claim promotion must require:
  - `settlement_collected`, or
  - `manual_approved`, or
  - `reserve_covered`.
- Failed settlement, refund hold, risk hold, dispute hold, or unknown settlement status blocks live claimability.

Minimal future schema additions:

- On earning/accounting rows:
  - `settlement_status`
  - `settlement_item_id`
  - `settlement_eligible_at`
  - `manual_approved_at`
  - `manual_approved_by`
  - `reserve_covered_at`
  - `risk_status`
  - `refund_status`
- Settlement tables:
  - `settlement_batches`
  - `settlement_items`
  - `brand_payment_methods`
  - `brand_reserve_ledger`
  - `settlement_attempts`
  - `settlement_events`

Dashboard language:

- Show accounted earnings separately from funded/claimable earnings.
- Use "Pending settlement" for earnings that exist but are not funded.
- Use "Claimable" only when settlement, manual approval, or reserve coverage is true.
- Disabled claim states must explain the funding/approval requirement.

### Brand-Origin Economic Validation Plan

Brand-origin onboarding is proven as lineage. Brand-origin economics still need end-to-end proof.

Required future validation:

- Brand invites creator through `/join/brand/:brandSlug`.
- Creator signs up and receives `invited_by_brand_id`.
- Creator later generates attributed conversion through product referral flow.
- System calculates brand-origin network reward from downstream `platform_fee_amount` only.
- No creator-origin parent is set.
- No self-generated override is created.
- No duplicate `brand_network_earnings` row is created for replayed webhook.
- Settlement gate applies before any brand-origin reward is payable.

Brand-origin rewards are network overrides, not affiliate commissions. The inviting brand is rewarded only for downstream entity activity that creates eligible PartnerLinks platform fee.

### Synthetic-Commerce Risk Model

Controlled-beta risk model should stay small but explicit:

- New creator payout hold:
  - first payout and abnormal first conversion spike require review or settlement/reserve protection.
- Refund-heavy hold:
  - creators/brands/products with high refund or chargeback rates cannot bypass settlement/refund gates.
- Velocity hold:
  - abnormal order count, repeated buyer/order patterns, or sudden platform-fee spikes create risk review rows.
- Identity-cluster review:
  - duplicate Stripe accounts, payout methods, tax IDs, devices, IP clusters, or emails are risk signals.
- Commerce-quality review:
  - fake orders, circular purchases, stolen-card indicators, buyer/creator collusion, and low-quality incentive orders block claimability until reviewed.

Risk status must never create payout eligibility by itself. It can only hold, release after approved review, or require more evidence.

### Audit Automation / Threat Intelligence Plan

The future safety monitor is read-only by default.

It should produce a daily report with:

- source or incident summary.
- mapped PartnerLinks subsystem.
- severity.
- possible exploit path.
- current protection status.
- recommended docs/tests/code follow-up.
- human approval requirement before any code or money-state change.

It should monitor:

- affiliate fraud and attribution hijacking cases.
- Shopify app incidents.
- Stripe Connect and marketplace payout fraud.
- synthetic commerce cases.
- refund/chargeback abuse.
- small-platform security failures.
- referral messaging and disclosure issues.

It must not:

- mutate code.
- mutate payout, settlement, attribution, or creator state.
- auto-create payouts, reversals, settlements, or moderation actions.

### Automated Invariant Enforcement Plan

`scripts/productionSafetyTest.js` should evolve from reporting toward read-only invariant checks.

Current read-only reporting flags:

- `--actor-matrix`
- `--economic-report`
- `--lineage-report`
- `--settlement-report`
- `--refund-report`
- `--risk-report`
- `--route-risk-report`
- `--order-report`

Current lookup inputs:

- `--order-id`
- `--partnerlinks-ref`
- `--creator-code`
- `--brand-id`
- `--shop-domain`

Still-proposed future flags:

- `--idempotency-report`
- `--claim-retry-report`
- `--collision-window-report`

Required invariant checks:

- no Level 4+ network earnings.
- no duplicate conversion order ids.
- no duplicate network earning keys.
- no self-generated network override.
- no dual brand/creator lineage.
- no ambiguous attribution conversion.
- no payout-mode bypass.
- no claimable live earnings without settlement, approval, or reserve.
- no refunded conversion still payable.
- no duplicate settlement item.
- no duplicate claim transfer.
- no unsafe admin/debug mutation route.

Recommended build order:

1. Add read-only invariant reports.
2. Add refund/reversal schema and diagnostics.
3. Add settlement item schema and eligibility service.
4. Add manual approval gate.
5. Add reserve/prepaid balance mode.
6. Add Shopify refund/dispute webhook ingestion.
7. Add risk holds and operator review queue.

## Controlled Financial-Failure Implementation Sequence

This is the sequencing model for moving from documented architecture to runtime infrastructure. Each phase must be small, isolated, and fail closed.

### Phase 1 - Refund / Reversal Ledger Infrastructure

Goal:

- create accounting-safe reversal infrastructure before automated payout mutation.
- preserve immutable evidence that a conversion or earning was reversed.
- make it possible to prove that refunded commerce cannot remain permanently payable.

Smallest isolated runtime patch:

- add reversal ledger tables only.
- do not automatically claw back payouts.
- do not create Stripe reversals.
- do not collect negative balances.
- do not automatically mutate historical claim ledgers.

Recommended schema:

- `financial_reversal_events`
  - `id`
  - `created_at`
  - `updated_at`
  - `source_type`
  - `source_event_id`
  - `shop_domain`
  - `shopify_order_id`
  - `order_id`
  - `brand_id`
  - `conversion_id`
  - `reversal_type`
  - `reversal_reason`
  - `reversal_status`
  - `currency`
  - `original_order_amount`
  - `reversed_order_amount`
  - `reversal_ratio`
  - `idempotency_key`
  - `evidence`
  - `notes`
- `financial_reversal_items`
  - `id`
  - `created_at`
  - `reversal_event_id`
  - `item_type`
  - `conversion_id`
  - `creator_network_earning_id`
  - `brand_network_earning_id`
  - `creator_earning_claim_id`
  - `affected_creator_id`
  - `affected_brand_id`
  - `original_amount`
  - `reversal_amount`
  - `currency`
  - `payout_status_at_reversal`
  - `offset_required`
  - `offset_status`
  - `settlement_status_at_reversal`
  - `notes`

Allowed initial values:

- `reversal_type`
  - `full_refund`
  - `partial_refund`
  - `chargeback`
  - `dispute`
  - `manual_adjustment`
- `reversal_status`
  - `recorded`
  - `review_required`
  - `applied`
  - `offset_required`
  - `voided`
- `item_type`
  - `direct_commission`
  - `platform_fee`
  - `creator_network_override`
  - `brand_network_override`
  - `claim_offset`

Migration safety concerns:

- Use additive tables first; do not rewrite existing earnings rows in the first migration.
- Add uniqueness on `idempotency_key` for events.
- Allow nullable links for future compatibility, but enforce at least one target reference through application validation first.
- Use `jsonb` evidence only for minimal non-sensitive diagnostics; never store full customer/payment payloads by default.
- Do not require historical backfill before deployment.

Backward compatibility:

- Existing conversions, network earnings, and claim rows remain valid.
- Existing dashboard totals are unchanged until explicit reversal application logic is built.
- Existing `PAYOUT_MODE` fail-closed behavior remains the live safety guard.

Runtime artifact:

- `database/migrations/016_financial_reversal_ledger.sql`

Current status:

- migration file created.
- SQL not run automatically.
- no runtime JS behavior changed.

Tables created by the migration:

- `financial_reversal_events`
- `financial_reversal_items`

Important boundary:

- migration 016 creates reversal observability/accounting infrastructure only.
- it does not enforce reversals.
- it does not mutate payout state.
- it does not change dashboard balances.
- it does not create Stripe reversals, payout clawbacks, or negative-balance collection.

### Phase 2 - Settlement-State Runtime Schema

Goal:

- make settlement status queryable before settlement automation exists.
- prepare earnings rows for settlement-aware claim promotion.

Smallest safe schema additions:

- On `conversions`:
  - `settlement_status`
  - `settlement_collected_at`
  - `settlement_batch_id`
  - `reversal_status`
  - `risk_status`
  - `reserve_covered_at`
- On `creator_network_earnings`:
  - same settlement/reversal/risk fields.
- On `brand_network_earnings`:
  - same settlement/reversal/risk fields.
- On future `settlement_items`:
  - direct commission item.
  - platform fee item.
  - creator network override item.
  - brand-origin network override item.

Initial defaults:

- `reversal_status = 'none'`.
- `risk_status = 'normal'`.
- settlement status should not imply live claimability until a settlement eligibility service exists.

Fail-closed rule:

- unknown settlement status cannot make live earnings claimable.

### Phase 3 - Read-Only Invariant Reporting Expansion

Goal:

- expand `scripts/productionSafetyTest.js` into repeatable financial invariant reporting before new mutation systems are enabled.

Initial flags:

- `--actor-matrix`
- `--economic-report`
- `--lineage-report`
- `--settlement-report`
- `--refund-report`
- `--risk-report`
- `--idempotency-report`

Reports must be read-only by default and safe against production data.

### Phase 4 - Controlled-Beta Synthetic-Commerce Detection

Goal:

- add the smallest practical risk model before public beta.

Minimal runtime pieces:

- `risk_reviews`
- `risk_signals`
- `creator_risk_status`
- `brand_risk_status`
- manual hold/release state.

Initial signals:

- first payout.
- conversion velocity spike.
- refund ratio.
- repeated buyer/order patterns when available.
- duplicate payout method or Stripe account when available.
- suspicious creator clusters.

### Phase 5 - Read-Only Threat Intelligence / Audit Monitor

Goal:

- create daily risk scan output that maps external incidents to PartnerLinks subsystems.

Rules:

- no code mutation.
- no money-state mutation.
- no automatic moderation or payout actions.
- human approval required before implementation.

### Phase 6 - Replay / Idempotency Hardening

Goal:

- extend idempotency from orders/paid and claims into refunds, settlements, reversals, and risk review events.

Required idempotency keys:

- Shopify order paid event.
- Shopify refund event.
- Shopify dispute/chargeback event.
- reversal event.
- reversal item.
- settlement item.
- settlement batch.
- brand payment attempt.
- Stripe transfer/claim batch.

Validation required before each phase:

- migration SQL reviewed manually before Supabase execution.
- `node --check` for touched JS files.
- read-only `productionSafetyTest.js` report before and after.
- docs updated with new invariant and rollback/disable behavior.

## Runtime Claimability Gate

Classification:

- `RUNTIME-ENFORCED` for claim route/service row eligibility.
- `BLOCKED / NO-GO` for live creator payouts.

Canonical invariant:

- Accounted earnings are not necessarily funded earnings.
- Live claimability must not be based only on `claimable_at`.

Current payout-mode behavior:

- `sandbox_time_based`
  - test-only behavior.
  - requires `STRIPE_SECRET_KEY` beginning with `sk_test_`.
  - keeps the existing `claimable_at` based sandbox validation flow.
- `claims_disabled`
  - production-safe default.
  - blocks claim execution and time-based claim promotion.
- `manual_approval`
  - only works with a Stripe test key in this MVP.
  - only rows with `manual_approved_at` or `settlement_status='manual_approved'` can become claimable/reserved.
- `settlement_gated`
  - only works with a Stripe test key in this MVP.
  - only rows with `settlement_collected_at`, `reserve_covered_at`, `settlement_status='settlement_collected'`, or `settlement_status='reserve_covered'` can become claimable/reserved.
- missing/unknown modes:
  - block.

Dashboard money language:

- `Accounted earnings`: recorded earnings before funding gates.
- `Pending settlement`: accounted but not currently claimable under the active payout mode.
- `Claimable earnings`: row-level eligible under the active payout mode.
- `Claimed earnings`: internally claimed ledger state.

Important:

- This gate prevents accidental live claimability before settlement infrastructure exists.
- It does not collect brand funds.
- It does not enforce refunds.
- It does not enable live Stripe transfers.
## Settlement Batch Lifecycle Phase 1 Classification

Status: READ-ONLY DIAGNOSTIC / PLANNED RUNTIME INFRASTRUCTURE

- `settlement_batches` and `settlement_items` provide additive settlement state infrastructure.
- `settlement_audit_events` is proposed in migration `018_settlement_lifecycle_audit_events.sql` as the audit trail for settlement lifecycle observations and future transitions.
- This phase does not create brand charges, Stripe PaymentIntents, Stripe invoices, settlement collection, manual approval mutations, reserve deductions, payout release, or refund enforcement.
- Safe claimability states remain `settlement_collected`, `manual_approved`, or `reserve_covered`.
- Blocked states remain non-claimable for live payouts, including `settlement_pending`, `settlement_authorized`, `settlement_failed`, `settlement_retrying`, `settlement_disputed`, `refund_pending`, `reversed`, and `ignored`.
- `PAYOUT_MODE=claims_disabled` remains the production recommendation until funding/approval/reserve coverage is implemented and verified.
