# PartnerLinks / creator-os-bot Project Status

Last updated: 2026-05-15

## Current MVP State

- Homepage V1 is working.
- Discord bot is working.
- Supabase connection is working.
- Creator flow is working through `/start` and `/link`.
- PartnerLinks-owned tracking links are working, for example `/r/:brand_slug/:creator_code`.
- Click tracking is working through the `clicks` table.
- Last-touch attribution sessions are working through the `attribution_sessions` table.
- Manual conversions are working through the `conversions` table.
- `/tracking_stats` is working for creator-facing referral performance.
- `/record_conversion` is working for admin manual sale entry.
- `/sales_dashboard` is working for admin brand-level sales totals.
- `/creator_leaderboard` is working for admin creator performance ranking.
- Creator invite links are scaffolded through `/join/:creator_code`.
- Creator invite click/session capture is scaffolded through `creator_invite_sessions`.
- Creator-network override earnings are scaffolded through `creator_network_earnings`.
- `/network_stats` is available for creator-facing invite network stats.
- Supabase Google OAuth web signup bridge is implemented through `/signup`, `/auth/google/start`, `/auth/callback`, and `/creator/welcome`.
- Web signup can create/find creators and permanently bind `parent_creator_id` from invite sessions.
- `/auth/google/start` and `/auth/google/start/` both initiate Supabase Google OAuth and redirect to Google.
- Shopify OAuth MVP install flow is implemented through `/register-business`, `/api/shopify/start`, and `/api/shopify/callback`.
- Shopify installs now automatically create or reuse a brand record and link `shopify_stores.brand_id` to `brands.id`.
- Post-install brand setup is implemented through `/brand/setup/:brand_id`.
- Brands can now act as origin sponsors when creators sign up through a brand onboarding link.
- Creator codes, referral codes, and brand URL slugs are canonical lowercase identifiers across routes, lookups, and generated links.
- Creator Dashboard MVP is available at `/dashboard/:creator_code` with referral, conversion, commission, and network earnings summary. `/dashboard` resolves the current persisted Supabase auth user to their creator dashboard when available, and otherwise shows a clean sign-in state. Post-signup welcome pages now include primary Creator Dashboard and secondary Home CTAs using the canonical lowercase creator code.
- Brand Dashboard MVP is available at `/brand-dashboard/:brand_slug` with tracked revenue, creator, conversion, fee, network payout, tracking link, and program performance summaries.
- Homepage creator navigation now uses the same persisted Supabase Auth session resolver as `/dashboard`; returning signed-in creators see Creator Dashboard links routed directly to their canonical `/dashboard/:creator_code` page without a separate homepage auth system, and the homepage hero swaps the public Google signup CTA for a compact creator-code/invite-link copy panel.
- Homepage hero positioning now uses a stacked editorial hierarchy: creator referral growth on top, the gradient divider, and creator-brand monetization below.
- Homepage affiliate revenue highlight is presented as a labeled `Network Rewards` value proposition with restrained champagne/gold styling.
- Homepage hero right-side visual now shows the 3-tier PartnerLinks commission structure: 30% Direct L1, 3% Indirect L2, and 2% Third-Tier L3 in a compact dark tree/pyramid card.
- Homepage now includes a UI-only `Featured Brands` discovery section under `How it works?` with 20 imaginary mock brand cards, mock referral links, and client-side copy buttons. This is intentionally not connected to real brand/campaign database logic yet.
- Product-level referral link MVP is UI-only through `/brands/:brand_slug`. Featured brand cards click through to a brand product page with manually curated mock products, brand-level referral links, and product-level preview links in the planned `/r/:brand_slug/:creator_code/:product_slug` format. Signed-in creators see their real lowercase creator code; signed-out visitors see `creator` as the placeholder.
- Brand detail pages distinguish brand-wide referral links from product-specific referral links with peach/gold editorial supporting copy aligned to the homepage hero accent style.
- Stripe Connect Express payout onboarding MVP is scaffolded in sandbox/test mode. The Creator Dashboard Total Earnings card now shows Connect with Stripe, Continue setup, or Payouts connected states. This only creates/reuses a creator Stripe connected account and sends creators through hosted onboarding; it does not move money, create transfers, calculate withdrawals, or custody creator earnings.
- Auth persistence now uses dedicated server-set httpOnly access and refresh token cookies with a 30-day max age instead of relying on Supabase's full session blob cookie, so returning creators can be restored across normal browser returns.
- Homepage brand navigation stores only a non-sensitive brand slug in browser state after Shopify install/brand setup to switch returning connected brands from Register Your Business to Brand Dashboard.
- `/creator_dashboard` is available as an admin/operator Discord shortcut for dashboard URL lookup and quick verification.

