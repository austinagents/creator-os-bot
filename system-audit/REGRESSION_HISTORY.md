# PartnerLinks Regression History

Purpose:

- Track reliability regressions and the checks that now protect against them.
- Keep future edits from reintroducing old failures.

## Regression Categories

- `AUTH_SCOPE`
- `REFERRAL_ROUTE`
- `ATTRIBUTION`
- `ATTRIBUTION_HIJACKING`
- `COOKIE_STUFFING`
- `PARAM_INJECTION`
- `SQL_INJECTION`
- `PLUGIN_SQL_INJECTION`
- `SMALL_PLATFORM_FRAGILITY`
- `FAKE_ACCOUNT_REWARDS`
- `SYNTHETIC_NETWORK_METRICS`
- `INCENTIVE_GAMING`
- `COMMS_COST_ABUSE`
- `THIRD_PARTY_APP_RISK`
- `DOCS_SOURCE_INTEGRITY`
- `WEBHOOK_IDEMPOTENCY`
- `WEBHOOK_REPLAY`
- `ECONOMICS`
- `NETWORK_ECONOMICS`
- `SYNTHETIC_COMMERCE`
- `FAKE_IDENTITY_NETWORKS`
- `REFUND_REVERSAL`
- `REFUND_FRAUD`
- `SETTLEMENT_FAILURE`
- `PAYOUT_LIFECYCLE`
- `PAYOUT_IDEMPOTENCY`
- `SECURITY_ISOLATION`
- `PRODUCT_VERIFICATION`
- `SHOPIFY_APP_DATA_RISK`
- `AUTHORIZATION_SCOPE_BUGS`
- `STRIPE_CONNECT_FRAUD`
- `AFFILIATE_NETWORK_LIABILITY`
- `REFERRAL_MESSAGING_COMPLIANCE`
- `AFFILIATE_LINK_HIJACKING`
- `DATA_BREACH_RESPONSE`
- `ADMIN_TOOLING_SAFETY`
- `DIAGNOSTICS`
- `UI_GUARDRAIL`
- `CREATOR_DISCLOSURE`
- `REFERRAL_ABUSE`
- `DASHBOARD_MONEY_CLARITY`

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

### REG-SAFETY-006 - Referral Tracking Params Must Not Become Injection Surfaces

- Category: `PARAM_INJECTION`, `SQL_INJECTION`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - Affiliate/referral systems and plugin ecosystems have suffered injection issues through public referral/tracking params.
- Guardrail now expected:
  - `creator_code`, `brand_slug`, `product_slug`, `partnerlinks_ref`, `sub_id`, and UTM params are validated, length-limited, normalized, and escaped before query or render use.
  - raw tracking params never become trusted attribution, raw SQL, or unescaped output.
- Regression test:
  - Send malformed and oversized params through `/r`, `/join`, product referral routes, debug filters, and attribution parsers.
  - Expected: safe rejection/logging, no SQL/string injection, no trusted attribution.

### REG-SAFETY-007 - Unnecessary Customer Or Payment-Sensitive Data Must Not Be Stored Or Logged

- Category: `SHOPIFY_APP_DATA_RISK`, `DATA_BREACH_RESPONSE`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - Shopify third-party apps/providers can become the weak point for customer/order data exposure.
- Guardrail now expected:
  - PartnerLinks stores only required Shopify order/attribution/payment metadata.
  - webhook diagnostics avoid full customer/payment-sensitive payload logging.
  - Shopify/Stripe/Supabase/Discord secrets remain out of client code, public logs, and debug output.
- Regression test:
  - Review webhook logging, diagnostic rows, debug routes, and env exposure.
  - Expected: no unnecessary customer/payment-sensitive data or secrets are persisted or displayed.

### REG-SAFETY-008 - Sensitive Creator/Brand Actions Must Use Explicit Scoped Ownership Checks

- Category: `AUTHORIZATION_SCOPE_BUGS`, `AUTH_SCOPE`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `MITIGATED_FOR_STRIPE_ROUTES`
- Real-world pattern:
  - Authorization bugs often come from implicit default resources, missing ownership checks, or cross-account resource mutation.
