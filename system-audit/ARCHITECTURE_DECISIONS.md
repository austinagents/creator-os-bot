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

### ADR-005 - Platform Fee Funded Entity Network Overrides

- Status: `ACCEPTED`
- Date: 2026-05-16
- Context:
  - PartnerLinks has base earning systems and network override systems. The network override layer sits above the underlying earning systems and is entity-based, not creator-only.
- Decision:
  - Network override rewards may only be calculated from eligible downstream PartnerLinks `platform_fee_amount`.
  - Network override rewards must never be calculated from creator commissions, Shopify checkout revenue, merchant gross revenue, or self-generated sales activity.
  - Entities do not earn network override rewards from their own direct sales activity.
  - The canonical economic model lives in `system-audit/ECONOMIC_ARCHITECTURE.md`.
- Rationale:
  - Prevents self-referral farming.
  - Preserves accounting clarity.
  - Keeps direct brand affiliate commissions separate from PartnerLinks platform-fee-funded network rewards.
  - Makes future creator, brand, agency, community, and manager entities fit the same propagation model.
- Consequences:
  - Dashboards and ledgers must keep direct creator commission, platform fee, and network override rewards visually and operationally separate.
  - Future settlement automation must collect/verify platform fee eligibility before paying platform-fee-funded network overrides when settlement risk matters.
  - Public/product language must not imply network rewards come from creator commission principal.

### ADR-006 - Settlement Status Gates Live Claimability

- Status: `ACCEPTED`
- Date: 2026-05-16
- Context:
  - PartnerLinks can account for direct commission, platform fees, and network overrides before automated brand settlement is built. Accounting alone does not prove funds are safely available.
- Decision:
  - Live public payout claimability must require safe settlement state.
  - Recommended invariant:
    - `claimable requires settlement_collected OR explicit_manual_approval OR sufficient_prepaid_reserve`
  - Public beta should start with a conservative settlement model:
    - manual approval gate plus reserve/prepaid or per-order settlement.
  - The canonical settlement state model lives in `system-audit/ECONOMIC_ARCHITECTURE.md`.
- Rationale:
  - Prevents accidental unfunded payouts.
  - Separates recorded economic obligations from collected funds.
  - Keeps PartnerLinks from silently accepting credit risk without an explicit decision.
- Consequences:
  - Future live payout automation needs settlement tables/statuses before automatic claimability.
  - Creator-facing claimable balances must eventually reflect funding safety, not only elapsed pending windows.
  - Refund/reversal and negative-balance behavior must be ledgered before broader live payouts.

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
