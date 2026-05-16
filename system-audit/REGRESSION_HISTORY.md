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

### REG-001 - Stripe Routes Used Default Creator Context

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

### REG-002 - Claim Button Ownership Used Default Creator

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

### REG-003 - Shopify Test Product Card Drifted From Universal Layout

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