- Guardrail now expected:
  - sensitive routes require explicit resource context such as `creator_code` or `brand_id`.
  - route handlers verify ownership before sensitive visibility or mutation.
  - no money, Stripe, settlement, payout, or admin path relies on newest/default creator fallback.
- Regression test:
  - one auth user owns multiple creators; sensitive action targets a non-default creator.
  - Expected: action only affects the explicitly requested owned creator, or fails closed.

### REG-SAFETY-009 - New Or High-Risk Actors Must Not Instantly Extract Payouts

- Category: `STRIPE_CONNECT_FRAUD`, `FAKE_IDENTITY_NETWORKS`, `SYNTHETIC_COMMERCE`, `PAYOUT_LIFECYCLE`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - Marketplace/gig payout systems are attacked with stolen cards, fake transactions, controlled accounts, and fast payout extraction.
- Guardrail now expected:
  - new creators, new brands, large first payouts, abnormal velocity, duplicate payout identities, and high-risk clusters can be held for review.
  - Stripe Connect onboarding is not treated as fraud approval.
  - live claimability still requires settlement, approval, or reserve coverage.
- Regression test:
  - create a new/high-risk creator pattern.
  - Expected: no instant live payout without review/funding gate.

### REG-SAFETY-010 - Refunds And Chargebacks Must Create Reversal Or Offset Records

- Category: `REFUND_FRAUD`, `REFUND_REVERSAL`, `SETTLEMENT_FAILURE`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - refund loops, chargeback farming, false claims, and post-payout reversals can leak money from marketplaces and reward systems.
- Guardrail now expected:
  - refund before payout reverses or blocks claimability.
  - refund after payout creates `offset_required`, negative balance, or equivalent reversal records.
  - historical paid earnings and transfer records are not silently deleted.
- Regression test:
  - simulate refund before and after claim.
  - Expected: auditable reversal/offset state, no silent deletion.

### REG-SAFETY-011 - Third-Party Onboarding Alone Is Not Fraud Approval

- Category: `STRIPE_CONNECT_FRAUD`, `PRODUCT_VERIFICATION`, `SHOPIFY_APP_DATA_RISK`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - Stripe Connect onboarding and Shopify OAuth confirm rail/access setup, but not creator quality, product legitimacy, or commerce safety.
- Guardrail now expected:
  - Stripe onboarding means payout rail readiness only.
  - Shopify OAuth means store access only.
  - payout eligibility and public promotion still require settlement/risk/review rules.
- Regression test:
  - connect Stripe/Shopify for a new actor.
  - Expected: no live payout or public trust upgrade purely from third-party onboarding completion.

### REG-SAFETY-012 - Promotional Abuse Requires Takedown And Audit Workflow

- Category: `AFFILIATE_NETWORK_LIABILITY`, `CREATOR_DISCLOSURE`, `PRODUCT_VERIFICATION`, `REFERRAL_ABUSE`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - affiliate networks can face liability for deceptive affiliate claims, unsafe product promotion, and undisclosed compensation relationships.
- Guardrail now expected:
  - unsafe creator/brand promotion can be reported, reviewed, suspended, removed, and audited.
  - creator disclosure reminders and terms are visible before public scale.
  - moderation actions are not silent or untracked.
- Regression test:
  - report unsafe promotion or misleading brand/product.
  - Expected: operator-visible review/takedown/audit path exists.

### REG-SAFETY-013 - Incentive Systems Must Not Reward Synthetic Accounts Or Non-Commerce Actions

- Category: `INCENTIVE_GAMING`, `SYNTHETIC_COMMERCE`, `FAKE_ACCOUNT_REWARDS`
- Severity: `SEV1`
- Status: `OPEN`
- Note:
  - `REG-SAFETY-010` is already reserved for refund/chargeback reversal integrity, so incentive gaming is tracked as `REG-SAFETY-013`.
