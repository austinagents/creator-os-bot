# PartnerLinks Operational Runbooks

Purpose:

- Provide safe, repeatable operator procedures for reliability testing and debugging.
- Keep commands explicit and non-destructive by default.

## Safety Rules

- Do not deploy or push unless explicitly approved.
- Do not run SQL automatically.
- Do not delete production data.
- Do not create live Stripe transfers.
- Do not bypass Shopify webhook HMAC verification.
- Do not loosen attribution fallback to make tests pass.
- Do not mutate non-test creators during safety testing.
- Keep test-mode/sandbox flows clearly separated from production money movement.

## Runbook: Read-Only Creator Reliability Audit

Use when:

- Auditing current creator/referral/payout state without writes.

Command:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04
```

Expected:

- Prints creator graph.
- Prints clicks, attribution sessions, conversions, network earnings, claim ledger rows.
- Prints reliability matrix summary.
- Does not create data or move money.

Record results in:

- `system-audit/RELIABILITY_AUDIT.md`
- `PROJECT_STATUS.md` if implementation snapshot changes.

## Runbook: Duplicate Shopify Webhook Replay

Use when:

- Verifying duplicate order idempotency with a real signed webhook.

Requirements:

- `SHOPIFY_WEBHOOK_SECRET` available.
- Exact approved replay payload.
- Real webhook endpoint.
- Operator approval before sending.

Expected:

- HMAC accepted.
- Existing order detected.
- Diagnostic row records `duplicate_skipped`.
- No duplicate conversion.
- No duplicate creator network earnings.
- No duplicate brand network earnings.

Do not:

- Bypass HMAC.
- Write directly to conversion tables.
- Replay unknown live customer orders without approval.

## Runbook: Stripe Claim Retry Safety

Use when:

- Verifying retry-after-success does not create duplicate transfers.

Requirements:

- Stripe test mode only.
- Test creator only.
- Explicit approval before using the real claim route.

Expected:

- If no claimable rows remain, no new transfer is created.
- Existing claim ledger remains intact.
- Claimed rows keep `claim_batch_id` and `claimed_at`.

Do not:

- Use live Stripe keys.
- Modify payout rows manually.
- Force claimable balances on real creators.

## Runbook: Multi-Creator Collision Test

Use when:

- Verifying attribution does not bleed between creators.

Setup:

- Use test creators only.
- Use `/r/aria-wellness/test-creator-05/test-product`.
- Use `/r/aria-wellness/test-creator-06/test-product`.

Expected:

- Exact cart/order attributes win when present.
- If deterministic context is missing and fallback is ambiguous, webhook skips attribution instead of guessing.
- Diagnostics explain source, confidence, fallback, and unmatched reason.

## Runbook: Settlement State Machine Review

Use when:

- Reviewing a settlement item, refund, failed brand payment, manual approval, reserve application, or blocked claim.

Requirements:

- Do not mutate settlement or payout rows without explicit approval.
- Use canonical states from `system-audit/ECONOMIC_ARCHITECTURE.md`.
- Preserve auditability and idempotency.

Review steps:

1. Identify the Shopify order id and conversion id.
2. Identify all related economic rows:
   - direct creator commission.
   - platform fee.
   - creator-network overrides.
   - brand-network overrides.
3. Identify settlement batch and settlement items.
4. Confirm current state is legal.
5. Confirm required evidence exists:
   - Shopify event.
   - Stripe event/object.
   - reserve ledger entry.
   - manual approval metadata.
   - refund/reversal event.
6. Confirm claimability status:
   - not claimable unless `settlement_collected`, `manual_approved`, or `reserve_covered`.
7. Record operator finding in `RELIABILITY_AUDIT.md` if a gap or exception is found.

Expected:

- No ambiguous state.
- Every state transition has evidence.
- Every blocked claim has an explainable reason.

Do not:

- Mark earnings claimable from `claimable_at` alone.
- Delete historical conversion, earning, claim, settlement, or refund rows.
- Approve payout eligibility without operator id, timestamp, amount, reason, and affected row ids.

## Runbook: Failed Brand Settlement

Use when:

- Brand payment fails for a settlement batch/item.

Expected:

- State moves to `settlement_failed`.
- Retry can move to `settlement_retrying`.
- Earnings remain non-claimable.
- Operator alert is created.

Do not:

- Release claimability from failed settlement.
- Pay creator/network earnings unless explicit manual approval accepts the risk.

## Runbook: Refund After Payout

Use when:

- Shopify refund/chargeback arrives after a creator claim was paid.

Expected:

- Original claim and transfer rows remain intact.
- Refund creates `refund_pending`.
- Final adjustment creates `offset_required` or negative-balance ledger rows.
- Future earnings offset the negative balance or operator handles recovery.

Do not:

- Delete claimed rows.
- Remove Stripe transfer history.
- Silently reduce historical earnings without reversal/offset audit rows.

## Runbook: Platform Safety Review Before Launch

Use when:

- Reviewing PartnerLinks before public launch, onboarding a real brand, enabling new payout behavior, or adding new referral/invite tooling.

Safety principle:

```text
conversion_created != safe_to_pay
```

Review checklist:

1. Attribution hijacking:
   - exact `partnerlinks_ref` wins.
   - ambiguous attribution skips.
   - no payout from raw click/cookie alone.
2. Extension/coupon theft:
   - low-confidence fallback cannot override exact attribution.
   - attribution source/confidence is visible.
3. Synthetic commerce:
   - payout requires settlement/approval/reserve.
   - refund/reversal handling exists for the path being enabled.
   - suspicious velocity/manual review is considered.
4. Referral abuse:
   - no signup-only payouts.
   - no self-generated network override.
   - no Level 4+.
5. Duplicate events:
   - webhook and payout operations are idempotent.
   - duplicate settlement items cannot be created.
6. Disclosure:
   - creator-facing UX makes compensation relationship clear.
7. Messaging:
   - no platform-sent third-party invite messages without consent safeguards.
8. Money clarity:
   - accounted, funded, claimable, claimed, reversed, direct, and network earnings are distinguishable.

Expected:

- Every enabled money path has deterministic attribution, settlement safety, refund/reversal handling, and diagnostics.

Do not:

- Treat conversion creation as payout eligibility.
- Enable outreach automation without consent review.
- Hide affiliate compensation language in creator-facing UX.

## Runbook: Referral Param And Query Safety Review

Use when:

- Adding or modifying `/r`, `/join`, dashboard filters, debug routes, attribution parsers, or tracking params.

Checklist:

1. Validate expected format for:
   - `creator_code`
   - `referral_code`
   - `brand_slug`
   - `product_slug`
   - `partnerlinks_ref`
   - `sub_id`
   - UTM params.
2. Enforce length limits.
3. Normalize canonical identifiers.
4. Escape any rendered values.
5. Reject or log suspicious malformed params.
6. Use structured/parameterized Supabase queries only.
7. Keep service-role usage server-side.

Expected:

- Malformed params cannot become trusted attribution.
- Malformed params cannot reach raw SQL.
- Malformed params cannot render unescaped into HTML/admin output.

Do not:

- Build raw SQL with route/query params.
- Trust unbounded tracking params.
- Log full sensitive payloads when a compact diagnostic is enough.

## Runbook: Secret Exposure / Breach Response

Use when:

- A secret may have appeared in logs, code, screenshots, debug routes, analytics, or third-party tooling.

Immediate steps:

1. Stop exposing the surface.
2. Identify secret type:
   - Stripe secret key.
   - Supabase service role key.
   - Shopify API secret.
   - Shopify webhook secret.
   - Discord bot token.
3. Rotate the secret in its source system.
4. Update Railway/env configuration.
5. Confirm old secret is invalid.
6. Search repo/logs for remaining exposure.
7. Record incident in `INCIDENT_LOG.md`.

Do not:

- Paste secrets into chat, public logs, screenshots, or docs.
- Leave debug routes publicly accessible if they expose sensitive account state.

## Runbook: Shopify App Data Minimization Review

Use when:

- Adding Shopify scopes, webhook fields, diagnostics, debug output, analytics, support tooling, or order/customer storage.

Checklist:

1. Confirm the Shopify scope is required for the exact feature.
2. Store only the fields needed for attribution, settlement, diagnostics, or support.
3. Avoid full customer/order payload logging.
4. Redact customer/payment-sensitive fields from diagnostics.
5. Confirm Shopify access tokens and webhook secrets are server-side only.
6. Confirm token rotation steps are documented.
7. Record any intentional data retention decision in the audit docs.

Expected:

- PartnerLinks does not become the weak point in the Shopify data chain.
- Attribution diagnostics remain useful without becoming a customer-data warehouse.

Do not:

- Add broad Shopify scopes because they may be useful later.
- Store full order/customer payloads when compact attribution/settlement fields are enough.

## Runbook: Authorization Scope Review

Use when:

- Adding or changing routes/actions for creators, brands, Stripe, payouts, settlement, debug visibility, Shopify store data, or admin tools.

Checklist:

1. Identify the target resource:
   - creator.
   - brand.
   - Shopify store.
   - claim batch.
   - settlement batch/item.
   - diagnostic event.
2. Require explicit resource context when sensitive:
   - `creator_code`.
   - `brand_id`.
   - `shop_domain`.
   - order id.
3. Verify signed-in ownership or operator authorization.
4. Refuse default/latest creator fallback in money/sensitive paths.
5. Return safe `403`/empty state when unauthorized.
6. Log operator/admin access where appropriate.

Expected:

- One auth user with multiple creators cannot mutate or inspect the wrong creator accidentally.
- Brand and creator resources are not crossed by convenience navigation.

Do not:

- Infer sensitive action targets from newest/default rows.
- Trust a query param without ownership verification.

## Runbook: Fraud / Synthetic Commerce Review

Use when:

- Reviewing suspicious orders, first payouts, abnormal creator growth, refund-heavy behavior, duplicate payout identities, or rapid network expansion.

Checklist:

1. Confirm deterministic attribution source and confidence.
2. Confirm brand settlement/funding status.
3. Review creator/account age and first-payout status.
4. Check for duplicate Stripe accounts, payout destinations, tax ids, IP/device clusters when available.
5. Check order velocity, refund/chargeback history, and repeated buyer/order patterns.
6. Hold or block claimability if risk is unresolved.
7. Record review outcome and operator action.

Expected:

- New creators/brands/high-risk activity cannot instantly extract payouts.
- Synthetic commerce does not become payable solely because conversions exist.

Do not:

- Treat Stripe onboarding as fraud approval.
- Treat Shopify order payment as final payout safety without settlement/refund gates.

## Runbook: Small Platform Fragility Review

Use when:

- Preparing public launch, onboarding a real brand, changing referral rewards, adding invite/messaging tools, adding dashboards/metrics, or enabling payout/settlement automation.

Core assumption:

- A single serious exploit, fake-account loop, payout leak, data exposure, or misleading growth metric can materially damage PartnerLinks.

Checklist:

1. SQL/query safety:
   - public referral/tracking params are validated and length-limited.
   - no raw SQL uses route/query params.
   - Supabase service role remains server-side only.
2. Fake account/reward exploitation:
   - no signup-only reward exists.
   - no recruitment-only reward exists.
   - new/high-risk creators cannot instantly extract payouts.
3. Synthetic network metrics:
   - creator count and invite count are not presented as economic value.
   - productive network metrics are tied to attributed, settled commerce.
4. Incentive gaming:
   - internal/operator incentives do not reward unsafe growth.
   - manual overrides have audit trails.
5. Messaging cost/legal exposure:
   - no automated SMS/email invite system is enabled without consent, rate limits, and cost controls.
6. Third-party app fragility:
   - Shopify scopes are least-privilege.
   - customer/payment-sensitive data is minimized.
   - key rotation runbook exists.
7. Docs source integrity:
   - source-backed facts, assumptions, and internal opinions are clearly separated.
   - AI-generated risk language is not treated as legal advice.

Expected:

- PartnerLinks does not rely on the resilience assumptions of a large company.
- Any public-launch path has safety controls proportional to a small platform's fragility.

Do not:

- Treat vanity metrics as value.
- Add paid messaging rails without abuse controls.
- Publish compliance/legal claims without source review.

## Runbook: Promotional Abuse / Takedown Review

Use when:

- A creator, brand, product, landing page, or public promotion is reported as deceptive, unsafe, undisclosed, spammy, or non-compliant.

Checklist:

1. Capture reported URL, creator, brand, product, and evidence.
2. Determine whether compensation/affiliate disclosure is missing or unclear.
3. Review brand/product legitimacy and Shopify ownership.
4. Suspend or remove public visibility when risk is credible.
5. Notify/record affected creator or brand status when appropriate.
6. Record operator, timestamp, reason, and action taken.
7. Add a follow-up review date if temporary.

Expected:

- PartnerLinks can respond to affiliate-network liability and endorsement/disclosure risks.
- Unsafe promotion has a takedown path and audit record.

Do not:

- Leave deceptive promotion unresolved because it came from an affiliate/creator.
- Hide moderation actions from the operator audit trail.

## Runbook: Admin Tooling Safety Review

Use when:

- Adding or running scripts, Discord admin commands, debug routes, replay utilities, payout tools, settlement tools, or moderation tools.

Requirements:

- Default read-only/dry-run.
- Explicit write flag for mutations.
- Test namespace guard when applicable.
- Operator approval before production mutation.
- Audit log for admin action.
- No destructive automation by default.

Review questions:

- Can this mutate attribution, payout, settlement, creator ownership, or brand state?
- Does it require explicit approval?
- Does it refuse non-test data when it is a test utility?
- Does it log who/what/when/why?
- Can it accidentally create duplicate financial mutations?

Do not:

- Add admin tools that silently mutate financial state.
- Bypass HMAC/idempotency/ownership checks for convenience.
- Run destructive SQL through scripts.

## Runbook: Refund / Chargeback / Reversal Review

Use when:

- Shopify order is fully refunded, partially refunded, disputed, or charged back.
- A creator, brand, or operator reports a reversed order.
- Future Shopify refund/dispute webhook creates a review event.

Requirements:

- Do not delete conversion, earning, claim, or transfer rows.
- Freeze affected unpaid earnings while review is active.
- Preserve the original claim ledger if payout already occurred.
- Create reversal/offset records once reversal tooling exists.
- Migration `016_financial_reversal_ledger.sql` creates the first reversal event/item tables, but does not apply reversals automatically.

Steps:

1. Identify Shopify order id, conversion id, creator id, brand id, product slug, and original attribution event.
2. Determine whether the affected direct commission or network override rows are unclaimed, claimable, claimed, or paid.
3. For pre-payout reversals, mark affected earnings as reversed and remove from claimable balance after ledgering.
4. For post-payout reversals, create `offset_required` / negative-balance records and hold future earnings if needed.
5. Review Level 1/2/3 creator-network and brand-origin rewards created from the same `platform_fee_amount`.
6. Record operator, timestamp, refund amount, refund percentage, reason, evidence, and affected rows.
7. Add creator/brand risk hold if refund/chargeback pattern is suspicious.

Expected:

- Money does not remain permanently earned after commerce reverses.
- Paid rows remain auditable and immutable.
- Future earnings can offset post-payout reversals.

Do not:

- Silently edit claimed rows.
- Delete payout history.
- Leave network overrides payable when the platform fee source has reversed.

## Runbook: Brand Settlement Failure

Use when:

- Future brand payment collection fails.
- Settlement batch or settlement item enters `settlement_failed` or `settlement_retrying`.
- Brand reserve is insufficient.

Requirements:

- Do not mark related earnings live-claimable.
- Keep direct commission, platform fee, and network override items separate.
- Keep operator diagnostics clear enough to explain blocked claimability.

Steps:

1. Identify settlement batch, settlement items, brand id, conversions, affected creators, and affected network rows.
2. Verify whether failure is payment method failure, insufficient reserve, dispute, refund, or integration error.
3. Keep affected earnings in pending settlement or hold state.
4. Retry according to future settlement retry policy.
5. Notify/operator-review brand if retries fail.
6. Suspend claimability for affected rows until `settlement_collected`, `manual_approved`, or `reserve_covered`.
7. Record all attempts, Stripe ids, operator notes, and final status.

Expected:

- Failed settlement cannot create claimable earnings.
- Creators see clear pending-settlement language, not guaranteed payout language.

Do not:

- Release payouts because `claimable_at` elapsed.
- Mix direct commission settlement with PartnerLinks platform fee accounting.

## Runbook: Synthetic Commerce / Fraud Review

Use when:

- Order, creator, brand, product, payout, or network activity looks abnormal.
- Signals include refund loops, repeated buyer/order patterns, sudden conversion velocity, duplicate payout methods, duplicate Stripe accounts, suspicious IP/device clusters, or first-payout spikes.

Requirements:

- Risk review can hold payout eligibility but must not create payout eligibility.
- Do not assume correct attribution means safe commerce.
- Do not assume Stripe onboarding proves user quality.

Steps:

1. Identify the affected creators, brands, conversions, clicks, attribution events, settlement items, and claim rows.
2. Confirm deterministic attribution and duplicate prevention still behaved correctly.
3. Review refund/chargeback history and conversion velocity.
4. Review payout method/Stripe account overlap when available.
5. Place affected earnings or creators on review hold once risk tooling exists.
6. Decide: release, continue hold, reverse, offset, suspend, or escalate.
7. Record evidence, operator, timestamp, decision, and follow-up date.

Expected:

- New/high-risk creators cannot instantly extract payouts.
- Synthetic commerce does not become claimable just because conversion attribution was correct.

Do not:

- Pay solely from raw clicks, signups, or deterministic-but-suspicious conversions.
- Resolve risk holds without an audit trail.

## Runbook: Daily Threat Intelligence / Reliability Scan

Use when:

- Running future read-only safety monitoring.
- Reviewing external affiliate, Shopify app, Stripe Connect, marketplace, payout, or creator-reward incidents.

Requirements:

- Read-only by default.
- Human approval required before code, payout, settlement, attribution, or moderation changes.
- Separate verified facts, assumptions, and internal opinions.

Output format:

- Date.
- Source/incident summary.
- Mapped PartnerLinks subsystem.
- Severity.
- Possible exploit path.
- Current protection status.
- Recommended docs/tests/code follow-up.
- Approval needed before action.

Do not:

- Auto-mutate code.
- Auto-mutate creator, attribution, payout, settlement, or risk state.
- Treat AI-generated research as legal advice.

## Runbook: Financial-Failure Implementation Review

Use when:

- Adding refund, reversal, settlement, risk, payout, or idempotency infrastructure.

Required implementation order:

1. Refund / reversal ledger infrastructure.
2. Settlement-state runtime schema.
3. Read-only invariant reporting.
4. Controlled-beta synthetic-commerce risk holds.
5. Read-only threat intelligence / audit monitor.
6. Replay / idempotency hardening.

Requirements:

- One financial mutation class per patch.
- Additive migrations first.
- No destructive SQL.
- No automatic payout clawback in reversal-ledger patch.
- No Stripe reversal or negative-balance collection until explicitly designed.
- No live claimability from settlement fields until eligibility service exists.
- Manual Supabase SQL execution by operator only.
- Migration `016_financial_reversal_ledger.sql` is the current first patch and should be reviewed/run manually before any reversal application logic is considered.

Review checklist:

1. Does this patch mutate money state, or only add audit/schema infrastructure?
2. What is the idempotency key?
3. What happens if the same event arrives twice?
4. What happens if the event arrives out of order?
5. What happens if payout already occurred?
6. What rows prove the operator can audit the decision?
7. Are sensitive payloads minimized/redacted?
8. Does the patch fail closed?
9. Are docs and regression tests updated?
10. Were read-only reports run before and after?

Expected:

- Financial-failure infrastructure arrives in layers.
- Each layer is explainable, auditable, and reversible from rollout behavior.

Do not:

- Bundle settlement collection, reversal application, risk scoring, and payout mutation together.
- Treat schema existence as payout eligibility.
- Change payout math while adding failure-condition infrastructure.

## Runbook: Controlled Real-Money Attribution-Only Beta

Use when:

- Testing real Shopify orders with PartnerLinks attribution/accounting while creator payouts remain disabled.

Requirements:

- Production `PAYOUT_MODE=claims_disabled`.
- No live Stripe transfers.
- `orders/paid` webhook active and HMAC verified.
- `SHOPIFY_WEBHOOK_SECRET` configured.
- Product referral URL routes through PartnerLinks.
- Attribution diagnostics are reviewed before any economic conclusion.

Checklist:

1. Confirm brand/store is connected.
2. Confirm product link uses PartnerLinks `/r/:brandSlug/:creatorCode/:productSlug`.
3. Confirm Shopify cart/order attributes include `partnerlinks_ref`, `creator_code`, `brand_slug`, and `product_slug`.
4. Place a small real order.
5. Verify `shopify_attribution_events` by Shopify order id.
6. Verify `conversions` direct commission and `platform_fee_amount`.
7. Verify `creator_network_earnings` Level 1/2/3 rows when applicable.
8. Confirm no `brand_network_earnings` unless intentionally testing brand-origin economics.
9. Confirm production claims are disabled.
10. Record reconciliation notes.
11. If a refund occurs, do not assume reversal enforcement; record manually until refund ingestion is built.

Read-only operator report commands:

```bash
node scripts/productionSafetyTest.js --dry-run --order-report --order-id shopify:{shop_domain}:{order_id}
node scripts/productionSafetyTest.js --dry-run --actor-matrix --lineage-report --economic-report --refund-report --settlement-report --risk-report --route-risk-report
```

Use these reports to answer:

- which creator/product/brand matched.
- attribution source, confidence, fallback, duplicate/skipped decision, and checked sources.
- direct commission and `platform_fee_amount`.
- Level 1/2/3 creator network rows and brand-origin rows if present.
- claim batch and payout status context.
- reversal rows, if refund/reversal ingestion has created any.
- payout-mode and settlement-readiness state.

Expected:

- Real order proves attribution/accounting only.
- No creator payout is enabled or executed.

Do not:

- Change `PAYOUT_MODE` to allow live claims.
- Treat accounted earnings as funded earnings.
- Run Stripe live transfers.
- Assume refunds are enforced until refund webhook ingestion and reversal application exist.

## Runbook Template

```markdown
## Runbook: Title

Use when:

- Situation.

Requirements:

- Required env/data/approval.

Steps:

1. Step one.
2. Step two.

Expected:

- Safe expected result.

Do not:

- Unsafe action.

Record results in:

- File(s).
```