## Product Direction

PartnerLinks is focused on sales generated from creator referral links:

Brand connects ecommerce/payment rails -> creator gets PartnerLinks tracking/invite infrastructure -> creator promotes links -> clicks and sales are attributed -> creator commission and PartnerLinks platform fee are calculated separately -> creator-network overrides are calculated only from PartnerLinks platform fee revenue.

Content submission workflows are not the MVP priority unless they directly support sales attribution.

### Future-Facing Onboarding And Payment Model

Brand onboarding should be simplified around ecommerce/payment connections:

1. Connect Shopify.
2. Set creator commission percentage.
3. PartnerLinks generates creator onboarding, creator invite links, and brand referral/tracking infrastructure.

Shopify-first is the MVP default for target DTC and creator-commerce brands. Stripe may be added later for deeper payment routing, but it is not the default first integration.

Current Shopify app setup:

- App name: PartnerLinks.
- App URL: `https://partnerlinks.app`.
- Redirect URL: `https://partnerlinks.app/api/shopify/callback`.
- Current scopes: `read_orders`, `read_customers`.

Current Shopify OAuth flow:

1. Brand visits `/register-business`.
2. Brand enters Shopify store domain and clicks Connect Shopify.
3. PartnerLinks redirects to Shopify OAuth install.
4. Shopify redirects back to `/api/shopify/callback`.
5. PartnerLinks validates the callback, exchanges the code for an access token, and stores the shop domain plus token in Supabase `shopify_stores`.
6. PartnerLinks creates or reuses a brand record using the Shopify store domain as the initial brand name/slug source.
7. PartnerLinks links `shopify_stores.brand_id` to `brands.id`.
8. PartnerLinks redirects the merchant to `/brand/setup/:brand_id`.

Product discovery and curation direction:

- The first roughly 20 featured brands should remain PartnerLinks-managed/admin-curated instead of requiring brands to manage products or campaigns themselves.
- Public product pages use the planned product-level referral URL format: `/r/:brand_slug/:creator_code/:product_slug`.
- Shopify product auto-pull is planned later through the Shopify Admin API, but pulled products should first be stored as candidates and manually approved/curated before becoming publicly visible.

Stripe Connect payout direction:

- Creator payouts should use connected payout rails, starting with Stripe Connect Express in test mode.
- Brand -> Stripe Connect payout rails -> Creator is the long-term payment direction.
- PartnerLinks should not custody creator campaign earnings directly.
- Current Stripe scope is onboarding/connection state only; withdrawals, transfers, payout calculations, and real-money movement are intentionally out of scope.
9. Brand sets display name, destination URL, and creator commission percentage.
10. PartnerLinks displays creator onboarding and tracking link formats.

For MVP, `platform_fee_rate` remains an internal field and defaults to 5% server-side during brand setup. It is not shown in the brand-facing setup UI.

Creator onboarding should be low-friction:

1. Join through `/join/:creator_code` or a brand onboarding link like `/join/brand/:brand_slug`.
2. Sign in with Google.
3. Set creator code and social handle.
4. Connect payout destination: bank or PayPal.
5. Receive creator invite link and brand referral/tracking links.

Do not collect creator tax info, identity verification, or KYC during the MVP. Creators should provide only email/profile/social information and payout destination. Compliance, tax, and KYC can be revisited later if PartnerLinks directly automates payouts at scale.

Payment model:

- PartnerLinks should not custody funds.
- Long-term, payments should be routed through connected platform/payment rails.
- Creator commission should route to the creator payout destination.
- PartnerLinks platform fee should route to PartnerLinks.
- Brand keeps remaining revenue.
- Until automated payout routing is implemented, PartnerLinks can generate payout reporting and instructions.

Example economics on a `$100` sale:

- 20% creator commission = `$20` to creator.
- 5% PartnerLinks platform fee = `$5` to PartnerLinks.
- Brand keeps `$75`.

Creator-network referral economics are separate from buyer/brand attribution:

Creator invite links use `/join/:creator_code`. Buyer attribution links use `/r/:brand_slug/:creator_code`. Creator-network override earnings are calculated only from explicit PartnerLinks `platform_fee_amount`, not from creator campaign commission.

Canonical referral identifiers are always lowercase:

- `creator_code` is generated, stored, looked up, and linked in lowercase.
- `referral_code` is generated, stored, looked up, and linked in lowercase.
- Brand URL slugs/codes are generated and matched in lowercase.
- Incoming route params are normalized with lowercase trimming before lookup. `/join/:creator_code` explicitly normalizes with `String(...).trim().toLowerCase()` and checks both `referral_code` and `creator_code` case-insensitively before redirecting to `/signup?invite={lowercase_code}`.
- Display names keep their original casing in UI.

Creator-network example:

- Creator 1 invites Creator 2.
- Creator 2 invites Creator 3.
- Creator 3 drives a `$100` sale.
- Creator 3 earns the creator commission.
- Creator 2 earns 30% of PartnerLinks' platform fee.
- Creator 1 earns 3% of PartnerLinks' platform fee.
- If there is a Level 3 inviter, they earn 2% of PartnerLinks' platform fee.
- Network overrides never come from creator commission principal.

MVP override rates:

- Level 1 direct invited creator: 30% of PartnerLinks platform fee.
- Level 2 indirect invited creator: 3% of PartnerLinks platform fee.
- Level 3 extended invited creator: 2% of PartnerLinks platform fee.
- No Level 4+ rewards.

Brands can occupy the origin sponsor position when they directly onboard a creator. This uses the same 30% / 3% / 2% capped economics:

- If a brand directly invites Creator 1 and Creator 1 generates a sale, the brand receives the Level 1 reward.
- If Creator 1 invites Creator 2 and Creator 2 generates a sale, Creator 1 receives Level 1 and the brand receives Level 2.
- If Creator 2 invites Creator 3 and Creator 3 generates a sale, Creator 2 receives Level 1, Creator 1 receives Level 2, and the brand receives Level 3.
- If the creator chain already uses all three levels, the brand receives nothing. There is no infinite depth and no Level 4+ reward.

Brand-origin rewards are recorded only from explicit `platform_fee_amount`, never from order value or creator campaign commission.

## Product Architecture Direction

Going forward, prioritize product architecture, UI/UX consistency, and complete user journeys over rapidly adding isolated features. Major new pages or capabilities should first be assigned to a user type and placed inside a coherent navigation model.

Primary user types:

- Brand
- Creator
- Internal Admin

Before implementing major new features, decide:

- Where the feature lives in the product.
- Which user type owns it.
- How users reach it.
- How users return to it.
- Whether it belongs inside a dashboard, tab, or navigation section.

Product structure rules:

- Build cohesive Creator and Brand dashboard systems before adding many more isolated backend capabilities.
- Creator Dashboard MVP now lives at `/dashboard/:creator_code` as the first Creator dashboard surface. The homepage creator navigation includes a Creator Dashboard dropdown item; signed-in creators are routed directly to their canonical dashboard through the persisted Supabase session, while unauthenticated visitors still use the safe `/dashboard` entry/sign-in state.
- Brand Dashboard MVP now lives at `/brand-dashboard/:brand_slug` as the first Brand dashboard surface and intentionally reuses the Creator Dashboard visual system, sidebar structure, card styling, responsive behavior, and dark SaaS layout language.
- Place features inside structured dashboard/navigation systems instead of standalone utility routes whenever practical.
- Avoid disconnected utility pages and duplicate navigation paths for the same functionality.
- Add redirects and canonical routes where appropriate.
- Keep onboarding flows linear, low-friction, and continuous.
- Avoid exposing internal/admin tooling in public UI.
- Preserve mobile responsiveness.
- Optimize for clean SaaS UX, not developer tooling UX.

UI direction:

- Maintain consistent dark PartnerLinks styling.
- Keep spacing, typography, buttons, gradients, cards, and layouts consistent across public, creator, and brand experiences.
- Treat new UI work as part of a scalable dashboard/navigation architecture rather than one-off screens.

