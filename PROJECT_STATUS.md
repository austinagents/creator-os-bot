# PartnerLinks / creator-os-bot Project Status

Last updated: 2026-05-19

This file is the current implementation snapshot for starting a new ChatGPT/Codex project chat with minimal context loss. Permanent product philosophy, UX guardrails, terminology, and long-term architecture rules live in `CHAT_HANDOFF.md`.

## 2026-05-19 Session Update

Status: SHOPIFY REVIEW READINESS / HANDOFF SNAPSHOT

- Shopify approval readiness is close to submission-ready. Remaining high-leverage work: record the app screencast, prepare reviewer instructions, confirm test credentials, polish screenshots/app listing copy, run final visual QA, and run support widget QA.
- Shopify minimum-necessary scope milestone is complete:
  - runtime Shopify OAuth scope is `read_orders`.
  - generated OAuth URL requests `read_orders`.
  - stored Shopify scopes are `["read_orders"]`.
  - live Shopify scopes were verified as `["read_orders"]` for Brand 10 and Brand 11.
  - `read_customers` is not present in stored or live scopes.
  - verification used the dedicated `scripts/shopifyWebhookOperator.js --scope-check` mode.
  - scope verification did not mutate webhooks or financial state.
- Shopify OAuth/install/uninstall/reconnect status:
  - Shopify install/OAuth works.
  - uninstall/reinstall/reconnect flows have been tested repeatedly.
  - Brand 10 and Brand 11 live scope checks passed after fresh reconnect.
  - invalid, uninstalled, or stale Shopify connection states now route to owner-scoped reconnect before brand dashboard/setup continues.
- Public Shopify-review wording cleanup is substantially complete:
  - public pages and support KB were cleaned to reduce MLM/recruitment/network-income-adjacent wording.
  - wording such as creator network participation, network rewards, downstream, and recruitment-only rewards platform was softened.
  - privacy wording was tightened around `limited order-associated metadata available through Shopify order records`.
  - support widget KB was cleaned so review probes should stay order/referral/brand-program focused.
- Branding and polish:
  - favicon integration was added/updated across public HTML pages using `/favicon.png`.
  - favicon now uses cleaner PartnerLinks branding.
  - homepage/demo wording was cleaned for Shopify reviewer trust posture.
- Current identity/auth consideration:
  - MVP currently allows creator and brand capabilities to coexist.
  - current concern: identity fragmentation when brand-first users later sign in with Google, or creator-first users later register a brand.
  - preferred MVP direction is to preserve low-friction onboarding while adding identity-linking logic so the same human/user can hold both creator and brand capabilities without duplicate unrelated identities.
  - do not force Google OAuth immediately after Shopify OAuth unless explicitly decided later.
  - future sensitive settings may use Google re-auth or email OTP step-up verification.
- Future commission/security idea:
  - possible Brand Dashboard Settings feature: commission percent change modal.
  - sensitive commission changes should require step-up verification.
  - likely guardrail: normal self-service range below 30%; elevated/manual review above higher thresholds; 50%+ requires PartnerLinks approval.
  - not implemented yet.
- Railway operational note:
  - Railway dashboard/routing showed a transient Not Found / "train has not arrived" issue.
  - no deploy had occurred for roughly 16 hours when observed.
  - production later recovered/appeared reachable.
  - treat this as an infrastructure observation, not a confirmed app code crash.
  - add uptime/health monitoring to the ops backlog.
- Recommended next work:
  - record Shopify screencast.
  - prepare reviewer instructions with exact flow, test accounts, reconnect URLs, and concise `read_orders` explanation.
  - run final public visual QA.
  - run support widget QA.
  - prepare app listing screenshots/copy.
  - submit after those items are complete.

## Required Infrastructure Decision Rules

Status: REQUIRED OPERATING STANDARD

Root-level rules document:

```text
INFRASTRUCTURE_DECISION_RULES.md
```

Required usage:

- Read before every major implementation or debugging pass.
- Re-read at least every third response during long debugging sessions.
- Use it to force provider/platform verification before changing app code.
- Explicitly distinguish runtime-enforced behavior, read-only diagnostics, documentation-only architecture, planned work, manual operator tasks, and blocked/NO-GO items.

The core standard is Shopify/Stripe/affiliate-infrastructure discipline:

- deterministic
- auditable
- scoped
- fail-closed
- idempotent
- provider-compliant
- operationally safe

## Strategic Positioning Source Of Truth

Status: INTERNAL STRATEGY / DOCUMENTATION ONLY

Root-level strategy memo:

```text
GO_TO_MARKET_STRATEGY.md
```

Current strategic positioning:

- PartnerLinks should not position itself as another generic affiliate app.
- PartnerLinks should position itself as creator network infrastructure and creator-led growth infrastructure.
- The core differentiator is optimizing creator-to-creator network expansion, not only brand-to-creator acquisition.
- GTM language must avoid recruitment-style framing and should use creator network, creator expansion, creator-led growth, referral infrastructure, creator participation, network propagation, and creator ecosystem.
- Time-to-first-referral-link is a critical activation metric with a target of under 60 seconds.

Strategic safety boundary:

- Strategy docs do not change runtime behavior.
- No payout, Stripe, settlement, claim, reserve, refund, earnings math, Shopify webhook, or financial state behavior is changed by this document.

## Status Classification Warning

Documented architecture is not automatically runtime-enforced. Treat all financial safety claims as runtime-enforced only when explicitly marked `RUNTIME-ENFORCED`.

Use these labels throughout PartnerLinks docs:

- `RUNTIME-ENFORCED`: implemented in app code, database schema, route checks, service logic, or webhook processing today.
- `READ-ONLY DIAGNOSTIC`: visible through scripts, debug routes, logs, or reports, but does not mutate or enforce money state.
- `DOCUMENTED ARCHITECTURE ONLY`: accepted design direction, but not runtime behavior by itself.
- `PLANNED / NOT IMPLEMENTED`: planned future work with no current runtime behavior.
- `MANUAL OPERATOR TASK`: requires Austin/operator action in Shopify, Stripe, Railway, Supabase, or production testing.
- `BLOCKED / NO-GO`: not safe to run for live money or public launch.
- `SAFE FOR CONTROLLED BETA`: safe only within the explicitly stated beta boundary.
- `UNSAFE FOR LIVE PAYOUTS`: must not be used to release live creator payouts.

## Current Classification Snapshot

`RUNTIME-ENFORCED`:

- deterministic Shopify `partnerlinks_ref` attribution before fallback.
- Shopify `orders/paid` HMAC verification.
- duplicate conversion prevention for Shopify order ids.
- creator-origin lineage through `parent_creator_id`.
- brand-origin onboarding lineage through `invited_by_brand_id`.
- creator/brand lineage dual-binding guard for normal invite binding.
- Level 1/2/3 creator network economics from `platform_fee_amount`.
- hard stop after Level 3 in current creator network economics.
- payout mode guard on `/earnings/claim`.
- Stripe/claim routes use explicit creator scoping and ownership checks.
- `financial_reversal_events` and `financial_reversal_items` tables exist after migration 016.

`READ-ONLY DIAGNOSTIC`:

- Discord `/shopify_attribution_debug`.
- `shopify_attribution_events`.
- `scripts/productionSafetyTest.js` reports:
  - `--order-report`
  - `--actor-matrix`
  - `--lineage-report`
  - `--economic-report`
  - `--refund-report`
  - `--settlement-report`
  - `--risk-report`
  - `--route-risk-report`

`DOCUMENTED ARCHITECTURE ONLY` / `PLANNED / NOT IMPLEMENTED`:

- settlement collection.
- settlement-aware live claimability.
- automatic brand charging.
- refund/chargeback enforcement.
- payout clawbacks.
- negative balance offsets.
- synthetic-commerce scoring and risk holds.
- threat intelligence scanning.
- live creator payout release.
- brand-origin network economics end-to-end validation at live scale.

`MANUAL OPERATOR TASK`:

- confirm production `PAYOUT_MODE=claims_disabled`.
- confirm Railway/Shopify/Stripe/Supabase env and webhook settings.
- place controlled real Shopify test orders.
- reconcile first beta orders manually with read-only reports.
- approve any future payout, settlement, refund, or brand-billing changes.

`BLOCKED / NO-GO`:

- live creator payouts.
- live settlement automation.
- automatic refund enforcement.
- automatic negative-balance collection.
- live Stripe transfers.

## Current Live State

- Production app is deployed on Railway.
- GitHub repo is connected: `https://github.com/austinagents/creator-os-bot.git`.
- Railway redeploys from GitHub pushes.
- Express listens on `process.env.PORT || 3000` and binds to `0.0.0.0`, so Railway public URL works.
- Supabase is connected and used for app data, auth-related creator binding, tracking, conversions, Shopify stores, and payout ledger tables.
- Discord bot starts successfully, logs in, and registers slash commands on startup.
- Homepage V1 is live and styled with the current dark PartnerLinks SaaS visual system.
- Creator Google signup through Supabase Auth works.
- Returning creators are restored through server-set httpOnly access/refresh token cookies with a 30-day max age.
- Shopify OAuth install works end-to-end in production.
- Shopify paid-order webhook ingestion is implemented and has produced a successful production Bogus Gateway test conversion with diagnostics visibility.
- Stripe Connect Express payout onboarding is implemented in sandbox/test mode.
- Claim Earnings can create Stripe test-mode transfers when claimable earnings exist and creator Stripe payouts are enabled.

## Current Working Systems

### Public Site And Navigation

- Homepage route `/` works.
- Homepage includes:
  - creator/brand hero positioning
  - creator invite CTA/sign-in-aware invite panel
  - 3-tier commission structure visual
  - `Featured Brands` mock discovery section
  - state-aware creator/brand navigation
- Signed-in creators see their creator code and invite link on the homepage instead of the public Google signup CTA.
- `For Creators -> Creator Dashboard` routes signed-in creators to `/dashboard/:creator_code`.
- Signed-out users are routed to the safe dashboard sign-in state.
- Brand nav is lightweight state-aware:
  - unconnected visitors see `Register Your Business`
  - connected brands can see `Brand Dashboard`
  - invalid/missing brand state falls back to `/register-business`

### Creator Auth And Onboarding

- Supabase Google OAuth starts through `/auth/google/start` and `/auth/google/start/`.
- OAuth callback route `/auth/callback` exchanges the code for a session.
- Server stores auth access/refresh tokens in httpOnly cookies.
- Web signup can create or find a creator by `auth_user_id` or email.
- Web signup can bind `parent_creator_id` from invite session when available.
- Discord `/start` still cannot reliably read browser cookies, so permanent creator invite binding should happen through web signup.
- Creator invite links:
  - `/join/:creatorCode`
  - `/join/brand/:brandSlug`
- Brand-origin onboarding links are active onboarding lineage links, not product attribution links:
  - canonical format: `/join/brand/:brandSlug`
  - example: `https://partnerlinks.app/join/brand/partnerlinks-test-myshopify-com`
  - link visits create a brand invite-session audit row when migration `015_brand_invite_sessions.sql` has been run.
  - `creators.invited_by_brand_id` is only set after successful Google auth/signup.
  - onboarding links do not create clicks, conversions, product attribution, or payout rows.
- Returning signed-in creators who open invite/referral entry routes can be redirected back to their dashboard instead of being forced to sign up again.

### Discord Bot

Creator-facing commands:

- `/start`
- `/link`
- `/stats`
- `/tracking_stats`
- `/network_stats`

Admin/operator commands:

- `/brand_setup`
- `/record_conversion`
- `/sales_dashboard`
- `/creator_leaderboard`
- `/creator_dashboard`
- `/shopify_attribution_debug`

Current Discord behavior:

- Slash command registration refreshes on startup.
- `/record_conversion` finds creators by exact lowercase `creator_code` or `referral_code`.
- `/record_conversion` supports Google/web-created creators with no `discord_user_id`.
- `/record_conversion` does not require creator lookup to match `brand_id`.
- `/record_conversion` accepts optional numeric `platform_fee_amount`.
- Creator-network earnings are only created when `platform_fee_amount > 0`.
- `/shopify_attribution_debug` shows recent Shopify webhook attribution decisions from `shopify_attribution_events`.
- Discord replies use the safe reply flow to avoid duplicate interaction acknowledgements.

### Brand Onboarding

- Shopify-first brand onboarding is implemented.
- `/register-business` shows Shopify store input and Connect Shopify CTA.
- `/api/shopify/start` validates the shop domain, creates state, and redirects to Shopify OAuth.
- `/api/shopify/callback` validates HMAC/state, exchanges the code for an access token, stores the Shopify store, creates/reuses a brand, links `shopify_stores.brand_id`, and redirects into setup.
- `/brand/setup/:brandId` lets brands set:
  - display brand name
  - destination URL
  - creator commission percentage
- `platform_fee_rate` remains internal and defaults to 5% server-side.
- Brand setup success shows:
  - connected Shopify store
  - brand name
  - creator commission percentage
  - creator onboarding link
  - next step to invite creators
- Brand Dashboard MVP exists at:
  - `/brand-dashboard`
  - `/brand-dashboard/:brandSlug`
- Brand Dashboard links section now shows the active creator onboarding/share URL for the brand instead of a placeholder tracking-link preview.

### Creator Dashboard

- Creator Dashboard MVP exists at:
  - `/dashboard`
  - `/dashboard/:creatorCode`
- `/dashboard` resolves the current persisted Supabase auth user to their canonical creator dashboard when available.
- Dashboard shows current creator/referral/earnings state:
  - display name
  - creator code
  - invite link
  - direct referrals
  - second-level referrals
  - third-level referrals
  - total conversions
  - total order value
  - direct commission
  - network earnings
  - pending earnings
  - claimable earnings
  - claimed earnings
  - lifetime earnings
  - Stripe payout status
  - payout history
- Dashboard UI is dark, premium, responsive, and aligned with the Brand Dashboard visual system.

## Current Routes

Public and discovery:

- `GET /`
- `GET /signup`
- `GET /creator/welcome`
- `GET /brands/:brandSlug`

Creator invite/referral:

- `GET /join/:creatorCode`
- `GET /join/brand/:brandSlug`
- `GET /r/:brandSlug/:creatorCode`
- `GET /r/:brandSlug/:creatorCode/:productSlug`

Creator dashboard and payout:

- `GET /dashboard`
- `GET /dashboard/:creatorCode`
- `POST /earnings/claim`
- `GET /stripe/connect/start`
- `GET /stripe/connect/debug`
- `GET /stripe/connect/refresh`
- `GET /stripe/connect/return`

Auth:

- `GET /auth/google/start`
- `GET /auth/google/start/`
- `GET /auth/callback`
- `GET /auth/google`

Brand and Shopify:

- `GET /register-business`
- `GET /api/shopify/start`
- `GET /api/shopify/callback`
- `GET /brand/setup/:brandId`
- `POST /brand/setup/:brandId`
- `GET /brand-dashboard`
- `GET /brand-dashboard/:brandSlug`

Webhooks:

- `POST /webhooks/shopify/orders-paid`

Static/runtime:

- `GET /styles.css` with no-store headers for production CSS freshness.

## Current Database Tables

Core:

- `brands`
- `creators`
- `submissions`

Tracking and attribution:

- `clicks`
- `attribution_sessions`
- `conversions`
- `creator_invite_sessions`
- `brand_invite_sessions`

Network earnings:

- `creator_network_earnings`
- `brand_network_earnings`

Shopify:

- `shopify_stores`
- `shopify_attribution_events`

Payout ledger:

- `creator_earning_claims`

Important current fields:

- `creators.creator_code`
- `creators.referral_code`
- `creators.parent_creator_id`
- `creators.invited_by_brand_id`
- `creators.join_referral_link`
- `creators.auth_user_id`
- `creators.email`
- `creators.stripe_account_id`
- `creators.stripe_onboarding_status`
- `brands.destination_url`
- `brands.creator_commission_rate`
- `brands.platform_fee_rate`
- `brands.setup_completed_at`
- `shopify_stores.brand_id`
- `shopify_stores.shop_domain`
- `shopify_stores.access_token`
- `shopify_attribution_events.order_id`
- `shopify_attribution_events.partnerlinks_ref`
- `shopify_attribution_events.attribution_source`
- `shopify_attribution_events.attribution_confidence`
- `shopify_attribution_events.fallback_used`
- `shopify_attribution_events.decision`
- `shopify_attribution_events.unmatched_reason`
- `clicks.creator_code`
- `clicks.referral_code`
- `clicks.brand_slug`
- `clicks.product_slug`
- `clicks.shop_domain`
- `clicks.partnerlinks_ref`
- `brand_invite_sessions.inviting_brand_id`
- `brand_invite_sessions.session_id`
- `brand_invite_sessions.invite_code`
- `brand_invite_sessions.resulting_creator_id`
- `brand_invite_sessions.bound_at`
- `conversions.platform_fee_amount`
- `conversions.payout_status`
- `conversions.claimable_at`
- `conversions.claimed_at`
- `conversions.claim_batch_id`
- `creator_network_earnings.payout_status`
- `creator_network_earnings.claimable_at`
- `creator_network_earnings.claimed_at`
- `creator_network_earnings.claim_batch_id`
- `brand_network_earnings.payout_status`
- `brand_network_earnings.claimable_at`
- `creator_earning_claims.claim_batch_id`
- `creator_earning_claims.stripe_transfer_id`
- `creator_earning_claims.stripe_transfer_status`
- `creator_earning_claims.stripe_transfer_created_at`

## Current Migrations

Manual SQL migration files currently present:

- `database/migrations/001_tracking_tables.sql`
- `database/migrations/002_conversions_table.sql`
- `database/migrations/003_creator_network.sql`
- `database/migrations/004_web_auth_creators.sql`
- `database/migrations/005_shopify_stores.sql`
- `database/migrations/006_brand_setup_fields.sql`
- `database/migrations/007_brand_origin_network.sql`
- `database/migrations/008_normalize_referral_codes.sql`
- `database/migrations/009_stripe_connect_creators.sql`
- `database/migrations/010_earnings_lifecycle.sql`
- `database/migrations/011_claim_earnings_ledger.sql`
- `database/migrations/012_claim_stripe_transfer_fields.sql`
- `database/migrations/013_click_product_attribution.sql`
- `database/migrations/014_shopify_attribution_events.sql`
- `database/migrations/015_brand_invite_sessions.sql`

Migration policy:

- There is no automated migration runner.
- Do not execute SQL automatically unless explicitly requested.
- Add migration files and paste the exact SQL for manual Supabase SQL Editor execution.
- `013_click_product_attribution.sql` adds product/shop/ref metadata columns to `clicks` so Shopify webhook fallback attribution can recover stripped checkout attribution.
- `014_shopify_attribution_events.sql` adds an internal Shopify attribution diagnostics ledger for webhook decisions, duplicate skips, unmatched reasons, fallback usage, click ids, and attribution confidence.
- `015_brand_invite_sessions.sql` adds an internal brand-origin onboarding audit ledger for brand invite clicks and post-auth creator binding.

## Shopify Attribution And Webhook State

Current Shopify app setup:

- App name: PartnerLinks.
- App URL: `https://partnerlinks.app`.
- Redirect URL: `https://partnerlinks.app/api/shopify/callback`.
- Scopes: `read_orders`, `read_customers`.

Current Shopify OAuth flow:

1. Brand visits `/register-business`.
2. Brand enters Shopify store domain.
3. PartnerLinks redirects to Shopify OAuth.
4. Shopify redirects to `/api/shopify/callback`.
5. PartnerLinks validates callback HMAC/state.
6. PartnerLinks exchanges code for access token.
7. PartnerLinks stores `shop_domain` and `access_token` in `shopify_stores`.
8. PartnerLinks creates/reuses a brand and links `shopify_stores.brand_id`.
9. PartnerLinks redirects to `/brand/setup/:brandId`.

Current product attribution flow:

1. Creator/customer opens `/r/:brandSlug/:creatorCode/:productSlug`.
2. PartnerLinks normalizes route params.
3. PartnerLinks resolves brand and creator.
4. For Aria Wellness, public slug `aria-wellness` maps to `partnerlinks-test.myshopify.com`.
5. PartnerLinks creates/reuses `partnerlinks_sid`.
6. PartnerLinks records a `clicks` row with creator, brand, product, shop, destination, and `partnerlinks_ref` metadata.
7. PartnerLinks upserts `attribution_sessions`.
8. For Shopify-backed products with a configured `shopifyVariantId`, PartnerLinks redirects to a Shopify cart permalink that includes cart/order attributes:
   - `attributes[partnerlinks_ref]`
   - `attributes[creator_code]`
   - `attributes[brand_slug]`
   - `attributes[product_slug]`
   - `ref`
9. If no `shopifyVariantId` is configured, PartnerLinks falls back to the live Shopify storefront product URL with query params:
   - `creator_code`
   - `partnerlinks_ref`
   - `brand_slug`
   - `product_slug`
10. Shopify checkout completes.
11. Shopify `orders/paid` webhook posts to `/webhooks/shopify/orders-paid`.
12. Webhook verifies HMAC using `SHOPIFY_WEBHOOK_SECRET`.
13. Webhook resolves `shopify_stores.shop_domain -> brand_id`.
14. Webhook prevents duplicate conversion by `shopify:{shop_domain}:{order_id}`.
15. Webhook resolves attribution through a deterministic ranked resolver.
16. Webhook writes an internal attribution diagnostic event when the diagnostics table exists.
17. Webhook creates conversion and earnings rows when attribution resolves cleanly.

