# PartnerLinks Reliability Audit

Purpose:

- Maintain a living, Git-friendly reliability record for PartnerLinks creator/referral/payout infrastructure.
- Track PASS/CHECK/FAIL findings from manual audits, scripts, production tests, and incidents.
- Preserve operational memory without creating autonomous mutation logic.

This file is implementation and reliability focused. Product philosophy belongs in `CHAT_HANDOFF.md`; current implementation status belongs in `PROJECT_STATUS.md`.

## Audit Principles

- Prefer deterministic attribution over fallback guessing.
- Prefer explicit creator/brand/resource scoping over implicit defaults.
- Preserve signed webhook verification.
- Preserve idempotent conversion creation.
- Preserve idempotent Stripe transfer and claim finalization behavior.
- Preserve safe failure over ambiguous execution.
- Never tie payout creation directly to raw click events.
- Never let audit tooling mutate production data unless explicitly approved and clearly test-scoped.

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
  - `/stripe/connect/start`, `/stripe/connect/return`, `/stripe/connect/refresh`, `/earnings/claim`, and `/stripe/connect/debug?creator_code=...` use explicit creator context for sensitive Stripe behavior or Stripe diagnostics.
- Shopify deterministic attribution:
  - `PASS`
  - Cart/order attributes with `partnerlinks_ref`, `creator_code`, `brand_slug`, and `product_slug` have produced exact attribution without fallback.
- Creator economics:
  - `PASS`
  - Test conversion for `test-creator-04` produced direct commission and Level 1/2/3 network earnings with no Level 4.
- Payout lifecycle:
  - `PASS`
  - `test-creator-04` completed Stripe test onboarding and successfully claimed direct commission through the real claim route.
- Duplicate webhook replay:
  - `CHECK`
  - Signed replay with valid HMAC still needs to be executed in an environment with `SHOPIFY_WEBHOOK_SECRET`.
- Multi-creator convenience navigation:
  - `CHECK`
  - `/dashboard` and homepage dashboard navigation still use default/latest creator resolution for convenience. Sensitive payout routes are scoped, but UX can be confusing when one auth user owns multiple creators.

## Latest Audit Entries

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
- Remaining checks:
  - Duplicate webhook replay with valid HMAC.
  - Claim retry after success.
  - Failure recovery test in Stripe sandbox.

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