- Real-world pattern:
  - incentive plans can drive fake accounts, unsafe growth, or internal/operator gaming when rewards are tied to account creation instead of real value.
- Guardrail now expected:
  - incentives are tied to attributed, settled commerce.
  - manual overrides require audit trails.
  - abnormal onboarding spikes are reviewable.
  - self-generated loops do not create creator/network rewards.
- Regression test:
  - create signup/invite/onboarding activity without downstream commerce.
  - Expected: no payable earnings and no platform value metric based only on signups.

### REG-METRICS-001 - Network Value Metrics Must Be Commerce-Based

- Category: `SYNTHETIC_NETWORK_METRICS`, `SMALL_PLATFORM_FRAGILITY`, `DIAGNOSTICS`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - fake user/network metrics can destroy trust, fundraising, and strategic value.
- Guardrail now expected:
  - creator count and invite count are not treated as economic value.
  - dashboards distinguish raw network size from productive network.
  - operator/investor metrics are tied to attributed, settled commerce.
- Regression test:
  - inspect dashboard/operator reporting.
  - Expected: raw signup counts are not labeled as revenue, value, or productive network without commerce qualification.

### REG-COMMS-001 - Referral Messaging Cannot Create Unbounded Cost Or Legal Exposure

- Category: `COMMS_COST_ABUSE`, `REFERRAL_MESSAGING_COMPLIANCE`, `REFERRAL_ABUSE`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - SMS toll fraud, fake account loops, and unsolicited referral messaging can create direct cost and legal exposure.
- Guardrail now expected:
  - no automated SMS/email referral tooling during beta.
  - future messaging is consent-aware, rate-limited, and monitored for velocity.
  - public signup and invite flows include bot/cost protections before paid messaging rails are attached.
- Regression test:
  - attempt bulk invite/send behavior.
  - Expected: no unbounded send/cost path and no platform-sent third-party messages without safeguards.

### REG-DATA-001 - Customer And Payment-Sensitive Data Must Be Minimized

- Category: `THIRD_PARTY_APP_RISK`, `SHOPIFY_APP_DATA_RISK`, `DATA_BREACH_RESPONSE`
- Severity: `SEV1`
- Status: `OPEN`
- Real-world pattern:
  - small Shopify/affiliate apps can become the weakest link because they hold tokens, customer/order data, and payout logic.
- Guardrail now expected:
  - least-privilege Shopify scopes.
  - no unnecessary customer/payment-sensitive data storage.
  - server-only Shopify tokens and Supabase service role.
  - debug routes are scoped/read-only and do not expose sensitive payloads.
- Regression test:
  - review webhook logs, diagnostics, debug routes, and persisted order/customer fields.
  - Expected: compact necessary data only; no secrets or unnecessary customer/payment details.

### REG-DOCS-001 - Risk Docs Must Separate Verified Facts, Assumptions, And Internal Opinions

- Category: `DOCS_SOURCE_INTEGRITY`, `DIAGNOSTICS`
- Severity: `SEV2`
- Status: `OPEN`
- Real-world pattern:
  - AI-assisted research can introduce hallucinated facts or fabricated citations into risk/compliance documentation.
- Guardrail now expected:
  - docs identify source-backed examples, user-provided research, internal assumptions, and implementation decisions separately.
  - public/legal/compliance claims are verified before publication.
  - AI-generated policy text is not treated as legal advice.
- Regression test:
  - review risk/compliance docs before external use.
  - Expected: claims have sources or are marked as assumptions/internal guidance.

### REG-SECURITY-001 - Malformed Tracking Params Must Not Become Trusted

- Category: `PARAM_INJECTION`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - malformed `creator_code`, `partnerlinks_ref`, `sub_id`, UTM, `product_slug`, or `brand_slug` value becomes trusted attribution, unsafe rendered output, or backend abuse vector.
- Root cause:
  - referral systems often treat tracking params as harmless strings.
- Guardrail now expected:
  - sanitize, validate, length-limit, escape, and log suspicious malformed params.
  - never trust raw tracking params.