Current webhook attribution resolution order:

1. explicit `partnerlinks_ref` exact click/session recovery
2. exact `referral_code` / `creator_code`
3. explicit Shopify `note_attributes`
4. explicit `landing_site` params
5. explicit `source_url` params
6. deterministic `attribution_sessions` lookup by `partnerlinks_ref`
7. strict recent-click fallback
8. unmatched attribution

Current webhook attribution diagnostics:

- Stored in `shopify_attribution_events` after migration `014_shopify_attribution_events.sql` is run.
- Logged even if the diagnostics table is not available yet.
- Tracks:
  - `order_id`
  - `shopify_order_id`
  - `shop_domain`
  - `brand_id`
  - matched creator id/code
  - matched product slug
  - `partnerlinks_ref`
  - attribution source
  - attribution confidence
  - fallback usage
  - recent click id
  - click/session id
  - time delta from click
  - decision/result
  - unmatched reason
  - duplicate order status

Current attribution confidence values:

- `exact`
- `high`
- `medium`
- `low`
- `none`

Recent-click fallback is now intentionally low confidence:

- It is used only after explicit attribution and deterministic session lookup fail.
- It uses a tighter attribution window.
- It prefers same `shop_domain`, same `product_slug` when available, same creator when available, and closest reasonable click timing.
- If the recent-click set is ambiguous, the webhook logs/skips attribution and returns `200` instead of guessing.

Current Aria Wellness test flow:

- Brand/store page: `/brands/aria-wellness`
- First product: `Test Product`
- Product card uses the universal product card layout.
- Product referral link format:
  - `partnerlinks.app/r/aria-wellness/:creatorCode/test-product`
- Internal Shopify-backed product metadata now supports:
  - `shopifyProductUrl`
  - `shopifyVariantId`
- The Test Product variant id is read from `ARIA_WELLNESS_TEST_PRODUCT_VARIANT_ID`.
- When `ARIA_WELLNESS_TEST_PRODUCT_VARIANT_ID` is configured, `/r/aria-wellness/:creatorCode/test-product` redirects to a Shopify cart permalink:
  - `https://partnerlinks-test.myshopify.com/cart/{variantId}:1?attributes[partnerlinks_ref]={partnerlinks_ref}&attributes[creator_code]={creator_code}&attributes[brand_slug]=aria-wellness&attributes[product_slug]=test-product&ref={partnerlinks_ref}`
- This is intended to persist attribution into Shopify cart/order attributes so the webhook can resolve through exact `partnerlinks_ref`/`note_attributes` before recent-click fallback.
- Test creator used in production test:
  - `austin-taylor`
- Live Shopify product URL:
  - `https://partnerlinks-test.myshopify.com/products/test-product`
- Shopify preview URLs are no longer used for checkout testing.
- Strict recent-click fallback remains unchanged and still skips ambiguous orders instead of guessing.

Current confirmed Shopify/Bogus Gateway test result:

- A product referral route was opened for:
  - `/r/aria-wellness/austin-taylor/test-product`
- The route recorded click/session attribution.
- Shopify order webhook received the paid order.
- Webhook resolved:
  - `shopDomain = partnerlinks-test.myshopify.com`
  - connected brand id from `shopify_stores.brand_id`
- Webhook recovered attribution through recent click fallback.
- Webhook created a conversion with order id format:
  - `shopify:partnerlinks-test.myshopify.com:{order_id}`
- Conversion was attributed to creator:
  - `austin-taylor`
- Direct creator commission was created.
- Creator/network earnings were created from `platform_fee_amount`.
- Shopify attribution hardening is working in production.
- `shopify_attribution_events` inserts successfully.
- `/shopify_attribution_debug` retrieves attribution decisions.
- Confirmed diagnostic decision:
  - order: `shopify:partnerlinks-test.myshopify.com:6548591673518`
  - decision: `conversion_created`
  - source: `recent_click_fallback`
  - confidence: `low`
  - fallback: yes, click `14`
  - click delta: `33s`
  - conversion: `18`
- Full confirmed flow:
  - referral click -> Shopify checkout -> `orders/paid` webhook -> attribution recovery -> conversion -> creator commission -> network earnings -> diagnostics visibility.

Latest deterministic cart-attribute attribution validation:

- Test referral route:
  - `/r/aria-wellness/test-creator-04/test-product`
- Confirmed order:
  - `shopify:partnerlinks-test.myshopify.com:6548682670254`
- Diagnostic event:
  - `shopify_attribution_events.id = 7`
  - `decision = conversion_created`
  - `attribution_source = partnerlinks_ref`
  - `attribution_confidence = exact`
  - `fallback_used = false`
  - `matched_creator_code = test-creator-04`
  - `matched_product_slug = test-product`
  - `click_id = 24`
  - `conversion_id = 19`
  - `time_delta_from_click_seconds = 34`
- Checked sources included:
  - `note_attributes.brand_slug`
  - `note_attributes.creator_code`
  - `note_attributes.partnerlinks_ref`
  - `note_attributes.product_slug`
- Economics validation:
  - conversion order value: `18`
  - direct creator commission: `2.70`
  - `platform_fee_amount = 0.90`
  - Level 1 earning for `test-creator-03`: `0.27`
  - Level 2 earning for `test-creator-02`: `0.03`
  - Level 3 earning for `test-creator-01`: `0.02`
  - no Level 4+ creator-network earnings were created.
- This confirms:
  - cart/order attributes now preserve deterministic `partnerlinks_ref`
  - exact attribution wins before fallback
  - Level 1/2/3 economics remain correct
  - strict fallback remains unchanged.

Current webhook behavior:

- Returns `200` for unmatched attribution so Shopify does not retry forever.
- Returns `200` for invalid creator attribution after logging clearly.
- Skips duplicate orders.
- Records duplicate/unmatched/created attribution decisions in `shopify_attribution_events` when migration `014` exists.
- Diagnostics insert path now logs insert attempts, successes, Supabase error codes/messages/details/hints, and normalized payload identifiers.
- `/shopify_attribution_debug` now logs query filters, Supabase query errors, row counts, and a compact preview of returned rows to help distinguish insert failures from retrieval filter mismatches.
- Leaves manual `/record_conversion` as the operational fallback.

## Stripe Connect And Claim Lifecycle State

Current Stripe scope:

- Stripe Connect Express onboarding is implemented in sandbox/test mode.
- Test-mode Stripe transfers are implemented through Claim Earnings.
- Live payouts remain intentionally blocked.
- PartnerLinks does not custody creator campaign earnings.

Current Stripe routes:

- `/stripe/connect/start?creator_code=:creatorCode`
- `/stripe/connect/refresh?creator_code=:creatorCode`
- `/stripe/connect/return?creator_code=:creatorCode`
- `/stripe/connect/debug`
- `/earnings/claim`

Current payout routing safety rule:

- Sensitive payout actions must be scoped to the active dashboard creator.
- Creator Dashboard Stripe CTA now sends:
  - `/stripe/connect/start?creator_code=<active_dashboard_creator_code>`
- Stripe refresh/return URLs preserve the same `creator_code` context.
- Claim form includes hidden `creator_code`.
- Server-side Stripe/claim routes verify:
  - signed-in Supabase auth user exists
  - requested creator exists by exact creator/referral code
  - requested creator `auth_user_id` matches signed-in auth user id
  - action proceeds only for that scoped creator
- Routes must never silently fall back to the newest/default creator row when an explicit `creator_code` is provided.

Payout routing bug discovered and patched:

- Bug:
  - `/dashboard/test-creator-04` displayed `test-creator-04`, but Stripe onboarding could start for `frostclips`.
- Root cause:
  - Stripe CTA linked to global `/stripe/connect/start`.
  - `/stripe/connect/start` used `getSignedInCreator()`.
  - `getSignedInCreator()` resolves creator by auth user via `getCreatorByAuthUserId()`.
  - `getCreatorByAuthUserId()` returns the newest creator row for that auth user.
  - The same auth user owned both `frostclips` and `test-creator-04`, so payout routing selected `frostclips`.
- Patch:
  - Payout routes now use explicit dashboard creator context and ownership verification.
  - Stripe account links now include creator-scoped refresh/return URLs.
  - Claim route now claims only the requested owned creator.
- Follow-up owner button bug:
  - Claim button on `/dashboard/test-creator-04` remained disabled even after Stripe status and claimable earnings were correct.
  - Root cause was the dashboard `ownerCanClaim` render check still using `getSignedInCreator()`, which returned the newest/default creator row (`frostclips`) for the auth user.
  - Patch changed `/dashboard/:creatorCode` ownership rendering to compare signed-in `authUser.id` directly against the active `dashboard.creator.auth_user_id`.
  - The server-rendered Claim button should now enable for the active dashboard creator when the signed-in auth user owns that exact creator.
- Principle reinforced:
  - payout/auth/attribution systems should use explicit resource scoping, ownership checks, deterministic routing, idempotent financial operations, exact-match resolution, and safe failure over ambiguous execution.

Current onboarding states:

- not connected
- finish setup
- Stripe connected
- payouts enabled

Current payout lifecycle:

- New direct commissions and creator-network earnings start as `pending`.
- Pending earnings become `claimable` after the configured claim window.
- Claimable earnings can be claimed when the signed-in creator has Stripe payouts enabled.
- Claimed earnings appear in payout history.
- Lifetime earnings remain unchanged by claiming.

Claim flow:

1. Signed-in creator clicks Claim Earnings.
2. Claim form submits the active dashboard creator code.
3. Server verifies signed-in auth user owns the requested creator.
4. Server requires `stripe_onboarding_status = payouts_enabled`.
5. Server requires creator `stripe_account_id`.
6. Server requires `STRIPE_SECRET_KEY` beginning with `sk_test_`.
7. Server reserves claimable rows with `claim_batch_id`.
8. Server creates a claim row in `creator_earning_claims`.
9. Server creates a Stripe test transfer using claim batch id as idempotency key.
10. Server stores:
   - `stripe_transfer_id`
   - `stripe_transfer_status`
   - `stripe_transfer_created_at`
11. Server marks reserved earnings rows as `claimed`.
12. Dashboard shows payout history.

Claim idempotency/recovery state:

- If Stripe transfer creation fails, reservations are cleared and earnings remain claimable.
- If Stripe transfer succeeds but DB finalization fails, retries recover the reserved batch/claim row instead of intentionally creating duplicate transfers.
- Preserve this idempotency and recovery logic during payout changes.

## UI Systems

Current frontend style:

- Server-rendered Express HTML plus `public/styles.css`.
- Homepage, Creator Dashboard, Brand Dashboard, brand pages, onboarding, and auth pages share the dark PartnerLinks SaaS aesthetic.
- `/styles.css` is served with no-store headers to reduce Railway/browser stale CSS issues.

Homepage:

- Current hero copy and visual direction are live.
- Homepage hero includes the 3-tier commission structure visual.
- Homepage includes mock `Featured Brands`.
- Featured Brands is UI-only and does not yet query real campaigns/brands.

Creator Dashboard:

- Dark premium dashboard with sidebar, KPI cards, invite link, earnings cards, payout module, claim CTA, and payout history.
- Mobile overflow issues were addressed with responsive dashboard CSS.

Brand Dashboard:

- Reuses Creator Dashboard visual system.
- Shows brand-level metrics, tracking preview, recent conversions/top creators-style panels, and program summaries.

Brand/product pages:

- `/brands/:brandSlug` shows brand detail and product grid.
- Brand-wide explainer:
  - `Earn from any purchase across the brand's store`
- Product section explainer:
  - `Promote a specific featured product`
- Product grid:
  - desktop: 4 columns
  - tablet: 2 columns
  - mobile: 1 column

Universal product card layout:

1. image/placeholder area
2. product title
3. short description
4. creator commission line
5. referral URL pill
6. Copy Link button

Current product card rule:

- All products use the same card layout regardless of source.
- Shopify-backed products must not show special Shopify/test badges, price rows, or metadata rows unless the same visible row exists for every product.
- Copy Link CTA is universal and copies the PartnerLinks referral URL.

## Current Service/File Responsibilities

`index.js`

- Express app setup.
- Public/server-rendered routes.
- Auth/session route handling.
- Dashboard rendering.
- Referral/product forwarding routes.
- Shopify OAuth entry/callback routes.
- Webhook route mounting.
- Earnings claim route wiring.

`services/authService.js`

- Supabase auth session cookies.
- Current auth user resolution.
- Login/logout cookie helpers.
- Persisted creator session restoration.

`services/trackingService.js`

- Click/session tracking.
- Referral click persistence.
- `attribution_sessions` creation/upsert.
- Product referral metadata persistence.

`services/shopifyWebhookService.js`

- Shopify `orders/paid` webhook HMAC verification.
- Shopify order parsing.
- Deterministic attribution recovery.
- Canonical `partnerlinks_ref` recovery.
- Low-confidence recent click fallback attribution.
- Attribution diagnostics ledger writing.
- Duplicate order prevention.
- Conversion creation handoff.

`services/creatorNetworkService.js`

- Creator referral tree logic.
- `parent_creator_id` relationships.
- Creator network earnings calculations.
- Level 1/2/3 payout logic.

`services/earningsLifecycleService.js`

- Pending/claimable/claimed earnings lifecycle.
- `claimable_at` handling.
- Claim reservations.
- `creator_earning_claims` ledger writing.
- Stripe transfer finalization handoff.
- Duplicate claim prevention.

`services/stripeConnectService.js`

- Stripe Connect Express account creation/reuse.
- Hosted onboarding account links.
- Stripe account status refresh.
- Sandbox transfer creation.
- Transfer idempotency/recovery support.

`services/creatorDashboardService.js`

- Creator Dashboard data aggregation.
- Referral counts.
- Conversion totals.
- Earnings totals.
- Stripe payout status.
- Payout history retrieval.

`services/brandDashboardService.js`

- Brand Dashboard data aggregation.
- Brand-level metrics.
- Creator/conversion summaries.
- Dashboard fallback state.

`commands/handlers.js`

- Discord slash command handling.
- Manual conversion fallback.
- Admin/operator shortcuts.
- Creator dashboard link command.

`commands/registerCommands.js`

- Discord slash command definitions/registration.

`public/styles.css`

- Global PartnerLinks visual system.
- Homepage styling.
- Dashboard styling.
- Brand/product page styling.
- Universal product card layout rules.

`database/migrations/`

- Manual Supabase migration files.
- SQL must be run manually by the user in Supabase SQL Editor.
- No automatic migration runner currently exists.

`scripts/productionSafetyTest.js`

- Test-only Node diagnostic script for production-safety validation.
- Default behavior is dry-run/read-only.
- The only write mode is `--seed-test-creators`.
- Seeding is restricted to the fixed `test-creator-01` through `test-creator-10` namespace.
- Refuses `--creator-code` outside the allowed test creator list.
- Does not delete rows.
- Does not touch attribution resolution, webhook logic, payout logic, UI, or routes.
- Reports test creator graph, clicks, attribution sessions, conversions, network earnings, brand network earnings, Shopify attribution events, and expected vs actual Level 1/2/3 economics for a provided order id.

## Environment Variables

Core/Discord:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `ADMIN_DASHBOARD_CHANNEL_ID`
- `CREATOR_LOG_CHANNEL_ID`
- `SUBMISSIONS_LOG_CHANNEL_ID`
- `BOT_ALERTS_CHANNEL_ID`
- `DEFAULT_REF_TEMPLATE`
- `EXPORTS_DIR`
- `LOG_LEVEL`

Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Public/runtime:

- `NODE_ENV`
- `PORT`
- `PUBLIC_BASE_URL`

Shopify:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_WEBHOOK_SECRET`
- `SHOPIFY_SCOPES`
- `SHOPIFY_APP_URL`
- `ARIA_WELLNESS_TEST_PRODUCT_VARIANT_ID`

Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `EARNINGS_PENDING_WINDOW_HOURS`

Google OAuth note:

- The current app does not read `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` from Railway.
- Google OAuth is started through Supabase Auth using `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PUBLIC_BASE_URL`.
- Google Client ID and Secret belong in the Supabase Auth Google provider configuration.
- Supabase redirect allow list should include:
  - `http://localhost:3000/auth/callback`
  - `https://partnerlinks.app/auth/callback`
  - `https://www.partnerlinks.app/auth/callback` if using `www`

## Runtime And Deployment Workflow

Local:

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill real local values:

```bash
cp .env.example .env
```

3. Run migrations manually in Supabase SQL Editor.

4. Start the app only if it is not already running:

```bash
npm start
```

Local app URL:

- `http://localhost:3000`

Production:

- Production app URL: `https://partnerlinks.app`
- Railway should run:

```bash
npm start
```

Git/Railway:

- Repo is initialized and connected to GitHub.
- Push to GitHub to trigger Railway redeploy.
- Do not deploy or push unless explicitly requested.

Bot runtime:

- If Discord bot is offline, run `npm start`.
- If Discord bot is already online, do not run `npm start` again without stopping the existing process.

## Production Safety Test Utility

Script:

```bash
node scripts/productionSafetyTest.js
```

Supported flags:

- `--dry-run`
- `--seed-test-creators`
- `--validate-tree`
- `--report`
- `--order-id <order_id>`
- `--creator-code <creator_code>`
- `--collision-test`
- `--replay-test`
- `--payout-test`
- `--stress-test`
- `--matrix-report`

Safety behavior:

- Running with no flags is dry-run/read-only.
- `--dry-run` is explicit dry-run/read-only.
- `--seed-test-creators` is the only flag that writes data.
- Write mode creates/updates only:
  - `test-creator-01`
  - `test-creator-02`
  - `test-creator-03`
  - `test-creator-04`
  - `test-creator-05`
  - `test-creator-06`
  - `test-creator-07`
  - `test-creator-08`
  - `test-creator-09`
  - `test-creator-10`
- Test creators use:
  - `display_name = TEST Creator XX`
  - `referral_code = creator_code`
  - `signup_source = production_safety_test`
- The script refuses to modify creators outside the allowed test namespace.
- The script does not run SQL migrations, delete rows, create live Stripe transfers, or change payout state.
- Reliability matrix modes are read-only diagnostics. They inspect existing clicks, conversions, network earnings, claim ledgers, and attribution events without replaying webhooks or mutating payout rows.

Referral tree created/validated:

- `test-creator-01`
- `test-creator-01 -> test-creator-02`
- `test-creator-02 -> test-creator-03`
- `test-creator-03 -> test-creator-04`
- `test-creator-05` through `test-creator-10` remain available for attribution/collision tests without parent links.

Exact manual production-safety test flow:

1. Seed test creators:

```bash
node scripts/productionSafetyTest.js --seed-test-creators --validate-tree --report
```

2. Open the Aria Wellness test product referral link:

```text
/r/aria-wellness/test-creator-04/test-product
```

3. Complete Shopify Bogus Gateway checkout.

4. Run the report for the resulting Shopify order id:

```bash
node scripts/productionSafetyTest.js --report --order-id shopify:partnerlinks-test.myshopify.com:{order_id}
```

5. Confirm expected economics:

- `test-creator-04` receives direct creator commission in `conversions`.
- `test-creator-03` receives Level 1 = 30% of `platform_fee_amount`.
- `test-creator-02` receives Level 2 = 3% of `platform_fee_amount`.
- `test-creator-01` receives Level 3 = 2% of `platform_fee_amount`.
- No Level 4+ creator-network earning exists.
- `shopify_attribution_events` contains the webhook decision and diagnostic context.

Reliability matrix commands:

```bash
node scripts/productionSafetyTest.js --matrix-report
node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:{order_id}
```

Current reliability matrix coverage:

- Collision diagnostics:
  - identifies close-together multi-creator click clusters for the same shop/product.
  - checks for ambiguous fallback events that safely skipped instead of guessing.
  - checks for deterministic non-fallback conversions when `partnerlinks_ref` survives.
- Replay/idempotency diagnostics:
  - checks duplicate conversion rows by `order_id`.
  - checks duplicate creator-network and brand-network earning keys.
  - surfaces duplicate webhook diagnostic events when present.
- Payout lifecycle diagnostics:
  - reports `creator_earning_claims` for test creators.
  - checks for stuck reserved `claim_batch_id` rows.
  - checks claimed rows for `claimed_at`.
  - compares claim ledger totals against claimed row totals when claims exist.
- Attribution stress diagnostics:
  - checks recent test clicks for missing `partnerlinks_ref`.
  - reports repeated click groups.
  - summarizes fallback/unmatched visibility and confidence labeling.

Reliability matrix milestone:

- Core trust pillars now validated:
  - deterministic Shopify `partnerlinks_ref` attribution.
  - Shopify cart/order attributes.
  - ambiguous recent-click fallback skips instead of guessing.
  - duplicate Shopify webhook replay is idempotent.
  - no duplicate conversions/earnings from duplicate webhook replay.
  - Level 1/2/3 economics work and stop after Level 3.
  - creator-scoped Stripe onboarding.
  - creator-scoped claim ownership.
  - Stripe test payout claim lifecycle.
  - `creator_earning_claims` ledger integrity.
- Permanent regression IDs now live in `system-audit/REGRESSION_HISTORY.md` and `system-audit/TEST_MATRIX.md`.
- Raw Shopify webhook payloads are not currently stored in PartnerLinks DB/repo; replay tests use approved signed payload/script flow.

