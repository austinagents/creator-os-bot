# PartnerLinks / Creator OS Vision

Important continuity rule:

- Read `INFRASTRUCTURE_DECISION_RULES.md` before every major implementation or debugging pass. During long debugging sessions, re-read it at least every third response.
- `PROJECT_STATUS.md` is the source of truth for what currently exists and works.
- `system-audit/ECONOMIC_ARCHITECTURE.md` and ADRs contain canonical architecture direction, but architecture direction is not automatically runtime-enforced.
- Treat claims as `RUNTIME-ENFORCED` only when the status docs or code explicitly say they are implemented.
- Settlement collection, settlement-aware live claimability, refund enforcement, chargeback enforcement, payout clawbacks, negative balance offsets, synthetic-commerce scoring, threat intelligence scanning, live brand auto-charging, and live creator payout release remain planned/blocked unless explicitly updated in `PROJECT_STATUS.md`.
- Shopify refund webhook capture may exist as diagnostic-only reversal ledgering. It must not be confused with refund enforcement, payout clawback, negative-balance offsetting, or live claimability gating.

- PartnerLinks is a creator-first affiliate/referral infrastructure platform.
- Focus:
  - creator communities
  - Discord-native onboarding
  - multi-level creator referral incentives
  - Shopify conversion attribution
  - scalable creator monetization systems
- Goal:
  Build repeatable creator operating systems deployable across brands/niches.
- Prioritize:
  - simplicity
  - creator UX
  - operational scalability
  - deterministic tracking
  - payout reliability
- PartnerLinks should feel like infrastructure for creator-owned distribution, not an influencer marketplace.
- Creator and brand surfaces should feel like one cohesive SaaS product with different account contexts.
- MVP product direction favors working attribution, payout state integrity, and operational control over broad feature expansion.

# Core Architecture Philosophy

- Discord-native lightweight UX preferred over complex external dashboards during MVP.
- Website/dashboard UX is still the primary long-term experience for brands and creators.
- Discord should act as:
  - admin control layer
  - testing layer
  - operational shortcut layer
  - diagnostics layer
- One visible multi-tenant Discord bot architecture.
- Admin workflows handled primarily inside private Discord channels.
- Minimal permissions philosophy.
- Preserve deterministic referral attribution.
- Preserve payout state integrity.
- Never tightly couple payouts to raw conversion ingestion.
- Internal earnings ledger architecture is intentional.
- Creator claim flow is intentional:
  pending -> claimable -> claimed.
- Manual creator claims are preferred over instant automatic payouts because:
  - improves creator return loops
  - increases dashboard revisits
  - improves platform engagement
  - allows fraud/review buffer windows
  - improves payout batching efficiency
- New feature checklist:
  - website/dashboard route needed?
  - backend/service logic needed?
  - Supabase schema changes needed?
  - Discord slash command needed?
  - PROJECT_STATUS.md update needed?
- Do not add slash commands blindly. Add Discord commands only when they help with testing, admin operations, manual overrides, status checks, diagnostics, conversion/referral debugging, lookup, earnings inspection, or manual backend workflow triggers.

# Current Working Milestones

- Railway production deployment is working.
- GitHub repo is connected to Railway.
- Supabase is connected.
- Discord bot starts and registers commands.
- Homepage V1 works.
- Creator Google signup works through Supabase Auth.
- Persistent creator auth/session cookies are implemented.
- Creator Dashboard is available at:
  - `/dashboard`
  - `/dashboard/:creatorCode`
- Brand Dashboard is available at:
  - `/brand-dashboard`
  - `/brand-dashboard/:brandSlug`
- Shopify OAuth install works end-to-end through:
  - `/register-business`
  - `/api/shopify/start`
  - `/api/shopify/callback`
- Shopify connected stores are stored in `shopify_stores`.
- Shopify store installs create/reuse `brands` and populate `shopify_stores.brand_id`.
- Brand setup works through:
  - `/brand/setup/:brandId`
- Creator invite links work through:
  - `/join/:creatorCode`
  - `/join/brand/:brandSlug`
- Brand referral links work through:
  - `/r/:brandSlug/:creatorCode`
- Product referral links work through:
  - `/r/:brandSlug/:creatorCode/:productSlug`
- Shopify orders/paid webhook is implemented at:
  - `POST /webhooks/shopify/orders-paid`
- Manual fallback conversion entry remains available through Discord:
  - `/record_conversion`
