# PartnerLinks / creator-os-bot Project Status

Last updated: 2026-05-14

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
- Incoming route params are normalized with lowercase trimming before lookup.
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
- Slash command registration logs the exact command list on startup, including `/network_stats`, and startup registration refreshes guild commands automatically.
- `/join/:creator_code` captures invite sessions in a browser cookie. Permanent parent binding from invite session to new creator is completed by the web Google signup flow.
- Web signup/auth binding is now implemented for Google OAuth. Discord `/start` still cannot reliably read browser invite cookies, so invite parent binding should happen through the web signup flow.
- Google-created creators can have `brand_id` null if the database allows it. If the existing production schema requires `brand_id`, the auth helper falls back to the latest brand so creator creation can still complete; review this later when multi-brand web onboarding is formalized.
- Supabase Google provider and redirect allow-list entries must be configured manually before OAuth works. Railway must also include `SUPABASE_ANON_KEY` and `PUBLIC_BASE_URL=https://partnerlinks.app`; missing either one causes `/auth/google/start` to return `Unable to start Google signup`.
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