## Validation Workflow

Run `node --check` for every changed JS file.

Common validation sets:

General server/route changes:

```bash
node --check index.js
```

Discord command changes:

```bash
node --check commands/handlers.js
node --check commands/registerCommands.js
```

Shopify webhook/tracking changes:

```bash
node --check index.js
node --check services/shopifyWebhookService.js
node --check services/trackingService.js
```

Stripe/payout changes:

```bash
node --check index.js
node --check services/earningsLifecycleService.js
node --check services/stripeConnectService.js
node --check services/creatorDashboardService.js
```

Dashboard changes:

```bash
node --check index.js
node --check services/creatorDashboardService.js
node --check services/brandDashboardService.js
```

Latest Shopify attribution hardening validation:

```bash
node --check index.js
node --check services/shopifyWebhookService.js
node --check services/trackingService.js
node --check commands/handlers.js
node --check commands/registerCommands.js
```

Latest production safety script validation:

```bash
node --check scripts/productionSafetyTest.js
```

## Current Known Blockers And Risks

Current highest-priority blocker/risk:

- Deterministic Shopify attribution, duplicate webhook idempotency, ambiguous fallback safety, Level 1/2/3 economics, and Stripe test payout claim lifecycle are now validated. The highest-priority reliability work is now preserving these as regression guarantees while completing the remaining Stripe sandbox failure-recovery drill and multi-creator convenience navigation decision before broader onboarding.

Known risks:

- Shopify may strip query params before checkout/webhook, requiring fallback attribution.
- Recent-click fallback is intentionally low-confidence and should not silently guess when multiple creators/products could match.
- Product card layouts can regress if Shopify-backed products get special UI.
- Shopify preview URLs break checkout and must not be used for live conversion testing.
- Duplicate Stripe transfers are a serious risk; preserve claim idempotency and recovery logic.
- DB finalization after successful Stripe transfer must remain recoverable.
- Auth/session cookies can regress if cookie size, `sameSite`, `secure`, or refresh behavior changes.
- Discord interaction handlers can regress into duplicate reply/acknowledgement errors.
- `/r/:brandSlug/:creatorCode` must not be broken while modifying product referral route `/r/:brandSlug/:creatorCode/:productSlug`.
- Homepage/dashboard UI can regress if one-off route changes bypass the shared visual system.

Known non-blocking limitations:

- No embedded Shopify admin UI.
- No Shopify billing.
- No automated public marketplace.
- No AI/content workflow system.
- No live Stripe payouts.
- No full brand auth system beyond current lightweight Shopify/local state behavior.
- No Shopify product auto-pull/approval workflow yet.
- No automated webhook registration during Shopify install documented as fully complete yet.
- Manual `/record_conversion` remains the fallback for operational conversion entry.

## Creator Systems Reliability Audit

PartnerLinks now has a markdown-first internal reliability audit system at:

- `system-audit/RELIABILITY_AUDIT.md`
- `system-audit/TEST_MATRIX.md`
- `system-audit/KNOWN_RISKS.md`
- `system-audit/INCIDENT_LOG.md`
- `system-audit/ARCHITECTURE_DECISIONS.md`
- `system-audit/ECONOMIC_ARCHITECTURE.md`
- `system-audit/REGRESSION_HISTORY.md`
- `system-audit/OPERATIONAL_RUNBOOKS.md`

Purpose:

- Act as an internal reliability analyst/runbook layer.
- Track tested guarantees, known risks, incidents, regressions, and architecture decisions.
- Define canonical economic architecture before settlement automation or public launch.
- Keep PartnerLinks moving toward Shopify/Stripe/SRE-grade reliability standards.
- Stay markdown-first, Git-friendly, reviewable, and non-autonomous.

Rules:

- Audit docs may record findings, commands, assumptions, and runbooks.
- `scripts/productionSafetyTest.js` and future audit tools may print suggested entries or append only with explicit operator approval.
- Audit tooling should default to read-only.
- Audit tooling must not autonomously mutate attribution, payouts, Stripe transfers, or production data.
- Severity labels:
  - `SEV0`: active money movement, attribution, auth, or data integrity failure affecting production users.
  - `SEV1`: high-risk payout, attribution, webhook, or ownership bug with plausible production impact.
  - `SEV2`: reliability gap, unsafe assumption, or edge case to fix before scale.
  - `SEV3`: documentation, workflow, or observability improvement.
- Regression categories:
  - `AUTH_SCOPE`
  - `REFERRAL_ROUTE`
  - `ATTRIBUTION`
  - `ATTRIBUTION_HIJACKING`
  - `COOKIE_STUFFING`
  - `PARAM_INJECTION`
  - `SQL_INJECTION`
  - `PLUGIN_SQL_INJECTION`
  - `SMALL_PLATFORM_FRAGILITY`
  - `FAKE_ACCOUNT_REWARDS`
  - `SYNTHETIC_NETWORK_METRICS`
  - `INCENTIVE_GAMING`
  - `COMMS_COST_ABUSE`
  - `THIRD_PARTY_APP_RISK`
  - `DOCS_SOURCE_INTEGRITY`
  - `WEBHOOK_IDEMPOTENCY`
  - `WEBHOOK_REPLAY`
  - `ECONOMICS`
  - `NETWORK_ECONOMICS`
  - `LINEAGE_INTEGRITY`
  - `SYNTHETIC_COMMERCE`
  - `FAKE_IDENTITY_NETWORKS`
  - `REFUND_REVERSAL`
  - `REFUND_FRAUD`
  - `SETTLEMENT_FAILURE`
  - `PAYOUT_LIFECYCLE`
  - `PAYOUT_IDEMPOTENCY`
  - `SECURITY_ISOLATION`
  - `PRODUCT_VERIFICATION`
  - `SHOPIFY_APP_DATA_RISK`
  - `AUTHORIZATION_SCOPE_BUGS`
  - `STRIPE_CONNECT_FRAUD`
  - `AFFILIATE_NETWORK_LIABILITY`
  - `REFERRAL_MESSAGING_COMPLIANCE`
  - `AFFILIATE_LINK_HIJACKING`
  - `DATA_BREACH_RESPONSE`
  - `ADMIN_TOOLING_SAFETY`
  - `DIAGNOSTICS`
  - `UI_GUARDRAIL`
  - `CREATOR_DISCLOSURE`
  - `REFERRAL_ABUSE`
  - `DASHBOARD_MONEY_CLARITY`

Permanent regression IDs now tracked in `system-audit/REGRESSION_HISTORY.md` and `system-audit/TEST_MATRIX.md`:

- `REG-AUTH-001`: Sensitive Stripe routes require explicit `creator_code` scoping and ownership verification.
- `REG-AUTH-002`: Dashboard claim eligibility compares the active dashboard creator `auth_user_id` to the signed-in auth user.
- `REG-ATTRIBUTION-001`: Exact `partnerlinks_ref` attribution wins before fallback.
- `REG-ATTRIBUTION-002`: Ambiguous recent-click fallback skips attribution instead of guessing.
- `REG-WEBHOOK-001`: Duplicate Shopify order webhooks are idempotent and produce duplicate/skipped diagnostics without duplicate conversions.
- `REG-PAYOUT-001`: Claim flow creates one `creator_earning_claims` ledger row and one Stripe transfer per claim batch.
- `REG-PAYOUT-002`: Claim retry-after-success does not create a second transfer or duplicate ledger.
- `REG-ECONOMICS-001`: Level 1 = 30%, Level 2 = 3%, Level 3 = 2%, and no Level 4+ payout.
- `REG-ECONOMICS-002`: Source entity must not earn network override from its own direct sale activity.
- `REG-ECONOMICS-003`: Network override rewards must be funded only from eligible downstream `platform_fee_amount`.
- `REG-LINEAGE-001`: A creator cannot be accidentally dual-bound to both brand-origin and creator-origin lineage.
- `REG-SETTLEMENT-001`: Live claimability must not be based only on `claimable_at`.
- `REG-SETTLEMENT-002`: No payout before `settlement_collected`, `manual_approved`, or `reserve_covered`.
- `REG-SETTLEMENT-003`: Failed settlement cannot create claimable earnings.
- `REG-SETTLEMENT-004`: Refunds after payout create offset/reversal records, not silent deletion.
- `REG-SETTLEMENT-005`: Claim retries cannot create duplicate Stripe transfers.
- `REG-SETTLEMENT-006`: Duplicate webhooks cannot create duplicate settlement items.
- `REG-SETTLEMENT-007`: Manual approval must be auditable.
- `REG-SAFETY-001`: No live payout is released just because a conversion exists.
- `REG-SAFETY-002`: Recruitment alone cannot generate PartnerLinks revenue or network payouts.
- `REG-SAFETY-003`: Creator-facing UX must not obscure that links may create compensation.
- `REG-SAFETY-004`: PartnerLinks must not send referral messages to third parties without proper consent and safeguards.
- `REG-SAFETY-005`: Dashboard money states must distinguish accounted earnings from funded/claimable earnings.
- `REG-SAFETY-006`: Referral/tracking params must not become injection surfaces.
- `REG-SAFETY-007`: PartnerLinks must not store/log unnecessary customer or payment-sensitive data.
- `REG-SAFETY-008`: Every sensitive creator/brand action must use explicit scoped ownership checks.
- `REG-SAFETY-009`: New creators, brands, and high-risk activity must not be able to instantly extract payouts.
- `REG-SAFETY-010`: Refunded or charged-back orders must create reversal/offset records, not silent deletion.
- `REG-SAFETY-011`: PartnerLinks must not rely on third-party onboarding alone as fraud approval.
- `REG-SAFETY-012`: Creator/brand promotional abuse must have takedown and audit workflow.
- `REG-SAFETY-013`: Incentive systems must not reward synthetic accounts or non-commerce actions.
- `REG-METRICS-001`: PartnerLinks network value metrics must be tied to commerce, not raw signups.
- `REG-COMMS-001`: Referral messaging cannot create unbounded platform cost or legal exposure.
- `REG-DATA-001`: PartnerLinks must not store/log unnecessary customer/payment-sensitive data.
- `REG-DOCS-001`: Risk/compliance docs must separate verified facts, assumptions, and internal opinions.
- `REG-SECURITY-001`: Malformed tracking params must not create unsafe SQL, unsafe rendered output, or trusted attribution.
- `REG-SECURITY-002`: User-controlled referral params must never reach raw SQL or expose service-role credentials.
- `REG-SECURITY-003`: Synthetic identity clusters must not bypass payout holds, settlement gates, or commerce quality review.
- `REG-SECURITY-004`: Public/featured brands and products must be verified or admin-approved before broad creator promotion.
- `REG-SECURITY-005`: Low-confidence or late attribution cannot replace exact deterministic `partnerlinks_ref`.
- `REG-SECURITY-006`: Secrets and sensitive payout/admin credentials must not be exposed to client code, public logs, or unprotected debug routes.
- `REG-SECURITY-007`: Refund-heavy or chargeback-linked activity must remain reviewable and blocked from bypassing settlement/refund gates.
- `REG-SECURITY-008`: Admin/debug tooling must be read-only by default and audited when mutating.

Guaranteed behaviors:

- Duplicate Shopify order webhooks cannot create duplicate conversions.
- Duplicate Shopify order webhooks cannot create duplicate creator-network or brand-network earnings.
- Ambiguous attribution cannot create conversions, creator earnings, network earnings, or payout-eligible rows.
- Exact `partnerlinks_ref` attribution must win before fallback.
- Webhook decisions create diagnostics for conversion and skipped outcomes.
- Stripe onboarding is creator-scoped and ownership-verified.
- Claim actions are creator-scoped and ownership-verified.
- Payout claims are idempotent by claim batch and Stripe transfer behavior.
- Network earnings stop after Level 3 and come only from `platform_fee_amount`.
- Direct creator commission, PartnerLinks platform fee, and network override rewards are separate economic systems.
- Network override rewards never come from creator commissions, Shopify checkout revenue, merchant gross revenue, or self-generated sales.
- Entities do not earn network override rewards from their own direct sales activity.
- Creators cannot be accidentally dual-bound to both brand-origin and creator-origin lineage through normal invite/signup flows.

Platform safety risk model:

- Core rule:
  - `conversion_created` does not mean `safe_to_pay`.
- No payout should be released just because a conversion exists.
- Payout eligibility requires:
  - deterministic attribution.
  - acceptable commerce quality.
  - safe brand settlement/funding.
  - refund/reversal handling.
  - explicit payout eligibility.
- First-class risk categories now documented:
  - attribution hijacking / cookie stuffing.
  - cookie stuffing / improper affiliate attribution.
  - affiliate network liability for deceptive affiliates.
  - last-click, extension, and coupon attribution theft.
  - synthetic commerce activity.
  - referral/fake account abuse.
  - fake account / reward farming.
  - Shopify third-party app data exposure risk.
  - authorization / resource-scoping bugs.
  - Stripe Connect / platform payout fraud.
  - recruitment-only legal/economic risk.
  - duplicate webhook/payment replay.
  - payout leakage / unfunded earnings.
  - refunds, chargebacks, and reversals.
  - failed brand settlement.
  - creator disclosure/compliance risk.
  - unsolicited referral messaging.
  - referral messaging legal risk.
  - FTC endorsement/disclosure risk.
  - UI/UX money confusion.
  - referral param injection / malicious tracking params.
  - SQL injection / backend query safety.
  - synthetic identity networks / fake creator farms.
  - product / brand verification risk.
  - affiliate link hijacking / attribution replacement.
  - data breach / secret exposure risk.
  - refund fraud / chargeback farming.
  - internal tooling / admin abuse.
- Real-world patterns now explicitly modeled:
  - cookie stuffing can set attribution without genuine referral intent.
  - affiliate networks can face liability for deceptive affiliate claims.
  - coupon/browser extensions can replace attribution late in checkout.
  - synthetic commerce can combine fake orders, controlled accounts, and payout extraction.
  - fake identity networks can farm rewards through disposable or clustered accounts.
  - Shopify apps can become data-exposure weak points.
  - authorization bugs can expose or mutate the wrong creator/brand resource.
  - Stripe Connect onboarding does not prove creator/store quality.
  - referral messaging can create consent/compliance exposure.
  - FTC endorsement rules require clear compensation disclosure.
  - public referral params are injection surfaces.
  - refund/chargeback farming can create post-payout losses.
- Current prevention foundations:
  - deterministic `partnerlinks_ref`.
  - Shopify cart/order attributes.
  - exact attribution before fallback.
  - no payout from raw click/cookie alone.
  - ambiguous attribution skips.
  - signed webhooks and duplicate guards.
  - idempotent claim batches.
  - `PAYOUT_MODE` fail-closed.
  - settlement state-machine docs.
- Future prevention required before public launch:
  - Shopify fraud/risk signal ingestion.
  - suspicious velocity/manual review.
  - disclosure reminders in creator UX.
  - consent-aware invite tooling before any outreach automation.
  - refund/reversal ledgers.
  - settlement/funding gates.
  - clearer dashboard money-state language.
- Security exploit safeguards documented:
  - sanitize, validate, length-limit, escape, and log suspicious tracking params.
  - no raw user-controlled SQL.
  - no service-role key exposure client-side.
  - no secrets/webhook secrets in logs.
  - protected/scoped admin and debug routes.
  - default read-only admin tooling with explicit approval for mutation.
  - brand/product verification before broad promotion.
  - identity cluster monitoring before larger payouts.
  - least-privilege Shopify scopes and customer/order data minimization.
  - explicit scoped ownership checks for every sensitive creator/brand action.
  - first-payout/high-risk holds before live extraction.
  - takedown and audit workflow for deceptive or unsafe creator/brand promotion.

Small/mid-size platform fragility model:

- Core assumption:
  - large companies may survive a fraud/security incident, but a small platform may not.
  - one payout exploit, fake-account loop, settlement bug, data leak, misleading growth metric, or messaging-cost abuse can materially damage trust, cash flow, investor confidence, and brand partnerships.
- New first-class small-platform risk patterns:
  - affiliate/plugin SQL injection through public referral params.
  - fake account/reward exploitation.
  - fake user metrics and synthetic network value.
  - incentive-plan gaming.
  - SMS/communication cost abuse.
  - third-party app/plugin fragility.
  - AI/research/documentation hallucination.
- PartnerLinks prevention model:
  - no signup-only or recruitment-only payouts.
  - no instant extraction for new/high-risk creators.
  - network value metrics tied to attributed, settled commerce.
  - public params validated, length-limited, escaped, and kept out of raw SQL.
  - Shopify scopes stay least-privilege.
  - customer/payment-sensitive data is minimized.
  - referral messaging automation stays off until consent, rate-limit, cost, and bot controls exist.
  - risk/compliance docs separate verified facts, assumptions, and internal opinions.
- Documentation note:
  - `REG-SAFETY-010` remains the refund/chargeback reversal rule.
  - incentive-gaming prevention is tracked as `REG-SAFETY-013` to avoid a duplicate regression ID.

Canonical economic architecture:

- New source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Base earning systems:
  - Direct Brand Creator Commission:
    - brand-funded affiliate commission.
    - triggered by direct attributed sale activity.
    - not PartnerLinks network earnings.
    - not funded from platform fee.
  - PartnerLinks Platform Fee:
    - platform fee on attributed conversions.
    - creates the only eligible pool for network override rewards.
- Network override system:
  - entity-based propagation layer above base earning systems.
  - current entities are creators and brands, but architecture must support future agencies, communities, managers, and other participants.
  - Level 1 = 30%, Level 2 = 3%, Level 3 = 2%.
  - percentages apply to eligible downstream `platform_fee_amount`, not gross revenue, company revenue, or creator commissions.
- Settlement architecture still needs implementation design before public launch:
  - platform fee collection from brands.
  - direct creator commission funding.
  - network override funding from collected/eligible platform fee.
  - reserve/pending windows.
  - refund/reversal handling.
  - failed settlement behavior.
  - negative balance behavior.
  - failed payout recovery.
  - settlement retry rules.

Canonical settlement status model:

- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Main rule:
  - accounted earnings are not necessarily funded earnings.
- Recommended live claimability invariant:
  - `claimable requires settlement_collected OR explicit_manual_approval OR sufficient_prepaid_reserve`
- Canonical states:
  - `attributed`
  - `settlement_pending`
  - `settlement_authorized`
  - `settlement_collected`
  - `settlement_failed`
  - `settlement_retrying`
  - `settlement_disputed`
  - `refund_pending`
  - `reversed`
  - `claimable`
  - `claimed`
- Recommended public beta settlement model:
  - manual approval gate plus reserve/prepaid or per-order settlement.
  - do not allow automatic live creator/network payouts from merely recorded conversions.
- Recommended Stripe model:
  - SetupIntent for saved brand payment method.
  - Stripe Customer for brand billing identity.
  - PaymentIntent for per-order or batch collection where direct control is needed.
  - Stripe Billing/invoices as a strong option for daily/weekly settlement statements, retries, and accounting clarity.
- Future schema/service requirements:
  - `brand_payment_methods`
  - `settlement_batches`
  - `settlement_items`
  - `refund_reversal_events`
  - `brand_reserve_balances`
  - `settlement_audit_events`
  - settlement-aware claimability promotion job.
  - brand billing/settlement/refund services.
- Current gap:
  - current test-mode lifecycle can promote earnings based on `claimable_at`.
  - live payout automation must not use pending-window claimability alone.
  - settlement status gates are not implemented yet.

Brand settlement automation architecture:

- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Status:
  - design documented.
  - not implemented.
  - no runtime behavior changed.
- Brand Stripe model:
  - each brand should have a Stripe Customer.
  - saved payment method should be collected through Stripe SetupIntent.
  - payment method ids and Stripe secrets remain server-side only.
- Settlement options:
  - per-order PaymentIntent:
    - strongest order-level traceability.
    - good for controlled beta / low volume.
  - daily batch:
    - likely early-production default.
    - requires batch/item allocation logic.
  - weekly batch:
    - lower brand payment noise but higher credit exposure.
    - safest only with reserve/prepaid coverage or trusted terms.
  - Stripe Billing/invoices:
    - strong fit for daily/weekly brand statements, retries, and accounting clarity.
  - prepaid/reserve:
    - safest for fast claimability.
    - requires reserve ledger and top-up rules.
- Proposed settlement ledger:
  - `settlement_batches`
    - brand, shop, cadence, period, status, totals, Stripe ids, retry metadata, manual approval metadata.
  - `settlement_items`
    - conversion/order, earning row reference, item type, amount, status, funding source/reference, claimability release timestamp.
- Settlement item types:
  - `direct_creator_commission`
  - `platform_fee`
  - `creator_network_override`
  - `brand_network_override`
  - `refund_reversal`
  - `reserve_application`
- Claimability release rule:
  - direct commission becomes live-claimable only when its settlement item is collected, manually approved, or reserve-covered.
  - creator/brand network overrides become live-claimable only when the eligible platform-fee-funded settlement item is collected, manually approved, or reserve-covered.
  - no refund/dispute block may exist.
- Failed brand payment behavior:
  - settlement batch/item becomes failed or retrying.
  - affected earnings remain blocked from claimability.
  - operator alert/queue is required.
  - brand may become billing attention/settlement blocked after retry exhaustion.