- Stripe Connect Express creator onboarding is implemented in test mode.
- Earnings lifecycle and claim ledger are implemented.
- Test-mode Stripe transfers can be created from claimable earnings.
- Payout History UI is available in the Creator Dashboard.
- Current confirmed Shopify conversion test result:
  - Shopify order webhook created a conversion for order id format `shopify:partnerlinks-test.myshopify.com:{order_id}`.
  - The conversion was attributed to creator `austin-taylor`.
  - Direct commission was created.
  - Creator/network earnings were created from `platform_fee_amount`.
- Current important blocker/state:
  - Attribution persistence is now working via recent click fallback.
  - Continue hardening referral click -> Shopify redirect -> checkout -> webhook attribution before adding analytics complexity.

# Exact Routes

Public/homepage and discovery:

- `/`
- `/signup`
- `/creator/welcome`
- `/brands/:brandSlug`

Creator referral and invite routes:

- `/join/:creatorCode`
- `/join/brand/:brandSlug`
- `/r/:brandSlug/:creatorCode`
- `/r/:brandSlug/:creatorCode/:productSlug`

Creator dashboard and payout routes:

- `/dashboard`
- `/dashboard/:creatorCode`
- `/stripe/connect/start`
- `/stripe/connect/refresh`
- `/stripe/connect/debug`
- `/earnings/claim`

Brand onboarding/dashboard routes:

- `/register-business`
- `/brand/setup/:brandId`
- `/brand/setup/:brandId/success`
- `/brand-dashboard`
- `/brand-dashboard/:brandSlug`

Auth routes:

- `/auth/google/start`
- `/auth/google/start/`
- `/auth/callback`

Shopify routes:

- `/api/shopify/start`
- `/api/shopify/callback`
- `POST /webhooks/shopify/orders-paid`

Discord slash commands currently expected:

- `/start`
- `/link`
- `/stats`
- `/tracking_stats`
- `/network_stats`
- `/brand_setup`
- `/record_conversion`
- `/sales_dashboard`
- `/creator_leaderboard`
- `/creator_dashboard`

# Exact Supabase Tables

Core tables:

- `brands`
- `creators`
- `submissions`

Tracking and attribution:

- `clicks`
- `attribution_sessions`
- `conversions`
- `creator_invite_sessions`

Creator/brand network earnings:

- `creator_network_earnings`
- `brand_network_earnings`

Shopify:

- `shopify_stores`

Stripe/payout lifecycle:

- `creator_earning_claims`

Important current columns/fields:

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
- `shopify_stores.brand_id`
- `shopify_stores.shop_domain`
- `shopify_stores.access_token`
- `clicks.creator_code`
- `clicks.referral_code`
- `clicks.brand_slug`
- `clicks.product_slug`
- `clicks.shop_domain`
- `clicks.partnerlinks_ref`
- `conversions.payout_status`
- `conversions.claimable_at`
- `conversions.claimed_at`
- `conversions.claim_batch_id`
- `creator_network_earnings.payout_status`
- `creator_network_earnings.claimable_at`
- `brand_network_earnings.payout_status`
- `brand_network_earnings.claimable_at`
- `creator_earning_claims.claim_batch_id`
- `creator_earning_claims.stripe_transfer_id`
- `creator_earning_claims.stripe_transfer_status`
- `creator_earning_claims.stripe_transfer_created_at`

# Shopify / Attribution Rules

- Use LIVE Shopify storefront URLs, never Shopify preview URLs.
- Current live test product URL:
  - `https://partnerlinks-test.myshopify.com/products/test-product`
- Do not use `shopifypreview.com` URLs in referral redirects because preview URLs block checkout and prevent live order/webhook testing.
- Preserve attribution across:
  referral click -> Shopify redirect -> checkout -> webhook ingestion.
- Product referral route structure:
  - `/r/:brandSlug/:creatorCode/:productSlug`
- Current Aria Wellness test route:
  - `/r/aria-wellness/austin-taylor/test-product`
- Public/demo brand slug mapping:
  - `aria-wellness` maps to Shopify shop domain `partnerlinks-test.myshopify.com`.
  - This allows the public storefront slug to resolve to the connected Shopify brand/store even when the database brand name is based on the Shopify store domain.
- Product referral redirects must append:
  - `creator_code`
  - `partnerlinks_ref`
  - `brand_slug`
  - `product_slug`
- Product referral clicks must persist:
  - `creator_code`
  - `referral_code`
  - `brand_slug`
  - `product_slug`
  - `shop_domain`
  - `destination_url`
  - `partnerlinks_ref` / session id
- Shopify webhooks must remain idempotent.
- Duplicate conversion prevention uses order id format:
  - `shopify:{shop_domain}:{order_id}`
