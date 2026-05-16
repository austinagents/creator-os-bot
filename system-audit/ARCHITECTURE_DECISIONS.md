# PartnerLinks Architecture Decisions

Purpose:

- Record reliability-relevant architecture decisions and their rationale.
- Keep future changes aligned with proven Shopify/Stripe/SRE-grade patterns.

## Decision Status

- `ACCEPTED`: Current direction.
- `SUPERSEDED`: Replaced by a later decision.
- `PROPOSED`: Under consideration.
- `REJECTED`: Explicitly avoided.

## Decisions

### ADR-001 - Manual Claim Ledger Before Stripe Transfer Finalization

- Status: `ACCEPTED`
- Date: 2026-05-16
- Context:
  - Creator payouts must be idempotent and recoverable.
- Decision:
  - Preserve the flow:
    - reserve claimable rows
    - create `creator_earning_claims` ledger
    - create Stripe test transfer
    - finalize claim state
- Rationale:
  - Prevents duplicate transfers.
  - Gives operators a recovery anchor if DB finalization fails after Stripe succeeds.
- Consequences:
  - Claim logic is more complex than direct transfer-on-click, but safer.

### ADR-002 - Partnerlinks Ref As Canonical Shopify Attribution Anchor

- Status: `ACCEPTED`
- Date: 2026-05-16
- Context:
  - Shopify may strip landing query params before webhook ingestion.
- Decision:
  - Treat `partnerlinks_ref` as the canonical durable attribution identity.
  - Prefer Shopify-supported cart/order attributes over broad recent-click guessing.
- Rationale:
  - Deterministic exact matching is safer than probabilistic attribution.
- Consequences:
  - Recent-click fallback remains low-confidence and strict.

### ADR-003 - Explicit Creator Scoping For Stripe Routes

- Status: `ACCEPTED`
- Date: 2026-05-16
- Context:
  - One auth user can own multiple creator rows during testing and potentially in future operations.
- Decision:
  - Stripe start, return, refresh, debug, and claim actions must use explicit `creator_code` where creator context matters.
  - Ownership must be verified by `creator.auth_user_id === authUser.id`.
- Rationale:
  - Avoids hidden "latest creator" assumptions in financial workflows.
- Consequences:
  - Some convenience routes still need product decisions for multi-creator UX, but sensitive actions are protected.

### ADR-004 - Markdown-First Reliability System

- Status: `ACCEPTED`
- Date: 2026-05-16
- Context:
  - PartnerLinks needs operational memory without autonomous mutation.
- Decision:
  - Use `/system-audit` markdown files for audit state, risks, incidents, test matrix, decisions, regression history, and runbooks.
  - Scripts may print suggested entries or append only with explicit operator approval.
- Rationale:
  - Git-friendly, reviewable, simple, and safe.
- Consequences:
  - Reliability work remains auditable before automation is introduced.

## ADR Template

```markdown
### ADR-000 - Title

- Status: `PROPOSED`
- Date: YYYY-MM-DD
- Context:
  - Problem or pressure.
- Decision:
  - What we are choosing.
- Rationale:
  - Why this is safer/better.
- Alternatives considered:
  - Option A.
  - Option B.
- Consequences:
  - What changes or tradeoffs follow.
```