- Regression test:
  - malicious-input tests for referral/product routes and tracking params.
  - Expected: rejected/sanitized/logged, no unsafe attribution or rendering.

### REG-SECURITY-002 - Referral Params Must Not Reach Raw SQL

- Category: `SQL_INJECTION`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - user-controlled referral param affects raw SQL or service-role access.
- Root cause:
  - affiliate systems historically expose SQL injection through reporting/filter/referral params.
- Guardrail now expected:
  - structured Supabase queries only.
  - no raw user-controlled SQL.
  - service role server-side only.
- Regression test:
  - static review and malicious-input tests for creator/referral/product params.

### REG-SECURITY-003 - Synthetic Identity Clusters Must Not Bypass Review

- Category: `FAKE_IDENTITY_NETWORKS`, `SYNTHETIC_COMMERCE`, `REFERRAL_ABUSE`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - creator/brand/account clusters can extract payouts through synthetic commerce or payout loops.
- Root cause:
  - network rewards can incentivize identity farms if payout eligibility is too trusting.
- Guardrail now expected:
  - monitor duplicate payout methods, Stripe accounts, tax ids, IP/device clusters, abnormal creator spawn/network growth.
  - use payout holds for high-risk first payouts.
- Regression test:
  - synthetic identity network report flags suspicious clusters before large payout.

### REG-SECURITY-004 - Public Products And Brands Require Verification

- Category: `PRODUCT_VERIFICATION`, `REFERRAL_ABUSE`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - unverified scam/misleading brand or product is broadly promoted through PartnerLinks.
- Root cause:
  - product discovery without verification can amplify unsafe commerce.
- Guardrail now expected:
  - verified Shopify ownership, product identity, admin approval, suspension path, moderation audit trail.
- Regression test:
  - featured/public brand/product cannot appear without approval state.

### REG-SECURITY-005 - Low-Confidence Attribution Cannot Replace Exact Ref

- Category: `AFFILIATE_LINK_HIJACKING`, `ATTRIBUTION_HIJACKING`
- Severity: `SEV1`
- Status: `MITIGATED`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - extension/coupon/late redirect replaces exact creator attribution.
- Root cause:
  - last-click systems can overweight late-stage or injected attribution.
- Guardrail now expected:
  - exact `partnerlinks_ref` wins before fallback.
  - low-confidence fallback cannot override deterministic attribution.
  - attribution source/confidence is logged.
- Regression test:
  - exact cart/order `partnerlinks_ref` and conflicting low-confidence source.
  - Expected: exact `partnerlinks_ref` wins.

### REG-SECURITY-006 - Secrets Must Not Leak Through Client/Logs/Debug

- Category: `DATA_BREACH_RESPONSE`, `SECURITY_ISOLATION`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - Stripe/Supabase/webhook/service-role secret appears in client code, public logs, or unprotected debug route.
- Root cause:
  - infrastructure diagnostics can accidentally over-log sensitive payloads.
- Guardrail now expected:
  - no secrets in client-side code or public logs.
  - minimal webhook payload logging.
  - protected/scoped debug routes.
  - secret rotation runbook.
- Regression test:
  - static secret exposure scan and debug route review.

### REG-SECURITY-007 - Refund Fraud Must Stay Reviewable

- Category: `REFUND_FRAUD`, `REFUND_REVERSAL`, `SYNTHETIC_COMMERCE`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - refund-heavy or chargeback-linked commerce creates unrecoverable payout leakage.
- Root cause:
  - payouts before refund/reversal safety create credit and fraud exposure.
- Guardrail now expected:
  - refund reversal ledger.
  - negative balance/offset model.
  - manual review queue.
  - payout holds for suspicious refund behavior.
- Regression test:
  - refund after payout creates offset/reversal records and does not silently delete history.

### REG-SECURITY-008 - Admin Tooling Must Be Read-Only By Default