- Shopify webhook attribution recovery should check:
  - discount/referral code if present
  - URL params
  - `landing_site`
  - `referring_site`
  - `note_attributes`
  - nested Shopify order fields that may contain attribution keys
  - fallback lookup by `partnerlinks_ref`
  - recent click fallback for the same `shop_domain`/product context when Shopify strips params
- Fallback attribution recovery strategies are acceptable when Shopify strips params.
- Attribution persistence is higher priority than analytics complexity.
- Webhooks should return 200 for unmatched attribution to prevent retry loops.
- If attribution is missing:
  - log clearly
  - do not create conversion
  - return 200
- If attribution references an invalid creator:
  - log clearly
  - do not create conversion
  - return 200
- Preserve duplicate conversion prevention.
- Do not change payout logic while debugging Shopify webhook ingestion.

# Stripe / Payout Rules

- Stripe Connect Express architecture is intentional.
- Do not introduce escrow/treasury/custodial wallet systems during MVP.
- PartnerLinks orchestrates payout flows through Stripe infrastructure.
- Creator payouts must remain idempotent.
- Prevent duplicate Stripe transfers.
- Preserve:
  reserve rows -> create claim ledger -> create Stripe transfer -> finalize claim state
- Current payout lifecycle:
  pending -> claimable -> claimed -> payout history
- New direct commissions and network earnings start as:
  - `pending`
- Pending earnings become:
  - `claimable`
- Claimable earnings can be claimed by the signed-in creator when Stripe payouts are enabled.
- Claimed earnings remain part of lifetime earnings and appear in payout history.
- Claim flows must remain resumable/recoverable if DB finalization fails after Stripe transfer succeeds.
- Exact Stripe Connect flow:
  - creator clicks payout onboarding CTA
  - server creates/reuses Stripe connected account
  - server stores `creators.stripe_account_id`
  - server creates Stripe hosted onboarding account link
  - Stripe redirects back to `/dashboard`
  - server refreshes account state
  - dashboard shows not connected / finish setup / connected / payouts enabled
- Exact claim flow:
  - query signed-in creator
  - require Stripe payouts enabled
  - find claimable direct commissions and creator-network earnings
  - reserve rows with `claim_batch_id`
  - create claim row in `creator_earning_claims`
  - create Stripe transfer using test-mode secret key only
  - store `stripe_transfer_id`
  - store `stripe_transfer_status`
  - store `stripe_transfer_created_at`
  - mark reserved earnings rows as `claimed`
  - show success and payout history
- Sandbox/test-mode payout safety guards are intentional.
- `STRIPE_SECRET_KEY` must start with `sk_test_` for test transfer execution.
- Do not create live transfers during MVP unless explicitly planned later.
- Never mix payout UI state with raw conversion state.
- Exact warning:
  preserve claim idempotency and Stripe transfer recovery.
- If Stripe transfer succeeds but DB finalization fails:
  - do not create duplicate Stripe transfers on retry
  - recover from existing claim batch/transfer state
  - log clearly
  - finalize safely

# Payout / Earnings Lifecycle Rules

- Direct campaign commissions live in `conversions`.
- Creator network earnings live in `creator_network_earnings`.
- Brand-origin network earnings live in `brand_network_earnings`.
- Claim batches live in `creator_earning_claims`.
- Current lifecycle:
  - `pending`
  - `claimable`
  - `claimed`
- Dashboard should show:
  - Pending earnings
  - Claimable earnings
  - Claimed earnings
  - Lifetime earnings
  - Payout History
- Never deduct creator-network rewards from creator campaign commission.
- Network rewards come only from `platform_fee_amount`.
- Creator campaign commissions are creator-owned allocations, not PartnerLinks platform revenue.
- PartnerLinks platform revenue is only the explicit `platform_fee_amount`.
- Current network economics:
  - Level 1 Direct: 30% of `platform_fee_amount`
  - Level 2 Indirect: 3% of `platform_fee_amount`
  - Level 3 Extended: 2% of `platform_fee_amount`
  - hard stop after Level 3
- Brand-origin rewards use the same 30/3/2 capped model when a brand directly invited a creator.
- No Level 4+ rewards.

# Product Card / Storefront UI Rules

VERY IMPORTANT:
All product cards must use ONE universal layout regardless of product source.

This includes:

- Shopify-backed products
- static/mock products
- future real brand products
- test products

Never create alternate product card layouts.

Universal product card layout:

1. image/placeholder area
2. product title
3. short description
4. creator commission line
5. referral URL pill
6. Copy Link button

Rules:

- Copy Link CTA is universal.
- Copy Link copies the PartnerLinks referral URL, not the raw Shopify product URL.
- Do not expose Shopify-specific metadata publicly.
- Do not expose test-mode metadata publicly.
- Do not add special badges/rows/layouts for Shopify products.
- Do not show Shopify/test labels such as:
  - `TEST PRODUCT`
  - `LIVE SHOPIFY TEST INTEGRATION`
  - Shopify-specific rows
- Preserve identical spacing/alignment/card dimensions across products.
- Product data may vary.
- Product card layout may NOT vary.
- Preserve dark luxury PartnerLinks storefront aesthetic.
- Preserve clean SaaS visual hierarchy.
- Fixed internal vertical rhythm matters:
  - same image area height
  - same title row height
  - same description block height
  - same commission row position
  - same referral URL pill position
  - same Copy Link button position
- Exact warning:
  do not create alternate UI for Shopify-backed products.

# Homepage UI Rules

- Preserve homepage V1 visual system.
- Dark premium SaaS aesthetic.
- Use subtle gradients, soft borders, clean spacing, and restrained hierarchy.
- Do not modify homepage design casually while working on backend/debugging tasks.
- Homepage hero current positioning:
  - top statement group:
    - `Invite creators`
    - `Get paid for every sale they generate`
  - divider
  - bottom statement group:
    - `Partner with brands`
    - `Turn content into income`
- Hero affiliate highlight:
  - label: `NETWORK REWARDS`
  - line: `30% of all PartnerLinks revenue goes directly to affiliates`
- Hero right-side visual:
  - Commission Structure
  - Earn across 3 levels
  - 30% Direct (L1)
  - 3% Indirect (L2)
  - 2% Third-Tier (L3)
- Featured Brands section is currently UI/mock discovery.
- Featured brand cards click through to `/brands/:brandSlug`.
- Featured brand Copy Link buttons must not trigger card navigation.
- Homepage auth-aware creator state:
  - signed-out users see public Google signup CTA
  - signed-in creators see creator code, creator invite link, and Copy button
  - Creator Dashboard nav routes signed-in creators directly to their dashboard
- Brand nav is lightweight state-aware:
  - unconnected visitors see Register Your Business
  - connected brands can see Brand Dashboard
  - no heavy auth/session overhaul for brand nav yet
- Navbar dropdowns must stay hoverable when moving from trigger to dropdown.

# Dashboard UI Rules

- Creator Dashboard and Brand Dashboard must share the same visual language.
- PartnerLinks should feel like one unified SaaS product, not separate apps.
- Preserve:
  - dark theme
  - gradients
  - sidebar structure
  - card styling
  - spacing rhythm
  - responsive behavior
  - premium SaaS feel
- Creator Dashboard route:
  - `/dashboard/:creatorCode`
- Creator Dashboard should show:
  - creator display name
  - creator code
  - creator invite link with copy button
  - direct referrals
  - second-level referrals
  - third-level referrals
  - conversions
  - order value
  - direct commission
  - network earnings
  - total earnings
  - payout status
  - pending/claimable/claimed/lifetime earnings
  - payout history
- Brand Dashboard route:
  - `/brand-dashboard/:brandSlug`
- Brand Dashboard should show:
  - brand name
  - brand slug
  - tracked revenue
  - active creators
  - conversions
  - platform fees
  - network payouts
  - conversion rate placeholder if needed
  - recent conversions
  - top creators
  - tracking link preview
- Mobile dashboard guardrails:
  - no horizontal overflow
  - cards stack cleanly
  - long URLs wrap or truncate safely
  - sidebar/nav must not force page width beyond viewport

# Brand Page UI Rules

- Brand detail route:
  - `/brands/:brandSlug`
- Brand page should show:
  - brand name
  - short brand description
  - brand-level referral link
  - Featured Products grid
- Brand-wide explainer:
  - `Earn from any purchase across the brand's store`
- Product section explainer:
  - `Promote a specific featured product`
- Brand-wide and product-specific explainers use premium peach/gold accent styling.
- Product grid:
  - desktop: 4 per row
  - tablet: 2 per row
  - mobile: 1 per row
- Referral URL pills:
  - single-line where intended
  - ellipsis when needed
  - no horizontal overflow
- Do not expose raw Shopify implementation details in the storefront UI.

# Terminology Rules

Preferred terms:

- creator
- brand
- campaign
- conversion
- creator earnings
- network earnings
- creator operating system
- creator monetization infrastructure

Avoid:

- influencer marketplace
- partner marketplace
- Shopify app clone framing

Preferred positioning:

- creator-first
- infrastructure
- operating system
- scalable creator communities
- creator monetization layer

# Operational Rules

- If Discord bot is offline:
  run `npm start`
