# PartnerLinks Support Knowledge Base

Status: CANONICAL APPROVED SUPPORT ANSWER DATABASE

Purpose:

- Store approved support-safe answers for the PartnerLinks onsite support agent.
- Keep answer content separate from agent behavior rules and training history.
- Provide concise responses that can be promoted into runtime support knowledge only after review.

Document roles:

- `SUPPORT_AGENT.md`: agent behavior rules, tone, safety boundaries, escalation behavior, prohibited responses, and support UX principles.
- `SUPPORT_AGENT_TRAINING_LOG.md`: support QA history, unanswered questions, misanswered questions, approved snippet updates, escalation learnings, and weekly review notes.
- `SUPPORT_KNOWLEDGE_BASE.md`: approved answer database the agent should answer from.

Important response rules:

- Do not promise payouts.
- Do not guarantee earnings.
- Do not say live payouts are enabled unless `PROJECT_STATUS.md` says so.
- Do not expose internal admin routes.
- Do not expose internal debugging details.
- Do not ask for passwords, private keys, API keys, webhook secrets, recovery codes, or full card numbers.
- Keep answers calm, helpful, and concise.
- For sensitive account, financial, ownership, refund, payout, or security issues, route to support/admin escalation.

## What Is PartnerLinks?

Intent:
User asks what PartnerLinks is or what it does.

Approved Response:
PartnerLinks helps brands and creators run referral links, Shopify attribution, creator invite flows, earnings tracking, and payout workflows. It is built as creator-led growth infrastructure, with an emphasis on deterministic tracking, clear money states, and safe operations.

Sensitive?:
No

Escalate When:
- User asks about legal, tax, payout guarantees, or live financial commitments.
- User asks whether a specific earning is payable.

Source of Truth:
`CHAT_HANDOFF.md`, `PROJECT_STATUS.md`, `GO_TO_MARKET_STRATEGY.md`

Last Reviewed:
2026-05-18

## Brand Onboarding Overview

Intent:
Brand asks how to get started or connect a business.

Approved Response:
Brands start by connecting a Shopify store, completing brand setup, setting creator commission terms, and sharing creator onboarding links. Brand dashboard and setup access require the signed-in owner/admin for that exact brand.

Sensitive?:
Yes

Escalate When:
- Brand cannot access its dashboard.
- Shopify install or reconnect fails.
- Owner email does not match the intended brand owner.
- User asks to change ownership.

Source of Truth:
`PROJECT_STATUS.md`, `SUPPORT_AGENT.md`, `system-audit/OPERATIONAL_RUNBOOKS.md`

Last Reviewed:
2026-05-18

## Creator Onboarding Overview

Intent:
Creator asks how to join or get a creator account.

Approved Response:
Creators join with Google, receive a creator code, and can use referral links to share brands or products. If a creator joins from an invite, PartnerLinks records the invite context after successful signup.

Sensitive?:
No

Escalate When:
- Creator joined with the wrong email.
- Creator cannot access dashboard.
- Creator invite lineage appears wrong.

Source of Truth:
`PROJECT_STATUS.md`, `CHAT_HANDOFF.md`

Last Reviewed:
2026-05-18

## Referral Links Overview

Intent:
User asks how referral links work or why a link redirects.

Approved Response:
Referral links route through PartnerLinks first so the system can record a click, create a tracking reference, and send the shopper to the correct brand or Shopify product path. Product links should preserve attribution data so Shopify order attribution can be resolved later.

Sensitive?:
No

Escalate When:
- Link goes to the wrong brand or product.
- Link redirects to the generic site instead of Shopify.
- User reports missing attribution after a real order.

Source of Truth:
`PROJECT_STATUS.md`, `CHAT_HANDOFF.md`

Last Reviewed:
2026-05-18

## Creator Invite Chains / Creator Network Explanation

Intent:
User asks how creator networks, creator invites, or levels work.

Approved Response:
PartnerLinks supports creator network participation where creators can invite other creators into a brand ecosystem. Network rewards are tied to eligible downstream attributed commerce, not signups alone. Current creator network economics stop after Level 3 and should not reward a creator for their own direct sale.

Sensitive?:
Yes

Escalate When:
- User asks for payout guarantees.
- User asks why a level did or did not earn.
- User frames the system as recruitment-only income.
- User reports possible self-referral or suspicious activity.