- Refund/reversal behavior:
  - create explicit refund/reversal events.
  - before payout: block or reverse claimability.
  - after payout: create negative balance/offset rows.
  - never silently delete or rewrite original conversion/claim history.
- Safest controlled-beta recommendation:
  1. Brand connects Shopify.
  2. Brand adds payment method through SetupIntent.
  3. PartnerLinks records conversion/economic obligations.
  4. Earnings remain settlement pending.
  5. Operator reviews first conversions.
  6. Claimability releases only after per-order collection, reserve coverage, or explicit manual approval.
- Required future services:
  - `brandBillingService`
  - `settlementService`
  - `refundReversalService`
  - `settlementDiagnosticsService`
- Required operator visibility:
  - latest settlement batches.
  - failed settlement queue.
  - settlement status by order/conversion.
  - items blocking claimability.
  - reserve balance by brand.
  - refund/reversal queue.
  - Stripe customer/payment intent/invoice ids.

Canonical settlement lifecycle/state machine:

- Source of truth:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
- Status:
  - documented.
  - not implemented.
  - no runtime behavior changed.
- Governing principle:
  - settlement must be deterministic, auditable, idempotent, and safe-failing before live payout automation.
- States defined:
  - `attributed`
  - `settlement_pending`
  - `settlement_authorized`
  - `settlement_collected`
  - `settlement_failed`
  - `settlement_retrying`
  - `settlement_disputed`
  - `refund_pending`
  - `reversed`
  - `manual_approved`
  - `reserve_covered`
  - `claimable`
  - `claim_reserved`
  - `claimed`
  - `claim_failed`
  - `offset_required`
- Each state now documents:
  - trigger.
  - owning system.
  - required evidence.
  - required ledger rows.
  - required diagnostics.
  - creator visibility.
  - claimability.
  - operator action.
- Main legal paths documented:
  - happy path from Shopify paid order to claimed payout.
  - duplicate/replay path.
  - ambiguous attribution path.
  - failed brand settlement and retry path.
  - refund before payout.
  - refund after payout.
  - manual approval path.
  - prepaid reserve path.
  - claim lifecycle.
  - brand-origin network override path.
  - creator-origin network override path.
- UX money-state mapping documented for:
  - creators.
  - brands.
  - operators/admin.
- Required future implementation additions:
  - `brand_payment_methods`
  - `settlement_batches`
  - `settlement_items`
  - `settlement_audit_events`
  - `refund_reversal_events`
  - `refund_reversal_items`
  - `brand_reserve_balances`
  - `brand_reserve_ledger`
  - `entity_negative_balances`
  - `settlementEligibilityService`
  - settlement state reports in `scripts/productionSafetyTest.js`
- Current protective behavior:
  - live claims remain fail-closed by `PAYOUT_MODE`.
  - settlement state machine is documentation/architecture only until implementation is explicitly approved.

Settlement-aware claimability audit:

- Date:
  - 2026-05-16
- Result:
  - current claimability is still time-window based.
  - safe for sandbox/test-mode payout validation.
  - unsafe for live payout automation without settlement gates.
- Exact implementation paths found:
  - `services/trackingService.js`
    - `recordConversion()` inserts direct commission rows with `payout_status = pending` and `claimable_at = getClaimableAt()`.
  - `services/creatorNetworkService.js`
    - `buildCreatorEarningRow()` inserts creator-network earnings with `payout_status = pending` and `claimable_at = getClaimableAt()`.
    - `buildBrandEarningRow()` inserts brand-network earnings with `payout_status = pending` and `claimable_at = getClaimableAt()`.
  - `services/earningsLifecycleService.js`
    - `resolveLifecycleStatus()` treats `payout_status = claimable` or elapsed `claimable_at` as claimable.
    - `sumLifecycleAmounts()` calculates dashboard pending/claimable/claimed totals from that lifecycle status.
    - `promoteClaimableEarningsForCreator()` updates `conversions` and `creator_network_earnings` from pending to claimable when `claimable_at <= now`.
    - `claimCreatorEarnings()` promotes, reserves, creates `creator_earning_claims`, creates a Stripe test transfer, and finalizes rows as claimed without settlement collection checks.
  - `services/creatorDashboardService.js`
    - `getCreatorDashboardByCode()` calls `promoteClaimableEarningsForCreator()` when the dashboard loads.
    - dashboard balances are therefore based on lifecycle status, not settlement status.
  - `index.js`
    - `renderCreatorEarningsLifecycle()` enables Claim earnings when owner, Stripe payouts, and `claimableEarnings > 0` are true.
    - `POST /earnings/claim` is explicitly creator-scoped and ownership-verified, but not settlement-scoped.
- Dashboard wording risk:
  - `Claimable Earnings` and `Claim earnings` can make accounted/time-window earnings look funded.
  - `Pending Earnings` currently means the 24-hour pending window, not necessarily settlement pending.
- Recommended beta-safe behavior:
  - keep current behavior for test/sandbox only.
  - add a payout mode or feature flag before live claims.
  - public beta should require manual approval, collected per-order/batch settlement, or sufficient prepaid reserve before earnings become live-claimable.
  - block live claims until the settlement layer exists.
- Minimal future architecture change:
  - add settlement status/manual approval/reserve fields.
  - add a central settlement eligibility service.
  - modify promotion and claim reservation to require settlement eligibility.
  - keep `claimable_at` as a review-window timestamp, not proof of funding.
- Protective implementation now added:
  - `PAYOUT_MODE` environment variable.
  - allowed values:
    - `sandbox_time_based`
    - `claims_disabled`
    - `manual_approval`
    - `settlement_gated`
  - default:
    - `claims_disabled`
  - unknown or missing mode blocks claims.
  - `/earnings/claim` checks payout mode before `claimCreatorEarnings()`.
  - current time-based claim flow is preserved only when:
    - `PAYOUT_MODE=sandbox_time_based`
    - `STRIPE_SECRET_KEY` starts with `sk_test_`
  - `manual_approval` and `settlement_gated` are recognized but blocked until their schemas/services exist.
  - Creator Dashboard disables Claim earnings and shows an unavailable-until-settlement/approval message when payout mode blocks claims.
- New regression rule:
  - `REG-SETTLEMENT-001`: live claimability must not be based only on `claimable_at`.
- Docs updated:
  - `system-audit/ECONOMIC_ARCHITECTURE.md`
  - `system-audit/RELIABILITY_AUDIT.md`
  - `system-audit/KNOWN_RISKS.md`
  - `system-audit/TEST_MATRIX.md`

Post-payout-mode attribution/conversion validation:

- Date:
  - 2026-05-16
- Goal:
  - confirm the fail-closed payout-mode guard did not affect referral attribution or conversion creation paths.
- Commands run:
  - `node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04`
  - `node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548682670254 --creator-code test-creator-04`
  - `node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548718420142`
  - `node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:7659900000001`
- Read-only scope:
  - no new clicks created.
  - no webhook replays executed.
  - no conversions created.
  - no payout claims executed.
  - no Stripe transfers created.
- Confirmed exact attribution/conversion:
  - order:
    - `shopify:partnerlinks-test.myshopify.com:6548682670254`
  - conversion:
    - `19`
  - creator:
    - `test-creator-04`
  - product:
    - `test-product`
  - `attribution_source = partnerlinks_ref`
  - `attribution_confidence = exact`
  - `fallback_used = false`
  - `click_id = 24`
  - `session_id = bd837fcf-3a53-4372-811e-e9a082b137f5`
  - direct commission:
    - `2.70`
  - `platform_fee_amount = 0.90`
  - Level 1:
    - `test-creator-03 = 0.27`
  - Level 2:
    - `test-creator-02 = 0.03`
  - Level 3:
    - `test-creator-01 = 0.02`
  - Level 4+:
    - none.
- Confirmed duplicate webhook idempotency:
  - order:
    - `shopify:partnerlinks-test.myshopify.com:6548718420142`
  - original event:
    - `decision = conversion_created`
  - duplicate diagnostics:
    - events `10` and `11`
    - `decision = duplicate_skipped`
    - `duplicate_order = true`
  - no duplicate conversion groups found.
  - no duplicate creator-network or brand-network earning keys found.
- Confirmed ambiguous fallback safety:
  - order:
    - `shopify:partnerlinks-test.myshopify.com:7659900000001`
  - diagnostic:
    - event `12`
  - `decision = skipped`
  - `unmatched_reason = ambiguous_recent_click_fallback`
  - `attribution_source = unmatched`
  - `attribution_confidence = none`
  - no conversion found.
  - no creator-network or brand-network earnings found.
- Result:
  - `PASS`
  - payout-mode guard did not break attribution/conversion code paths.
  - exact attribution, duplicate skip, ambiguous skip, conversion accounting, direct commission, platform fee, and Level 1/2/3 economics remain intact.

Latest economic flow audit:

- Command:
  - `node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04`
- Result:
  - dry-run/read-only report completed successfully.
- Direct Brand Creator Commission:
  - `PASS`
  - conversion `19` has `order_value = 18`, `commission_rate = 15`, `commission_amount = 2.70`.
  - direct commission is stored on `conversions`.
  - direct commission is separate from creator-network override rows.
  - direct commission was claimed through the test Stripe claim flow and was not reduced by network override payouts.
- PartnerLinks Platform Fee:
  - `PASS` for accounting.
  - `GAP` for actual settlement collection.
  - conversion `19` has `platform_fee_amount = 0.90`.
  - all Level 1/2/3 network rows for conversion `19` use `platform_fee_amount = 0.90`.
- Creator -> Creator Network Overrides:
  - `PASS`
  - `test-creator-03` Level 1 = 30% = `0.27`.
  - `test-creator-02` Level 2 = 3% = `0.03`.
  - `test-creator-01` Level 3 = 2% = `0.02`.
  - no Level 4+ row exists.
  - source creator `test-creator-04` did not receive a network override from their own direct sale.
  - upstream creators did not receive direct creator commission.
- Brand -> Creator Network Overrides:
  - `PARTIALLY BUILT / NOT FULLY PROVEN`
  - schema and service paths exist:
    - `creators.invited_by_brand_id`
    - `creators.brand_referred_at`
    - `brand_network_earnings`
    - `bindCreatorToBrandOrigin`
    - brand-origin row creation inside `createNetworkEarningsForConversion`
  - current `test-creator-04` report shows `Brand Network Earnings (0)`.
  - no end-to-end brand-origin economic test has proven this path yet.
- Settlement:
  - `NOT BUILT / ARCHITECTURE GAP`
  - Shopify checkout pays merchant directly.
  - PartnerLinks records conversion/economic ledgers.
  - Stripe test transfer proves payout mechanics only.
  - automated brand platform-fee collection is not built.
  - automated direct creator commission funding from brands is not built.
  - settlement status gating before claimability is not built.
  - refunds/reversals/negative balances are not built.
- Current economic/UI tension:
  - dashboard data separates direct commission and network earnings, but pending/claimable/claimed totals combine them.
  - `creator_earning_claims` stores `direct_commission_amount` and `network_earning_amount` separately, but current creator claim can claim both in one batch.
  - before public launch, creator-facing money states should make direct earnings vs network override earnings unmistakably distinct.

Last read-only audit run:

```bash
node scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04
```

Result:

- `PASS`: 11
- `CHECK`: 3
- `INFO`: 1
- No database writes, webhook replays, payout claims, or Stripe transfers were executed by the audit command.

Primary authorized creator test identity:

- `test-creator-04`
- Supabase auth email:
  - `andycoinsolana@gmail.com`
- Creator id:
  - `13`
- Parent chain:
  - `test-creator-01 -> test-creator-02 -> test-creator-03 -> test-creator-04`
- Stripe test account:
  - connected and `payouts_enabled`
- Claim ledger:
  - `creator_earning_claims.id = b165c948-b74d-474c-b042-c8b75f6eb037`
  - `stripe_transfer_id = tr_1TXlwnBcdNgp5p4cywmElHtK`
  - `total_claimed_amount = 2.70`
- Confirmed successful creator conversion:
  - `conversions.id = 19`
  - `order_id = shopify:partnerlinks-test.myshopify.com:6548682670254`
  - `commission_amount = 2.70`
  - `platform_fee_amount = 0.90`
- Confirmed Shopify attribution diagnostic:
  - `shopify_attribution_events.id = 7`
  - `attribution_source = partnerlinks_ref`
  - `attribution_confidence = exact`
  - `fallback_used = false`
  - `click_id = 24`
  - `product_slug = test-product`

Audit checklist status:

- Creator auth and ownership:
  - PASS: auth binding exists for `test-creator-04`.
  - PASS: creator-scoped Stripe start/return/refresh and claim routes verify ownership by `auth_user_id`.
  - PASS: `/stripe/connect/debug?creator_code=...` is now creator-scoped and verifies ownership before showing Stripe state.
  - PASS: dashboard `ownerCanClaim` now checks active dashboard creator ownership directly.
  - PASS: one auth user owning both `frostclips` and `test-creator-04` exposed the old newest/default creator bug, and sensitive payout routes now avoid that implicit context.
  - GAP: `/dashboard` and homepage still use default/latest creator resolution for convenience navigation when one auth user owns multiple creators. This is not a payout mutation path, but it can be confusing.
  - UNKNOWN: logout/login and stale-session browser behavior has not been re-tested during this latest reliability audit.
- Creator referral links:
  - PASS: `/join/:creatorCode` and `/join/brand/:brandId` redirect signed-in creators to their dashboard instead of rebinding parent/origin.
  - PASS: invite binding avoids self-referral and does not overwrite existing `parent_creator_id`.
  - PASS: test creator parent graph is correct:
    - `test-creator-02.parent_creator_id = test-creator-01.id`
    - `test-creator-03.parent_creator_id = test-creator-02.id`
    - `test-creator-04.parent_creator_id = test-creator-03.id`
  - UNKNOWN: signed-in multi-creator behavior for invite redirects can still land on the default/latest dashboard, not necessarily a chosen active creator.
- Shopify product attribution:
  - PASS: cart/order attributes preserve `partnerlinks_ref`, `creator_code`, `brand_slug`, and `product_slug`.
  - PASS: exact `partnerlinks_ref` attribution wins before fallback.
  - PASS: strict fallback remains low-confidence and diagnostics-visible.
  - PASS: ambiguous recent-click fallback skips attribution instead of guessing when deterministic attribution is missing and multiple creators could match.
  - PASS: repeated clicks for `test-creator-04` persist `partnerlinks_ref`.
  - PASS: 12 recent `test-creator-04` clicks were inspected; all included `partnerlinks_ref`.
  - PASS: 7 attribution sessions for `test-creator-04` were inspected with expected `last_click_id` updates.
  - UNKNOWN: delayed checkout and multi-product attribution still need broader manual coverage.
- Conversion ingestion:
  - PASS: `orders/paid` webhook requires HMAC.
  - PASS: duplicate conversion prevention is in place by `shopify:{shop_domain}:{order_id}`.
  - PASS: signed duplicate Shopify webhook replay returns safely with duplicate/skipped diagnostics.
  - PASS: diagnostics ledger explains conversion source/confidence/fallback.
  - PASS: scoped report found no duplicate conversion `order_id` groups.
  - PASS: scoped report found no duplicate creator-network earning keys for conversion/level.
  - PASS: scoped report found no duplicate brand-network earning keys for conversion/level.
- Creator economics:
  - PASS: direct commission for conversion `19` was `2.70`.
  - PASS: platform fee was `0.90`.
  - PASS: Level 1/2/3 network earnings were `0.27`, `0.03`, and `0.02`.
  - PASS: no Level 4+ network earnings were created.
  - PASS: creator direct commission was not reduced by network rewards.
  - GAP: network earnings for test parents remain `pending` even though their `claimable_at` timestamps have passed until their dashboards/services promote them. This is expected lazy promotion behavior but should be remembered during reports.
- Payout system:
  - PASS: `test-creator-04` completed Stripe test-mode onboarding.
  - PASS: `test-creator-04` claimed direct commission through the real claim route.
  - PASS: `claim_batch_id` remained linked to claimed conversion row.
  - PASS: `claimed_at` is set.
  - PASS: claim ledger total matches claimed direct commission.
  - PASS: Stripe transfer used test mode.
  - PASS: latest scoped payout diagnostics found no stuck reserved claim batches.
  - PASS: latest scoped payout diagnostics found claimed rows have `claimed_at` timestamps.
  - PASS: claim retry-after-success does not create a second transfer or duplicate ledger.
  - UNKNOWN: failure-recovery path should still be manually tested or covered with a safe diagnostic harness.
- Security and isolation:
  - PASS: sensitive payout routes now use explicit creator scoping and ownership checks.
  - PASS: Stripe debug visibility now also requires explicit `creator_code` ownership, preventing multi-creator auth users from seeing the wrong Stripe state.
  - PASS: no client-side service role exposure found in the inspected payout paths.
  - PASS: webhook replay requires HMAC.
  - GAP: non-mutating convenience navigation routes should be moved toward explicit creator selection to avoid operator confusion.
- Operator/admin diagnostics:
  - PASS: `scripts/productionSafetyTest.js --report --matrix-report --creator-code test-creator-04` shows attribution, conversion, payout ledger, claim state, and matrix results.
  - PASS: `/shopify_attribution_debug` has source/confidence/fallback/duplicate fields.
  - PASS: `scripts/productionSafetyTest.js` reports manual test URLs and read-only matrix checks without changing data.
  - GAP: payout-specific diagnostics could be clearer for retry/idempotency verification.

Remaining untested or partially tested edge cases:

- Stripe transfer failure recovery path with a safe sandbox-only diagnostic.
- Delayed checkout after a stale click/session.
- Same creator across multiple real product slugs once more than one Shopify-backed product exists.
- Auth logout/login/session restore for `test-creator-04` after the scoped payout fixes.
- Cross-creator security probes:
  - authenticated `test-creator-04` attempting Stripe start/claim against another creator code should be blocked.
  - authenticated `test-creator-04` attempting dashboard claim without explicit `creator_code` should not mutate another creator.

## Current Financial Failure-Condition Design State

The happy-path referral/economic system has been proven across deterministic attribution, direct commission accounting, platform-fee accounting, Level 1/2/3 creator network propagation, duplicate webhook idempotency, ambiguous fallback skip behavior, lineage isolation, and Stripe test-mode claim flow.

The next layer is financial correctness when commerce, settlement, or payout assumptions fail.

Documentation updated:

- `system-audit/ECONOMIC_ARCHITECTURE.md`
- `system-audit/RELIABILITY_AUDIT.md`
- `system-audit/TEST_MATRIX.md`
- `system-audit/KNOWN_RISKS.md`
- `system-audit/OPERATIONAL_RUNBOOKS.md`
- `system-audit/REGRESSION_HISTORY.md`

Newly clarified invariant:

- `conversion_created` does not mean `safe_to_pay`.
- Accounted earnings are not necessarily funded earnings.
- Money cannot remain permanently earned if the underlying commerce reverses.
- Live claimability requires `settlement_collected`, `manual_approved`, or `reserve_covered`.

Refund/reversal architecture now documented:

- full refund before payout.
- full refund after payout.
- partial refund before payout.
- partial refund after payout.
- chargeback/dispute before payout.
- chargeback/dispute after payout.
- direct commission reversal.
- Level 1/2/3 network override reversal.
- brand-origin network reversal.
- post-payout `offset_required` / negative-balance behavior.
- immutable claim ledger interaction.

Settlement-aware claimability plan now documented:

- add central settlement eligibility service before live claims.
- add settlement status/manual approval/reserve coverage fields.
- add `settlement_batches`, `settlement_items`, `brand_payment_methods`, `brand_reserve_ledger`, `settlement_attempts`, and `settlement_events`.
- dashboard should distinguish accounted earnings, pending settlement, funded/claimable earnings, claimed earnings, reversed earnings, and on-hold earnings.

Brand-origin economic validation state:

- brand-origin onboarding lineage is proven.
- brand-origin economic conversion behavior is not yet end-to-end proven.
- future proof must show `brand_network_earnings` generated only from downstream `platform_fee_amount`, with no creator-origin contamination, no self-generated override, no duplicate brand-network rows, and settlement gating.

Synthetic-commerce risk model now documented:

- new creator payout holds.
- first-payout review.
- refund-heavy creator/brand/product holds.
- abnormal conversion velocity review.
- duplicate payout method / Stripe account / device / IP / email cluster review.
- risk status can hold/release after review but must not create payout eligibility by itself.

Audit automation / threat intelligence plan:

- daily read-only safety scan proposed.
- maps external affiliate, Shopify, Stripe Connect, marketplace, payout, and creator-reward incidents to PartnerLinks subsystems.
- requires human approval before code, money-state, attribution, settlement, payout, moderation, or risk-state changes.

Proposed `productionSafetyTest.js` future read-only flags:

- `--actor-matrix`
- `--economic-report`
- `--lineage-report`
- `--settlement-report`
- `--refund-report`
- `--risk-report`
- `--route-risk-report`
- `--idempotency-report`

New/proposed regression coverage:

- `REG-REFUND-001`: refunded commerce must reverse all related earnings.
- `REG-SETTLEMENT-008`: risk holds must block claim promotion.
- `REG-BRAND-ECON-001`: brand-origin rewards require downstream commerce.
- `REG-INVARIANT-001`: production safety reports must cover financial failure states.

No runtime code, payout math, Stripe logic, settlement logic, deployment, or data mutation changed in this documentation pass.

