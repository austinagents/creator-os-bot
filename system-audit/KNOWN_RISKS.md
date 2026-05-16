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
