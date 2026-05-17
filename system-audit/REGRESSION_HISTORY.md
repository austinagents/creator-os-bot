# PartnerLinks Regression History

Purpose:

- Track reliability regressions and the checks that now protect against them.
- Keep future edits from reintroducing old failures.

## Regression Categories

- `AUTH_SCOPE`
- `REFERRAL_ROUTE`
- `ATTRIBUTION`
- `WEBHOOK_IDEMPOTENCY`
- `ECONOMICS`
- `PAYOUT_LIFECYCLE`
- `SECURITY_ISOLATION`
- `DIAGNOSTICS`
- `UI_GUARDRAIL`

## Regression Entries

### REG-AUTH-001 - Stripe Routes Must Use Explicit Creator Context

- Category: `AUTH_SCOPE`, `PAYOUT_LIFECYCLE`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Viewing `/dashboard/test-creator-04` but Stripe onboarding routed to `frostclips`.
- Root cause:
  - Sensitive route used signed-in auth user's default/latest creator instead of active dashboard creator context.
- Guardrail now expected:
  - Stripe-sensitive routes require/propagate explicit `creator_code`.
  - Ownership is verified by `auth_user_id`.
- Regression test:
  - One auth user owns two creators.
  - Start Stripe from second creator dashboard.
  - Expected: Stripe route uses second creator only.

### REG-AUTH-002 - Dashboard Claim Eligibility Must Use Active Creator Ownership

- Category: `AUTH_SCOPE`, `PAYOUT_LIFECYCLE`
- Severity: `SEV2`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Correct dashboard data displayed but Claim button remained disabled.
- Root cause:
  - `ownerCanClaim` checked default/latest creator instead of active dashboard creator.
- Guardrail now expected:
  - Dashboard ownership compares signed-in auth user directly to `dashboard.creator.auth_user_id`.
- Regression test:
  - Auth user owns multiple creators.
  - Open `/dashboard/:creatorCode` for a non-default owned creator.
  - Expected: owner-only actions reflect that active creator ownership.

### REG-ATTRIBUTION-001 - Exact Partnerlinks Ref Must Win Before Fallback

- Category: `ATTRIBUTION`, `WEBHOOK_IDEMPOTENCY`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Shopify webhook attribution could fall through to weaker matching even when exact `partnerlinks_ref` was present.
- Root cause:
  - Deterministic attribution ordering must remain explicit and guarded.
- Guardrail now expected:
  - `partnerlinks_ref` is the canonical durable attribution anchor.
  - Exact `partnerlinks_ref` click/session recovery wins before landing-site, source-url, attribution-session, or recent-click fallback.
- Regression test:
  - Complete a Shopify test order from `/r/aria-wellness/test-creator-04/test-product`.
  - Expected: `shopify_attribution_events.attribution_source = partnerlinks_ref`, `attribution_confidence = exact`, `fallback_used = false`.

### REG-ATTRIBUTION-002 - Ambiguous Recent-Click Fallback Must Skip

- Category: `ATTRIBUTION`, `WEBHOOK_IDEMPOTENCY`, `ECONOMICS`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - If Shopify strips deterministic attribution and multiple recent clicks could match, fallback could guess the wrong creator.
- Root cause:
  - Broad recent-click fallback is unsafe when multiple creators/products are plausible.
- Guardrail now expected:
  - Ambiguous fallback returns a skipped/unmatched attribution decision.
  - No conversion, creator earnings, network earnings, or payout-eligible rows are created.
  - Diagnostics record `unmatched_reason = ambiguous_recent_click_fallback`.
- Regression test:
  - Create close-together clicks for `test-creator-05` and `test-creator-06`.
  - Send signed Shopify webhook payload with no deterministic attribution fields.
  - Expected: skipped diagnostic, no conversion, no earnings.

### REG-WEBHOOK-001 - Duplicate Shopify Orders Must Be Idempotent

- Category: `WEBHOOK_IDEMPOTENCY`, `ECONOMICS`, `DIAGNOSTICS`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Replayed Shopify `orders/paid` webhooks could create duplicate conversion or earnings rows.
- Root cause:
  - Financial/conversion systems must treat `shopify:{shop_domain}:{order_id}` as an idempotency key.
- Guardrail now expected:
  - Duplicate webhook returns safely.
  - Diagnostic row records duplicate/skipped behavior.
  - No second conversion is created.
  - No duplicate creator-network or brand-network earnings are created.
- Regression test:
  - Replay a signed webhook for an order that already has a conversion.
  - Expected: `decision = duplicate_skipped`, `duplicate_order = true`, no duplicate economic rows.

