# PartnerLinks Incident Log

Purpose:

- Record reliability incidents, near misses, regressions, and production test discoveries.
- Preserve root cause, impact, mitigation, and follow-up.

This is not a changelog. Only record reliability-relevant events.

## Incident Classification Boundary

Incident mitigations are historical facts, not blanket runtime guarantees.

- Treat a mitigation as `RUNTIME-ENFORCED` only when the incident entry or `PROJECT_STATUS.md` explicitly says the current code/schema enforces it.
- Follow-up items remain `PLANNED / NOT IMPLEMENTED` until completed.
- Manual validation steps remain `MANUAL OPERATOR TASK` unless automated runtime checks exist.

## Incident Severity

- `SEV0`: Active money movement, attribution, auth, or data integrity failure affecting production users.
- `SEV1`: High-risk confirmed bug with possible production impact.
- `SEV2`: Reliability regression or near miss found in testing.
- `SEV3`: Low-risk operational/documentation issue.

## Incident Entries

### 2026-05-16 - Stripe Onboarding Routed To Wrong Creator

- Severity: `SEV1`
- Status: `MITIGATED`
- Impacted systems:
  - `/stripe/connect/start`
  - `/earnings/claim`
  - `/dashboard/:creatorCode`
- Summary:
  - When one auth user owned multiple creators, Stripe onboarding initially resolved the default/latest creator instead of the active dashboard creator.
- Root cause:
  - Sensitive payout actions used auth-user default creator resolution instead of explicit dashboard creator context.
- Impact:
  - Test account for `test-creator-04` was sent toward another creator's Stripe account context.
- Mitigation:
  - Stripe start/return/refresh links now preserve `creator_code`.
  - Claim route requires explicit `creator_code`.
  - Ownership is verified by `creator.auth_user_id === authUser.id`.
- Validation:
  - `test-creator-04` completed Stripe test onboarding and claim lifecycle under the correct creator context.
- Follow-up:
  - Continue moving non-mutating convenience/debug surfaces toward explicit creator context.

### 2026-05-16 - Claim Button Disabled For Active Dashboard Creator

- Severity: `SEV2`
- Status: `MITIGATED`
- Impacted systems:
  - `/dashboard/:creatorCode`
- Summary:
  - `test-creator-04` dashboard displayed correct data but disabled the Claim button.
- Root cause:
  - `ownerCanClaim` used default/latest creator resolution instead of comparing signed-in auth user to the active dashboard creator.
- Mitigation:
  - Dashboard ownership check now compares `authUser.id` directly to `dashboard.creator.auth_user_id`.
- Validation:
  - Claim flow became available for `test-creator-04` and completed successfully in Stripe test mode.

## Incident Entry Template

```markdown
### YYYY-MM-DD - Incident Title

- Severity: `SEV1`
- Status: `OPEN | MITIGATED | RESOLVED`
- Impacted systems:
  - route/service/table
- Summary:
  - What happened?
- Detection:
  - How was it found?
- Root cause:
  - Why did it happen?
- Impact:
  - Who or what was affected?
- Mitigation:
  - What stopped or reduced risk?
- Validation:
  - Commands/tests/results.
- Follow-up:
  - Remaining work.
```
## Settlement Lifecycle Phase 1 - No Incident

Status: INFORMATIONAL

- This entry records that settlement lifecycle audit infrastructure is being added proactively, not in response to a production incident.
- No live payout, settlement collection, refund enforcement, or brand charging incident triggered this work.
- The purpose is pre-live financial safety hardening before controlled payout beta.
