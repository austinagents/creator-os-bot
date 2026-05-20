# PartnerLinks Infrastructure Decision Rules

Status: REQUIRED OPERATING STANDARD

Read this file before every major implementation or debugging pass. During long debugging sessions, re-read it at least every third response before continuing.

PartnerLinks is unique, but we are not inventing new infrastructure patterns. We must operate like a mature Shopify, Stripe, attribution, referral, and affiliate platform:

- deterministic
- auditable
- scoped
- reversible where appropriate
- fail-closed
- idempotent
- compliant with provider and platform rules
- operationally safe

## First-Principles Platform Verification

Before changing app code, verify provider and platform behavior first.

- Check official docs and platform rules before assuming an API, scope, permission, webhook, token, payout, or auth behavior exists.
- Never assume a provider scope exists without verifying it against official provider documentation.
- Never treat local app configuration as proof of provider approval.
- Separate provider rules from app bugs.
- Prefer one read-only proof over several speculative patches.

Examples:

- Shopify protected customer data rules govern `orders/paid` and `refunds/create` webhook access.
- Shopify OAuth scopes must be verified against official Shopify scope docs.
- Stripe Connect transfers require idempotency and reconciliation; Stripe is not accounting truth.
- Supabase auth/session behavior must be verified before debugging ownership or route logic.
- Railway runtime/deploy behavior must be verified before assuming production is running the latest code or env.

## Debugging Order Of Operations

Use this order before code mutation:

1. Provider/platform rules
2. App/provider configuration
3. Environment/runtime
4. Auth/session
5. Routing
6. Database state
7. Business logic

Do not repeatedly mutate code before isolating the unknown.

If a provider is blocking the action, app code should not be patched around the provider rule. The correct path is to satisfy the provider rule or choose an approved testing method.

## Minimum-Change Debugging

Every debugging pass should answer:

- What is the exact unknown?
- What is the fastest read-only proof?
- What is the smallest possible fix?
- What assumptions are being made?
- What platform/provider facts are already known?

Prefer:

- read-only reports
- explicit reproduction commands
- exact route traces
- exact provider error messages
- minimal, scoped patches

Avoid:

- broad refactors during active debugging
- speculative permission or scope changes
- hidden mutations
- direct database edits as proof of runtime correctness
- conflating sandbox success with production readiness

## Minimal-Context Workflow

Use the smallest context set that can safely answer the task.

- Avoid broad `.md` reads by default.
- Prefer scoped reads based on task tier and current risk.
- For small UI, styling, copy, and frontend polish tasks, avoid architecture and runtime docs unless they are directly needed.
- For runtime, financial, auth, Shopify, Stripe, settlement, payout, support, or compliance work, read only the smallest relevant docs.
- Prefer runtime verification and narrow file inspection over historical re-analysis.
- Do not update documentation unless explicitly requested or required by the task.
- If additional docs are needed, state exactly which files are needed, why they are needed, and what cannot be completed without them before pulling more context.

## Approval-Window Operational Discipline

During Shopify review, protected-data approval, or submission-prep windows:

- Avoid destabilizing auth rewrites unless explicitly approved.
- Avoid payout, settlement, refund, attribution math, or economic changes unless explicitly approved.
- Avoid broad UI redesigns, routing rewrites, or architectural refactors unless explicitly approved.
- Prioritize reviewer readiness, operational stability, visual QA, support QA, least-privilege scope posture, and deterministic install/reconnect behavior.
- Treat small trust, wording, navigation, and support-polish fixes as preferred over new feature expansion.

## Runtime Vs Planned Distinction

Clearly label system claims as one of:

- `RUNTIME-ENFORCED`
- `READ-ONLY DIAGNOSTIC`
- `MANUAL OPERATOR TASK`
- `DOCUMENTED ARCHITECTURE ONLY`
- `PLANNED / NOT IMPLEMENTED`
- `BLOCKED / NO-GO`

Rules:

- Sandbox proof does not equal production readiness.
- Diagnostic capture does not equal enforcement.
- Attribution/accounting does not equal payout eligibility.
- Provider configuration does not equal provider approval.
- Stored app state does not always equal live provider state.

