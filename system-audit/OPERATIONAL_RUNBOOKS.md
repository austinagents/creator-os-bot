# PartnerLinks Operational Runbooks

Purpose:

- Provide safe, repeatable operator procedures for reliability testing and debugging.
- Keep commands explicit and non-destructive by default.

## Runbook Classification Labels

- `READ-ONLY DIAGNOSTIC`: safe inspection only.
- `MANUAL OPERATOR TASK`: human action outside app automation.
- `SANDBOX_ACTION`: test-only action requiring approval.
- `RUNTIME-ENFORCED`: behavior currently enforced by code/schema.
- `PLANNED / NOT IMPLEMENTED`: runbook describes future process but runtime support is incomplete.
- `BLOCKED / NO-GO`: do not execute for live money.

Runbooks are not automatic controls. A runbook step is runtime-enforced only when explicitly labeled `RUNTIME-ENFORCED`.

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

## Runbook: Diagnostic-Only Shopify Refund Capture

Use when:

- Capturing Shopify refund events for observability while payouts remain disabled/fail-closed.

Classification:

- `RUNTIME-ENFORCED` for HMAC verification and diagnostic ledger capture.
- `READ-ONLY DIAGNOSTIC` for operator review.
- `PLANNED / NOT IMPLEMENTED` for reversal enforcement.

Requirements:

- `SHOPIFY_WEBHOOK_SECRET` configured.
- `financial_reversal_events` and `financial_reversal_items` exist from migration 016.
- Production `PAYOUT_MODE=claims_disabled`.
- No live Stripe transfers.

Steps:

1. Register Shopify refund webhook to `POST /webhooks/shopify/refunds-create` only after operator approval.
2. Trigger or receive a refund event.
3. Verify a `financial_reversal_events` row exists.
4. Verify `financial_reversal_items` only if the source conversion was safely matched.
5. Run:

```bash
node scripts/productionSafetyTest.js --dry-run --refund-report --idempotency-report
```

Expected:

- Refund event is captured idempotently.
- No payout, claimability, dashboard total, settlement, or Stripe state changes.

Do not:

- Apply reversal offsets.
- Change `payout_status`.
- Claw back payouts.
- Create Stripe reversals.
- Treat diagnostic capture as refund enforcement.

## Runbook: Manual First-Order / First-Payout Reconciliation

Use when:

- Reviewing a controlled-beta order before any payout approval or future settlement release.

Classification:

- `MANUAL OPERATOR TASK`
- `READ-ONLY DIAGNOSTIC`

Checklist:

1. Identify Shopify order id and shop domain.
2. Run:

```bash
node scripts/productionSafetyTest.js --dry-run --order-report --order-id shopify:{shop_domain}:{order_id}
```

3. Confirm attribution source/confidence.
4. Confirm matched creator/product/brand.
5. Confirm direct commission amount.
6. Confirm `platform_fee_amount`.
7. Confirm Level 1/2/3 network rows and no Level 4+.
8. Confirm duplicate/skipped diagnostics if replay occurred.
9. Confirm reversal rows, if any.
10. Confirm settlement/funding state is not assumed from accounted earnings.
11. Confirm payout mode remains fail-closed before any live creator payout discussion.

Do not:

- Approve live payout from conversion existence alone.
- Treat `claimable_at` as funding proof.
- Skip refund/reversal review.

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
## Settlement Lifecycle Audit Event Runbook

Status: MANUAL OPERATOR TASK / READ-ONLY DIAGNOSTIC

Use this after migration `018_settlement_lifecycle_audit_events.sql` is manually applied.

1. Run `node scripts/productionSafetyTest.js --dry-run --settlement-report --idempotency-report`.
2. Confirm `settlement_audit_events` is visible.
3. Confirm duplicate settlement audit event idempotency keys are zero.
4. Treat all audit events as evidence for operator review only.
5. Do not release payouts from audit events alone.
6. Do not treat `settlement_authorized`, `settlement_pending`, or `settlement_retrying` as funding proof.
7. Live claimability still requires `settlement_collected`, `manual_approved`, or `reserve_covered`, plus an explicitly allowed payout mode.

Manual-only actions:

- Running migration `018`.
- Reviewing settlement audit event evidence.
- Approving any future settlement lifecycle mutation flow.
- Confirming production `PAYOUT_MODE=claims_disabled` before deployment.

## Draft Settlement Batch Operator Runbook

Status: MANUAL OPERATOR TASK / NO MONEY MOVEMENT

