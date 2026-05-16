# PartnerLinks / creator-os-bot Project Status

Last updated: 2026-05-16

This file is the current implementation snapshot for starting a new ChatGPT/Codex project chat with minimal context loss. Permanent product philosophy, UX guardrails, terminology, and long-term architecture rules live in `CHAT_HANDOFF.md`.

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
- `GET /join/brand/:brandId`
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

Migration policy:

- There is no automated migration runner.
- Do not execute SQL automatically unless explicitly requested.
- Add migration files and paste the exact SQL for manual Supabase SQL Editor execution.
- `013_click_product_attribution.sql` adds product/shop/ref metadata columns to `clicks` so Shopify webhook fallback attribution can recover stripped checkout attribution.
- `014_shopify_attribution_events.sql` adds an internal Shopify attribution diagnostics ledger for webhook decisions, duplicate skips, unmatched reasons, fallback usage, click ids, and attribution confidence.

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

Latest read-only reliability matrix result:

- Command:
  - `node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548682670254`
- Summary:
  - `10 PASS`
  - `4 CHECK`
  - `1 INFO`
- PASS:
  - deterministic `partnerlinks_ref` attribution exists and avoided fallback.
  - no duplicate conversions were found for scoped order id.
  - no duplicate creator-network earnings keys were found.
  - no duplicate brand-network earnings keys were found.
  - no stuck reserved claim batches were found in scoped rows.
  - claimed row timestamp checks passed for scoped data.
  - recent test clicks include `partnerlinks_ref`.
- CHECK:
  - no current close-together multi-creator collision cluster exists in the query window.
  - no duplicate webhook replay diagnostic exists yet.
  - no test-creator payout claim ledger rows exist yet.
  - collision/replay/payout claim scenarios still need manual execution to complete the reliability matrix.

Duplicate webhook replay precheck:

- Target order inspected:
  - `shopify:partnerlinks-test.myshopify.com:6548718420142`
- Existing conversion:
  - `conversions.id = 21`
  - attributed to `test-creator-06`
  - `attribution_source = partnerlinks_ref`
  - `fallback_used = false`
- Existing diagnostics:
  - `shopify_attribution_events.id = 9`
  - `decision = conversion_created`
  - no duplicate replay diagnostic exists yet.
- Existing economics:
  - no duplicate conversion row found for the scoped order.
  - no creator-network earnings rows exist for the scoped order because `test-creator-06` has no parent chain.
  - no brand-network earnings rows exist for the scoped order.
- Raw Shopify webhook payloads are not currently stored in PartnerLinks DB/repo.
- Safest duplicate replay path still requires explicit approval because it will intentionally create one additional `duplicate_skipped` diagnostics row while leaving conversions/earnings unchanged.

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

- Deterministic Shopify attribution is now working through cart/order attributes and exact `partnerlinks_ref` recovery. The highest-priority reliability work is now completing manual collision, duplicate webhook replay, and Stripe test-claim recovery scenarios across the 10 test creators before scaling onboarding.

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

## Recommended Next Steps

1. Complete the manual production-safety reliability matrix across the 10 test creators.
   - Collision: click `test-creator-05` and `test-creator-06` close together, complete one checkout, verify exact attribution wins or ambiguity skips safely.
   - Replay: replay a real signed Shopify `orders/paid` webhook payload if available, verify `duplicate_skipped` diagnostics and no duplicate conversion/earnings rows.
   - Payout: when test earnings are claimable and Stripe test payouts are enabled, claim once and retry safely to verify claim ledger/idempotency.
   - Use `node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:{order_id}` after each scenario.

2. Register/verify Shopify `orders/paid` webhook setup for connected stores.
   - Confirm whether webhook registration is manual or automated per installed store.
   - Avoid duplicate webhook registrations.

3. Expand internal/admin attribution diagnostics only as needed.
   - Current `/shopify_attribution_debug` works for recent decisions.
   - Next useful additions would be lookup by `partnerlinks_ref`, latest clicks by creator/product, and unmatched-only filters.

4. Move product data toward admin-curated Shopify-backed products.
   - Keep universal product card layout.
   - Do not expose Shopify/test metadata publicly.
   - Auto-pull can come later, but display should remain curated/approved.

5. Continue hardening Stripe claim/payout recovery.
   - Keep test-mode guard.
   - Preserve idempotency.
   - Add more operator diagnostics before live payout plans.

6. Keep dashboards cohesive.
   - Any new brand/creator feature should land inside the appropriate dashboard/navigation system, not as a disconnected utility page.

7. Keep manual operations available.
   - `/record_conversion` remains useful as fallback.
   - Discord diagnostics should support admin/operator testing without becoming the primary creator/brand UX.