## Current Controlled Implementation Sequence

PartnerLinks is now moving from happy-path proof toward financial correctness under failure conditions.

Runtime implementation order:

1. Refund / reversal ledger infrastructure.
2. Settlement-state runtime schema.
3. Read-only invariant reporting expansion.
4. Controlled-beta synthetic-commerce detection.
5. Read-only threat intelligence / audit monitor.
6. Replay / idempotency hardening across refunds, reversals, settlements, claims, transfers, and settlement batches.

Smallest first runtime patch:

- additive migration only.
- create `financial_reversal_events`.
- create `financial_reversal_items`.
- link reversals to the original conversion/network earning/brand earning/claim rows.
- include `reversal_reason`, `reversal_status`, `offset_required`, idempotency key, timestamps, and minimal evidence.
- do not automatically claw back payouts.
- do not create Stripe reversals.
- do not collect negative balances.
- do not change dashboard totals or payout state until reversal application logic is separately reviewed.

Proposed reversal schema:

- `financial_reversal_events`
  - source/event identity.
  - Shopify order/conversion/brand references.
  - reversal type, reason, status.
  - original amount, reversed amount, reversal ratio.
  - unique idempotency key.
  - minimal non-sensitive evidence.
- `financial_reversal_items`
  - reversal event reference.
  - direct commission / platform fee / creator network / brand network / claim offset item type.
  - original financial-row reference.
  - affected creator or brand.
  - original amount, reversal amount.
  - payout status and settlement status at reversal time.
  - offset-required status.

Migration safety concerns:

- additive-only first migration.
- no destructive SQL.
- no automatic historical backfill.
- unique reversal event idempotency key.
- nullable references where needed for forward compatibility.
- no full Shopify/Stripe/customer/payment payload storage.
- SQL must be pasted/run manually in Supabase SQL Editor by the user.

Backward compatibility:

- existing conversions remain unchanged.
- existing creator/network/brand earnings remain unchanged.
- existing claim ledger remains unchanged.
- `PAYOUT_MODE` remains the active live-claim safety guard.
- current dashboard behavior remains unchanged until explicit reversal/settlement application logic is built.

Validation required for the first implementation patch:

- run read-only `productionSafetyTest.js --dry-run --report --matrix-report` before and after.
- run `node --check` on any touched JS files.
- inspect generated migration SQL before manual Supabase execution.
- update `PROJECT_STATUS.md` and system-audit docs with migration name, invariants, and known limitations.

## Migration 016 Financial Reversal Ledger

Status:

- Created locally.
- Not run in Supabase.
- Not deployed.

File:

- `database/migrations/016_financial_reversal_ledger.sql`

Adds additive-only tables:

- `financial_reversal_events`
- `financial_reversal_items`

Purpose:

- create immutable observability/accounting infrastructure for refunds, partial refunds, chargebacks, disputes, manual adjustments, future negative-balance offsets, and future reversal application.

What it includes:

- unique `idempotency_key` on reversal events.
- `source_system` values: `shopify`, `stripe`, `admin`, `manual`.
- `reversal_type` values: `refund`, `partial_refund`, `chargeback`, `dispute`, `manual_adjustment`.
- `reversal_status` values: `detected`, `pending_review`, `applied`, `ignored`, `failed`.
- `offset_required` and `offset_status` on reversal items.
- links to affected rows where applicable:
  - `conversion_id`
  - `creator_network_earning_id`
  - `brand_network_earning_id`
  - `creator_earning_claim_id`
  - `affected_creator_id`
  - `affected_brand_id`
- minimal `evidence` JSON with explicit comments warning against full Shopify/Stripe/customer/payment payload storage.
- indexes for order, brand, conversion, source, affected creator/brand, and offset lookups.

What it does not do:

- does not change dashboard totals.
- does not change `payout_status`.
- does not create Stripe reversals.
- does not claw back payouts.
- does not collect negative balances.
- does not alter claim logic.
- does not alter settlement logic.
- does not alter attribution logic.
- does not rewrite existing conversion, earning, or claim rows.

Operational note:

- SQL must be run manually in Supabase SQL Editor when approved.
- This migration only creates reversal observability/accounting infrastructure. It does not enforce reversals yet.

Validation:

- `git diff --check` passed.
- `node scripts/productionSafetyTest.js --dry-run --report --matrix-report` completed read-only.
- No runtime JavaScript files were touched, so no `node --check` was required for this patch.
- SQL was not executed automatically.

## Controlled Real-Money Beta Readiness State

Current readiness split:

- Real-money attribution/accounting-only beta: `GO WITH MANUAL OWNER CHECKS`.
- Live creator payouts: `NO-GO`.

Important boundary:

- Real Shopify orders can be used to validate referral attribution, conversion creation, direct commission accounting, platform fee accounting, network earnings, duplicate prevention, and operator diagnostics.
- Creator payouts must remain disabled/fail-closed until settlement/funding gates exist.
- Production `PAYOUT_MODE` recommendation remains `claims_disabled`.
- `sandbox_time_based` is only acceptable with `STRIPE_SECRET_KEY` starting with `sk_test_`.

Environment safety audit:

- `.env.example` defaults `PAYOUT_MODE=claims_disabled`.
- `config/config/env.js` defaults missing `PAYOUT_MODE` to `claims_disabled`.
- `/earnings/claim` checks `getPayoutClaimGate()` before `claimCreatorEarnings()`.
- `sandbox_time_based` only allows claims when `STRIPE_SECRET_KEY` starts with `sk_test_`.
- Local development currently reports `PAYOUT_MODE=sandbox_time_based` with a Stripe test key. This is safe only for sandbox validation and must not be copied to production.
- Stripe key mode can be reported as `test`, `live`, `unknown`, or `missing` without exposing the secret.

Shopify live-readiness audit:

- Current implemented webhook:
  - `POST /webhooks/shopify/orders-paid`
  - verifies `X-Shopify-Hmac-Sha256` using the raw body and `SHOPIFY_WEBHOOK_SECRET`.
  - returns safe success for unmatched/invalid attribution cases after diagnostic logging.
  - duplicate Shopify orders are guarded by conversion order id format `shopify:{shop_domain}:{order_id}` and diagnostics.
- Required beta webhook topics:
  - `orders/paid` for conversion source of truth.
  - refund handling should be added next through a Shopify-supported refund/order update strategy, such as `refunds/create` or a current equivalent supported by the installed app/API version.
  - compliance/privacy webhooks later for app review/data compliance: `customers/data_request`, `customers/redact`, and `shop/redact`.
- Product referral attribution currently persists through Shopify cart/order attributes:
  - `partnerlinks_ref`
  - `creator_code`
  - `brand_slug`
  - `product_slug`
- Operator attribution diagnostics:
  - `shopify_attribution_events` answers source, confidence, fallback, duplicate, skipped, conversion id, and checked source questions.

Refund/reversal readiness:

- `financial_reversal_events` exists and is readable.
- `financial_reversal_items` exists and is readable.
- Both tables currently contain `0` rows.
- Migration `016_financial_reversal_ledger.sql` creates observability/accounting infrastructure only.
- Refund enforcement is not implemented yet.
- Next smallest safe engineering step is a read-only/refund-webhook design and diagnostic route/service plan before any reversal application logic.

Settlement/funding readiness:

- Current runtime accounts earnings but does not prove funding.
- Live claimability must remain blocked until funding gates exist.
- Required future brand settlement infrastructure:
  - Stripe Customer per brand.
  - SetupIntent saved payment method.
  - `settlement_batches`.
  - `settlement_items`.
  - PaymentIntent or Stripe Billing invoice path.
  - `settlement_collected` gate.
  - manual approval and/or reserve coverage paths.

Real-money attribution-only beta checklist:

1. Brand account connected to Shopify.
2. `orders/paid` webhook active and HMAC verified.
3. Product configured with Shopify storefront/cart path.
4. Creator referral link generated.
5. Real order placed through referral link.
6. `shopify_attribution_events` row verified.
7. `conversions` row verified.
8. Direct commission amount verified.
9. `platform_fee_amount` verified.
10. Level 1/2/3 network rows verified where applicable.
11. Confirm no Claim button/live payout is enabled in production.
12. Refund scenario recorded in `financial_reversal_events` only after refund ingestion is implemented.
13. Operator reconciliation notes captured for expected vs accounted amounts.

Admin/operator questions currently answerable:

- Given Shopify order id, who got attribution?
  - yes, through `shopify_attribution_events` and `conversions`.
- What commission was recorded?
  - yes, through `conversions.commission_amount`.
- What network rows exist?
  - yes, through `creator_network_earnings` and `brand_network_earnings`.
- Was fallback used?
  - yes, through `shopify_attribution_events.fallback_used`, `attribution_source`, and `attribution_confidence`.
- Was duplicate replay seen?
  - yes, through `shopify_attribution_events.decision = duplicate_skipped` and `duplicate_order`.
- Is payout disabled?
  - yes, through `PAYOUT_MODE` and `getPayoutClaimGate()` behavior.
- Are reversal rows present?
  - yes, through `financial_reversal_events` and `financial_reversal_items`; currently both are empty.

Manual owner tasks before controlled real-money attribution-only beta:

- Confirm production `PAYOUT_MODE=claims_disabled`.
- Confirm production Stripe key mode is not used for transfers while claims are disabled.
- Confirm `SHOPIFY_WEBHOOK_SECRET` is set in production.
- Confirm `orders/paid` webhook is registered for the connected real store.
- Confirm product/variant/storefront route points to the intended live Shopify product.
- Confirm compliance/privacy webhook requirements in Shopify Partner configuration before broader app review.
- Place a small real order through a PartnerLinks referral link.
- Verify attribution/accounting rows before any refund or payout work.

Safe engineering tasks Codex can do next:

- Validate the new read-only `productionSafetyTest.js` reports against production Supabase after network access is available.
- Design refund webhook ingestion without applying reversals.
- Add diagnostic-only refund event recording to `financial_reversal_events`.
- Add operator docs for real-order reconciliation.

New read-only operator reports in `scripts/productionSafetyTest.js`:

- `--order-report`
  - lookup by `--order-id`, `--partnerlinks-ref`, `--creator-code`, `--brand-id`, or `--shop-domain`.
  - reports attribution decision, conversion accounting, Level 1/2/3 network rows, claim batches, and reversal rows.
- `--actor-matrix`
  - reports test/brand-origin actor roles, auth binding, Stripe state, direct conversions, network earnings, and claim totals.
- `--lineage-report`
  - reports parent lineage, brand-origin lineage, dual-lineage rows, self-parent rows, and circular lineage findings.
- `--economic-report`
  - reports direct commission rows, `platform_fee_amount`, creator/brand network rows, Level 4+ violations, duplicate order ids, duplicate network earning keys, and self-generated override findings.
- `--refund-report`
  - reports `financial_reversal_events` and `financial_reversal_items` presence/counts and scoped reversal rows without applying reversals.
- `--settlement-report`
  - reports local payout gate state, Stripe key mode, missing settlement columns, and required future funding infrastructure.
- `--risk-report`
  - reports controlled-beta risk signals such as duplicate auth bindings, duplicate Stripe accounts, first-payout actors, conversion velocity clusters, and refund-enforcement gap.
- `--route-risk-report`
  - statically classifies Express routes as read-only, attribution, auth/lineage, conversion/economics, payout/claim, Stripe, or admin/debug.
  - reports `getSignedInCreator()` references and payout/Stripe guard references for human review.

Validation run on 2026-05-17:

- `node --check scripts/productionSafetyTest.js`: passed.
- `git diff --check`: passed.
- `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`: passed with 12 `PASS`, 2 `CHECK`, 1 `INFO`.
  - `CHECK` items were expected operator-test gaps: no ambiguous fallback event in the current query window and no duplicate webhook replay diagnostic in the scoped result.
- `node scripts/productionSafetyTest.js --dry-run --actor-matrix --lineage-report --economic-report --refund-report --settlement-report --risk-report --route-risk-report`: completed read-only.
  - dual brand/creator lineage rows: 0.
  - self-parent rows: 0.
  - circular lineage findings: 0.
  - Level 4+ findings: 0.
  - self-generated network override findings: 0.
  - duplicate conversion/order findings in scope: 0.
  - duplicate creator/brand network earning key findings: 0.
  - reversal tables readable and empty.
  - local payout gate reports `sandbox_time_based` + Stripe test key as locally allowed; production remains `claims_disabled`.
- `node scripts/productionSafetyTest.js --dry-run --order-report --order-id shopify:partnerlinks-test.myshopify.com:6549690941614`: completed read-only.
  - decision: `conversion_created`.
  - source: `partnerlinks_ref`.
  - confidence: `exact`.
  - fallback used: false.
  - direct commission: 2.70.
  - platform fee amount: 0.90.
  - creator network rows: Level 1 = 0.27, Level 2 = 0.03, no Level 3 because the conversion source was `test-creator-03`.
  - reversal rows: 0.

## Pre-Payout Financial Failure Infrastructure Pass

Classification:

- Diagnostic refund ingestion: `RUNTIME-ENFORCED` only for HMAC verification, idempotent reversal event capture, and non-mutating reversal item capture.
- Refund/reversal application: `PLANNED / NOT IMPLEMENTED`.
- Settlement schema: migration proposed locally; `PLANNED / NOT IMPLEMENTED` until Austin manually runs it.
- Live creator payouts: `BLOCKED / NO-GO`.

Runtime behavior added:

- `POST /webhooks/shopify/refunds-create`
  - verifies Shopify HMAC with the same raw-body verifier used by `orders/paid`.
  - creates an idempotent `financial_reversal_events` row using `shopify:refund:{shop_domain}:{refund_id_or_webhook_id_or_body_hash}`.
  - stores minimal non-sensitive evidence:
    - webhook id
    - refund id
    - Shopify order id
    - timestamps
    - currency
    - transaction/refund-line/order-adjustment counts
    - whether a conversion match was found
  - optionally creates `financial_reversal_items` only when the original conversion is safely matchable by `shopify:{shop_domain}:{order_id}`.
  - creates diagnostic item rows for:
    - direct commission
    - platform fee
    - creator network overrides
    - brand network overrides when present
  - marks reversal items as `offset_required` only when the affected row was already claimed or reserved, but does not apply the offset.

Explicitly unchanged:

- no `payout_status` changes.
- no claimability changes.
- no dashboard total changes.
- no Stripe reversals.
- no payout clawbacks.
- no negative-balance collection.
- no settlement release.
- no payout math changes.

New additive migration proposal:

- `database/migrations/017_settlement_state_runtime_schema.sql`
  - creates `settlement_batches`.
  - creates `settlement_items`.
  - adds settlement/risk/manual-approval/reserve/reversal status columns to:
    - `conversions`
    - `creator_network_earnings`
    - `brand_network_earnings`
  - does not collect money or release payouts by itself.
  - must be run manually by Austin in Supabase SQL Editor if approved.

Latest validation notes:

- `git diff --check` passed.
- JS syntax checks passed for touched runtime/reporting files.
- `node scripts/productionSafetyTest.js --dry-run --report --matrix-report` completed with no new payout, lineage, or attribution regressions; remaining `CHECK` items are expected scoped coverage gaps for recent ambiguous fallback and duplicate replay diagnostics.
- `node scripts/productionSafetyTest.js --dry-run --refund-report --settlement-report --idempotency-report --route-risk-report` confirmed reversal tables are present and empty, refund enforcement is disabled, and route classification includes the diagnostic refund endpoint.
- `--idempotency-report` classifies duplicate conversion order ids by namespace/source:
  - `shopify:*` duplicates remain `FAIL` launch blockers.
  - non-Shopify/manual/test duplicates are `CHECK` hygiene findings unless linked to earnings, claims, payouts, reversals, settlement items, or network rows.
- Known hygiene item:
  - `test-network-001` conversion ids `2` and `3` are historical/manual test rows from `2026-05-13` for brand `8` / creator `4`.
  - They have `source=manual`, `notes=network test`, no Shopify attribution events, no network earnings, no reversal rows, no claim rows, and no claimed/reserved payout state.
  - Current Shopify conversion safety remains clean: `11` Shopify conversions, `0` duplicate Shopify order ids.

New read-only diagnostics:

- `scripts/productionSafetyTest.js --idempotency-report`
  - checks duplicate Shopify conversion order ids as hard failures.
  - labels non-Shopify/manual duplicate conversion order ids as historical/test-data hygiene unless financial side effects exist.
  - checks duplicate creator-network and brand-network earning keys.
  - checks duplicate reversal event idempotency keys.
  - checks duplicate settlement item idempotency keys when settlement tables exist.
  - checks duplicate Stripe transfer ids in `creator_earning_claims`.
  - shows duplicate webhook replay diagnostics when present.

## Settlement-Aware Claimability Gate

Classification:

- claimability gate: `RUNTIME-ENFORCED`
- live creator payouts: `BLOCKED / NO-GO`
- settlement collection: `PLANNED / NOT IMPLEMENTED`

Runtime behavior:

- Claimability is centralized in `services/payoutModeService.js`.
- `/earnings/claim` still requires scoped creator ownership and Stripe payouts enabled.
- `claimCreatorEarnings()` independently checks the payout mode gate before reserving rows.
- claim reservation only selects eligible rows for the active payout mode.
- dashboard totals now distinguish:
  - Accounted earnings
  - Pending settlement
  - Claimable earnings
  - Claimed earnings

Behavior by `PAYOUT_MODE`:

- `sandbox_time_based`
  - allowed only when `STRIPE_SECRET_KEY` starts with `sk_test_`.
  - keeps current sandbox behavior based on `claimable_at`.
- `claims_disabled`
  - blocks claims.
  - production default/recommendation.
- `manual_approval`
  - allowed only with a Stripe test key.
  - only earnings with `manual_approved_at` or `settlement_status='manual_approved'` can be reserved/claimed.
- `settlement_gated`
  - allowed only with a Stripe test key.
  - only earnings with `settlement_collected_at`, `reserve_covered_at`, `settlement_status='settlement_collected'`, or `settlement_status='reserve_covered'` can be reserved/claimed.
- missing/unknown mode:
  - blocks claims.

Safety notes:

- Non-sandbox live claims remain unavailable because production must stay `claims_disabled`.
- Existing Stripe transfer creation remains test-mode guarded by `sk_test_`.
- Time-based claim promotion no longer runs when payout mode is blocked.
- Settlement/manual/reserve fields do not collect money or prove funding by themselves.

Remaining blocked before live payouts:

- settlement collection is not built.
- settlement-aware live claim promotion is not built.
- refund enforcement is not built.
- chargeback/dispute enforcement is not built.
- payout clawbacks and negative-balance offsets are not built.
- risk holds and first payout review are not enforced.
- brand auto-charging is not built.

Recommended fixes before broader real brand onboarding:

- Keep all Stripe diagnostic and payout routes on explicit creator-scoped ownership checks; `/stripe/connect/debug?creator_code=...` now follows the same pattern as start/return/claim.
- Decide how multi-creator auth users should choose an active creator for convenience routes:
  - temporary safe option: `/dashboard` shows a creator selection page when multiple creators share one auth user.
  - later product option: account switcher.
- Keep duplicate webhook replay and ambiguous fallback tests in the regression matrix before major attribution/webhook changes.
- Keep all payout retry/failure testing in Stripe test mode only.

## Recommended Next Steps

1. Patch creator-scoped non-mutating navigation where it reduces confusion.
   - `/dashboard` and homepage creator dashboard navigation need a product decision for multi-creator auth users: choose a default, show an account switcher later, or route to a selection state.

2. Complete the remaining production-safety reliability matrix.
   - Failure recovery: test only with a safe, explicit sandbox diagnostic plan.
   - Delayed checkout/stale session: verify attribution remains deterministic or skips safely.
   - Multi-product: repeat tests once more than one Shopify-backed product exists.
   - Brand-origin economics: prove `brand_network_earnings` end to end before claiming brand-as-network-entity support.
   - Economic report: add a read-only report that distinguishes direct commission, platform fee, and network override rows.

3. Register/verify Shopify `orders/paid` webhook setup for connected stores.
   - Confirm whether webhook registration is manual or automated per installed store.
   - Avoid duplicate webhook registrations.

4. Expand internal/admin attribution diagnostics only as needed.
   - Current `/shopify_attribution_debug` works for recent decisions.
   - Next useful additions would be lookup by `partnerlinks_ref`, latest clicks by creator/product, and unmatched-only filters.

5. Move product data toward admin-curated Shopify-backed products.
   - Keep universal product card layout.
   - Do not expose Shopify/test metadata publicly.
   - Auto-pull can come later, but display should remain curated/approved.

6. Continue hardening Stripe claim/payout recovery.
   - Keep test-mode guard.
   - Preserve idempotency.
   - Add more operator diagnostics before live payout plans.

7. Keep dashboards cohesive.
   - Any new brand/creator feature should land inside the appropriate dashboard/navigation system, not as a disconnected utility page.

8. Keep manual operations available.
   - `/record_conversion` remains useful as fallback.
   - Discord diagnostics should support admin/operator testing without becoming the primary creator/brand UX.
# Settlement Batch Lifecycle - Phase 1

Status: READ-ONLY DIAGNOSTIC / PLANNED RUNTIME INFRASTRUCTURE

