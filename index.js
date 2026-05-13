const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Client, GatewayIntentBits } = require("discord.js");
const supabase = require("./database/database/supabase");
const { log } = require("./services/services/logger");
const { registerCommands } = require("./commands/registerCommands");
const { handleInteraction } = require("./commands/handlers");
const { getBrandBySlug, getCreatorByCodeAndBrand, recordClick, upsertAttributionSession, generateSessionId, hashIp } = require("./services/trackingService");
const { getCreatorByInviteCode, recordCreatorInviteSession, bindCreatorToInviteSession } = require("./services/creatorNetworkService");
const { findOrCreateWebCreator, getCreatorById } = require("./services/creatorService");
const { getGoogleOAuthUrl, exchangeAuthCodeForUser } = require("./services/authService");
const {
  buildShopifyInstallUrl,
  validateShopifyCallback,
  exchangeShopifyCodeForToken,
  upsertShopifyStore,
  generateShopifyState,
  shopifyStateCookieOptions
} = require("./services/shopifyService");

const {
  DISCORD_TOKEN,
  BOT_ALERTS_CHANNEL_ID
} = require("./config/config/env");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/join/:creatorCode', async (req, res) => {
  try {
    const { creatorCode } = req.params;
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

    res.redirect(`/signup?invite=${encodeURIComponent(creatorCode)}`);
  } catch (error) {
    log('Creator invite redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/r/:brandSlug/:creatorCode', async (req, res) => {
  try {
    const { brandSlug, creatorCode } = req.params;

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

    if (inviteSessionId) {
      await bindCreatorToInviteSession(creator.id, inviteSessionId);
    }

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

    res.send(renderSimpleMessagePage(
      'Shopify connected',
      `${store.shop_domain} is connected to PartnerLinks. Creator onboarding and referral infrastructure can be configured next.`,
      '/',
      'Return home'
    ));
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
