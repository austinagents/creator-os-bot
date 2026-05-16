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