- Added migration proposal `database/migrations/018_settlement_lifecycle_audit_events.sql`.
- Adds `settlement_audit_events` as an additive audit trail for future settlement batch/item lifecycle transitions.
- The migration is idempotent and manual-only; it has NOT been run automatically.
- `scripts/productionSafetyTest.js --settlement-report` now reports:
  - `settlement_batches`
  - `settlement_items`
  - `settlement_audit_events`
  - batch status summary
  - item status summary
  - audit event type summary
  - documented safe-claimability states vs blocked states
- `scripts/productionSafetyTest.js --idempotency-report` now checks duplicate `settlement_audit_events.idempotency_key` values when the table exists.

Runtime behavior added:

- READ-ONLY DIAGNOSTIC reporting only.
- No automatic settlement collection.
- No brand charging.
- No manual approval mutation.
- No reserve coverage mutation.
- No payout release.
- No claimability change.
- No existing financial rows are mutated.

Blocked / NO-GO:

- Live creator payouts remain NO-GO.
- Live settlement automation remains NO-GO.
- Brand funding collection remains PLANNED / NOT IMPLEMENTED.
- Manual operator approval runtime mutation remains PLANNED / NOT IMPLEMENTED.
- Reserve coverage enforcement remains PLANNED / NOT IMPLEMENTED.
- Refund offset enforcement remains PLANNED / NOT IMPLEMENTED.

Next safest implementation step:

- After Austin manually runs migration `018`, verify `settlement_audit_events` exists and then build an operator-only, explicit, idempotent settlement batch/item creation service that writes audit events but still does not charge brands or release payouts.

# Operator Settlement Batch Creation

Status: RUNTIME-ENFORCED MANUAL SCRIPT / FAIL-CLOSED MONEY MOVEMENT

- Added `scripts/settlementBatchOperator.js`.
- Default behavior is dry-run/read-only.
- `--create-draft` is the only write mode.
- Write mode creates only:
  - `settlement_batches`
  - `settlement_items`
  - `settlement_audit_events`
- The script does NOT:
  - charge brands.
  - create Stripe PaymentIntents.
  - create Stripe transfers.
  - release creator payouts.
  - mark settlement collected.
  - mark manual approved.
  - mark reserve covered.
  - mark earnings claimable.
  - change `payout_status`.
  - mutate existing `conversions`, `creator_network_earnings`, or `brand_network_earnings`.
- Existing financial rows are referenced from `settlement_items`; they are not linked back through `settlement_batch_id` in this first pass.

Supported flags:

- `--dry-run`
- `--report`
- `--create-draft`
- `--brand-id <id>`
- `--shop-domain <domain>`
- `--order-id <order_id>` repeatable or comma-separated
- `--date-from <YYYY-MM-DD>`
- `--date-to <YYYY-MM-DD>`
- `--batch-key <key>`
- `--operator <name>`
- `--notes <text>`

Validated dry-run:

- `node scripts/settlementBatchOperator.js --dry-run --report --brand-id 9`
- Proposed batch key: `settlement_batch:9:d3d73eedef2583c3`
- Included:
  - 11 conversions.
  - 13 creator network earning rows.
  - 0 brand network earning rows.
  - 35 proposed settlement items.
- Totals:
  - direct commission total: `$29.70`
  - platform fee total: `$9.90`
  - creator network override total: `$2.30`
  - brand funding obligation: `$39.60`
  - settlement item total: `$41.90`
- No rows were mutated during dry-run.

NO-GO remains:

- Brand charging.
- Automatic settlement collection.
- Live creator payouts.
- Claim release.
- Refund/offset enforcement.

# Settlement Reconciliation Verification

Status: READ-ONLY DIAGNOSTIC

- Extended `scripts/settlementBatchOperator.js` with `--verify-reconciliation`.
- Verification recomputes deterministic settlement items from immutable accounting rows and compares them against existing `settlement_batches`, `settlement_items`, and `settlement_audit_events`.
- The verifier does not mutate rows.
- The verifier confirms:
  - deterministic settlement item generation.
  - stable settlement item idempotency keys.
  - duplicate settlement item/audit keys are absent.
  - missing expected items are detected.
  - unexpected batch items are detected.
  - item amounts/source references match recomputation.
  - orphan settlement items are detected.
  - source rows assigned to multiple batches are detected.
  - Level 4+ settlement behavior is blocked by invariant checks.
  - self-generated creator override settlement items are detected.
  - batch gross funding total equals direct creator commissions plus platform fee.
  - network override items remain allocation visibility only and do not increase brand funding obligation.

Validated command:

- `node scripts/settlementBatchOperator.js --dry-run --report --verify-reconciliation --brand-id 9`

Current result:

- Existing deterministic batch found: `9d07ec69-2959-433c-b9a3-46f3aebc23a8`
- Expected settlement items: `35`
- Existing batch settlement items: `35`
- Brand settlement items total for brand: `35`
- Brand settlement audit events total for brand: `36`
- Reconciliation checks: `12 PASS`
- Direct commission total: `$29.70`
- Platform fee total: `$9.90`
- Network override total: `$2.30`
- Brand funding obligation: `$39.60`
- Batch gross amount: `$39.60`
- No mismatches, duplicate keys, orphan items, multi-batch source assignments, Level 4+ rows, or self-generated creator override settlement items found.

Design-only future note:

- A future canonical payout eligibility resolver should derive eligibility from conversions, creator network earnings, brand network earnings, settlement state, reserve coverage, reversal state, claim state, manual review state, risk holds, and payout mode.
- This resolver is NOT implemented yet.
- Next approved mutation layer should remain operator-controlled and likely follow `draft -> manually_reviewed -> manually_marked_collected`, but that transition is NOT implemented.

# Financial Infrastructure Standards Audit

Status: READ-ONLY DIAGNOSTIC / ONE LOW-RISK REPORTING PATCH

Audit lens:

- PartnerLinks financial, attribution, settlement, payout, refund, reserve, claimability, and audit behavior should follow conservative Shopify/Stripe/affiliate-accounting infrastructure patterns.
- Clever or implicit shortcuts are not acceptable for money-state decisions.
- Runtime safety claims should be trusted only when marked `RUNTIME-ENFORCED`.

Current runtime-aligned findings:

- Claim actions are creator-scoped and owner-verified.
- Stripe Connect routes are creator-scoped and owner-verified.
- `PAYOUT_MODE` remains the primary fail-closed claim guard.
- `claims_disabled` blocks claims.
- `sandbox_time_based` requires a Stripe test key.
- `manual_approval` and `settlement_gated` require a Stripe test key and row-level eligibility; live payouts remain NO-GO.
- Settlement draft creation is explicit, idempotent, and limited to `settlement_batches`, `settlement_items`, and `settlement_audit_events`.
- Settlement reconciliation recomputes from immutable accounting rows and confirms brand funding obligation is direct creator commissions plus platform fee.
- Network override settlement items are allocation visibility only and do not increase brand funding obligation.
- Duplicate Shopify order ids remain hard failures; historical non-Shopify manual duplicate test rows are classified as hygiene findings unless linked to financial side effects.

Low-risk fix applied:

- `scripts/productionSafetyTest.js --route-risk-report` now explicitly labels `/brand/setup/:brandId` routes as:
  - `BLOCKED_FOR_PUBLIC_BRAND_ONBOARDING_UNTIL_BRAND_OWNERSHIP_AUTH_EXISTS`
- This is diagnostic/reporting only.
- No runtime route behavior changed.

Open infrastructure-standard blocker:

- Brand setup and brand dashboard ownership are not yet launch-grade.
- `/brand/setup/:brandId` can mutate brand setup by route id and must not be used as public self-serve brand onboarding until signed-in brand ownership/auth scoping exists.
- This is not a payout bug and does not affect the currently verified creator payout scoping, Shopify webhook attribution, or settlement reconciliation invariants.
- It is a public brand-onboarding blocker because a Shopify/Stripe-grade system would require explicit resource ownership checks for brand setup mutations.

Validation commands:

- `node scripts/productionSafetyTest.js --dry-run --route-risk-report --settlement-report --idempotency-report`
- `node scripts/settlementBatchOperator.js --dry-run --report --verify-reconciliation --brand-id 9`
- `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`

NO-GO remains:

- Live creator payouts.
- Brand charging.
- Stripe PaymentIntent collection.
- Automatic settlement transitions.
- Manual mark-collected transition.
- Reserve deduction/enforcement.
- Refund offset enforcement.
- Public self-serve brand onboarding without brand ownership controls.

# Brand Setup/Admin Ownership Protection

Status: RUNTIME-ENFORCED AFTER MIGRATION `019` / FAIL-CLOSED BEFORE MIGRATION

What changed:

- Added migration `database/migrations/019_brand_owner_auth.sql`.
- Added `services/brandOwnershipService.js`.
- Added explicit brand owner/admin checks for:
  - `GET /brand/setup/:brandId`
  - `POST /brand/setup/:brandId`
  - `GET /brand-dashboard/:brandSlug`
- Added signed-in owner requirement to:
  - `GET /api/shopify/start`
  - `GET /api/shopify/callback`
- Shopify OAuth callback now binds the signed-in Supabase auth user to the exact Shopify-connected brand through `brand_owners`.
- Brand dashboard now resolves the brand first, verifies signed-in ownership, and only then loads dashboard data.
- Brand setup POST verifies signed-in ownership server-side before mutating brand setup fields.
- Route-risk diagnostics now classify protected brand routes as:
  - `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`

Runtime behavior:

- URL params alone are no longer enough to view or mutate brand setup/admin state.
- Latest/default brand assumptions are not used for brand admin access.
- Unauthorized users see a blocked/sign-in page.
- Missing `brand_owners` table fails closed and blocks brand admin access.
- No payout, settlement, Stripe transfer, PaymentIntent, reserve, claim, conversion, or earnings behavior changed.

New migration:

- `database/migrations/019_brand_owner_auth.sql`
  - creates `brand_owners`.
  - stores `brand_id`, `auth_user_id`, `email`, `role`, `source_system`, `shop_domain`, timestamps, revocation timestamp, and metadata.
  - unique key: `(brand_id, auth_user_id)`.
  - active-owner index for scoped access checks.

Transitional limitation:

- The current brand owner sign-in uses the existing Supabase Google auth flow.
- Until a dedicated brand auth UX exists, Shopify brand setup may require signing in through the existing Google auth entry path before starting Shopify OAuth.
- Existing brands created before migration `019` need an owner binding through a safe OAuth reinstall/reconnect or future manual operator binding workflow.

Validation:

- `node --check index.js`
- `node --check services/brandOwnershipService.js`
- `node --check services/brandDashboardService.js`
- `node --check scripts/productionSafetyTest.js`

Still NO-GO:

- Public brand onboarding until migration `019` is applied and at least one owner is bound for each brand.
- Brand billing/charging.
- Stripe PaymentIntent collection.
- Settlement collection.
- Automatic settlement transitions.
- Live creator payouts.

Migration `019` manual verification:

- Austin manually ran `database/migrations/019_brand_owner_auth.sql` in Supabase SQL Editor.
- Read-only app verification confirms:
  - `brand_owners` exists.
  - `brand_owners` is readable.
  - current row count is `0`.
  - expected columns are visible:
    - `id`
    - `brand_id`
    - `auth_user_id`
    - `email`
    - `role`
    - `source_system`
    - `shop_domain`
    - `created_at`
    - `updated_at`
    - `revoked_at`
    - `metadata`
  - Route-risk report sees `brand_owners`.
  - Route-risk report classifies:
    - `/brand/setup/:brandId` as `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`
    - `/brand-dashboard/:brandSlug` as `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`
- Supabase REST/PostgREST does not expose `pg_indexes` or `information_schema` to this app client, so index/check/FK metadata should be verified manually in Supabase SQL Editor if needed.

Existing brand owner coverage:

- `brand_id=9`, `partnerlinks-test.myshopify.com`: no active `brand_owners` row currently exists.
- `brand_id=8`, `AGEN`: no active `brand_owners` row currently exists.
- Result:
  - brand setup/dashboard routes fail closed for existing brands until owner rows are inserted or Shopify OAuth is re-run while signed in as the intended owner.

Manual owner binding is required before testing owner access:

- Do not insert owner rows automatically from Codex.
- Austin should add owner rows manually in Supabase SQL Editor or re-run Shopify OAuth while signed in as the intended owner.
- After an owner row exists, expected behavior:
  - matching signed-in owner can access exact brand setup/dashboard.
  - non-owner remains blocked.
  - missing owner row remains fail-closed.

Final brand owner binding verification:

- Austin manually inserted an owner row for `brand_id=9`.
- Read-only verification confirms:
  - `brand_id=9` exists as `partnerlinks-test.myshopify.com`.
  - Shopify store for brand `9` exists with `shop_domain=partnerlinks-test.myshopify.com`.
  - `brand_owners` has one active owner row for brand `9`.
  - owner `auth_user_id=d66e565d-8e21-4896-badd-00f552ea8ad1`.
  - owner email: `austindtaylor7@gmail.com`.
  - role: `owner`.
  - source: `manual_operator`.
  - `revoked_at` is null.
- Guard checks:
  - `userOwnsBrand({ brandId: 9, authUserId: owner })` returns true.
  - active owner lookup returns a row.
  - fake non-owner auth UUID is blocked for brand `9`.
  - the brand `9` owner is blocked for brand `8`, which has no owner row.
- Route-risk report confirms:
  - `brand_owners` is visible.
  - `/brand-dashboard/:brandSlug` is `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`.
  - `/brand/setup/:brandId` is `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`.

Current runtime guarantees:

- Brand setup/dashboard routes require signed-in brand ownership.
- URL params alone do not grant brand access.
- Missing owner row fails closed.
- Non-owner access fails closed.
- Shopify OAuth callback can bind future connected brands to the signed-in owner.

Remaining limitation:

- Browser click-through for `/brand-dashboard/:brandSlug` and `/brand/setup/:brandId` as the owner still depends on signing in locally as `austindtaylor7@gmail.com`; Codex verified the server-side guard path and database binding read-only, not a live browser session with Austin's owner cookie.

Current GO / NO-GO:

- Brand owner table and brand `9` owner binding: GO.
- Server-side brand ownership guard: GO.
- Route-risk classification: GO.
- Public brand onboarding: CONTROLLED GO for owner-bound brands only.
- Existing brand `8` admin access: NO-GO until owner row exists.
- Live creator payouts: NO-GO.
- Brand charging / Stripe PaymentIntent collection: NO-GO.
- Settlement collection / automatic settlement transitions: NO-GO.
- Claim release / reserve deduction / refund offset enforcement: NO-GO.

# Pre-Live Financial Hardening Pass

Status: READ-ONLY DIAGNOSTIC / PHASE 6 BLOCKED

Scope:

- Advanced Phases 1, 2, 4, 5, 7, 8, 9, and 10 through read-only reports, diagnostics, and documentation.
- Did not start Phase 6 Stripe money movement.
- Did not create live Stripe transfers, PaymentIntents, brand charges, settlement collection, claim release, reserve deductions, payout clawbacks, or negative-balance collection.

Phase 1 - Financial State Integrity:

- Settlement reconciliation remains `12 PASS`.
- Existing deterministic batch: `9d07ec69-2959-433c-b9a3-46f3aebc23a8`.
- Expected settlement items: `35`.
- Existing batch settlement items: `35`.
- Brand funding obligation remains `$39.60`.
- Direct commission total: `$29.70`.
- Platform fee total: `$9.90`.
- Network override allocation total: `$2.30`.
- Network overrides remain allocation visibility only and do not increase brand funding obligation.
- Economic report confirms:
  - no Level 4+.
  - no self-generated creator network overrides.
  - no duplicate conversion order ids in scope.
  - no duplicate creator network earning keys.
  - no duplicate brand network earning keys.

Phase 2 - Canonical Payout Eligibility Resolver:

- Added `services/payoutEligibilityResolver.js`.
- Added `scripts/productionSafetyTest.js --eligibility-report`.
- Status: READ-ONLY DIAGNOSTIC.
- Resolver inputs:
  - conversions.
  - creator network earnings.
  - brand network earnings.
  - settlement items.
  - reversal items.
  - payout mode.
  - payout status / claim state.
  - settlement/manual/reserve evidence.
  - reversal/risk state.
- Resolver outputs:
  - `eligibility_state`.
  - blocker reasons.
  - warning reasons.
  - linked settlement item ids.
  - linked reversal item ids.
  - `eligible_for_live_payout=false` always in this phase.
- Current brand `9` report:
  - 24 scoped source rows evaluated.
  - all 24 are blocked.
  - blocker: missing `settlement_collected`, `manual_approved`, or `reserve_covered` evidence.
  - blocker: Phase 6 live payout release disabled.
- The resolver does not mutate `payout_status`, settlement state, claim rows, reserve rows, or Stripe state.

Phase 3 - Settlement Lifecycle:

- No operator transition mutation implemented in this pass.
- `draft -> manually_reviewed -> manually_marked_collected` remains DOCUMENTED ARCHITECTURE ONLY.
- Reason:
  - reconciliation truth should remain stable before introducing audited transition mutations.
  - manually-marked-collected requires explicit approval because it changes funding responsibility semantics even if it does not call Stripe.

Phase 4 - Refund / Reversal:

- `financial_reversal_events` and `financial_reversal_items` exist and are readable.
- Current reversal rows: `0` events and `0` items.
- Refund/reversal ingestion remains diagnostic-only.
- Eligibility resolver can block rows with reversal/offset evidence once reversal items exist.
- No clawbacks, payout offsets, negative-balance collection, dashboard total changes, or payable balance mutation were added.

Phase 5 - Reserve Architecture:

- Reserve remains DOCUMENTED ARCHITECTURE ONLY.
- `reserve_covered` is treated as a future eligibility input.
- No reserve balance table, reserve ledger, top-up, deduction, or reserve-based claim release was implemented.
- Required future model:
  - brand reserve balance ledger.
  - reserve application per settlement item.
  - reserve shortfall diagnostics.
  - low-reserve operator alerts.
  - explicit no-double-use idempotency.

Phase 7 - Operational/Admin Hardening:

- Route-risk report confirms:
  - brand owner table visible.
  - brand setup/dashboard routes require signed-in brand owner and exact brand scope.
  - payout/Stripe routes remain scoped and payout-mode gated.
  - Shopify webhooks remain signed/idempotent event handlers.
- No new dangerous admin mutation paths were added.
- Existing operator draft settlement tooling remains explicit and idempotent.

Phase 8 - Browser/User Beta Hardening:

- Dashboard money language remains separated:
  - Accounted earnings.
  - Pending settlement.
  - Claimable earnings.
  - Claimed earnings.
- Claim availability remains payout-mode and row-evidence gated.
- Brand setup/dashboard access is now brand-owner scoped.
- Remaining beta gaps:
  - rate limiting.
  - referral spam controls.
  - dedicated brand owner UX.
  - more polished blocked-state copy after browser testing.

Phase 9 - Accounting Export / Human Reconciliation:

- Read-only tools now cover:
  - route risk.
  - settlement readiness.
  - settlement reconciliation.
  - idempotency.
  - refund/reversal readiness.
  - economic invariants.
  - lineage.
  - risk signals.
  - payout eligibility blockers.
- `--eligibility-report` is the new operator answer for:
  - why an earning is blocked.
  - what settlement/reversal/risk condition is missing.
  - which settlement/reversal rows are linked.

Phase 10 - Live Rollout Strategy:

- Phase 6 remains last.
- Current staged rollout stance:
  - Stage 1 internal operator-only testing: GO.
  - Stage 2 single trusted owner-bound test brand: GO for attribution/accounting only.
  - Stage 3 manual settlement collection: NO-GO until explicit audited transition flow is approved.
  - Stage 4 manual creator payout approval: NO-GO.
  - Stage 5 limited creator beta with payouts: NO-GO.
  - Stage 6 partial automation: NO-GO.
  - Stage 7 broader rollout: NO-GO.

Validation commands run:

- `node --check services/payoutEligibilityResolver.js`
- `node --check scripts/productionSafetyTest.js`
- `node scripts/productionSafetyTest.js --dry-run --eligibility-report --brand-id 9`
- `node scripts/settlementBatchOperator.js --dry-run --report --verify-reconciliation --brand-id 9`
- `node scripts/productionSafetyTest.js --dry-run --settlement-report --refund-report --idempotency-report`
- `node scripts/productionSafetyTest.js --dry-run --route-risk-report --risk-report`
- `node scripts/productionSafetyTest.js --dry-run --economic-report --lineage-report`
- `node scripts/productionSafetyTest.js --dry-run --report --matrix-report`

Current GO / NO-GO:

- Real Shopify attribution/accounting beta: GO for controlled owner-bound brand `9`.
- Settlement reconciliation verification: GO.
- Payout eligibility explanation: GO as read-only diagnostic.
- Live creator payouts: NO-GO.
- Brand charging / Stripe PaymentIntent collection: NO-GO.
- Settlement collection / automatic transitions: NO-GO.
- Manual mark-collected transition: NO-GO until explicitly approved.
- Reserve deduction / reserve-based claim release: NO-GO.
- Refund offset enforcement / clawbacks / negative-balance collection: NO-GO.
- Phase 6 Stripe money movement hardening: intentionally last and NOT STARTED.

# Operator Reviewed Settlement Transition

Status: RUNTIME-ENFORCED OPERATOR-ONLY SCRIPT / NO MONEY MOVEMENT

Implemented:

- `scripts/settlementBatchOperator.js` now supports an explicit operator review transition:
  - `--review-draft`
  - `--batch-id <uuid>` or `--batch-key <key>`
  - `--operator <name>`
  - `--notes <text>`
  - `--dry-run`
- Because the current database state machine does not include a safe `manually_reviewed` settlement status, the runtime transition preserves:
  - `settlement_batches.settlement_status = settlement_pending`
  - `settlement_items.settlement_status = settlement_pending`
  - `collected_amount = 0`
  - `settlement_collected_at = null`
  - `manual_approved_at = null`
  - `reserve_covered_at = null`
- The reviewed state is stored as operator review metadata:
  - `settlement_batches.metadata.review_status = manually_reviewed`
  - `reviewed_at`
  - `reviewed_by`
  - `review_notes`
  - deterministic `review_audit_event_key`
- The transition writes one deterministic `settlement_audit_events` row using:
  - `event_type = batch_status_transition`
  - `from_status = settlement_pending`
  - `to_status = settlement_pending`
  - evidence showing `before_review_status -> manually_reviewed`
  - no-money-movement flags.

Command syntax:

```bash
node scripts/settlementBatchOperator.js --dry-run --review-draft --batch-id 9d07ec69-2959-433c-b9a3-46f3aebc23a8 --operator Austin --notes "Manual review dry run. No money movement."
```

Approved write command shape, only when explicitly intended:

```bash
node scripts/settlementBatchOperator.js --review-draft --batch-id <settlement_batch_id> --operator <operator_name> --notes "<review notes>"
```

What this mutates in write mode:

- `settlement_batches.metadata`
- `settlement_batches.audit_notes`
- `settlement_batches.updated_at`
- one idempotent `settlement_audit_events` row.

What this does NOT mutate:

- conversions.
- creator network earnings.
- brand network earnings.
- creator earning claims.
- payout rows.
- payout status.
- claimability.
- Stripe state.
- settlement collection state.
- reserve state.
- dashboard totals.

Validation:

- `node --check scripts/settlementBatchOperator.js`: PASS.
- `node --check scripts/productionSafetyTest.js`: PASS.
- `node --check services/payoutEligibilityResolver.js`: PASS.
- Dry-run review of batch `9d07ec69-2959-433c-b9a3-46f3aebc23a8`: PASS, would create audit key `settlement_audit:9d07ec69-2959-433c-b9a3-46f3aebc23a8:manually_reviewed`.
- Settlement reconciliation for brand `9`: PASS, 12 PASS checks.
- `productionSafetyTest.js --settlement-report --idempotency-report`: PASS, no duplicate Shopify orders, settlement/audit idempotency clean.
- Eligibility report for brand `9`: PASS, all rows remain `eligible_for_live_payout=false`.

Current GO / NO-GO:

- `draft -> manually_reviewed` operator review: GO as explicit operator-only script.
- `manually_reviewed -> manually_marked_collected`: NO-GO / NOT IMPLEMENTED.
- Live creator payouts: NO-GO.
- Brand charging / Stripe PaymentIntent collection: NO-GO.
- Settlement collection: NO-GO.
- Automatic claim release: NO-GO.

## Sandbox Stripe Money-Movement Readiness

Status: READ-ONLY DIAGNOSTIC / SANDBOX ONLY / LIVE PAYOUTS NO-GO

What changed:

- `scripts/productionSafetyTest.js` now supports:
  - `--sandbox-payout-readiness`
  - `--creator-code <creator_code>`
- The report previews sandbox claim readiness without reserving rows, creating claim ledger rows, calling Stripe, marking rows claimed, or changing `payout_status`.
- The report safely shows:
  - Stripe key mode as `test`, `live`, `missing`, or `unknown` without exposing secrets.
  - `PAYOUT_MODE` and payout gate reason.
  - whether sandbox payout testing is allowed.
  - whether live payout testing remains blocked.
  - creator auth binding, Stripe account presence, onboarding status, and payouts-enabled state.
  - rows that would be reserved in a sandbox claim.
  - rows blocked from reservation and why.
  - existing claim batches, duplicate transfer risks, stuck reservations, and live eligibility blockers.

Current verified actor:

- `test-creator-04`
- Creator id: `13`
- Email: `andycoinsolana@gmail.com`
- Auth binding: present.
- Stripe connected account: present.
- Stripe onboarding status: `payouts_enabled`.
- Local Stripe key mode: `test`.
- Local `PAYOUT_MODE`: `sandbox_time_based`.

Current readiness result:

- Sandbox environment/actor guardrails: PASS.
- Immediate sandbox transfer readiness for `test-creator-04`: BLOCKED.
- Blocker: no reservable sandbox claim amount exists.
- Existing claim ledger already contains the prior successful sandbox test transfer for direct commission amount `$2.70`.
- Existing claimed conversion is not reservable again because it is already claimed and linked to claim batch `b165c948-b74d-474c-b042-c8b75f6eb037`.
- Duplicate transfer risks: 0.
- Stuck reservations: 0.
- `eligible_for_live_payout`: false.

Exact readiness command:

```bash
node scripts/productionSafetyTest.js --dry-run --sandbox-payout-readiness --creator-code test-creator-04
```

Supporting verification commands:

```bash
node scripts/productionSafetyTest.js --dry-run --eligibility-report --creator-code test-creator-04
node scripts/productionSafetyTest.js --dry-run --idempotency-report --route-risk-report
node scripts/settlementBatchOperator.js --dry-run --report --verify-reconciliation --brand-id 9
```

Next sandbox-only test path:

- Create or prepare a new deterministic, attributed Shopify test conversion for `test-creator-04`.
- Wait for the row to become sandbox-claimable under `PAYOUT_MODE=sandbox_time_based`, or use an explicitly approved sandbox-only preparation path.
- Re-run the sandbox payout readiness report.
- Only execute the real claim route after the readiness report says GO and the operator explicitly approves the sandbox test action.

No SQL is required for this diagnostic.

No Stripe action was executed in this pass.

No money movement occurred in this pass.

Live payout status remains NO-GO:

- Production must remain `PAYOUT_MODE=claims_disabled`.
- Live Stripe transfers remain blocked.
- Brand charging, settlement collection, reserve deduction, refund offset enforcement, and automatic claim release remain blocked.

## Sandbox Claim Operator Wrapper

Status: RUNTIME-AVAILABLE SANDBOX-ONLY OPERATOR SCRIPT / DRY-RUN DEFAULT / LIVE PAYOUTS NO-GO

What changed:

- Added `scripts/sandboxClaimOperator.js`.
- The script is a sandbox-only wrapper around the existing `claimCreatorEarnings()` service path.
- It does not duplicate payout math or Stripe transfer logic.
- It exists only to run one controlled Stripe test-mode transfer when browser dashboard money states remain settlement-aware/fail-closed.

Required dry-run command:

```bash
node scripts/sandboxClaimOperator.js --dry-run --creator-code test-creator-04 --conversion-id 26
```

Approved execute command shape, only after explicit operator approval:

```bash
node scripts/sandboxClaimOperator.js --execute --confirm-sandbox-stripe-transfer --creator-code test-creator-04 --conversion-id 26
```

Hard safety gates:

- `STRIPE_SECRET_KEY` must be `sk_test_...`.
- `PAYOUT_MODE` must be `sandbox_time_based`.
- `--creator-code` must be exactly `test-creator-04`.
- `--conversion-id` must be exactly the requested conversion.
- `--execute` requires `--confirm-sandbox-stripe-transfer`.
- conversion must belong to `test-creator-04`.
- conversion must be unclaimed with `claim_batch_id = null`.
- duplicate Stripe transfer risk must be `0`.
- stuck reservations must be `0`.
- the requested conversion must be the only reservable row for the creator.

Dry-run result for conversion `26`:

- Status: GO.
- Would call Stripe now: false.
- Would create Stripe test transfer on execute: true.
- Creator id: `13`.
- Destination Stripe account: `acct_1TXlmIBcYxOEFHEX`.
- Reservable row:
  - table: `conversions`
  - id: `26`
  - order_id: `shopify:partnerlinks-test.myshopify.com:6550995533998`
  - amount: `$2.70`
  - payout_status: `pending`
  - claim_batch_id: null.
- Duplicate transfer risks: `0`.
- Stuck reservations: `0`.
- `eligible_for_live_payout`: false.

What execute mode may mutate on success:

- `conversions` row `26`:
  - `payout_status`
  - `claim_batch_id`
  - `claimed_at`
- `creator_earning_claims`:
  - one new immutable claim ledger row.
- Stripe test mode:
  - one test transfer using the generated claim batch id as idempotency key.

What execute mode must not mutate:

- `settlement_batches`.
- `settlement_items`.
- `settlement_audit_events`.
- `financial_reversal_events`.
- `financial_reversal_items`.
- brand billing/charging tables.
- brand reserve tables.
- settlement collection state.
- live payout eligibility state.

Browser dashboard behavior:

- The browser dashboard remains settlement-aware/fail-closed.
- It may show fresh accounted earnings as `Pending settlement` and `$0.00` claimable when the deployed runtime is not in local sandbox payout mode.
- Do not use the browser dashboard for this sandbox transfer test.

Post-execute verification commands:

```bash
node scripts/productionSafetyTest.js --dry-run --sandbox-payout-readiness --creator-code test-creator-04
node scripts/productionSafetyTest.js --dry-run --eligibility-report --creator-code test-creator-04
node scripts/productionSafetyTest.js --dry-run --idempotency-report --route-risk-report
node scripts/productionSafetyTest.js --dry-run --order-report --order-id shopify:partnerlinks-test.myshopify.com:6550995533998
```

No Supabase SQL is required for this operator wrapper.

No Stripe action was executed in the implementation pass.

## Shopify Public Distribution Install Readiness

Status: MANUAL OPERATOR TASK / SHOPIFY REVIEW BLOCKER / NO PAYOUT OR SETTLEMENT CHANGE

Current diagnosis:

- PartnerLinks selected Shopify Public distribution.
- Public distribution is the correct long-term path for installing across many independent merchant stores.
- Public distribution does not by itself mean the app is approved.
- External production stores cannot install a not-yet-approved public app.
- Brand B and Brand C external installs are blocked by Shopify app review/distribution status, not by PartnerLinks payout/settlement code.

Current app URL assumptions:

- `SHOPIFY_APP_URL` controls Shopify OAuth redirect construction.
- `PUBLIC_BASE_URL` controls public PartnerLinks links and can be used as fallback for `SHOPIFY_APP_URL`.
- Production values should both be:
  - `https://partnerlinks.app`

Required Shopify Partner / Dev Dashboard URLs:

- App URL:
  - `https://partnerlinks.app/register-business`
  - Alternative acceptable if Shopify expects the install entrypoint to start OAuth directly:
    - `https://partnerlinks.app/api/shopify/start`
- Allowed redirection URLs:
  - `https://partnerlinks.app/api/shopify/callback`
- Webhook endpoints:
  - `https://partnerlinks.app/webhooks/shopify/orders-paid`
  - `https://partnerlinks.app/webhooks/shopify/refunds-create`
- App homepage:
  - `https://partnerlinks.app/`
- Brand setup / internal install start:
  - `https://partnerlinks.app/register-business`

Current OAuth route behavior:

- `GET /api/shopify/start`
  - requires signed-in Supabase auth user.
  - validates `shop`.
  - creates Shopify OAuth `state`.
  - redirects to Shopify OAuth authorize URL.
- `GET /api/shopify/callback`
  - validates OAuth state.
  - requires signed-in Supabase auth user.
  - validates Shopify callback HMAC.
  - exchanges code for access token.
  - upserts `shopify_stores`.
  - creates/reuses a brand.
  - binds `brand_owners` for the signed-in auth user.
  - redirects to `/brand/setup/:brandId`.

Current scopes:

- `SHOPIFY_SCOPES=read_orders,read_customers` in `.env.example`.
- `read_orders` is needed for order/webhook conversion attribution.
- `read_customers` should be treated as a review risk unless specifically needed for current functionality.
- Do not add broad scopes.
- Before review, prefer least privilege and remove `read_customers` if the app does not need customer records.

External install status:

- Brand B:
  - display name: `novo-loom`
  - Shopify domain: `1ncc1j-yw.myshopify.com`
  - intended owner email: `fredcointron@gmail.com`
  - product: Nova Focus Gummies, `$30`
  - production external install before Shopify approval: BLOCKED.
- Brand C:
  - display name: `solace-market`
  - Shopify domain: `euz1e0-sf.myshopify.com`
  - intended owner email: `macicoinsol@gmail.com`
  - product: Solace Recovery Mix, `$45`
  - production external install before Shopify approval: BLOCKED.

Testing before review:

- Use development stores that are installable from the Shopify Dev Dashboard app overview/install flow.
- If Brand B/C are normal independent production stores, they likely cannot install until app approval.
- If Brand B/C can be recreated as development stores in the same Dev Dashboard context, they can be used for pre-review sandbox testing.
- Do not switch to custom distribution because PartnerLinks needs independent multi-merchant SaaS distribution long term.
- Do not submit app review until compliance URLs, scopes, privacy webhooks, and onboarding flow are ready.

Required compliance/listing items before review:

- privacy policy URL.
- terms of service URL.
- support URL or support email.
- app homepage.
- app listing content and install/testing instructions.
- compliance/privacy webhooks such as customer data request/redact and shop redact if required by Shopify app review.

Runtime/schema impact:

- Multi-store install does not require a new database schema today.
- `shopify_stores.shop_domain` is unique and linked to `brand_id`.
- `brand_owners` binds the signed-in PartnerLinks user to the exact connected brand.
- Each external install should start from a signed-in PartnerLinks brand owner so ownership remains deterministic.

NO-GO boundaries:

- no payout logic changes.
- no settlement logic changes.
- no Stripe money movement.
- no broad Shopify scopes.
- no public review submission without explicit approval.
- no deploy/push without explicit approval.

## Multi-Brand Install / Isolation Verification - Current Brand B/C Topology

Status: READ-ONLY DIAGNOSTIC / PARTIALLY VERIFIED / NO PAYOUT OR SETTLEMENT CHANGE

Important stale-data note:

- Earlier Brand B/C domains and products are historical only.
- Do not rely on `1ncc1j-yw.myshopify.com` or `euz1e0-sf.myshopify.com` for current Brand B/C testing.
- No stale shopify_stores rows currently exist for those old domains.

Read-only verification results:

- Brand A:
  - brand_id `9`
  - name `partnerlinks-test.myshopify.com`
  - shop_domain `partnerlinks-test.myshopify.com`
  - dashboard slugs `partnerlinks-test-my` and `partnerlinks-test-myshopify-com`
  - creator commission `15%`
  - active owner `austindtaylor7@gmail.com`
  - owner binding remains runtime-enforced.
- Brand B:
  - brand_id `11`
  - name `novo-loom.myshopify.com`
  - shop_domain `novo-loom.myshopify.com`
  - dashboard slugs `novo-loom-myshopify-` and `novo-loom-myshopify-com`
  - destination URL `https://novo-loom.myshopify.com`
  - expected product URL `https://novo-loom.myshopify.com/products/novo-gummies`
  - creator commission `25%`
  - owner row for `fredcointron@gmail.com`: MISSING / MANUAL OPERATOR TASK.
- Brand C:
  - brand_id `10`
  - name `solace-market-588vpz0h.myshopify.com`
  - shop_domain `solace-market-588vpz0h.myshopify.com`
  - dashboard slugs `solace-market-588vpz` and `solace-market-588vpz0h-myshopify-com`
  - destination URL `https://solace-market-588vpz0h.myshopify.com`
  - expected product URL `https://solace-market-588vpz0h.myshopify.com/products/solace-recovery-kit`
  - creator commission `20%`
  - owner row for `macicoinsol@gmail.com`: MISSING / MANUAL OPERATOR TASK.

Current isolation guarantees:

- `shopify_stores.shop_domain` has no duplicate rows for the active domains.
- Brand B and Brand C each map to a distinct `brand_id`.
- Webhook attribution can distinguish Brand A/B/C by exact `X-Shopify-Shop-Domain` when Shopify webhooks arrive from those domains.
- Brand dashboard and setup routes require exact signed-in brand owner scope.
- Missing owner rows fail closed, so Brand B/C dashboards are protected but not yet accessible to their intended owners.

Current product-route limitation:

- Product-specific `/r/:brandSlug/:creatorCode/:productSlug` routing is still driven by the in-app mock featured brand catalog.
- Runtime product metadata currently only has a real Shopify-backed cart permalink path for Aria Wellness / `test-product`.
- Brand B/C Shopify products are present as expected URLs, but product-specific PartnerLinks referral routes for `novo-gummies` and `solace-recovery-kit` are not yet verified as active runtime product routes.
- Generic brand referral routes can resolve the brand rows, but active product-specific testing needs explicit product metadata or a product catalog source before checkout validation.

Manual operator tasks:

- Add active `brand_owners` rows for:
  - brand_id `11` -> `fredcointron@gmail.com`
  - brand_id `10` -> `macicoinsol@gmail.com`
- Use confirmed Supabase Auth user ids from the signed-in app context before inserting owner rows.
- After owner rows exist, browser-test signed-in access:
  - Brand B owner can access only `/brand-dashboard/novo-loom-myshopify-`.
  - Brand C owner can access only `/brand-dashboard/solace-market-588vpz`.
  - Brand A owner isolation remains intact.

NO-GO boundaries:

- no deletion of stale rows until explicitly approved.
- no payout logic changes.
- no settlement logic changes.
- no Stripe money movement.
- no brand charging.
- no deploy/push without explicit approval.

## Brand B/C Owner Binding Verification

Status: RUNTIME-ENFORCED / READ-ONLY VERIFIED / NO PAYOUT OR SETTLEMENT CHANGE

Austin manually inserted `brand_owners` rows for Brand B and Brand C.

Read-only verification confirms:

- Brand A:
  - brand_id `9`
  - shop_domain `partnerlinks-test.myshopify.com`
  - owner `austindtaylor7@gmail.com`
  - auth_user_id `d66e565d-8e21-4896-badd-00f552ea8ad1`
  - owner access to Brand A: PASS
- Brand B:
  - brand_id `11`
  - shop_domain `novo-loom.myshopify.com`
  - owner `fredcointron@gmail.com`
  - auth_user_id `2b51e557-bfff-4346-83d7-eca0124eee96`
  - owner access to Brand B: PASS
- Brand C:
  - brand_id `10`
  - shop_domain `solace-market-588vpz0h.myshopify.com`
  - owner `macicoinsol@gmail.com`
  - auth_user_id `8c50f151-51af-4f51-9c5a-062675e096a2`
  - owner access to Brand C: PASS

Cross-brand isolation checks:

- Brand B owner blocked from Brand C: PASS.
- Brand B owner blocked from Brand A: PASS.
- Brand C owner blocked from Brand B: PASS.
- Brand C owner blocked from Brand A: PASS.
- Brand A owner blocked from Brand B: PASS.
- Brand A owner blocked from Brand C: PASS.
- Fake non-owner blocked from Brand B: PASS.
- Fake non-owner blocked from Brand C: PASS.

Route-risk report:

- `brand_owners` table visible with count `3`.
- `/brand-dashboard/:brandSlug` remains classified as `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`.
- `GET /brand/setup/:brandId` remains classified as `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`.
- `POST /brand/setup/:brandId` remains classified as `REQUIRES_SIGNED_IN_BRAND_OWNER_AND_EXACT_BRAND_SCOPE`.

Validation:

- `node --check index.js`
- `node --check services/brandOwnershipService.js`
- `node --check scripts/productionSafetyTest.js`
- `node scripts/productionSafetyTest.js --dry-run --route-risk-report`

Remaining limitation:

- Browser click-through still needs to be tested while signed in as each brand owner:
  - Brand B: `/brand-dashboard/novo-loom-myshopify-`
  - Brand C: `/brand-dashboard/solace-market-588vpz`
- Brand B/C product-specific referral routes still need explicit product metadata/link verification before checkout attribution testing.

NO-GO boundaries:

- no payout logic changes.
- no settlement logic changes.
- no Stripe money movement.
- no brand charging.
- no claim release.
- no deploy/push without explicit approval.

## Brand B Creator Chain Verification

Status: READ-ONLY VERIFIED / PRODUCT CHECKOUT ROUTE NOT READY / NO PAYOUT OR SETTLEMENT CHANGE

Brand B:

- brand_id `11`
- runtime brand name `novo-loom.myshopify.com`
- shop_domain `novo-loom.myshopify.com`
- owner `fredcointron@gmail.com`
- creator commission `25%`

Verified Brand B origin and creator chain:

- Brand B -> `epep`
  - creator_id `32`
  - email `epepcoinsol@gmail.com`
  - auth_user_id `75a955d9-ed6b-4b7e-99fc-3f6ac8b268a3`
  - `invited_by_brand_id=11`
  - `parent_creator_id=null`
  - brand invite session bound: PASS
- `epep` -> `ctofnf`
  - creator_id `33`
  - email `ctofnf@gmail.com`
  - auth_user_id `4e0608ee-4d69-401a-93e6-2edd2b3e7471`
  - `parent_creator_id=32`
- `ctofnf` -> `gibby`
  - creator_id `34`
  - email `gibbysolana@gmail.com`
  - auth_user_id `e96d82f0-ac27-4404-93dc-40ab8f5241b9`
  - `parent_creator_id=33`
