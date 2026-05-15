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
  const statCards = [
    ['Direct Referrals', dashboard.directReferralsCount],
    ['Second-Level Referrals', dashboard.secondLevelReferralsCount],
    ['Third-Level Referrals', dashboard.thirdLevelReferralsCount],
    ['Total Conversions', dashboard.totalConversions],
    ['Total Order Value', formatMoney(dashboard.totalOrderValue)],
    ['Direct Commission Earned', formatMoney(dashboard.directCommissionEarned)],
    ['Network Earnings Earned', formatMoney(dashboard.networkEarnings)],
    ['Total Earnings', formatMoney(dashboard.totalEarnings)]
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Creator Dashboard</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="dashboard-shell">
    <header class="dashboard-header">
      <a class="brand" href="/">
        <span class="logo-mark">PL</span>
        <span>
          <span class="brand-name">PartnerLinks</span>
          <span class="brand-tag">Creator Dashboard</span>
        </span>
      </a>
      <nav class="dashboard-nav" aria-label="Creator navigation">
        <a class="active" href="/dashboard/${escapeHtml(dashboard.creatorCode)}">Overview</a>
      </nav>
    </header>

    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">Creator</p>
        <h1>${escapeHtml(dashboard.displayName)}</h1>
        <p class="dashboard-subtitle">Creator code: <strong>${escapeHtml(dashboard.creatorCode)}</strong></p>
      </div>
      <div class="dashboard-total">
        <span>Total earnings</span>
        <strong>${escapeHtml(formatMoney(dashboard.totalEarnings))}</strong>
      </div>
    </section>

    <section class="dashboard-link-panel" aria-label="Creator invite link">
      <div>
        <span>Creator invite link</span>
        <strong id="invite-link">${escapeHtml(inviteLink)}</strong>
      </div>
      <button class="copy-button" type="button" data-copy-target="invite-link">Copy</button>
    </section>

    <section class="dashboard-grid" aria-label="Creator performance">
      ${statCards.map(([label, value]) => `
        <article class="dashboard-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `).join('')}
    </section>
  </main>
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