## Creator Dashboard Design Direction

Creator Dashboard MVP lives at `/dashboard/:creator_code` and should be treated as the first Creator product surface, not a standalone utility page. The dashboard uses a premium dark PartnerLinks UI with a persistent navigation frame, clear earnings hierarchy, compact stat cards, and low-clutter referral/earnings sections.

Design inspiration references for future polish, without directly cloning any product:

- Shopify Partner Dashboard
- Stripe Express Dashboard
- Linktree Creator Analytics
- Beacons.ai
- Gumroad
- Fourthwall
- Kajabi
- TikTok Creator tools
- Modern SaaS analytics dashboards

Finalized Creator Dashboard architecture:

- Sidebar navigation: Overview, Referrals, Earnings, Links, Settings.
- Top area: welcome header, creator code, total earnings summary.
- Primary action area: creator invite link with copy action.
- Middle area: stat cards for earnings, order value, conversions, and network earnings.
- Lower area: referral performance, earnings mix, recent conversions placeholder, network earnings note, referral tree preview.

UI principles:

- Premium, creator-first, modern, minimal, trustworthy.
- High signal and low clutter.
- Centered max-width layout with strong spacing rhythm.
- Subtle gradients, soft borders, dark surfaces, and restrained cards.
- Responsive sidebar and grids collapse cleanly on mobile with mobile-only overflow protection, tighter padding/gaps, smaller welcome heading, one-column cards, scrollable sidebar nav, and aggressive wrapping for long invite URLs. Dashboard critical CSS is inlined in the `/dashboard/:creator_code` route and the external stylesheet uses cache-busting/no-store headers so production cannot render the dashboard as raw unstyled markup if `/styles.css` is stale.
- No internal/admin tooling exposed in public creator dashboard UI.
- Homepage navigation includes a `For Creators` dropdown with `Creator Dashboard` as the first creator journey item; the homepage now checks the same persisted Supabase session used by `/dashboard` and routes signed-in creators directly to `/dashboard/:creator_code`. Signed-in creators also see a premium creator invite panel in place of the public `Sign up with Google` CTA, with canonical lowercase creator code, invite link, and copy action. `/dashboard` still shows a clean sign-in state when no authenticated creator session is available. Creator and brand invite links also avoid forcing signup when a valid creator session already exists, redirecting the returning creator to their dashboard instead. The dropdown is an overlay on hover/focus so it does not shift navbar layout, and the welcome-page Home CTA is styled as a balanced secondary button next to the primary Creator Dashboard CTA.
- Brand nav is state-aware without full auth: unconnected visitors see `Register Your Business` with a hover/focus `Brand Dashboard` teaser that routes to `/register-business`; connected brands with a stored safe brand slug see `Brand Dashboard` directly, routed to `/brand-dashboard/:brand_slug`. Invalid or missing brand slug state falls back safely to `/register-business`. Brand setup success pages show Brand Dashboard and Home CTAs with the same visual button system as creator onboarding.
- Homepage dropdown hover behavior uses a shared hover/focus wrapper and invisible hover bridge so users can move from the nav trigger to dropdown items without the menu closing.
- Website/dashboard remains the primary creator UX; Discord remains an operator shortcut layer.
- Dashboard rendering fix: `/styles.css` is served with `Cache-Control: no-store`, the dashboard route sets no-store headers, and `/styles.css?v=creator-dashboard-3` plus inline critical CSS ensure current dashboard classes apply in production.

## Development Workflow Rule

When adding a new PartnerLinks site feature or backend mechanic, evaluate whether it also needs a Discord slash command. Do not add slash commands automatically for every feature.

Website/dashboard UX should remain primary for brands and creators. Discord should act as:

- Admin control layer
- Testing layer
- Operational shortcut layer
- Diagnostics layer

Add slash commands when they help with:

- Admin/operator testing
- Quick verification
- Manual overrides
- Status checks
- Conversion/referral debugging
- Brand or creator lookup
- Payout/earnings inspection
- Triggering backend workflows manually

Before implementing future features, explicitly check:

1. Website/dashboard route needed?
2. Backend/service logic needed?
3. Supabase schema changes needed?
4. Discord slash command needed?
5. PROJECT_STATUS.md update needed?

