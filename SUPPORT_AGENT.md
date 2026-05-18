# PartnerLinks Support Agent Foundation

Status: RUNTIME-ENFORCED CLIENT-SIDE WIDGET / LOCAL DETERMINISTIC MVP / NO FINANCIAL MUTATION

Purpose:

- Provide an onsite support widget across PartnerLinks pages.
- Give creators and brands concise help for onboarding, referral links, Shopify setup, dashboards, earnings states, and safe escalation.
- Keep the first version deterministic, local, and privacy-preserving.

## Runtime Behavior

- Widget assets:
  - `public/support-widget.css`
  - `public/support-knowledge-base.js`
  - `public/support-widget.js`
- State persists in browser `localStorage` under:
  - `partnerlinks_support_chat_v1`
- The widget stores:
  - expanded/minimized state.
  - local conversation messages.
- The widget does not send messages to a backend.
- The widget does not call external AI APIs.
- The widget does not mutate PartnerLinks data.

## Covered Topics

- what PartnerLinks is.
- brand onboarding flow.
- creator onboarding flow.
- referral link basics.
- creator invite chain basics.
- Shopify connection basics.
- tracking/click attribution basics.
- pending vs claimable earnings.
- payout status explanations.
- sandbox/beta limitations.
- support escalation path.
- common issues:
  - Shopify app not installed.
  - wrong Shopify account/store context.
  - referral link not redirecting.
  - earnings pending settlement.
  - claim disabled.
  - creator cannot access dashboard.
  - brand cannot access dashboard.
  - owner email mismatch.
  - browser/session confusion.

## Safety Rules

- Never promise payouts.
- Never say money is guaranteed.
- Explain that accounted/pending earnings are not necessarily funded/claimable earnings.
- Route financial, ownership, payout, or sensitive account issues to human/admin support.
- Never ask for passwords, card numbers, private keys, API keys, webhook secrets, recovery codes, or full payment details.
- For ownership issues, ask only for account email and Shopify `.myshopify.com` store domain.
- Do not expose internal admin/debug routes.
- Keep live payout, settlement, refund enforcement, reserve, and Stripe money movement status aligned with `PROJECT_STATUS.md`.

## Future Architecture

The current widget is intentionally simple. Future versions may add:

- server-side support ticket creation.
- authenticated account context.
- admin support inbox.
- RAG over approved docs.
- OpenAI/Claude support agent backend.
- rate limiting and abuse controls.
- audit logs for support escalations.

Future backend or AI features must:

- preserve account/brand/creator scoping.
- avoid exposing secrets or internal routes.
- clearly separate sandbox/beta behavior from production readiness.
- avoid financial promises.
- route financial support to human/admin review.