Dry-run first:

```bash
node scripts/settlementBatchOperator.js --dry-run --report --brand-id 9
```

Optional filters:

```bash
node scripts/settlementBatchOperator.js --dry-run --report --brand-id 9 --date-from 2026-05-17 --date-to 2026-05-17
node scripts/settlementBatchOperator.js --dry-run --report --brand-id 9 --order-id shopify:partnerlinks-test.myshopify.com:ORDER_ID
```

Create a draft only after explicit approval:

```bash
node scripts/settlementBatchOperator.js --create-draft --brand-id 9 --operator Austin --notes "Draft settlement reconciliation only. No money movement."
```

Operator checks:

1. Confirm included conversions are expected.
2. Confirm direct commission totals.
3. Confirm platform fee totals.
4. Confirm creator/brand network override totals.
5. Confirm brand funding obligation does not double-count network overrides.
6. Confirm no Stripe PaymentIntent, invoice, or transfer was created.
7. Confirm `settlement_items` reference source financial rows.
8. Confirm existing source rows were not mutated.
9. Confirm `settlement_audit_events` were written.
10. Confirm production `PAYOUT_MODE=claims_disabled` before any deployment.

Never treat a draft settlement batch as funding proof.

## Settlement Reconciliation Verification Runbook

Status: READ-ONLY DIAGNOSTIC

Run:

```bash
node scripts/settlementBatchOperator.js --dry-run --report --verify-reconciliation --brand-id 9
```

Operator must confirm:

1. Existing deterministic batch is present when expected.
2. Expected settlement item count equals existing batch item count.
3. Missing expected item count is zero.
4. Unexpected batch item count is zero.
5. Duplicate settlement item idempotency keys are zero.
6. Duplicate settlement audit idempotency keys are zero.
7. Orphan settlement item count is zero.
8. Multi-batch source assignment count is zero.
9. Level 4+ settlement behavior count is zero.
10. Self-generated creator override count is zero.
11. Batch gross equals direct commission total plus platform fee total.
12. Network overrides are treated as allocation visibility only.

If any check fails, do not proceed to funding collection or payout release.

## Brand Setup Ownership Gate Runbook

Status: RUNTIME-ENFORCED AFTER MIGRATION `019` / FAIL-CLOSED BEFORE MIGRATION

Purpose:

- Prevent early-MVP brand setup routes from being mistaken for launch-grade brand administration.

Current operator rule:

1. Manually apply `database/migrations/019_brand_owner_auth.sql`.
2. Confirm `brand_owners` exists.
3. Start Shopify OAuth only while signed in as the intended brand owner/admin.
4. Confirm OAuth callback creates a `brand_owners` row for the connected brand.
5. Confirm `/brand/setup/:brandId` blocks signed-out and non-owner users.
6. Confirm `/brand-dashboard/:brandSlug` blocks signed-out and non-owner users.
7. Do not connect brand setup completion to settlement collection, payout release, or reserve approval.

Required future launch checks:

- Brand owner account exists.
- Brand owner is signed in.
- Brand owner is explicitly linked to the brand through `brand_owners`.
- Brand setup mutation verifies owner-to-brand relationship.
- Setup mutation writes an operator/admin audit event.
- Route-risk report labels brand setup and brand dashboard as requiring signed-in brand owner scope.

## Payout Eligibility Diagnostic Runbook

Status: READ-ONLY DIAGNOSTIC / NO CLAIM RELEASE

Run:

```bash
node scripts/productionSafetyTest.js --dry-run --eligibility-report --brand-id 9
```

Optional scoped runs:

```bash
node scripts/productionSafetyTest.js --dry-run --eligibility-report --order-id shopify:partnerlinks-test.myshopify.com:ORDER_ID
node scripts/productionSafetyTest.js --dry-run --eligibility-report --creator-code test-creator-04
```

Operator must confirm:

1. `eligible_for_live_payout` is false before Phase 6.
2. Missing settlement/manual/reserve evidence appears as a blocker.
3. Reversal or offset rows appear as blockers when present.
4. Risk holds appear as blockers when present.
5. Claimed/reserved rows are blocked from new claims.
6. No Stripe transfer, PaymentIntent, brand charge, payout release, reserve deduction, or settlement transition occurs.

## Controlled Rollout Runbook

Status: DOCUMENTED ARCHITECTURE ONLY

Stages:

1. Internal operator-only testing.
2. Single trusted owner-bound test brand.
3. Manual settlement collection only.
4. Manual creator payout approval only.
5. Limited creator beta.
6. Partial automation.
7. Broader rollout.

Hard stop conditions:

- any duplicate Shopify order id creates duplicate financial rows.
- settlement reconciliation fails.
- eligibility report shows unexpected eligibility.
- refund/reversal evidence does not block payout eligibility.
- brand owner auth fails.
- route-risk report shows unscoped sensitive routes.
- Phase 6 money movement is requested before accounting/settlement/reversal/reserve/operator controls are proven.

## Operator Settlement Manual Review Runbook

Status: RUNTIME-ENFORCED OPERATOR-ONLY SCRIPT / NO MONEY MOVEMENT

Purpose:

- Mark a draft settlement batch as operator-reviewed without claiming that funds were collected.
- Preserve auditability before any future manual collection or payout release step.

Dry-run first:

```bash
node scripts/settlementBatchOperator.js --dry-run --review-draft --batch-id <settlement_batch_id> --operator <operator_name> --notes "<review notes>"
```

Only after confirming the dry-run output, the explicit write command shape is:

```bash
node scripts/settlementBatchOperator.js --review-draft --batch-id <settlement_batch_id> --operator <operator_name> --notes "<review notes>"
```

Operator checks before write:

1. Reconciliation report passes.
2. Batch status is still `settlement_pending`.
3. Batch review status is `pending_review` or draft.
4. Direct commission and platform fee totals are expected.
5. Network override allocation is not added to brand funding obligation.
6. No refund/reversal rows contradict the batch scope.
7. `PAYOUT_MODE` remains production-safe.

Operator checks after write:

1. `settlement_batches.metadata.review_status = manually_reviewed`.
2. One `settlement_audit_events` row exists for the deterministic review key.
3. `settlement_batches.settlement_status` is still `settlement_pending`.
4. `settlement_items.settlement_status` is still `settlement_pending`.
5. `collected_amount` remains `0`.
6. `settlement_collected_at`, `manual_approved_at`, and `reserve_covered_at` remain null.
7. Eligibility report still shows `eligible_for_live_payout=false`.

Never treat manual review as:

- settlement collection.
- manual approval for payout eligibility.
- reserve coverage.
- brand payment confirmation.
- creator payout authorization.

Remaining blocked transition:

- `manually_reviewed -> manually_marked_collected` is NOT IMPLEMENTED and requires explicit approval.

## Sandbox Stripe Payout Readiness Runbook

Status: READ-ONLY DIAGNOSTIC / SANDBOX ONLY / LIVE PAYOUTS NO-GO

Purpose:

- Confirm that a test creator is ready for a Stripe test-mode claim before an operator runs the real claim route.
- Preview exactly what would be reserved and transferred in sandbox without mutating rows or calling Stripe.
- Keep live payout eligibility visibly blocked.

Readiness command:

```bash
node scripts/productionSafetyTest.js --dry-run --sandbox-payout-readiness --creator-code test-creator-04
```

Supporting checks:

```bash
node scripts/productionSafetyTest.js --dry-run --eligibility-report --creator-code test-creator-04
node scripts/productionSafetyTest.js --dry-run --idempotency-report --route-risk-report
node scripts/settlementBatchOperator.js --dry-run --report --verify-reconciliation --brand-id 9
```

The readiness report must show:

1. Stripe key mode is `test`.
2. `PAYOUT_MODE=sandbox_time_based`.
3. Live payout testing is blocked.
4. Creator auth binding is present.
5. Stripe account id is present.
6. Stripe onboarding status is `payouts_enabled`.
7. No stuck reservations exist.
8. No duplicate Stripe transfer risks exist.
9. Reservable row count and total amount are greater than zero before an actual sandbox claim.
10. `eligible_for_live_payout=false`.

Current sandbox actor:

- `test-creator-04`
- Email: `andycoinsolana@gmail.com`
- Stripe onboarding status: `payouts_enabled`
- Existing successful sandbox claim batch: `b165c948-b74d-474c-b042-c8b75f6eb037`

Current blocker:

- `test-creator-04` has no fresh reservable sandbox claim rows.
- The existing `$2.70` direct commission is already claimed and must not be claimed again.

Never use this runbook to:

- enable live payouts.
- change production `PAYOUT_MODE`.
- create live Stripe transfers.
- charge brands.
- mark settlement collected.
- release claimability.
- manually edit claimed rows.