## Current Tables

Expected base tables:

- `brands`
- `creators`
- `submissions`

Tracking and attribution tables:

- `clicks`
- `attribution_sessions`
- `conversions`
- `creator_invite_sessions`
- `creator_network_earnings`
- `brand_network_earnings`
- `shopify_stores`

Brand Dashboard uses existing tables only for this MVP pass: `brands`, `creators`, `clicks`, `conversions`, `creator_network_earnings`, and `shopify_stores`.

Migration files currently present:

- `database/migrations/001_tracking_tables.sql`
- `database/migrations/002_conversions_table.sql`
- `database/migrations/003_creator_network.sql`
- `database/migrations/004_web_auth_creators.sql`
- `database/migrations/005_shopify_stores.sql`
- `database/migrations/006_brand_setup_fields.sql`
- `database/migrations/007_brand_origin_network.sql`
- `database/migrations/008_normalize_referral_codes.sql`

## Current Discord Commands

Creator-facing:

- `/start`
- `/link`
- `/stats`
- `/tracking_stats`
- `/network_stats`

Admin-only:

- `/brand_setup`
- `/record_conversion`
- `/sales_dashboard`
- `/creator_leaderboard`
- `/creator_dashboard`

Admin-only means the Discord member must have Administrator or Manage Guild permission.

## How To Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` from `.env.example` and fill in real local values:

```bash
cp .env.example .env
```

3. Run Supabase migrations manually in the Supabase SQL editor:

```text
database/migrations/001_tracking_tables.sql
database/migrations/002_conversions_table.sql
database/migrations/003_creator_network.sql
database/migrations/004_web_auth_creators.sql
database/migrations/005_shopify_stores.sql
database/migrations/006_brand_setup_fields.sql
database/migrations/007_brand_origin_network.sql
database/migrations/008_normalize_referral_codes.sql
```

4. Start the app:

```bash
npm start
```

The app defaults to `http://localhost:3000` unless `PORT` or `PUBLIC_BASE_URL` are changed.

## Railway Deployment Notes

Set production environment variables in Railway, not in committed files:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `ADMIN_DASHBOARD_CHANNEL_ID`
- `CREATOR_LOG_CHANNEL_ID`
- `SUBMISSIONS_LOG_CHANNEL_ID`
- `BOT_ALERTS_CHANNEL_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES`
- `SHOPIFY_APP_URL`
- `NODE_ENV=production`
- `PUBLIC_BASE_URL`
- `DEFAULT_REF_TEMPLATE`
- `EXPORTS_DIR`
- `LOG_LEVEL`

Google OAuth production environment requirements for the current code:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_BASE_URL=https://partnerlinks.app`
- `NODE_ENV=production`

The current app does not read `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` from Railway. Google OAuth is started through Supabase Auth with `signInWithOAuth({ provider: 'google' })`, and the callback URL is built from `PUBLIC_BASE_URL` as `https://partnerlinks.app/auth/callback`. Google Client ID and Secret belong in the Supabase Auth Google provider configuration.

Railway should run:

```bash
npm start
```

## Known Warnings / Issues