- If Discord bot is already online:
  do NOT run `npm start` again without stopping existing process.
- Always validate major JS changes with:
  - `node --check index.js`
  - `node --check services/<changed-service>.js`
  - `node --check commands/handlers.js` when command handling changes
  - `node --check commands/registerCommands.js` when slash command definitions change
- Update `PROJECT_STATUS.md` after major architecture changes.
- Update `CHAT_HANDOFF.md` only when permanent architecture/UX/product continuity rules change.
- Preserve working systems during feature additions.
- Avoid unnecessary refactors during active debugging.
- Do not run SQL automatically unless the user explicitly asks.
- Create migration files and paste SQL for manual Supabase SQL Editor execution when needed.
- Do not delete database rows unless explicitly requested.
- Do not push/deploy unless explicitly requested.
- Keep `.env` secrets out of tracked files.
- Service role keys must remain server-side only.

# Deployment / Terminal Workflow

Local development:

- Use `npm start` when the bot/app is not already running.
- App listens on `process.env.PORT || 3000`.
- Railway requires Express to listen on:
  - `process.env.PORT`
  - host `0.0.0.0`
- Local URL:
  - `http://localhost:3000`
- Production URL:
  - `https://partnerlinks.app`

Validation:

- Run `node --check` for every touched JS file before finalizing.
- For frontend/CSS-only changes, still validate `index.js` if markup is server-rendered there.
- For Shopify webhook changes, validate:
  - `node --check services/shopifyWebhookService.js`
  - `node --check services/trackingService.js`
  - `node --check index.js`
- For payout changes, validate:
  - `node --check services/earningsLifecycleService.js`
  - `node --check services/stripeConnectService.js`
  - `node --check services/creatorDashboardService.js`
  - `node --check index.js`

Git/Railway:

- Commit only after verifying changed files.
- Push to GitHub to trigger Railway redeploy.
- Do not deploy manually from Codex unless the user explicitly asks.
- After deployment, test production routes with cache/hard refresh when UI/CSS changed.

Manual Supabase workflow:

- Create migration under `database/migrations/`.
- Do not execute SQL automatically.
- Paste full migration contents for the user when requested.
- User runs SQL manually in Supabase SQL Editor.

# Environment Variables

Core:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `BOT_ALERTS_CHANNEL_ID`
- `PUBLIC_BASE_URL`

Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Google OAuth / Supabase Auth:

- Supabase Google provider must be configured in Supabase.
- Redirect allow list should include:
  - `http://localhost:3000/auth/callback`
  - `https://partnerlinks.app/auth/callback`
  - `https://www.partnerlinks.app/auth/callback` if using www

Shopify:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `SHOPIFY_APP_URL`
- `SHOPIFY_WEBHOOK_SECRET`

Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- Test transfer flow requires `STRIPE_SECRET_KEY` to begin with `sk_test_`.

# Current MVP Priorities

Current highest priorities:

1. Reliable attribution persistence
2. Shopify conversion ingestion
3. Stable creator payout flows
4. Referral tracking integrity
5. Production-safe onboarding UX
6. Operational simplicity
7. Brand onboarding scalability

Avoid premature optimization of:

- advanced analytics
- AI features
- public APIs
- enterprise tooling
- complex admin systems
- marketplace mechanics
- embedded Shopify app UI
- automated live payout routing beyond the current test-mode claim flow

# Known Regression Risks

- Product card layouts diverging between Shopify/static products
- Shopify preview URLs breaking checkout
- Attribution loss during Shopify redirects
- Shopify stripping query params before webhook ingestion
- Duplicate Stripe transfer risks
- DB finalization failure after successful Stripe transfer
- UI regressions caused by one-off exceptions
- Dynamic product content breaking card alignment
- Oversized auth/session cookies
- Mixing payout state with conversion state
- Breaking `/r/:brandSlug/:creatorCode` while modifying `/r/:brandSlug/:creatorCode/:productSlug`
- Breaking homepage/nav while changing auth-aware state
- Discord interaction double-reply errors

# Long-Term Product Direction

Long-term direction:

- scalable creator referral infrastructure
- creator network effects
- multi-level referral incentives
- automated conversion ingestion
- payout reliability
- creator-owned distribution ecosystems
- repeatable multi-brand creator operating systems
- Shopify-first brand onboarding for DTC/creator-commerce brands
- Stripe Connect as payout rails, not a custodial wallet
- curated product discovery before brand self-serve product management
- creator dashboards and brand dashboards as coherent SaaS account surfaces

Do not drift toward:

- generic influencer marketplace
- Shopify app clone
- AI content workflow platform
- complex campaign CMS
- public marketplace-first product