## Sandbox Claim Operator Runbook

Status: RUNTIME-AVAILABLE SANDBOX-ONLY OPERATOR SCRIPT / DRY-RUN DEFAULT

Purpose:

- Execute one controlled Stripe test-mode transfer through the existing `claimCreatorEarnings()` service path.
- Keep browser dashboard money states settlement-aware and fail-closed.
- Avoid introducing any live payout, brand charging, settlement collection, reserve, or reversal behavior.

Dry-run command:

```bash
node scripts/sandboxClaimOperator.js --dry-run --creator-code test-creator-04 --conversion-id 26
```

Execute command, only after explicit approval:

```bash
node scripts/sandboxClaimOperator.js --execute --confirm-sandbox-stripe-transfer --creator-code test-creator-04 --conversion-id 26
```

Required preflight gates:

1. `STRIPE_SECRET_KEY` reports test mode.
2. `PAYOUT_MODE=sandbox_time_based`.
3. Creator code is exactly `test-creator-04`.
4. Conversion id is explicitly supplied.
5. Conversion belongs to `test-creator-04`.
6. Conversion is unclaimed and has no `claim_batch_id`.
7. The requested conversion is the only reservable row for the creator.
8. Duplicate transfer risk is `0`.
9. Stuck reservations are `0`.
10. Live eligibility remains false.

Expected dry-run for conversion `26`:

- `would_call_stripe_now=false`.
- `would_create_stripe_test_transfer=true`.
- reservable row count is `1`.
- amount is `$2.70`.
- destination account is `acct_1TXlmIBcYxOEFHEX`.
- proposed claim batch behavior is a new UUID generated by `claimCreatorEarnings()` at execution.

Mutations allowed in execute mode:

- `conversions` row `26` may move through claim reservation/finalization:
  - `payout_status`.
  - `claim_batch_id`.
  - `claimed_at`.
- `creator_earning_claims` may receive one immutable claim ledger row.
- Stripe test mode may create one transfer using the claim batch id as idempotency key.

Mutations prohibited:

- `settlement_batches`.
- `settlement_items`.
- `settlement_audit_events`.
- `financial_reversal_events`.
- `financial_reversal_items`.
- brand billing or charging tables.
- reserve state.
- refund offset state.
- settlement collection state.
- live payout eligibility state.

Post-execute verification:

```bash
node scripts/productionSafetyTest.js --dry-run --sandbox-payout-readiness --creator-code test-creator-04
node scripts/productionSafetyTest.js --dry-run --eligibility-report --creator-code test-creator-04
node scripts/productionSafetyTest.js --dry-run --idempotency-report --route-risk-report
node scripts/productionSafetyTest.js --dry-run --order-report --order-id shopify:partnerlinks-test.myshopify.com:6550995533998
```

Stop immediately if:

- the dry-run shows blockers.
- the dry-run shows more than one reservable row.
- Stripe key mode is not `test`.
- duplicate transfer risk is not `0`.
- stuck reservation count is not `0`.
- live eligibility is anything other than false.

## Shopify Public Distribution Install Runbook

Status: MANUAL OPERATOR TASK / SHOPIFY REVIEW BLOCKER

Purpose:

- Prepare PartnerLinks for multi-tenant Shopify SaaS installs without switching to custom distribution.
- Keep external production installs blocked until Shopify app review/approval is intentionally completed.

Partner Dashboard values to verify:

- App URL:
  - `https://partnerlinks.app/register-business`
  - If Shopify requires direct OAuth entry, use `https://partnerlinks.app/api/shopify/start`.
- Allowed redirection URLs:
  - `https://partnerlinks.app/api/shopify/callback`
- App homepage:
  - `https://partnerlinks.app/`
- Webhook endpoints:
  - `https://partnerlinks.app/webhooks/shopify/orders-paid`
  - `https://partnerlinks.app/webhooks/shopify/refunds-create`

Railway/env values to verify:

- `PUBLIC_BASE_URL=https://partnerlinks.app`
- `SHOPIFY_APP_URL=https://partnerlinks.app`
- `SHOPIFY_API_KEY` matches the same public app client id.
- `SHOPIFY_API_SECRET` matches the same public app secret.
- `SHOPIFY_WEBHOOK_SECRET` matches Shopify webhook signing secret.
- `SHOPIFY_SCOPES` stays least-privilege.

Current requested scopes:

- `read_orders`
- `read_customers`

Scope review:

- Keep `read_orders` for conversion/order attribution.
- Remove or justify `read_customers` before app review if current runtime does not need customer records.
- Do not add broad scopes.

Pre-review install limitation:

- Public distribution is the correct long-term path for many independent merchant stores.
- A not-yet-approved public app cannot be installed on normal external production stores.
- Development stores available from the Shopify Dev Dashboard can be used for pre-review testing.
- Do not click custom distribution for PartnerLinks because it is not the desired long-term multi-merchant SaaS distribution model.
- Do not submit app review until compliance, privacy, onboarding, scopes, and support materials are ready.

Brand B / Brand C status:

- Brand B `1ncc1j-yw.myshopify.com`: blocked from production external install until Shopify approval unless recreated as an eligible development store.
- Brand C `euz1e0-sf.myshopify.com`: blocked from production external install until Shopify approval unless recreated as an eligible development store.

Compliance/listing checklist before review:

1. Privacy policy URL.
2. Terms of service URL.
3. Support URL or support email.
4. App homepage.
5. App listing content.
6. Testing instructions for Shopify review.
7. Least-privilege scope justification.
8. Required privacy/compliance webhook plan.
9. Stable OAuth install flow that redirects into brand setup.

Do not:

- submit for public Shopify review without explicit approval.
- switch to custom distribution.
- add broad Shopify scopes.
- change payout, settlement, Stripe, claim, reserve, refund, or earnings logic for install testing.

## Multi-Brand Isolation Runbook - Current Brand B/C Topology

Status: READ-ONLY DIAGNOSTIC / MANUAL OWNER BINDING REQUIRED

Use this section as the current source of truth for Brand B/C testing. Earlier Brand B/C domains are stale and should be treated as historical data only.

Current active brands:

- Brand A:
  - brand_id `9`
  - shop_domain `partnerlinks-test.myshopify.com`
  - owner `austindtaylor7@gmail.com`
  - dashboard slugs `partnerlinks-test-my`, `partnerlinks-test-myshopify-com`
- Brand B:
  - brand_id `11`
  - shop_domain `novo-loom.myshopify.com`
  - intended owner `fredcointron@gmail.com`
  - dashboard slugs `novo-loom-myshopify-`, `novo-loom-myshopify-com`
  - product URL `https://novo-loom.myshopify.com/products/novo-gummies`
  - creator commission `25%`
- Brand C:
  - brand_id `10`
  - shop_domain `solace-market-588vpz0h.myshopify.com`
  - intended owner `macicoinsol@gmail.com`
  - dashboard slugs `solace-market-588vpz`, `solace-market-588vpz0h-myshopify-com`
  - product URL `https://solace-market-588vpz0h.myshopify.com/products/solace-recovery-kit`
  - creator commission `20%`

Read-only checks to run before any Brand B/C mutation:

```bash
node --check index.js
node --check services/shopifyService.js
node --check services/brandOwnershipService.js
node --check services/brandDashboardService.js
node --check scripts/productionSafetyTest.js
node scripts/productionSafetyTest.js --dry-run --route-risk-report
```

Expected read-only findings:

- `shopify_stores.shop_domain` has no duplicates for active Brand A/B/C domains.
- Old domains `1ncc1j-yw.myshopify.com` and `euz1e0-sf.myshopify.com` are not active `shopify_stores` rows.
- Brand B and Brand C have distinct brand ids and exact shop domains.
- Brand dashboards resolve using domain-derived slugs, not short display-name slugs.
- Missing owner rows fail closed.

Manual owner-binding workflow:

1. Confirm the intended owner signs in through PartnerLinks so a Supabase Auth user exists.
2. Confirm the auth user id from a safe app/session path or Supabase console.
3. Insert one active `brand_owners` row for the exact brand id and auth user id.
4. Browser-test the owner can access only their exact brand dashboard/setup route.
5. Browser-test cross-brand access fails closed.

Current blockers before Brand B/C product-attribution testing:

- Brand B/C owner rows are not present yet.
- Product-specific PartnerLinks routing for Brand B/C is not runtime-verified because the current product referral path still relies on explicit in-app product metadata/mock catalog entries.
- Do not run Brand B/C checkout attribution tests until product metadata/link behavior is explicitly configured and verified.

Do not:

- delete stale historical data without explicit approval.
- insert owner rows without confirmed auth user ids.
- change payouts, settlement, Stripe, claims, reserves, refunds, or earnings math as part of Brand B/C setup.