- This folder is not currently initialized as a Git repository.
- Database migrations are manual SQL files; there is no automated migration runner yet.
- Supabase service role key is required by the current server-side bot code and must only live in local `.env` or Railway environment variables.
- Payouts are manual. The app only calculates estimated commission.
- Current Discord brand setup is manual through `/brand_setup`; web brand onboarding now has a lightweight Shopify OAuth install flow.
- Shopify-connected stores are linked to brand records automatically. Reinstalling an existing connected store reuses the existing `shopify_stores.brand_id` and does not create a duplicate brand.
- Brand setup stores `brands.name`, `brands.destination_url`, `brands.creator_commission_rate`, internal `brands.platform_fee_rate`, and `brands.setup_completed_at`.
- Brand-facing setup only asks for creator commission percentage. `platform_fee_rate` exists internally and defaults to 5% for MVP.
- Brand setup displays a brand-origin creator onboarding link at `/join/brand/:brand_slug`.
- Newly generated brand-origin onboarding links use the lowercase brand slug format `/join/brand/:brand_slug`; existing numeric brand-id links remain accepted.
- Creators who sign up through a brand onboarding link can be permanently marked with `creators.invited_by_brand_id`.
- There is no embedded Shopify admin UI, webhook automation, billing, Stripe Connect integration, public marketplace, auth system, or web dashboard yet.
- Current sales recording is manual through `/record_conversion`.
- `/record_conversion` now accepts optional `platform_fee_amount`. Creator-network override rows are only created when this value is greater than zero.
- When `platform_fee_amount` is greater than zero, conversion recording can create creator network earnings and, if the chain reaches a brand origin sponsor before Level 3 is exhausted, a `brand_network_earnings` row.
- `/record_conversion` slash command registration includes optional numeric `platform_fee_amount`; if omitted, command handling treats it as `0`.
- `/record_conversion` can find creators by `creator_code` or `referral_code`, including web-created creators without a Discord user.
- `/record_conversion` uses direct exact creator lookups and does not require `discord_user_id`.
- `/record_conversion` performs its creator lookup inside the command handler without filtering by `brand_id`; temporary debug logs show input, creator-code lookup, referral-code lookup, and lookup errors before Discord replies.
- Discord command replies are routed through `safeInteractionReply`, which only uses `followUp()` after an interaction is replied/deferred and otherwise uses `reply()`; reply errors are logged without being rethrown.
- `/record_conversion` now runs both exact `creator_code` and exact `referral_code` lookups before deciding a creator is missing, and `safeInteractionReply` guards against duplicate responses per interaction.
- `/record_conversion` defers once, then edits that single interaction response so failure and success messages cannot both be sent by the same handler.
- `/creator_dashboard creator_code` returns the canonical Creator Dashboard URL and quick stats for admin/operator verification.
- Slash command registration logs the exact command list on startup, including `/network_stats`, and startup registration refreshes guild commands automatically.
- `/join/:creator_code` captures invite sessions in a browser cookie. Permanent parent binding from invite session to new creator is completed by the web Google signup flow.
- Web signup/auth binding is now implemented for Google OAuth. Supabase Auth access and refresh tokens are persisted in dedicated server-set httpOnly cookies with secure production settings, SameSite=Lax, path `/`, and a 30-day max age. The app restores/refreshes the Supabase session from those cookies server-side, so returning creators can access `/dashboard`, homepage Creator Dashboard navigation, and invite/referral entry points without signing in again until the session naturally expires. The full Supabase session blob is not exposed to browser JavaScript and is not relied on as a browser cookie. Discord `/start` still cannot reliably read browser invite cookies, so invite parent binding should happen through the web signup flow.
- Google-created creators can have `brand_id` null if the database allows it. If the existing production schema requires `brand_id`, the auth helper falls back to the latest brand so creator creation can still complete; review this later when multi-brand web onboarding is formalized.
- Supabase Google provider and redirect allow-list entries must be configured manually before OAuth works. Railway must also include `SUPABASE_ANON_KEY` and `PUBLIC_BASE_URL=https://partnerlinks.app`; missing either one causes `/auth/google/start` to return `Unable to start Google signup`. Auth clear-cookie calls must not include `maxAge`; Shopify and Supabase auth clear paths now use clear-cookie options without expiration metadata.
- Discord slash command registration happens on bot startup for the configured guild.

## Next Recommended Steps

- Initialize Git and push to a private GitHub repository.
- Configure Railway environment variables from `.env.example`.
- Set `PUBLIC_BASE_URL` to the Railway production URL after the first deploy.
- Run Supabase migrations manually before production testing.
- Test one full production referral loop: `/start`, `/link`, click tracking link, `/record_conversion`, `/tracking_stats`, `/sales_dashboard`, `/creator_leaderboard`, `/network_stats`.
- Continue hardening the Google signup flow after production traffic, especially duplicate creator edge cases between Discord-created and web-created creators.
- Replace the temporary `/creator/welcome` placeholder with a real creator account page after auth and brand onboarding mature.
- Add a simple production health check route later if Railway monitoring needs it.
- Next product layer should connect setup brands to real Shopify order webhooks and conversion creation.
- Payout reporting/instructions should come before deeper Stripe/payment routing.
- Keep automated custody-style payouts, Stripe Connect, dashboards, AI, and marketplace features out of scope until the sales attribution and Shopify onboarding loops are stable.