## Financial Infrastructure Posture

PartnerLinks touches:

- attribution
- commissions
- creator earnings
- settlements
- reversals
- payouts
- refunds
- affiliate economics

Therefore:

- no uncontrolled mutation
- no direct DB mutation as proof-of-correctness
- all financial mutations must be replay-safe and idempotent
- all operator actions must be auditable
- settlement/finalization paths must fail closed
- sandbox proof is not production readiness
- accounted earnings are not necessarily funded earnings
- conversion_created does not mean safe_to_pay

## Sandbox Vs Production Rules

Sandbox replay and test-mode activity may validate internal logic, but it does not validate:

- provider approval
- protected customer data approval
- live payout readiness
- compliance readiness
- production-scale guarantees
- live settlement readiness
- live refund/reversal safety

Every sandbox result must be labeled as sandbox-only unless the same provider-approved production path is verified.

## Shopify-Specific Known Rules

Current PartnerLinks Shopify lessons:

- `orders/paid` and `refunds/create` are protected customer data topics.
- App-created webhook registration for protected order/refund topics may require protected customer data approval.
- Webhook permissions derive from the underlying resource/topic access, not from an invented standalone webhook-write scope.
- Do not invent unsupported scopes such as `write_webhooks`.
- OAuth scopes must be verified against official Shopify scope docs.
- `.myshopify.com` is canonical for store identity.
- Account/store context matters during OAuth and install testing.
- Shopify app-installed state and local DB state can diverge.
- Development stores do not necessarily bypass protected customer data restrictions.
- Manual Shopify admin webhooks are not the canonical production-grade multi-tenant app install path.

For Shopify debugging, verify in this order:

1. Shopify platform rule or approval gate
2. Partner Dashboard app configuration
3. runtime env values
4. OAuth URL and scopes
5. token grant and returned scopes
6. webhook registration response
7. app database state
8. attribution/business logic

## Stripe-Specific Rules

- Stripe is execution infrastructure, not accounting truth.
- Idempotency keys are mandatory for money movement.
- Test mode does not prove production readiness.
- Transfers, finalization, refunds, reversals, and settlement systems require reconciliation guarantees.
- Payout and reversal flows must be replay-safe.
- Live payout paths must remain fail-closed until settlement, approval, reserve, risk, and reconciliation gates are proven.

## Supabase/Auth Rules

- Auth/session/cookie behavior must be verified before debugging business logic.
- Cross-domain cookie behavior matters, especially `partnerlinks.app` versus `www.partnerlinks.app`.
- Auth return paths must be deterministic and safe.
- No arbitrary external redirects.
- Ownership checks must be exact and resource-scoped.
- Do not rely on latest/default creator or brand identity for sensitive actions.
- Creator and brand capabilities may coexist for the same human/user.
- Prefer identity-linking over forced auth redesign for the MVP.
- Fail closed if ownership, account identity, creator identity, or brand identity is ambiguous.
- Never use latest/default creator or brand fallback behavior for sensitive actions.

## Operational Discipline

- Prefer explicit operator scripts over hidden mutations.
- Prefer dry-run first.
- Every mutation path should support verification/reporting.
- Avoid broad refactors during debugging.
- Isolate root cause before changing architecture.
- Keep debug routes read-only unless explicitly approved.
- Log decisions and diagnostics without printing secrets.
- Document known provider blockers separately from app bugs.
- Treat platform safety as product functionality, not cleanup work.

## Architecture Reminder Behavior

Future Codex sessions must:

- read `INFRASTRUCTURE_DECISION_RULES.md` before major work.
- re-read it at least every third response during long debugging sessions.
- cite which rule or principle applies before major architectural changes.
- identify provider/platform assumptions explicitly before debugging.
- distinguish runtime-enforced behavior from read-only diagnostics and documentation-only architecture.
- stop and verify official provider behavior before patching around a provider error.

If uncertain between a clever/fast/custom approach and a conservative industry-standard approach, choose the conservative industry-standard approach.