### REG-PAYOUT-001 - Claim Batch Must Create One Ledger And One Transfer

- Category: `PAYOUT_LIFECYCLE`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Claim flow could become ambiguous if ledger and transfer state drift.
- Root cause:
  - Payouts need an explicit claim ledger and deterministic finalization boundary.
- Guardrail now expected:
  - Each claim batch creates one `creator_earning_claims` row.
  - Each claim batch creates one Stripe transfer in test-mode payout testing.
  - Claimed rows keep `claim_batch_id` and `claimed_at`.
- Regression test:
  - Claim test creator earnings through the real claim route.
  - Expected: one ledger row, one transfer id, claimed rows linked to the claim batch.

### REG-PAYOUT-002 - Claim Retry After Success Must Not Double Transfer

- Category: `PAYOUT_LIFECYCLE`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Retrying a successful claim could create duplicate Stripe transfers or duplicate claim ledgers.
- Root cause:
  - Retry paths must respect claimed state, claim batches, and transfer idempotency.
- Guardrail now expected:
  - Retry after success creates no second transfer.
  - Retry after success creates no duplicate claim ledger.
  - Previously claimed rows remain linked to their original `claim_batch_id`.
- Regression test:
  - Retry claim after a successful Stripe test transfer.
  - Expected: no new transfer id, no duplicate ledger, no claimed row drift.

### REG-ECONOMICS-001 - Creator Network Economics Must Stop At Level 3

- Category: `ECONOMICS`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Referral economics could overpay or draw from the wrong principal.
- Root cause:
  - Network earnings must be capped and calculated only from `platform_fee_amount`.
- Guardrail now expected:
  - Level 1 = 30% of `platform_fee_amount`.
  - Level 2 = 3% of `platform_fee_amount`.
  - Level 3 = 2% of `platform_fee_amount`.
  - No Level 4+ payout.
  - Creator direct commission is not reduced.
- Regression test:
  - Sale by `test-creator-04` in the chain `01 -> 02 -> 03 -> 04`.
  - Expected: L1 to `03`, L2 to `02`, L3 to `01`, no L4.

### REG-ECONOMICS-002 - Source Entity Must Not Earn Own Network Override

- Category: `ECONOMICS`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - A source creator/entity could earn a network override from their own direct sale, creating self-referral farming risk.
- Root cause:
  - Network override logic must remain downstream-only.
- Guardrail now expected:
  - Source creator can earn direct commission from direct attributed sale.
  - Source creator cannot earn network override from that same direct sale.
  - Network overrides only propagate upstream/downstream according to entity relationships.
- Regression test:
  - Sale by `test-creator-04`.
  - Expected: no creator-network earning row where `earning_creator_id = source_creator_id = test-creator-04.id`.

### REG-ECONOMICS-003 - Network Overrides Must Use Platform Fee Only

- Category: `ECONOMICS`, `PAYOUT_LIFECYCLE`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: 2026-05-16
- Regression symptom:
  - Network override rewards could be accidentally calculated from order gross or direct creator commission.
- Root cause:
  - Base earning systems and network override systems must remain economically separate.
- Guardrail now expected:
  - Creator and brand network override rows use `platform_fee_amount` as principal.
  - Network overrides never use direct creator commission principal.
  - Network overrides never reduce creator direct commission.
- Regression test:
  - For conversion `19`, platform fee is `0.90`; Level 1/2/3 rows are `0.27`, `0.03`, and `0.02`.

### REG-UI-001 - Product Cards Must Use Universal Layout

- Category: `UI_GUARDRAIL`
- Severity: `SEV2`
- Status: `MITIGATED`
- First observed: 2026-05-15
- Regression symptom:
  - Shopify-backed product showed special rows, price/test metadata, and different CTA.
- Root cause:
  - Product source leaked into card rendering.
- Guardrail now expected:
  - All products use one universal layout:
    1. image/placeholder area
    2. product title
    3. short description
    4. creator commission line
    5. referral URL pill
    6. Copy Link button
- Regression test:
  - Add/modify Shopify-backed product.
  - Expected: no special public metadata or alternate card layout.

## Regression Entry Template

```markdown
### REG-000 - Title

- Category: `CATEGORY`
- Severity: `SEV2`
- Status: `OPEN | MITIGATED | RESOLVED`
- First observed: YYYY-MM-DD
- Regression symptom:
  - What broke?
- Root cause:
  - Why did it happen?
- Guardrail now expected:
  - What must stay true?
- Regression test:
  - How to catch this next time.
```
