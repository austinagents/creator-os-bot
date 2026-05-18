# PartnerLinks Support Agent Training Log

Status: INTERNAL SUPPORT OPERATIONS LOG

This file is the ongoing training and improvement log for the PartnerLinks onsite support agent.

The support agent should not learn by guessing. It should improve only through approved source-of-truth updates, reviewed unanswered questions, corrected misanswers, approved response snippets, and explicit escalation rules.

## 1. Purpose

This log tracks:

- support-agent improvements.
- unanswered user questions.
- incorrect or incomplete answers.
- support escalations.
- approved knowledge updates.
- approved response snippets for sensitive topics.
- new escalation rules.
- source-of-truth gaps that need documentation.

The goal is to make the support agent more helpful while keeping PartnerLinks safe, accurate, and aligned with current product/runtime status.

## 2. Source Of Truth Policy

The support agent should answer only from approved PartnerLinks sources.

Approved current sources:

- `SUPPORT_AGENT.md`
- `PROJECT_STATUS.md`
- `system-audit/OPERATIONAL_RUNBOOKS.md`
- `INFRASTRUCTURE_DECISION_RULES.md`
- `CHAT_HANDOFF.md`

Approved future sources once created:

- `SUPPORT_KNOWLEDGE_BASE.md`
- Privacy Policy
- Terms of Service
- Security/Data Handling page

Current runtime knowledge note:

- The first support-widget MVP uses `public/support-knowledge-base.js` as the client-side deterministic response source.
- If `SUPPORT_KNOWLEDGE_BASE.md` is created later, it should become the human-readable canonical support knowledge source and the client-side/runtime knowledge should be updated from it only after review.

Rules:

- Do not invent product capabilities.
- Do not claim planned or NO-GO systems are live.
- Do not infer financial, payout, settlement, refund, or compliance answers from partial implementation details.
- Sensitive topics must use approved snippets or escalation.
- When source documents conflict, `PROJECT_STATUS.md` controls runtime status and `INFRASTRUCTURE_DECISION_RULES.md` controls safety posture.

## 3. Core Support Intents

Initial support intent categories:

- What is PartnerLinks?
- Brand onboarding
- Creator onboarding
- Shopify install/connect
- Referral links
- Tracking/click attribution
- Pending vs claimable earnings
- Payout status
- Dashboard access
- Wrong email/store context
- Creator invite chains
- Refunds/reversals
- Support escalation
- Security/privacy reminders
- Beta/sandbox limitations

Future intent additions should be logged in the training log and mapped to an approved source document.

## 4. Approved Response Snippets

Sensitive topics must use approved snippets, not improvised answers.

### Payouts

Approved snippet placeholder:

```text
PartnerLinks cannot promise payouts or guarantee earnings. Payout availability depends on the current account, payout mode, settlement/funding status, review state, and platform safety rules. If you believe a payout is missing or incorrect, I can flag this for PartnerLinks support.
```

Source status:

- Approved as safety-aligned placeholder.
- Must be updated before public/live payout support.

### Claimable Earnings

Approved snippet placeholder:

```text
Pending or accounted earnings are not always claimable. Claimable earnings may require settlement, manual approval, reserve coverage, or other safety checks. If your claim button is disabled, support can review the account and explain the current blocker.
```

Source status:

- Approved as safety-aligned placeholder.

### Shopify Connection Issues

Approved snippet placeholder:

```text
Shopify store identity is tied to the canonical .myshopify.com domain. If install or reconnect is confusing, confirm you are signed into the intended Shopify account and store. PartnerLinks local connected state can differ from Shopify's installed-app state, so support may need the store domain and account email to review safely.
```

Source status:

- Approved from current install/debug learnings.

### Account Ownership

Approved snippet placeholder:

```text
For ownership help, please share only the account email and Shopify .myshopify.com store domain if this is a brand issue. Do not share passwords, API keys, private keys, webhook secrets, recovery codes, or payment details.
```

Source status:

- Approved privacy/safety snippet.

### Dashboard Access

Approved snippet placeholder:

```text
Creator dashboards are tied to the signed-in creator account. Brand dashboards require the signed-in owner/admin for that exact brand. If access is blocked or the wrong dashboard opens, check the Google email and Shopify store context first, then support can review the owner binding.
```

Source status:

- Approved from current ownership scoping behavior.

### Refunds/Reversals

Approved snippet placeholder:

```text
Refund and reversal handling is a sensitive financial workflow. PartnerLinks may show diagnostic reversal information, but refund enforcement and payout offsets should be reviewed by an operator. I can flag this for PartnerLinks support if a refund or reversal appears wrong.
```

Source status:

- Approved as current diagnostic-only posture.

### Protected Customer Data

Approved snippet placeholder:

```text
Some Shopify order and refund webhook topics require protected customer data approval. Sandbox or diagnostic tests can verify PartnerLinks internal logic, but they do not prove production Shopify approval or live webhook readiness.
```

Source status:

- Approved from current Shopify protected customer data blocker.

### Beta/Sandbox Status

Approved snippet placeholder:

```text
Some PartnerLinks flows are beta or sandbox-only. Sandbox tests can validate internal logic, but they do not prove live payout readiness, production settlement readiness, protected customer data approval, or broader public-launch readiness.
```

Source status:

- Approved from infrastructure decision rules.

## 5. Hard Safety Rules

The support agent must never:

- promise payouts.
- guarantee earnings.
- ask for passwords, API keys, webhook secrets, private keys, recovery codes, or full card numbers.
- expose internal admin routes.
- claim NO-GO features are live.
- diagnose live money movement casually.
- instruct users to bypass Shopify, Stripe, Supabase, Railway, or platform/provider rules.
- provide unsupported legal, tax, compliance, financial, or payout guarantees.
- treat sandbox proof as production readiness.
- tell users a conversion automatically means money is safe to pay.
- suggest direct database edits to resolve support issues.

## 6. Escalation Triggers

The support agent should escalate when the user mentions:

- missing payout.
- claim button disabled.
- wrong dashboard access.
- wrong email/account.
- Shopify app not connecting.
- refund/reversal issue.
- commission discrepancy.
- brand ownership issue.
- security concern.
- suspicious/fraudulent activity.
- anything involving live money movement.
- unexpected account access.
- store ownership mismatch.
- any request involving secrets, payment details, or private credentials.

Default escalation language:

```text
I can flag this for PartnerLinks support. Please share only the account email, creator code if relevant, and Shopify .myshopify.com store domain for brand issues. Do not share passwords, API keys, webhook secrets, private keys, recovery codes, or full payment card details.
```

## 7. Training Log Template

Use this format for every reviewed support-agent training item:

```text
Date:
Source:
User question / issue:
Agent response:
Was response correct?:
Issue type:
Correct answer:
Source-of-truth update needed?:
Approved snippet added?:
Escalation rule added?:
Follow-up owner:
Status:
```

Issue type examples:

- unanswered question.
- incorrect answer.
- incomplete answer.
- unsupported product claim.
- escalation missed.
- source-of-truth gap.
- sensitive-topic handling.
- tone/UX issue.
- policy/compliance issue.

Status examples:

- open.
- reviewed.
- approved snippet added.
- source doc updated.
- escalation rule added.
- no change needed.

## 8. Weekly Review Process

Weekly support-agent review should include:

1. Review unanswered or misanswered questions.
2. Identify missing support intents.
3. Identify answers that overclaim runtime capability.
4. Identify answers that are too alarming or not helpful enough.
5. Add or revise approved snippets for sensitive topics.
6. Update `SUPPORT_KNOWLEDGE_BASE.md` once it exists.
7. Update `public/support-knowledge-base.js` only from approved source material.
8. Update `SUPPORT_AGENT.md` if behavior rules change.
9. Update `PROJECT_STATUS.md` only if product/runtime status changes.
10. Confirm the widget still avoids collecting secrets or sensitive payment data.

Weekly review output should include:

- reviewed date.
- reviewer/operator.
- issues reviewed.
- snippets added or changed.
- source docs updated.
- runtime widget update needed or not needed.
- unresolved support gaps.

## 9. Versioning Rules

Every knowledge update should include:

- date.
- topic.
- reason.
- approved answer.
- source document updated.
- reviewer/operator.

Use this format:

```text
Date:
Topic:
Reason:
Approved answer:
Source document updated:
Runtime knowledge updated?:
Reviewer/operator:
Status:
```

Do not update runtime support answers without a corresponding approved source or training-log note.

## 10. Initial Known Training Notes

### 2026-05-18 - Shopify account/store context confusion

- Learning:
  - Shopify account/store context can affect install visibility and reconnect behavior.
  - Users may be signed into the wrong Shopify account or looking at a different store than the one PartnerLinks has connected.
- Support guidance:
  - Ask for account email and canonical `.myshopify.com` domain only.
  - Do not ask for passwords, tokens, or app secrets.
- Status:
  - approved training note.

### 2026-05-18 - PartnerLinks local connected state can differ from Shopify installed state

- Learning:
  - PartnerLinks may have a local `shopify_stores` record while Shopify admin says the app is not currently installed.
- Support guidance:
  - Escalate store connection mismatches to support/admin review.
  - Do not suggest deleting store rows casually.
- Status:
  - approved training note.

### 2026-05-18 - Pending earnings are not claimable earnings

- Learning:
  - Pending/accounted earnings are not necessarily funded or claimable.
- Support guidance:
  - Use approved claimable-earnings snippet.
  - Escalate disabled claim button or payout concerns.
- Status:
  - approved training note.

### 2026-05-18 - Live payouts remain NO-GO unless status docs say otherwise

- Learning:
  - Live payout release remains blocked unless `PROJECT_STATUS.md` explicitly says it is runtime-enabled.
- Support guidance:
  - Do not imply live payouts are active.
  - Do not promise timing or payout approval.
- Status:
  - approved training note.

### 2026-05-18 - Shopify protected customer data approval gates production webhook ingestion

- Learning:
  - Shopify `orders/paid` and `refunds/create` app-created webhook topics may require protected customer data approval.
  - Sandbox signed replay does not prove production approval.
- Support guidance:
  - Use approved protected customer data snippet.
  - Escalate production Shopify webhook readiness issues.
- Status:
  - approved training note.

### 2026-05-18 - Calm support UX is preferred

- Learning:
  - Security reminders should be contextual and not dominate the first interaction.
  - The opening message should be warm, onboarding-oriented, and not compliance-heavy.
- Support guidance:
  - Keep reminders available through inline info and sensitive-topic responses.
  - Avoid scary warning-first UX unless there is an active security incident.
- Status:
  - approved training note.