- Category: `ADMIN_TOOLING_SAFETY`, `SECURITY_ISOLATION`, `PAYOUT_IDEMPOTENCY`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: documentation-first risk model, 2026-05-16
- Regression symptom:
  - debug/admin tool mutates payouts, attribution, settlement, or creator ownership accidentally.
- Root cause:
  - operator shortcuts can become unsafe without explicit approval and audit logs.
- Guardrail now expected:
  - debug routes read-only by default.
  - mutating scripts require explicit flags/approval.
  - admin actions are audited.
  - test/sandbox separation is maintained.
- Regression test:
  - audit scripts default dry-run/read-only; mutation requires explicit flag and test scope.

### REG-REFUND-001 - Refunded Commerce Must Reverse All Related Earnings

- Category: `REFUND_REVERSAL`, `NETWORK_ECONOMICS`, `PAYOUT_LIFECYCLE`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: failure-condition architecture pass, 2026-05-17
- Regression symptom:
  - refunded or charged-back commerce leaves direct commission, creator-network overrides, or brand-origin rewards payable.
- Root cause:
  - refund/dispute signals not ledgered against all financial rows created from the original platform-fee/direct-commission accounting.
- Guardrail now expected:
  - full and partial refunds create reversal rows for direct commission, platform fee, creator Level 1/2/3 overrides, and brand-origin overrides.
  - post-payout refunds create offset/negative-balance records instead of deletion.
- Regression test:
  - Shopify refund/dispute event for an attributed order reverses or offsets every affected earning and leaves an audit trail.

### REG-SETTLEMENT-008 - Risk Holds Must Block Claim Promotion

- Category: `SYNTHETIC_COMMERCE`, `SETTLEMENT_FAILURE`, `PAYOUT_LIFECYCLE`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: failure-condition architecture pass, 2026-05-17
- Regression symptom:
  - suspicious commerce, refund-heavy activity, or new/high-risk creator activity becomes claimable without review.
- Root cause:
  - claim promotion only checks time/status and not settlement, refund, or risk eligibility.
- Guardrail now expected:
  - risk-held rows remain non-claimable until explicitly released.
  - risk status can hold or release after review, but cannot create payout eligibility by itself.
- Regression test:
  - risk-held earning remains excluded from claimable balance even after `claimable_at`.

### REG-BRAND-ECON-001 - Brand-Origin Rewards Require Downstream Commerce

- Category: `NETWORK_ECONOMICS`, `BRAND_ORIGIN`, `SETTLEMENT_FAILURE`
- Severity: `SEV1`
- Status: `OPEN`
- First observed: failure-condition architecture pass, 2026-05-17
- Regression symptom:
  - brand receives network reward from onboarding alone, self-generated activity, creator commission principal, or ambiguous attribution.
- Root cause:
  - brand-origin lineage confused with product attribution or creator-origin referral lineage.
- Guardrail now expected:
  - brand-origin rewards come only from eligible downstream `platform_fee_amount`.
  - brand-origin onboarding alone creates no conversion or payout.
  - `REG-LINEAGE-001` prevents accidental dual creator/brand lineage.
- Regression test:
  - brand-invited creator generates deterministic conversion; expected brand-origin row appears only if within network cap and settlement gate allows future payable status.

### REG-INVARIANT-001 - Production Safety Reports Must Cover Financial Failure States

- Category: `AUDITABILITY`, `PAYOUT_IDEMPOTENCY`, `WEBHOOK_REPLAY`
- Severity: `SEV2`
- Status: `OPEN`
- First observed: failure-condition architecture pass, 2026-05-17
- Regression symptom:
  - refund, settlement, risk, or route-scope regression is only found manually after money state changes.
- Root cause:
  - reliability scripts report happy-path invariants but do not yet enforce future financial-failure invariants.
- Guardrail now expected:
  - read-only reports cover actor matrix, economics, lineage, settlement, refunds, risk, route risk, and idempotency.
- Regression test:
  - `productionSafetyTest.js` read-only invariant run fails/report-checks when duplicate orders, Level 4+, dual lineage, ambiguous attribution conversion, settlement bypass, or refund-payable contradictions exist.

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
