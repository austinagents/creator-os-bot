# PartnerLinks / creator-os-bot Project Status

Last updated: 2026-05-12

## Current MVP State

- Homepage V1 is working.
- Discord bot is working.
- Supabase connection is working.
- Creator flow is working through `/start` and `/link`.
- PartnerLinks-owned tracking links are working, for example `/r/:brandSlug/:creatorCode`.
- Click tracking is working through the `clicks` table.
- Last-touch attribution sessions are working through the `attribution_sessions` table.
- Manual conversions are working through the `conversions` table.
- `/tracking_stats` is working for creator-facing referral performance.
- `/record_conversion` is working for admin manual sale entry.
- `/sales_dashboard` is working for admin brand-level sales totals.
- `/creator_leaderboard` is working for admin creator performance ranking.

## Product Direction

PartnerLinks is currently focused on sales generated from creator referral links:

Brand joins manually -> creator gets a PartnerLinks tracking link -> creator promotes link -> clicks are tracked -> sales/conversions are attributed -> estimated commission is calculated -> brand reviews performance and pays manually.

Content submission workflows are not the MVP priority unless they directly support sales attribution.

## Current Tables

Expected base tables:

- `brands`
- `creators`
- `submissions`

Tracking and attribution tables:

- `clicks`
- `attribution_sessions`
- `conversions`

Migration files currently present:

- `database/migrations/001_tracking_tables.sql`
- `database/migrations/002_conversions_table.sql`

## Current Discord Commands

Creator-facing:

- `/start`
- `/link`
- `/stats`
- `/tracking_stats`

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
- `NODE_ENV=production`
- `PUBLIC_BASE_URL`
- `DEFAULT_REF_TEMPLATE`
- `EXPORTS_DIR`
- `LOG_LEVEL`

Railway should run:

```bash
npm start
```

## Known Warnings / Issues

- This folder is not currently initialized as a Git repository.
- Database migrations are manual SQL files; there is no automated migration runner yet.
- Supabase service role key is required by the current server-side bot code and must only live in local `.env` or Railway environment variables.
- Payouts are manual. The app only calculates estimated commission.
- Brand onboarding is manual through `/brand_setup`.
- There is no Shopify app, Stripe Connect integration, public marketplace, auth system, or web dashboard yet.
- Current sales recording is manual through `/record_conversion`.
- Discord slash command registration happens on bot startup for the configured guild.

## Next Recommended Steps

- Initialize Git and push to a private GitHub repository.
- Configure Railway environment variables from `.env.example`.
- Set `PUBLIC_BASE_URL` to the Railway production URL after the first deploy.
- Run Supabase migrations manually before production testing.
- Test one full production referral loop: `/start`, `/link`, click tracking link, `/record_conversion`, `/tracking_stats`, `/sales_dashboard`, `/creator_leaderboard`.
- Add a simple production health check route later if Railway monitoring needs it.
- Keep payout automation, Shopify, Stripe Connect, dashboards, AI, and marketplace features out of scope until the sales attribution loop is stable.