Source of Truth:
`PROJECT_STATUS.md`, `GO_TO_MARKET_STRATEGY.md`, `system-audit/ECONOMIC_ARCHITECTURE.md`

Last Reviewed:
2026-05-18

## Shopify Install / Connect Overview

Intent:
Brand asks how Shopify install/connect works.

Approved Response:
PartnerLinks connects to Shopify through the brand onboarding flow. Shopify identity is based on the canonical `.myshopify.com` store domain, and the install flow depends on the user being in the correct Shopify account and store context.

Sensitive?:
Yes

Escalate When:
- Shopify app does not appear installed.
- OAuth reconnect loops or lands on the wrong page.
- Store domain is wrong.
- User asks for token or permission troubleshooting.

Source of Truth:
`PROJECT_STATUS.md`, `INFRASTRUCTURE_DECISION_RULES.md`, `system-audit/OPERATIONAL_RUNBOOKS.md`

Last Reviewed:
2026-05-18

## Shopify Account / Store Context Confusion

Intent:
User is confused because Shopify says the app is installed/uninstalled, or they are in the wrong account/store.

Approved Response:
Shopify account and store context can be confusing. Please confirm the exact `.myshopify.com` domain and the email you are using. PartnerLinks local connected state can differ from Shopify's installed-app state, so support may need to review the store connection safely.

Sensitive?:
Yes

Escalate When:
- Store install state conflicts between Shopify and PartnerLinks.
- Owner email is unclear.
- User wants a store disconnected or reconnected.
- User asks for manual database changes.

Source of Truth:
`SUPPORT_AGENT_TRAINING_LOG.md`, `PROJECT_STATUS.md`, `INFRASTRUCTURE_DECISION_RULES.md`

Last Reviewed:
2026-05-18

## Dashboard Access / Wrong Owner Email

Intent:
User cannot access a creator or brand dashboard, or sees the wrong workspace.

Approved Response:
Creator dashboards are tied to the signed-in creator account. Brand dashboards require the signed-in owner/admin for that exact brand. If access is blocked or the wrong dashboard opens, check the Google email and Shopify store domain first, then support can review the owner binding.

Sensitive?:
Yes

Escalate When:
- User cannot access brand dashboard.
- User sees another brand or creator context.
- User needs owner email changed.
- User reports unexpected account access.

Source of Truth:
`PROJECT_STATUS.md`, `SUPPORT_AGENT_TRAINING_LOG.md`

Last Reviewed:
2026-05-18

## Pending Earnings Vs Claimable Earnings

Intent:
Creator asks why earnings are pending or not claimable.

Approved Response:
Pending or accounted earnings are not always claimable. Claimable earnings may require settlement, manual approval, reserve coverage, or other safety checks. A conversion does not automatically mean funds are safe to pay.

Sensitive?:
Yes

Escalate When:
- User asks about a specific payout.
- User says expected earnings are missing.
- User asks when money will be paid.
- Claim button is disabled.

Source of Truth:
`PROJECT_STATUS.md`, `INFRASTRUCTURE_DECISION_RULES.md`, `system-audit/ECONOMIC_ARCHITECTURE.md`

Last Reviewed:
2026-05-18

## Payout Status Explanation

Intent:
Creator asks what payout status means.

Approved Response:
Payout status may include pending, claimable, claimed, blocked, setup-required, or review states. PartnerLinks should not promise payouts from a conversion alone. If a payout status looks wrong, support can review the account and explain the current blocker.

Sensitive?:
Yes

Escalate When:
- User says payout is missing.
- User asks for live money movement.
- User asks for a Stripe transfer status.
- User disputes payout status.

Source of Truth:
`PROJECT_STATUS.md`, `SUPPORT_AGENT.md`, `INFRASTRUCTURE_DECISION_RULES.md`

Last Reviewed:
2026-05-18

## Claim Button Disabled

Intent:
Creator asks why the Claim button is unavailable.

Approved Response:
If the Claim button is disabled, the account may not currently meet payout, settlement, approval, reserve, setup, or beta safety requirements. PartnerLinks support can review the account and explain the current blocker, but the support agent cannot promise payout timing or approval.

Sensitive?:
Yes

Escalate When:
- User asks to enable claim manually.
- User reports claim button disabled with expected earnings.
- User is asking about live money movement.

Source of Truth:
`PROJECT_STATUS.md`, `SUPPORT_AGENT_TRAINING_LOG.md`, `system-audit/OPERATIONAL_RUNBOOKS.md`