- `gibby` -> `goatse`
  - creator_id `35`
  - email `goatse550@gmail.com`
  - auth_user_id `813b80b7-eca8-4b8e-8623-4334fa379b17`
  - `parent_creator_id=34`
- `goatse` -> `solrocks`
  - creator_id `36`
  - email `solrocksnft@gmail.com`
  - auth_user_id `f35a5d07-360c-48c3-b446-9d3ff40071ad`
  - `parent_creator_id=35`

Lineage integrity:

- All five creator accounts exist.
- No duplicate creator rows by target email.
- No duplicate creator rows by target auth_user_id.
- No creator in this chain is attached to Brand A or Brand C through `brand_id`.
- No creator has accidental dual brand-origin and creator-origin lineage.
- No conversions or network earnings currently exist for this Brand B chain.

Expected economics for a future `solrocks` Brand B sale:

- Direct commission recipient: `solrocks`.
- Brand B creator commission rate: `25%`.
- For a `$25.00` order:
  - direct creator commission: `$6.25`.
  - expected PartnerLinks platform fee at current default `5%`: `$1.25`.
  - Level 1 creator override: `goatse`, 30% of platform fee = `$0.38`.
  - Level 2 creator override: `gibby`, 3% of platform fee = `$0.04`.
  - Level 3 creator override: `ctofnf`, 2% of platform fee = `$0.03`.
  - Level 4+ creator override: blocked by runtime cap.
  - `epep` would be depth 4 from `solrocks` and should not receive a creator override for this sale.
  - Brand B origin reward is not expected for this deepest sale because the runtime cap is consumed by three creator levels before reaching the brand-origin creator.

Product checkout readiness:

- Not ready to place a Brand B Shopify Bogus Gateway attribution test order yet.
- Product-specific `/r/:brandSlug/:creatorCode/:productSlug` routing is still dependent on explicit product metadata/mock catalog entries.
- `Novo Gummies` / `novo-gummies` is not yet configured as a Shopify-backed PartnerLinks product with cart permalink attributes.
- Generic `/r/:brandSlug/:creatorCode` currently requires creator rows scoped to the brand through `brand_id`, while these Brand B chain creators are global creator rows with `brand_id=null`.
- Before checkout testing, add or verify a deterministic Brand B product route that:
  - resolves `novo-loom-myshopify-` or canonical Brand B slug.
  - resolves creator code `solrocks`.
  - redirects to `https://novo-loom.myshopify.com/products/novo-gummies` or a Shopify cart permalink.
  - preserves `partnerlinks_ref`, `creator_code`, `brand_slug`, and `product_slug` through Shopify cart/order attributes.
  - sets `shop_domain=novo-loom.myshopify.com` in click/session diagnostics.

NO-GO until product route is configured:

- Do not place a Brand B checkout attribution test expecting deterministic Shopify attribution.
- Do not use Brand B checkout results to validate economics until product route/cart attribute persistence is proven.
- Do not alter payout, Stripe, settlement, claim, reserve, refund, or earnings math.

## Brand B Novo Gummies Product Route Wiring

Status: RUNTIME WIRED / FAIL-CLOSED UNTIL `NOVO_LOOM_GUMMIES_VARIANT_ID` IS SET / NO PAYOUT OR SETTLEMENT CHANGE

What changed:

- Added Shopify-backed product metadata for Brand B `Novo Gummies`.
- Added public Shopify brand slug mappings:
  - `novo-loom-myshopify-` -> `novo-loom.myshopify.com`
  - `novo-loom-myshopify-com` -> `novo-loom.myshopify.com`
- Added environment variable:
  - `NOVO_LOOM_GUMMIES_VARIANT_ID`
- Added fail-closed product routing behavior for Brand B:
  - if `NOVO_LOOM_GUMMIES_VARIANT_ID` is missing, the product route returns a safe not-configured response instead of silently falling back to a non-deterministic product page redirect.
  - if `NOVO_LOOM_GUMMIES_VARIANT_ID` is present, the product route uses Shopify cart permalink attribution.

Expected Brand B referral URL after deploy and env configuration:

```text
https://partnerlinks.app/r/novo-loom-myshopify-/solrocks/novo-gummies
```

Expected Shopify redirect shape:

```text
https://novo-loom.myshopify.com/cart/{NOVO_LOOM_GUMMIES_VARIANT_ID}:1?attributes[partnerlinks_ref]=...&attributes[creator_code]=solrocks&attributes[brand_slug]=novo-loom-myshopify-&attributes[product_slug]=novo-gummies&attributes[shop_domain]=novo-loom.myshopify.com&ref=...
```

Attribution fields persisted before Shopify checkout:

- `partnerlinks_ref`
- `creator_code=solrocks`
- `brand_slug=novo-loom-myshopify-`
- `product_slug=novo-gummies`
- `shop_domain=novo-loom.myshopify.com`

Manual operator tasks before placing Brand B Bogus Gateway order:

- Set `NOVO_LOOM_GUMMIES_VARIANT_ID` in Railway/production env.
- Deploy the route change.
- Open `https://partnerlinks.app/r/novo-loom-myshopify-/solrocks/novo-gummies`.
- Confirm redirect uses `/cart/{variantId}:1` on `novo-loom.myshopify.com`.
- Then place the Shopify Bogus Gateway order manually.

NO-GO boundaries:

- no payout changes.
- no Stripe changes.
- no settlement changes.
- no claim changes.
- no reserve changes.
- no refund changes.
- no earnings math or network rate changes.

## Brand B Bogus Gateway Order Verification

Status: CHECK / REFERRAL CLICK VERIFIED / SHOPIFY WEBHOOK INGESTION NOT VERIFIED

Order under test:

- Shopify order id `6176193511508`
- Expected PartnerLinks order id `shopify:novo-loom.myshopify.com:6176193511508`
- Brand B `brand_id=11`
- shop_domain `novo-loom.myshopify.com`
- creator code `solrocks`
- product slug `novo-gummies`

Read-only verification results:

- Brand B referral clicks exist:
  - click ids `74`, `75`, `76`
  - `brand_id=11`
  - `creator_id=36`
  - `product_slug=novo-gummies`
  - `shop_domain=novo-loom.myshopify.com`
  - latest `partnerlinks_ref=2a802b26-f101-41d0-9b28-e13f42d254d5`
- No `shopify_attribution_events` rows currently exist for:
  - `shopify_order_id=6176193511508`
  - `order_id=shopify:novo-loom.myshopify.com:6176193511508`
  - `shop_domain=novo-loom.myshopify.com`
- No `conversions` row exists for this order.
- No `creator_network_earnings` rows exist for this order.
- No `brand_network_earnings` rows exist for this order.
- No settlement items/draft obligation currently exist for Brand B because there are no Brand B conversion rows yet.

Expected economics once Shopify `orders/paid` ingestion is working:

- Direct commission recipient: `solrocks`.
- Direct commission: `$6.25` on a `$25.00` order at 25%.
- Platform fee at current default 5%: `$1.25`.
- Level 1: `goatse`, approximately `$0.38`.
- Level 2: `gibby`, approximately `$0.04`.
- Level 3: `ctofnf`, approximately `$0.03`.
- Level 4+: blocked; `epep` should receive nothing for this deepest-chain sale.
- Brand B origin reward is not expected for this deepest sale because the three-level cap is consumed by creator levels.

Current likely blocker:

- Shopify `orders/paid` webhook delivery/registration for `novo-loom.myshopify.com` has not been proven.
- The app code contains signed webhook handlers but does not currently show automatic webhook registration logic in `services/shopifyService.js`.
- A read-only Admin API webhook listing attempt for `novo-loom.myshopify.com` returned a Shopify 403 related to token format, so webhook registration could not be confirmed from Codex.

NO-GO until fixed/verified:

- Do not treat Brand B checkout as an attribution/economics PASS.
- Do not use this order to validate Brand B direct commission, network earnings, or settlement draftability.
- Confirm/register Shopify `orders/paid` webhook for Brand B, then replay or place a new Bogus Gateway order after webhook delivery is verified.
- Do not alter payout, Stripe, settlement, claim, reserve, refund, or earnings math.

## Multi-Store Shopify Webhook Registration

Status: RUNTIME WIRED FOR FUTURE INSTALLS / EXPIRING OFFLINE TOKEN FIX PREPARED / EXISTING STORES REQUIRE MIGRATION + DEPLOY + REINSTALL / NO PAYOUT OR SETTLEMENT CHANGE

What changed:

- Added automatic required Shopify webhook registration after OAuth install/callback.
- Added `scripts/shopifyWebhookOperator.js` for read-only webhook status reporting and explicit operator registration.
- Added required Shopify scope:
  - `write_webhooks`
- Required webhook topics:
  - `orders/paid` -> `/webhooks/shopify/orders-paid`
  - `refunds/create` -> `/webhooks/shopify/refunds-create`
- Registration is idempotent:
  - lists existing subscriptions first.
  - creates only missing required topic/address pairs.
  - does not create duplicates when matching subscriptions already exist.

Current read-only status:

- Brand A `partnerlinks-test.myshopify.com`:
  - access token present.
  - webhook status check failed with Shopify Admin API token-format error.
  - active webhook registration could not be confirmed from Codex.
- Brand B `novo-loom.myshopify.com`:
  - access token present.
  - webhook status check failed with Shopify Admin API token-format error.
  - `orders/paid` delivery remains unverified.
- Brand C `solace-market-588vpz0h.myshopify.com`:
  - access token present.
  - webhook status check failed with Shopify Admin API token-format error.
  - active webhook registration could not be confirmed from Codex.

Observed Shopify Admin API error for existing stored tokens:

```text
[API] Non-expiring access tokens are no longer accepted for the Admin API.
```

Root cause:

- PartnerLinks was still exchanging Shopify OAuth authorization codes for legacy non-expiring offline Admin API tokens.
- Current Shopify public-app installs require expiring offline tokens for this app path.
- Expiring offline tokens require `expiring=1` during token exchange and storage of token metadata:
  - `refresh_token`
  - `access_token_expires_at`
  - `refresh_token_expires_at`
  - `granted_scopes`
  - `token_type`
  - `token_last_refreshed_at`

Prepared fix:

- Added additive migration `database/migrations/020_shopify_expiring_offline_tokens.sql`.
- OAuth callback now stores expiring offline token metadata instead of treating the token response as a raw string.
- Shopify token exchange now sends `expiring=1`.
- Shopify access-token refresh support exists for operator registration paths.
- Webhook operator reports token metadata without printing token values.
- `--register` can refresh an expiring offline token before webhook registration.

Manual deployment sequence required:

1. Run `database/migrations/020_shopify_expiring_offline_tokens.sql` manually in Supabase.
2. Deploy/restart Railway with this code.
3. Reinstall/reconnect Brand B through Shopify OAuth so Shopify issues a new expiring offline token.
4. Run:

```bash
node scripts/shopifyWebhookOperator.js --dry-run --report --brand-id 11
```

5. Confirm `api_ok=true`, `write_webhooks_granted=true`, and required webhook callbacks are present or safely registerable.

Production configuration required:

- Railway must set:
  - `SHOPIFY_APP_URL=https://partnerlinks.app`
  - `SHOPIFY_SCOPES=read_orders,read_customers,write_webhooks`
- Existing stores likely need OAuth reinstall/reconnect after deploy so Shopify issues a token with the required webhook scope and usable token format.

Operator commands:

```bash
node scripts/shopifyWebhookOperator.js --dry-run --report --brand-id 11
node scripts/shopifyWebhookOperator.js --dry-run --report
```

Explicit registration command after deploy/reinstall and approval:

```bash
node scripts/shopifyWebhookOperator.js --register --brand-id 11
```

Important:

- Do not run `--register` until `SHOPIFY_APP_URL` points to `https://partnerlinks.app` in the runtime that executes the command.
- If run locally with local `.env`, callback URLs will point to `http://localhost:3000`.
- Prefer production/Railway runtime for registration so callback URLs are correct.

Validation:

- `node --check services/shopifyService.js`
- `node --check services/shopifyWebhookService.js`
- `node --check index.js`
- `node --check scripts/productionSafetyTest.js`
- `node --check scripts/shopifyWebhookOperator.js`
- `git diff --check`

NO-GO:

- Brand B economics remain unverified until a new `orders/paid` webhook is delivered and creates `shopify_attribution_events`.
- Do not replay or place another Brand B order until webhook registration is confirmed with an expiring offline token accepted by Shopify.
- No payout, Stripe, settlement, claim, reserve, refund, or earnings math changed.

## Brand-Scoped Shopify Reconnect Route

Status: RUNTIME-ENFORCED OWNER-SCOPED OAUTH START / NO FINANCIAL LOGIC CHANGE

Why added:

- Brand B Shopify admin showed PartnerLinks uninstalled while PartnerLinks still had a local `shopify_stores` row.
- Generic `/api/shopify/start?shop=novo-loom.myshopify.com` was not reliably moving the signed-in Brand B owner into Shopify OAuth in browser testing.
- Brand B needed an exact owner-scoped reconnect path that preserves brand/store/creator/lineage/product data.

Runtime behavior:

- New route:
  - `/brand/setup/:brandId/reconnect-shopify`
- Requires signed-in Supabase auth user.
- Requires active exact `brand_owners` ownership for the requested `brandId`.
- Reads the scoped `shop_domain` from the existing `shopify_stores` row.
- Starts Shopify OAuth for that exact shop.
- Logs the runtime `SHOPIFY_SCOPES`, parsed scopes, `write_webhooks` presence, redirect URI, brand id, and shop domain.
- Does not delete or mutate brand/store/creator/lineage/product data before OAuth.
- Does not touch payouts, Stripe, settlement, claims, reserves, refunds, or earnings math.

Brand B reconnect URL:

```text
https://partnerlinks.app/brand/setup/11/reconnect-shopify
```

Read-only OAuth scope diagnostic:

```bash
SHOPIFY_APP_URL=https://partnerlinks.app node scripts/shopifyWebhookOperator.js --dry-run --oauth-debug --brand-id 11
```

Validation:

- `node --check index.js`
- `node --check services/shopifyService.js`
- `node --check scripts/shopifyWebhookOperator.js`
- `git diff --check`

Next required Brand B sequence:

1. Deploy this route.
2. Sign in as `fredcointron@gmail.com`.
3. Open `https://partnerlinks.app/brand/setup/11/reconnect-shopify`.
4. Complete Shopify OAuth.
5. Run the webhook report and verify `write_webhooks_granted=true`.
6. Register missing webhooks only after the read-only report shows the token is scoped correctly.

## Brand B Shopify Protected Customer Data Gate And Sandbox Replay Tool

Status: READ-ONLY/DIAGNOSTIC TOOLING ADDED / PRODUCTION WEBHOOK REGISTRATION BLOCKED BY SHOPIFY PROTECTED CUSTOMER DATA APPROVAL / NO PAYOUT OR SETTLEMENT CHANGE

Provider/platform finding:

- Shopify Admin API token access for Brand B is usable, and webhook operator mutation mode is functional.
- Shopify rejects app-created `orders/paid` and `refunds/create` subscriptions for Brand B with protected customer data errors.
- `orders/paid` and `refunds/create` are protected customer data topics.
- `write_webhooks` is not the production blocker and must not be treated as an invented standalone fix.
- Production-grade multi-tenant Shopify ingestion remains blocked until Shopify protected customer data access/app review requirements are satisfied.

Sandbox-only diagnostic tooling:

- Added `scripts/replayBrandBOrdersPaidWebhook.js`.
- The script constructs a signed Shopify `orders/paid` request for Brand B order `6176193511508`.
- It sends the request to the real PartnerLinks webhook route:
  - `POST /webhooks/shopify/orders-paid`
- It uses `SHOPIFY_WEBHOOK_SECRET` to compute a valid `X-Shopify-Hmac-Sha256`.
- It includes Shopify headers:
  - `X-Shopify-Shop-Domain`
  - `X-Shopify-Topic`
  - `X-Shopify-Hmac-Sha256`
  - `X-Shopify-Webhook-Id`
  - `X-Shopify-Triggered-At`
- Default mode is dry-run/read-only.
- Execution requires:
  - `--execute`
  - `--confirm-sandbox-webhook-replay`

Expected Brand B replay economics:

- Brand: `brand_id=11`, `novo-loom.myshopify.com`.
- Order id: `shopify:novo-loom.myshopify.com:6176193511508`.
- Source creator: `solrocks`.
- Direct commission: `$6.25`.
- Platform fee: `$1.25`.
- Level 1: `goatse`, approximately `$0.38`.
- Level 2: `gibby`, approximately `$0.04`.
- Level 3: `ctofnf`, approximately `$0.03`.
- Level 4+: blocked; `epep` should receive no creator-network row.

Dry-run command:

```bash
SHOPIFY_APP_URL=https://partnerlinks.app node scripts/replayBrandBOrdersPaidWebhook.js --dry-run
```

Execution command, only after explicit operator approval:

```bash
SHOPIFY_APP_URL=https://partnerlinks.app node scripts/replayBrandBOrdersPaidWebhook.js --execute --confirm-sandbox-webhook-replay
```

Post-replay verification commands:

```bash
node scripts/replayBrandBOrdersPaidWebhook.js --verify-only
node scripts/productionSafetyTest.js --dry-run --order-report --economic-report --lineage-report --order-id shopify:novo-loom.myshopify.com:6176193511508
node scripts/settlementBatchOperator.js --dry-run --report --brand-id 11 --order-id shopify:novo-loom.myshopify.com:6176193511508 --verify-reconciliation
```

Expected mutation path if executed:

- `shopify_attribution_events`: insert `conversion_created`, or `duplicate_skipped` if rerun.
- `conversions`: insert one Brand B conversion if missing.
- `creator_network_earnings`: insert Level 1/2/3 rows if missing.
- `brand_network_earnings`: no row expected for this deepest-chain sale because the three creator levels consume the cap.

Must not mutate:

- Stripe transfers.
- Stripe PaymentIntents.
- brand charging/billing.
- settlement collection.
- claim release.
- reserve deduction.
- refund offset enforcement.
- `creator_earning_claims`.
- settlement/reversal tables.

Important classification:

- This replay validates PartnerLinks internal signed webhook ingestion and deterministic Brand B economics only.
- This replay does not prove Shopify protected customer data approval.
- This replay does not prove production live webhook readiness.
- This replay does not authorize live payouts or settlement automation.

## Onsite Support Agent Foundation

Status: RUNTIME-ENFORCED CLIENT-SIDE WIDGET / LOCAL DETERMINISTIC MVP / NO FINANCIAL LOGIC CHANGE

What changed:

- Added a fixed-position PartnerLinks support widget anchored bottom-right across website/app HTML pages.
- Added a local deterministic support knowledge base.
- Added `SUPPORT_AGENT.md` as the support-agent foundation document.
- Added automatic HTML asset injection for server-rendered pages.
- Added explicit support assets to static public HTML pages.

Runtime files:

- `public/support-widget.css`
- `public/support-knowledge-base.js`
- `public/support-widget.js`
- `SUPPORT_AGENT.md`
- `SUPPORT_KNOWLEDGE_BASE.md`
- `SUPPORT_AGENT_TRAINING_LOG.md`

Support training governance:

- The support agent should not learn by guessing.
- `SUPPORT_KNOWLEDGE_BASE.md` is the canonical approved support answer database.
- `public/support-knowledge-base.js` now mirrors approved KB entries for the client-side widget.
- The widget uses lightweight keyword/intent matching to return approved KB responses and falls back to safe support escalation when no confident public match exists.
- `SUPPORT_AGENT_TRAINING_LOG.md` tracks unanswered questions, incorrect answers, approved snippets, escalation rules, and source-of-truth updates.
- Sensitive topics such as payouts, claimable earnings, Shopify connection, account ownership, refunds/reversals, protected customer data, and beta/sandbox status must use approved snippets or escalation.

Persistence:

- Chat state persists in browser `localStorage`.
- Storage key:
  - `partnerlinks_support_chat_v1`
- Persisted state includes:
  - minimized/expanded state.
  - recent local conversation messages.
- Chat state is client-side only.
- The large default security warning banner has been replaced with a small inline info interaction next to the `Support` heading.
- The info interaction opens on hover/tap, closes on outside click, and closes with `Esc`.
- The security reminder remains available without dominating the support widget's onboarding/helpfulness hierarchy.

Covered support topics:

- what PartnerLinks is.
- brand onboarding.
- creator onboarding.
- referral link basics.
- creator invite chain basics.
- Shopify connection and account/store context.
- tracking/click attribution basics.
- pending vs claimable earnings.
- payout status explanations.
- sandbox/beta limitations.
- dashboard access and owner email mismatch issues.
- support escalation.

Safety boundaries:

- The widget does not call external AI APIs.
- The widget does not log support messages to the backend.
- The widget does not mutate database rows.
- The widget does not touch payouts, Stripe, settlement, claims, reserves, refunds, earnings math, Shopify webhook ingestion, or financial state.
- The agent must not promise payouts or guaranteed earnings.
- The agent tells users not to share passwords, private keys, card numbers, API keys, webhook secrets, or recovery codes.

Future planned support architecture:

- server-side support ticket creation.
- authenticated account context.
- support inbox/admin workflow.
- approved-doc RAG.
- optional AI backend with strict safety and scoping controls.
