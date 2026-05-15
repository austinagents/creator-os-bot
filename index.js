const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Client, GatewayIntentBits } = require("discord.js");
const supabase = require("./database/database/supabase");
const { log } = require("./services/services/logger");
const { registerCommands } = require("./commands/registerCommands");
const { handleInteraction } = require("./commands/handlers");
const { getBrandBySlug, getCreatorByCodeAndBrand, recordClick, upsertAttributionSession, generateSessionId, hashIp } = require("./services/trackingService");
const {
  getCreatorByInviteCode,
  recordCreatorInviteSession,
  bindCreatorToInviteSession,
  bindCreatorToBrandOrigin
} = require("./services/creatorNetworkService");
const { findOrCreateWebCreator, getCreatorById } = require("./services/creatorService");
const { getCreatorDashboardByCode } = require("./services/creatorDashboardService");
const { getGoogleOAuthUrl, exchangeAuthCodeForUser } = require("./services/authService");
const {
  buildShopifyInstallUrl,
  validateShopifyCallback,
  exchangeShopifyCodeForToken,
  upsertShopifyStore,
  generateShopifyState,
  shopifyStateCookieOptions
} = require("./services/shopifyService");
const { generateSlug, normalizeCode } = require("./utils/slug");

const {
  DISCORD_TOKEN,
  BOT_ALERTS_CHANNEL_ID,
  PUBLIC_BASE_URL
} = require("./config/config/env");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_PLATFORM_FEE_RATE = 5;

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.get('/styles.css', (req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/join/brand/:brandId', async (req, res) => {
  try {
    const brandCode = normalizeCode(req.params.brandId);
    const brand = await getBrandByIdentifier(brandCode);
    if (!brand) {
      return res.status(404).json({ error: 'Brand invite not found' });
    }

    res.cookie('partnerlinks_brand_invite_id', String(brand.id), {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.clearCookie('partnerlinks_invite_sid');

    res.redirect(`/signup?brand=${encodeURIComponent(generateSlug(brand.name))}`);
  } catch (error) {
    log('Brand invite redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/join/:creatorCode', async (req, res) => {
  try {
    const creatorCode = String(req.params.creatorCode || '').trim().toLowerCase();
    const inviter = await getCreatorByInviteCode(creatorCode);
    if (!inviter) {
      return res.status(404).json({ error: 'Creator invite not found' });
    }

    let sessionId = req.cookies.partnerlinks_invite_sid;
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const ipHash = hashIp(clientIp);
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    await recordCreatorInviteSession({
      inviterCreatorId: inviter.id,
      sessionId,
      ipHash,
      userAgent,
      referrer,
      inviteCode: creatorCode
    });

    res.cookie('partnerlinks_invite_sid', sessionId, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.clearCookie('partnerlinks_brand_invite_id');

    res.redirect(`/signup?invite=${encodeURIComponent(creatorCode)}`);
  } catch (error) {
    log('Creator invite redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/r/:brandSlug/:creatorCode', async (req, res) => {
  try {
    const brandSlug = normalizeCode(req.params.brandSlug);
    const creatorCode = normalizeCode(req.params.creatorCode);

    // Find brand by slug
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Ensure destination URL exists
    if (!brand.destination_url) {
      return res.status(400).json({ error: 'Brand destination URL not configured' });
    }

    // Find creator
    const creator = await getCreatorByCodeAndBrand(creatorCode, brand.id);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get or create session ID
    let sessionId = req.cookies.partnerlinks_sid;
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // Extract client info
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const ipHash = hashIp(clientIp);
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    // Record click
    const click = await recordClick(
      brand.id,
      creator.id,
      sessionId,
      ipHash,
      userAgent,
      referrer,
      brand.destination_url
    );

    // Upsert attribution session
    await upsertAttributionSession(brand.id, sessionId, creator.id, click.id);

    // Set session cookie (14 days)
    res.cookie('partnerlinks_sid', sessionId, {
      maxAge: 14 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Redirect to destination
    res.redirect(brand.destination_url);
  } catch (error) {
    log('Referral redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
app.get(['/auth/google/start', '/auth/google/start/'], async (req, res) => {
  try {
    const authUrl = await getGoogleOAuthUrl(req, res, req.query.invite);
    res.redirect(authUrl);
  } catch (error) {
    log('Google OAuth start error:', error);
    res.status(500).json({ error: 'Unable to start Google signup' });
  }
});
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Missing auth callback code' });
    }

    const authUser = await exchangeAuthCodeForUser(req, res, code);
    const creator = await findOrCreateWebCreator(authUser);
    const inviteSessionId = req.cookies.partnerlinks_invite_sid;
    const brandInviteId = req.cookies.partnerlinks_brand_invite_id;

    if (inviteSessionId) {
      await bindCreatorToInviteSession(creator.id, inviteSessionId);
    } else if (brandInviteId) {
      await bindCreatorToBrandOrigin(creator.id, brandInviteId);
    }

    res.clearCookie('partnerlinks_invite_sid');
    res.clearCookie('partnerlinks_brand_invite_id');
    res.redirect(`/creator/welcome?creator_id=${encodeURIComponent(creator.id)}`);
  } catch (error) {
    log('Auth callback error:', error);
    res.status(500).json({ error: 'Unable to complete Google signup' });
  }
});
app.get('/creator/welcome', async (req, res) => {
  try {
    const creatorId = req.query.creator_id;
    if (!creatorId) {
      return res.status(400).send('Missing creator id.');
    }

    const creator = await getCreatorById(creatorId);
    res.send(renderCreatorWelcomePage(creator));
  } catch (error) {
    log('Creator welcome error:', error);
    res.status(500).send('Unable to load creator welcome page.');
  }
});
app.get('/dashboard/:creatorCode', async (req, res) => {
  try {
    const creatorCode = String(req.params.creatorCode || '').trim().toLowerCase();
    const dashboard = await getCreatorDashboardByCode(creatorCode);
    if (!dashboard) {
      return res.status(404).send(renderSimpleMessagePage(
        'Creator not found',
        'We could not find that creator dashboard.',
        '/',
        'Return home'
      ));
    }

    res.set('Cache-Control', 'no-store, max-age=0');
    res.send(renderCreatorDashboardPage(dashboard));
  } catch (error) {
    log('Creator dashboard error:', error);
    res.status(500).send(renderSimpleMessagePage(
      'Dashboard unavailable',
      'Unable to load this creator dashboard. Please try again.',
      '/',
      'Return home'
    ));
  }
});
app.get('/auth/google', (req, res) => {
  res.redirect('/signup');
});
app.get('/api/shopify/start', async (req, res) => {
  try {
    const { shop } = req.query;
    const state = generateShopifyState();
    const { installUrl, shopDomain } = buildShopifyInstallUrl(shop, state);

    res.cookie('partnerlinks_shopify_state', state, shopifyStateCookieOptions());
    res.cookie('partnerlinks_shopify_shop', shopDomain, shopifyStateCookieOptions());
    res.redirect(installUrl);
  } catch (error) {
    log('Shopify OAuth start error:', error);
    res.status(400).send(renderSimpleMessagePage(
      'Shopify connection error',
      error.message || 'Unable to start Shopify install.',
      '/register-business',
      'Try again'
    ));
  }
});
app.get('/api/shopify/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query;
    const expectedState = req.cookies.partnerlinks_shopify_state;

    if (!state || !expectedState || state !== expectedState) {
      return res.status(400).send(renderSimpleMessagePage(
        'Shopify connection error',
        'Invalid Shopify install state. Please restart the install flow.',
        '/register-business',
        'Try again'
      ));
    }

    if (!code || !shop) {
      return res.status(400).send(renderSimpleMessagePage(
        'Shopify connection error',
        'Shopify did not return the expected install details.',
        '/register-business',
        'Try again'
      ));
    }

    if (!validateShopifyCallback(req.query)) {
      return res.status(400).send(renderSimpleMessagePage(
        'Shopify connection error',
        'Shopify callback validation failed.',
        '/register-business',
        'Try again'
      ));
    }

    const accessToken = await exchangeShopifyCodeForToken(shop, code);
    const store = await upsertShopifyStore({
      shopDomain: shop,
      accessToken
    });

    res.clearCookie('partnerlinks_shopify_state', shopifyStateCookieOptions());
    res.clearCookie('partnerlinks_shopify_shop', shopifyStateCookieOptions());

    res.redirect(`/brand/setup/${encodeURIComponent(store.brand_id)}`);
  } catch (error) {
    log('Shopify OAuth callback error:', error);
    res.status(500).send(renderSimpleMessagePage(
      'Shopify connection error',
      'Unable to complete Shopify install. Please try again.',
      '/register-business',
      'Try again'
    ));
  }
});
app.get('/register-business', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register-business.html'));
});
app.get('/brand/setup/:brandId', async (req, res) => {
  try {
    const setup = await getBrandSetupData(normalizeCode(req.params.brandId));
    if (!setup) {
      return res.status(404).send(renderSimpleMessagePage(
        'Brand not found',
        'We could not find that brand setup record.',
        '/register-business',
        'Connect Shopify'
      ));
    }

    res.send(renderBrandSetupPage(setup.brand, setup.store));
  } catch (error) {
    log('Brand setup page error:', error);
    res.status(500).send(renderSimpleMessagePage(
      'Brand setup error',
      'Unable to load brand setup. Please try again.',
      '/register-business',
      'Try again'
    ));
  }
});
app.post('/brand/setup/:brandId', async (req, res) => {
  try {
    const brandId = normalizeCode(req.params.brandId);
    const name = String(req.body.name || '').trim();
    const destinationUrl = String(req.body.destination_url || '').trim();
    const creatorCommissionRate = Number(req.body.creator_commission_rate);
    const platformFeeRate = DEFAULT_PLATFORM_FEE_RATE;

    if (!name || !destinationUrl || Number.isNaN(creatorCommissionRate)) {
      return res.status(400).send(renderSimpleMessagePage(
        'Missing setup details',
        'Please provide brand name, destination URL, and creator commission percentage.',
        `/brand/setup/${encodeURIComponent(brandId)}`,
        'Back to setup'
      ));
    }

    if (creatorCommissionRate < 0) {
      return res.status(400).send(renderSimpleMessagePage(
        'Invalid setup details',
        'Creator commission percentage must be zero or greater.',
        `/brand/setup/${encodeURIComponent(brandId)}`,
        'Back to setup'
      ));
    }

    const normalizedDestinationUrl = normalizeUrl(destinationUrl);
    const { data: brand, error } = await supabase
      .from('brands')
      .update({
        name,
        destination_url: normalizedDestinationUrl,
        creator_commission_rate: creatorCommissionRate,
        platform_fee_rate: platformFeeRate,
        setup_completed_at: new Date().toISOString()
      })
      .eq('id', brandId)
      .select()
      .single();

    if (error) throw error;

    const { data: stores, error: storeError } = await supabase
      .from('shopify_stores')
      .select('*')
      .eq('brand_id', brand.id)
      .order('installed_at', { ascending: false })
      .limit(1);
    if (storeError) throw storeError;

    res.send(renderBrandSetupSuccessPage(brand, stores ? stores[0] : null));
  } catch (error) {
    log('Brand setup save error:', error);
    res.status(500).send(renderSimpleMessagePage(
      'Brand setup error',
      'Unable to save brand setup. Please try again.',
      `/brand/setup/${encodeURIComponent(req.params.brandId)}`,
      'Back to setup'
    ));
  }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", async () => {
  log(`Logged in as ${client.user.tag}`);

  try {
    // Register commands
    await registerCommands(DISCORD_TOKEN);

    const channel = await client.channels.fetch(BOT_ALERTS_CHANNEL_ID);

    if (channel) {
      await channel.send("✅ CreatorOS Bot is online.");
    }

    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .limit(1);

    if (error) {
      log("Supabase connection error:", error.message);
      if (channel) {
        await channel.send(`❌ Supabase connection error: ${error.message}`);
      }
    } else {
      log("Supabase connected successfully.");
    }

  } catch (err) {
    log("Startup error:", err.message);
    try {
      const channel = await client.channels.fetch(BOT_ALERTS_CHANNEL_ID);
      if (channel) {
        await channel.send(`❌ Startup error: ${err.message}`);
      }
    } catch {}
  }
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction, client);
});

app.listen(PORT, '0.0.0.0', () => {
  log(`PartnerLinks homepage running at http://0.0.0.0:${PORT}`);
});

client.login(DISCORD_TOKEN);

function renderCreatorWelcomePage(creator) {
  const trackingLink = creator.tracking_link || 'Brand tracking link will appear after brand assignment.';
  const inviteLink = creator.join_referral_link || 'Invite link not available yet.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PartnerLinks</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">PartnerLinks</p>
      <h1>Welcome to PartnerLinks</h1>
      <p>Your creator account is ready.</p>
      <div class="link-list">
        <p><strong>Creator code</strong><br>${escapeHtml(creator.creator_code || '')}</p>
        <p><strong>Creator invite link</strong><br>${escapeHtml(inviteLink)}</p>
        <p><strong>Brand tracking link</strong><br>${escapeHtml(trackingLink)}</p>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderCreatorDashboardPage(dashboard) {
  const inviteLink = dashboard.inviteLink || `${PUBLIC_BASE_URL}/join/${dashboard.creatorCode}`;
  const dashboardPath = `/dashboard/${encodeURIComponent(dashboard.creatorCode)}`;
  const primaryStats = [
    ['Total Earnings', formatMoney(dashboard.totalEarnings), 'Campaign plus network earnings'],
    ['Order Value', formatMoney(dashboard.totalOrderValue), 'Attributed creator sales'],
    ['Conversions', dashboard.totalConversions, 'Recorded sales'],
    ['Network Earnings', formatMoney(dashboard.networkEarnings), 'Creator referral overrides']
  ];
  const referralStats = [
    ['Direct', dashboard.directReferralsCount],
    ['Second-Level', dashboard.secondLevelReferralsCount],
    ['Third-Level', dashboard.thirdLevelReferralsCount]
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Creator Dashboard</title>
  <link rel="stylesheet" href="/styles.css?v=creator-dashboard-3">
  <style>${renderCreatorDashboardCriticalStyles()}</style>
</head>
<body>
  <div class="creator-dashboard">
    <aside class="creator-sidebar" aria-label="Creator dashboard navigation">
      <a class="creator-sidebar-brand" href="/">
        <span class="logo-mark">PL</span>
        <span>
          <span class="brand-name">PartnerLinks</span>
          <span class="brand-tag">Creator</span>
        </span>
      </a>
      <nav class="creator-sidebar-nav">
        <a class="active" href="${escapeHtml(dashboardPath)}">Overview</a>
        <a href="${escapeHtml(dashboardPath)}#referrals">Referrals</a>
        <a href="${escapeHtml(dashboardPath)}#earnings">Earnings</a>
        <a href="${escapeHtml(dashboardPath)}#links">Links</a>
        <a href="${escapeHtml(dashboardPath)}#settings">Settings</a>
      </nav>
    </aside>

    <main class="creator-main">
      <header class="creator-topbar">
        <div>
          <p class="eyebrow">Creator Dashboard</p>
          <h1>Welcome, ${escapeHtml(dashboard.displayName)}</h1>
          <p class="creator-code-line">Creator code <strong>${escapeHtml(dashboard.creatorCode)}</strong></p>
        </div>
        <div class="creator-earnings-chip">
          <span>Total earnings</span>
          <strong>${escapeHtml(formatMoney(dashboard.totalEarnings))}</strong>
        </div>
      </header>

      <section class="creator-action-panel" id="links">
        <div>
          <span>Creator invite link</span>
          <strong id="invite-link">${escapeHtml(inviteLink)}</strong>
          <p>Share this link to invite creators into your PartnerLinks network.</p>
        </div>
        <button class="copy-button" type="button" data-copy-target="invite-link">Copy Link</button>
      </section>

      <section class="creator-stat-grid" aria-label="Creator performance summary">
        ${primaryStats.map(([label, value, description]) => `
          <article class="creator-stat-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <p>${escapeHtml(description)}</p>
          </article>
        `).join('')}
      </section>

      <section class="creator-content-grid">
        <article class="creator-panel" id="referrals">
          <div class="panel-heading">
            <span>Referral Performance</span>
            <strong>${escapeHtml(String(dashboard.directReferralsCount + dashboard.secondLevelReferralsCount + dashboard.thirdLevelReferralsCount))}</strong>
          </div>
          <div class="referral-levels">
            ${referralStats.map(([label, value]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="creator-panel creator-panel-accent" id="earnings">
          <div class="panel-heading">
            <span>Earnings Mix</span>
            <strong>${escapeHtml(formatMoney(dashboard.totalEarnings))}</strong>
          </div>
          <div class="earnings-list">
            <div>
              <span>Direct commission</span>
              <strong>${escapeHtml(formatMoney(dashboard.directCommissionEarned))}</strong>
            </div>
            <div>
              <span>Network earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.networkEarnings))}</strong>
            </div>
          </div>
        </article>
      </section>

      <section class="creator-lower-grid">
        <article class="creator-panel">
          <div class="panel-heading">
            <span>Recent Conversions</span>
            <strong>${escapeHtml(String(dashboard.totalConversions))}</strong>
          </div>
          <p class="muted-panel-copy">Detailed conversion activity will appear here as the dashboard expands.</p>
        </article>

        <article class="creator-panel">
          <div class="panel-heading">
            <span>Network Earnings</span>
            <strong>${escapeHtml(formatMoney(dashboard.networkEarnings))}</strong>
          </div>
          <p class="muted-panel-copy">Network rewards are calculated only from PartnerLinks platform fees.</p>
        </article>

        <article class="creator-panel" id="settings">
          <div class="panel-heading">
            <span>Referral Tree Preview</span>
            <strong>3 Levels</strong>
          </div>
          <p class="muted-panel-copy">Your creator network is tracked through direct, second-level, and third-level referrals.</p>
        </article>
      </section>
    </main>
  </div>
  <script>
    document.querySelectorAll('[data-copy-target]').forEach((button) => {
      button.addEventListener('click', async () => {
        const target = document.getElementById(button.dataset.copyTarget);
        if (!target) return;
        try {
          await navigator.clipboard.writeText(target.textContent.trim());
          button.textContent = 'Copied';
          window.setTimeout(() => {
            button.textContent = 'Copy';
          }, 1400);
        } catch (error) {
          button.textContent = 'Select link';
        }
      });
    });
  </script>
</body>
</html>`;
}

function renderCreatorDashboardCriticalStyles() {
  return `
    :root {
      color-scheme: dark;
      --bg: #04070f;
      --surface: rgba(8, 13, 28, 0.88);
      --surface-strong: rgba(14, 21, 44, 0.96);
      --text: #f8fafc;
      --muted: #9aa7c1;
      --primary: #9b5cff;
      --accent: #ff895f;
      --border: rgba(255, 255, 255, 0.1);
      --shadow: 0 40px 120px rgba(0, 0, 0, 0.25);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      background: radial-gradient(circle at top, rgba(155, 92, 255, 0.16), transparent 28%),
        radial-gradient(circle at 20% 10%, rgba(255, 111, 97, 0.14), transparent 22%),
        radial-gradient(circle at 90% 35%, rgba(155, 92, 255, 0.12), transparent 24%),
        var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: inherit; text-decoration: none; }
    .logo-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border-radius: 14px;
      background: linear-gradient(135deg, #9b5cff, #ff6f61);
      font-weight: 800;
    }
    .brand-name { display: block; font-weight: 800; font-size: 1rem; }
    .brand-tag { display: block; color: var(--muted); font-size: 0.78rem; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      color: #b8c0e0;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 0.78rem;
    }
    .creator-dashboard {
      width: min(1440px, 100%);
      min-height: 100vh;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      gap: 28px;
      padding: 24px;
    }
    .creator-sidebar {
      position: sticky;
      top: 24px;
      align-self: start;
      min-height: calc(100vh - 48px);
      display: flex;
      flex-direction: column;
      gap: 30px;
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(8, 13, 28, 0.78);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), var(--shadow);
      backdrop-filter: blur(18px);
    }
    .creator-sidebar-brand { display: flex; align-items: center; gap: 12px; }
    .creator-sidebar-nav { display: grid; gap: 6px; }
    .creator-sidebar-nav a {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      border-radius: 10px;
      color: var(--muted);
      font-weight: 700;
    }
    .creator-sidebar-nav a.active,
    .creator-sidebar-nav a:hover {
      color: var(--text);
      background: rgba(255,255,255,0.07);
    }
    .creator-main { min-width: 0; display: grid; gap: 22px; }
    .creator-topbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
      gap: 22px;
      align-items: stretch;
    }
    .creator-topbar > div,
    .creator-action-panel,
    .creator-stat-card,
    .creator-panel {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255,255,255,0.045);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
    }
    .creator-topbar > div:first-child { padding: 30px; }
    .creator-topbar h1 {
      max-width: 760px;
      margin: 12px 0;
      font-size: clamp(2.3rem, 5vw, 4.4rem);
      line-height: 0.96;
      letter-spacing: 0;
    }
    .creator-code-line { margin: 0; color: var(--muted); }
    .creator-code-line strong { color: var(--text); }
    .creator-earnings-chip {
      display: grid;
      align-content: end;
      gap: 10px;
      padding: 28px;
      background: linear-gradient(135deg, rgba(155,92,255,0.18), rgba(255,111,97,0.12));
    }
    .creator-earnings-chip span,
    .creator-action-panel span,
    .creator-stat-card span,
    .panel-heading span,
    .referral-levels span,
    .earnings-list span {
      color: var(--muted);
      font-size: 0.9rem;
    }
    .creator-earnings-chip strong { font-size: clamp(2rem, 4vw, 3rem); }
    .creator-action-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 22px;
      align-items: center;
      padding: 24px;
      background: linear-gradient(135deg, rgba(155,92,255,0.1), rgba(255,111,97,0.07));
    }
    .creator-action-panel div { min-width: 0; display: grid; gap: 8px; }
    .creator-action-panel strong { overflow-wrap: anywhere; }
    .creator-action-panel p,
    .muted-panel-copy,
    .creator-stat-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .copy-button {
      min-width: 118px;
      min-height: 44px;
      padding: 0 18px;
      border: 0;
      border-radius: 8px;
      background: linear-gradient(135deg, #9b5cff, #ff6f61);
      color: white;
      font: inherit;
      font-weight: 800;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: 0 18px 36px rgba(155, 92, 255, 0.18);
    }
    .creator-stat-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }
    .creator-stat-card {
      min-height: 154px;
      display: grid;
      align-content: space-between;
      gap: 16px;
      padding: 22px;
    }
    .creator-stat-card strong {
      font-size: clamp(1.55rem, 3vw, 2.15rem);
      overflow-wrap: anywhere;
    }
    .creator-content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
      gap: 16px;
    }
    .creator-lower-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .creator-panel { display: grid; gap: 22px; padding: 24px; }
    .creator-panel-accent {
      background: linear-gradient(135deg, rgba(155,92,255,0.12), rgba(255,111,97,0.08));
    }
    .panel-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
    }
    .panel-heading strong { font-size: 1.35rem; text-align: right; }
    .referral-levels,
    .earnings-list { display: grid; gap: 12px; }
    .referral-levels { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .referral-levels div,
    .earnings-list div {
      display: grid;
      gap: 8px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .referral-levels strong,
    .earnings-list strong { font-size: 1.45rem; }
    @media (max-width: 1024px) {
      .creator-dashboard { grid-template-columns: 1fr; gap: 18px; }
      .creator-sidebar { position: static; min-height: auto; }
      .creator-sidebar-nav { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
      .creator-sidebar-nav a { flex: 0 0 auto; }
      .creator-stat-grid,
      .creator-lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .creator-content-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .creator-dashboard { padding: 16px; }
      .creator-sidebar { padding: 16px; border-radius: 14px; }
      .creator-topbar,
      .creator-action-panel,
      .creator-stat-grid,
      .creator-lower-grid,
      .referral-levels { grid-template-columns: 1fr; }
      .creator-topbar > div:first-child,
      .creator-earnings-chip,
      .creator-action-panel,
      .creator-stat-card,
      .creator-panel {
        padding: 20px;
        border-radius: 14px;
      }
      .creator-topbar h1 { font-size: 2.4rem; }
      .copy-button { width: 100%; }
      .panel-heading { display: grid; }
      .panel-heading strong { text-align: left; }
    }
  `;
}

async function getBrandSetupData(brandId) {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single();
  if (error) throw error;
  if (!brand) return null;

  const { data: stores, error: storeError } = await supabase
    .from('shopify_stores')
    .select('*')
    .eq('brand_id', brand.id)
    .order('installed_at', { ascending: false })
    .limit(1);
  if (storeError) throw storeError;

  return {
    brand,
    store: stores ? stores[0] : null
  };
}

async function getBrandByIdentifier(brandIdentifier) {
  const normalizedBrandIdentifier = normalizeCode(brandIdentifier);
  if (/^\d+$/.test(normalizedBrandIdentifier)) {
    return getBrandById(normalizedBrandIdentifier);
  }

  const { data: brands, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (brands || []).find((brand) => generateSlug(brand.name) === normalizedBrandIdentifier) || null;
}

async function getBrandById(brandId) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

function renderBrandSetupPage(brand, store) {
  const destinationUrl = brand.destination_url || (store ? `https://${store.shop_domain}` : '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Brand Setup</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">PartnerLinks</p>
      <h1>Set up your brand</h1>
      <p>${escapeHtml(store ? `${store.shop_domain} is connected.` : 'Your Shopify store is connected.')}</p>
      <form class="auth-form" action="/brand/setup/${escapeHtml(brand.id)}" method="POST">
        <label for="name">Display brand name</label>
        <input id="name" name="name" type="text" value="${escapeHtml(brand.name || '')}" required>
        <label for="destination_url">Destination URL</label>
        <input id="destination_url" name="destination_url" type="url" value="${escapeHtml(destinationUrl)}" required>
        <label for="creator_commission_rate">Creator commission %</label>
        <input id="creator_commission_rate" name="creator_commission_rate" type="number" min="0" step="0.01" value="${escapeHtml(brand.creator_commission_rate ?? '')}" required>
        <button class="auth-primary-button" type="submit">Save brand setup</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

function renderBrandSetupSuccessPage(brand, store) {
  const links = buildBrandLinkExamples(brand);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Brand Ready</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">PartnerLinks</p>
      <h1>Brand setup saved</h1>
      <div class="link-list">
        <p><strong>Connected Shopify store</strong><br>${escapeHtml(store ? store.shop_domain : 'Connected store not found')}</p>
        <p><strong>Brand name</strong><br>${escapeHtml(brand.name)}</p>
        <p><strong>Creator commission</strong><br>${escapeHtml(brand.creator_commission_rate)}%</p>
        <p><strong>Creator onboarding link</strong><br>${escapeHtml(links.creatorSignupLink)}</p>
        <p><strong>Example tracking link format</strong><br>${escapeHtml(links.trackingLinkFormat)}</p>
        <p><strong>Next step</strong><br>Invite creators and share your onboarding link.</p>
      </div>
      <a class="auth-primary-button" href="/">Return home</a>
    </section>
  </main>
</body>
</html>`;
}

function buildBrandLinkExamples(brand) {
  const brandSlug = generateSlug(brand.name);
  return {
    creatorSignupLink: `${PUBLIC_BASE_URL}/join/brand/${brandSlug}`,
    trackingLinkFormat: `${PUBLIC_BASE_URL}/r/${brandSlug}/:creator_code`
  };
}

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSimpleMessagePage(title, message, href, linkLabel) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | ${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">PartnerLinks</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="auth-primary-button" href="${escapeHtml(href)}">${escapeHtml(linkLabel)}</a>
    </section>
  </main>
</body>
</html>`;
}