Last Reviewed:
2026-05-18

## Refunds And Reversals

Intent:
User asks what happens after refunds, reversals, disputes, or chargebacks.

Approved Response:
Refund and reversal handling is a sensitive financial workflow. PartnerLinks may record diagnostic reversal information, but refund enforcement, payout offsets, and balance adjustments should be reviewed by an operator. Support can flag refund or reversal questions for admin review.

Sensitive?:
Yes

Escalate When:
- User reports refunded order earnings.
- User asks for clawback, offset, or balance adjustment details.
- User disputes a reversal.
- User asks about chargebacks.

Source of Truth:
`PROJECT_STATUS.md`, `SUPPORT_AGENT_TRAINING_LOG.md`, `system-audit/ECONOMIC_ARCHITECTURE.md`

Last Reviewed:
2026-05-18

## Protected Customer Data / Shopify Webhook Limitation

Intent:
User asks why Shopify order/refund ingestion or webhooks are not fully working in production.

Approved Response:
Some Shopify order and refund webhook topics require protected customer data approval. Sandbox or diagnostic tests can verify PartnerLinks internal logic, but they do not prove production Shopify approval or live webhook readiness.

Sensitive?:
Yes

Escalate When:
- Brand asks whether production Shopify webhook ingestion is ready.
- Store orders are not appearing in PartnerLinks.
- User asks about Shopify protected customer data approval.

Source of Truth:
`PROJECT_STATUS.md`, `INFRASTRUCTURE_DECISION_RULES.md`, `SUPPORT_AGENT_TRAINING_LOG.md`

Last Reviewed:
2026-05-18

## Beta / Sandbox Limitations

Intent:
User asks what is live, beta, sandbox-only, or not available yet.

Approved Response:
Some PartnerLinks flows are beta or sandbox-only. Sandbox tests can validate internal logic, but they do not prove live payout readiness, production settlement readiness, protected customer data approval, or broader public-launch readiness.

Sensitive?:
Yes

Escalate When:
- User asks whether live payouts are enabled.
- User asks whether a real store/order/payout is production-ready.
- User asks for production launch guarantees.

Source of Truth:
`PROJECT_STATUS.md`, `INFRASTRUCTURE_DECISION_RULES.md`

Last Reviewed:
2026-05-18

## Security Reminder / Do Not Share Secrets

Intent:
User asks whether they should share credentials or sensitive information.

Approved Response:
PartnerLinks support will never ask for passwords, private keys, webhook secrets, API keys, recovery codes, or full payment card details. For account ownership help, share only the account email and Shopify `.myshopify.com` store domain if relevant.

Sensitive?:
Yes

Escalate When:
- User has already shared a secret.
- User reports suspected compromise.
- User asks how to rotate secrets or recover an account.

Source of Truth:
`SUPPORT_AGENT.md`, `INFRASTRUCTURE_DECISION_RULES.md`, `SUPPORT_AGENT_TRAINING_LOG.md`

Last Reviewed:
2026-05-18

## Support Escalation Path

Intent:
User needs human/admin support or asks for escalation.

Approved Response:
I can flag this for PartnerLinks support. Please share only the account email, creator code if relevant, and Shopify `.myshopify.com` store domain for brand issues. Do not share passwords, API keys, webhook secrets, private keys, recovery codes, or full payment card details.

Sensitive?:
Yes

Escalate When:
- Any sensitive financial, payout, ownership, dashboard, Shopify install, refund, reversal, security, suspicious activity, or live money movement issue is mentioned.

Source of Truth:
`SUPPORT_AGENT.md`, `SUPPORT_AGENT_TRAINING_LOG.md`

Last Reviewed:
2026-05-18

## Internal-Only: Brand B / Testing-Specific Issues

Intent:
Internal operator asks about Brand B or test-store-specific issues.

Approved Response:
Brand B and test-store details are internal operator context and should not be exposed in public support responses. Public support should discuss general Shopify store connection, referral link, dashboard access, and beta limitation patterns unless an authorized operator is reviewing a specific test.

Sensitive?:
Yes

Escalate When:
- User asks public support about Brand B, test orders, test creators, sandbox replay, internal routes, or diagnostic scripts.
- User asks for internal debugging details.

Source of Truth:
`PROJECT_STATUS.md`, `system-audit/OPERATIONAL_RUNBOOKS.md`, `INFRASTRUCTURE_DECISION_RULES.md`

Last Reviewed:
2026-05-18
