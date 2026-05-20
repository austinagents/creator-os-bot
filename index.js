const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
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
  recordBrandInviteSession,
  bindCreatorToInviteSession,
  bindCreatorToBrandInviteSession,
  bindCreatorToBrandOrigin
} = require("./services/creatorNetworkService");
const { findOrCreateWebCreator, getCreatorById, getCreatorByAuthUserId, getCreatorByCodeOrReferralCode } = require("./services/creatorService");
const { getCreatorDashboardByCode } = require("./services/creatorDashboardService");
const { getBrandDashboardBySlug, findBrandBySlug } = require("./services/brandDashboardService");
const { ensureBrandOwner, userOwnsBrand } = require("./services/brandOwnershipService");
const { getGoogleOAuthUrl, exchangeAuthCodeForUser, getCurrentAuthUser } = require("./services/authService");
const {
  createStripeOnboardingLinkForCreator,
  getCreatorStripeDebugStatus,
  refreshCreatorStripeStatus
} = require("./services/stripeConnectService");
const { claimCreatorEarnings } = require("./services/earningsLifecycleService");
const {
  buildShopifyInstallUrl,
  getShopifyOAuthDebugInfo,
  validateShopifyCallback,
  exchangeShopifyCodeForToken,
  upsertShopifyStore,
  markShopifyStoreUninstalled,
  resolveShopifyConnectionState,
  ensureRequiredWebhooks,
  generateShopifyState,
  shopifyStateCookieOptions,
  shopifyStateClearCookieOptions
} = require("./services/shopifyService");
const {
  verifyShopifyWebhookHmac,
  ingestShopifyOrdersPaidWebhook,
  ingestShopifyRefundWebhook
} = require("./services/shopifyWebhookService");
const { getPayoutClaimGate } = require("./services/payoutModeService");
const { generateCanonicalSlug, generateSlug, normalizeCode } = require("./utils/slug");

const {
  DISCORD_TOKEN,
  BOT_ALERTS_CHANNEL_ID,
  PUBLIC_BASE_URL,
  SHOPIFY_SCOPES,
  ARIA_WELLNESS_TEST_PRODUCT_VARIANT_ID,
  NOVO_LOOM_GUMMIES_VARIANT_ID
} = require("./config/config/env");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_PLATFORM_FEE_RATE = 5;
const REFERRAL_LINK_HOST = 'partnerlinks.app';
const AUTH_RETURN_COOKIE_NAME = 'partnerlinks_auth_return';
const PUBLIC_SHOPIFY_BRAND_MAP = {
  'aria-wellness': 'partnerlinks-test.myshopify.com',
  'novo-loom-myshopify-': 'novo-loom.myshopify.com',
  'novo-loom-myshopify-com': 'novo-loom.myshopify.com'
};
const SHOPIFY_BACKED_PRODUCTS = {
  'novo-loom-myshopify-': {
    'novo-gummies': {
      name: 'Novo Gummies',
      slug: 'novo-gummies',
      shopifyProductUrl: 'https://novo-loom.myshopify.com/products/novo-gummies',
      shopifyVariantId: NOVO_LOOM_GUMMIES_VARIANT_ID || null,
      shopDomain: 'novo-loom.myshopify.com',
      requiresCartPermalink: true
    }
  },
  'novo-loom-myshopify-com': {
    'novo-gummies': {
      name: 'Novo Gummies',
      slug: 'novo-gummies',
      shopifyProductUrl: 'https://novo-loom.myshopify.com/products/novo-gummies',
      shopifyVariantId: NOVO_LOOM_GUMMIES_VARIANT_ID || null,
      shopDomain: 'novo-loom.myshopify.com',
      requiresCartPermalink: true
    }
  }
};
const MOCK_FEATURED_BRANDS = [
  {
    slug: 'aria-wellness',
    name: 'Aria Wellness',
    description: 'Daily ritual goods for balanced routines.',
    products: [
      {
        name: 'Test Product',
        slug: 'test-product',
        description: 'A simple wellness product for testing creator referrals.',
        payout: 'Est. 20% creator commission',
        imageLabel: 'Test Product',
        shopifyProductUrl: 'https://partnerlinks-test.myshopify.com/products/test-product',
        shopifyVariantId: ARIA_WELLNESS_TEST_PRODUCT_VARIANT_ID || null
      },
      ['Energy Gummies', 'A bright daily boost for morning routines.', 'Est. 20% creator commission'],
      ['Focus Drops', 'Clean nootropic drops for deep work blocks.', 'Est. 18% creator commission'],
      ['Reset Tea', 'Evening tea blend for calm recovery.', 'Est. 15% creator commission'],
      ['Daily Greens', 'Simple greens powder for busy creators.', 'Est. 20% creator commission']
    ]
  },
  {
    slug: 'novo-loom',
    name: 'Novo Loom',
    description: 'Elevated essentials for modern wardrobes.',
    products: [
      ['Everyday Rib Tee', 'Soft ribbed staple with a polished fit.', 'Est. 15% creator commission'],
      ['Studio Wide Pant', 'Relaxed trousers made for work and travel.', 'Est. 18% creator commission'],
      ['Layer Knit Tank', 'Lightweight knit for year-round styling.', 'Est. 15% creator commission'],
      ['Travel Wrap', 'Cozy oversized wrap for flights and shoots.', 'Est. 12% creator commission']
    ]
  },
  {
    slug: 'solace-market',
    name: 'Solace Market',
    description: 'Home finds with a calm design point of view.',
    products: [
      ['Ceramic Catchall', 'Low-profile tray for entryways and desks.', 'Est. 15% creator commission'],
      ['Linen Room Spray', 'Soft home scent with warm floral notes.', 'Est. 18% creator commission'],
      ['Cloud Throw', 'Textured throw for sofas and studio corners.', 'Est. 12% creator commission'],
      ['Ripple Vase', 'Sculptural vase for everyday arrangements.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'kai-vale',
    name: 'Kai & Vale',
    description: 'Clean skincare built for everyday creators.',
    products: [
      ['Barrier Cream', 'Hydrating daily cream for dewy skin.', 'Est. 20% creator commission'],
      ['Glow Cleanser', 'Gentle gel cleanser for AM and PM routines.', 'Est. 18% creator commission'],
      ['Mineral Mist', 'Refreshing mist for on-camera skin prep.', 'Est. 15% creator commission'],
      ['Night Oil', 'Lightweight facial oil for overnight repair.', 'Est. 20% creator commission']
    ]
  },
  {
    slug: 'bright-cart',
    name: 'Bright Cart',
    description: 'Smart kitchen tools for simple meal prep.',
    products: [
      ['Prep Bento Set', 'Stackable containers for weekly meals.', 'Est. 15% creator commission'],
      ['Snap Scale', 'Compact kitchen scale with clear display.', 'Est. 12% creator commission'],
      ['Pour-Over Kit', 'Clean coffee setup for daily rituals.', 'Est. 15% creator commission'],
      ['Chop Board Duo', 'Color-coded boards for simple prep.', 'Est. 12% creator commission']
    ]
  },
  {
    slug: 'luna-ridge',
    name: 'Luna Ridge',
    description: 'Outdoor basics for weekend adventures.',
    products: [
      ['Trail Sling', 'Light pack for hikes and day trips.', 'Est. 15% creator commission'],
      ['Summit Bottle', 'Insulated bottle for long outdoor days.', 'Est. 12% creator commission'],
      ['Camp Beanie', 'Warm knit beanie for cold starts.', 'Est. 15% creator commission'],
      ['Field Blanket', 'Packable blanket for picnics and campsites.', 'Est. 12% creator commission']
    ]
  },
  {
    slug: 'tonic-muse',
    name: 'Tonic Muse',
    description: 'Functional beverages with fresh flavor profiles.',
    products: [
      ['Citrus Focus Pack', 'Sparkling functional drink for workdays.', 'Est. 20% creator commission'],
      ['Berry Calm Pack', 'Evening beverage with mellow botanicals.', 'Est. 18% creator commission'],
      ['Sampler Flight', 'Try every flavor in one discovery box.', 'Est. 20% creator commission'],
      ['Studio Mini Fridge Pack', 'Creator-ready restock bundle.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'ember-vale',
    name: 'Ember Vale',
    description: 'Minimal accessories with rich material details.',
    products: [
      ['Arc Card Case', 'Slim leather card case for daily carry.', 'Est. 12% creator commission'],
      ['Soft Tote', 'Unstructured tote with premium hardware.', 'Est. 15% creator commission'],
      ['Loop Belt', 'Minimal belt with brushed metal finish.', 'Est. 12% creator commission'],
      ['Studio Pouch', 'Compact pouch for tech and travel extras.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'halo-bottle',
    name: 'Halo Bottle',
    description: 'Hydration products for desk-to-gym routines.',
    products: [
      ['Halo Sport Bottle', 'Leakproof bottle for workouts and errands.', 'Est. 15% creator commission'],
      ['Desk Carafe', 'Minimal glass carafe for focused work.', 'Est. 12% creator commission'],
      ['Infuser Lid', 'Fruit infuser lid for fresh water blends.', 'Est. 15% creator commission'],
      ['Hydration Starter Set', 'Bottle, sleeve, and cleaning brush bundle.', 'Est. 18% creator commission']
    ]
  },
  {
    slug: 'paperwild',
    name: 'Paperwild',
    description: 'Stationery and planning tools for focused work.',
    products: [
      ['Creator Planner', 'Weekly planner for launches and content.', 'Est. 20% creator commission'],
      ['Deep Work Pad', 'Minimal notepad for daily priorities.', 'Est. 15% creator commission'],
      ['Idea Cards', 'Prompt cards for campaign brainstorming.', 'Est. 18% creator commission'],
      ['Desk Reset Kit', 'Planner, pens, and sticky tabs in one bundle.', 'Est. 20% creator commission']
    ]
  },
  {
    slug: 'studio-pave',
    name: 'Studio Pave',
    description: 'Small-batch decor for warm modern homes.',
    products: [
      ['Arch Bookend', 'Weighted bookend with soft architectural lines.', 'Est. 12% creator commission'],
      ['Table Candle Duo', 'Warm candle pair for styled interiors.', 'Est. 15% creator commission'],
      ['Stone Tray', 'Textured tray for coffee tables and desks.', 'Est. 12% creator commission'],
      ['Gallery Frame Set', 'Minimal frame set for art walls.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'cedar-row',
    name: 'Cedar Row',
    description: 'Heritage-inspired apparel for everyday wear.',
    products: [
      ['Market Jacket', 'Light canvas jacket for everyday layering.', 'Est. 15% creator commission'],
      ['Heritage Crew', 'Soft sweatshirt with classic proportions.', 'Est. 15% creator commission'],
      ['Rib Sock Trio', 'Durable socks with vintage-inspired colors.', 'Est. 12% creator commission'],
      ['Field Shirt', 'Button-up shirt made for casual styling.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'moss-bloom',
    name: 'Moss & Bloom',
    description: 'Plant care essentials for apartment gardens.',
    products: [
      ['Leaf Shine Mist', 'Gentle plant mist for healthy leaves.', 'Est. 15% creator commission'],
      ['Self-Watering Pot', 'Minimal pot for low-maintenance care.', 'Est. 12% creator commission'],
      ['Grow Light Bar', 'Slim light bar for shelves and corners.', 'Est. 15% creator commission'],
      ['Plant Parent Kit', 'Tools and care cards for beginners.', 'Est. 18% creator commission']
    ]
  },
  {
    slug: 'fable-organics',
    name: 'Fable Organics',
    description: 'Pantry staples made with thoughtful ingredients.',
    products: [
      ['Golden Granola', 'Small-batch granola with warm spices.', 'Est. 15% creator commission'],
      ['Pantry Sauce Trio', 'Everyday sauces for quick meals.', 'Est. 18% creator commission'],
      ['Breakfast Bundle', 'Oats, granola, and nut butter starter kit.', 'Est. 20% creator commission'],
      ['Herbal Honey', 'Infused honey for tea and toast.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'rivet-works',
    name: 'Rivet Works',
    description: 'Durable gear for makers and studio spaces.',
    products: [
      ['Utility Apron', 'Canvas apron with smart tool pockets.', 'Est. 15% creator commission'],
      ['Bench Organizer', 'Modular organizer for creative workspaces.', 'Est. 12% creator commission'],
      ['Maker Tote', 'Heavy-duty tote for supplies and gear.', 'Est. 15% creator commission'],
      ['Studio Hook Rail', 'Wall rail for tools, bags, and accessories.', 'Est. 12% creator commission']
    ]
  },
  {
    slug: 'cloud-orchard',
    name: 'Cloud Orchard',
    description: 'Sleep and lounge products with soft textures.',
    products: [
      ['Lounge Robe', 'Plush robe for slow mornings and evenings.', 'Est. 15% creator commission'],
      ['Pillow Mist', 'Soft sleep scent with orchard notes.', 'Est. 18% creator commission'],
      ['Cloud Sheet Set', 'Breathable sheets with a smooth finish.', 'Est. 12% creator commission'],
      ['Rest Bundle', 'Robe, mist, and eye pillow sleep kit.', 'Est. 18% creator commission']
    ]
  },
  {
    slug: 'fjord-supply',
    name: 'Fjord Supply',
    description: 'Travel accessories designed for light packing.',
    products: [
      ['Compression Cube Set', 'Packing cubes for cleaner luggage.', 'Est. 15% creator commission'],
      ['Passport Folio', 'Slim folio for documents and cards.', 'Est. 12% creator commission'],
      ['Transit Pouch', 'Compact pouch for cables and small tech.', 'Est. 15% creator commission'],
      ['Weekender Strap', 'Comfort strap for travel bags.', 'Est. 12% creator commission']
    ]
  },
  {
    slug: 'aster-valley',
    name: 'Aster Valley',
    description: 'Jewelry basics with refined everyday finishes.',
    products: [
      ['Everyday Hoops', 'Lightweight hoops for daily styling.', 'Est. 15% creator commission'],
      ['Fine Chain Stack', 'Layering necklace set with soft shine.', 'Est. 12% creator commission'],
      ['Signet Ring', 'Minimal ring with a polished finish.', 'Est. 12% creator commission'],
      ['Travel Jewelry Case', 'Small case for organized travel.', 'Est. 15% creator commission']
    ]
  },
  {
    slug: 'glyph-beam',
    name: 'Glyph & Beam',
    description: 'Lighting accents for creators and home studios.',
    products: [
      ['Desk Glow Lamp', 'Compact lamp for warm desk lighting.', 'Est. 15% creator commission'],
      ['Creator Light Bar', 'Soft light bar for filming corners.', 'Est. 18% creator commission'],
      ['Ambient Bulb Set', 'Warm bulbs for layered room lighting.', 'Est. 12% creator commission'],
      ['Studio Mood Kit', 'Lamp, bulbs, and dimmer bundle.', 'Est. 18% creator commission']
    ]
  },
  {
    slug: 'roam-studio',
    name: 'Roam Studio',
    description: 'Creator-friendly tech accessories and desk gear.',
    products: [
      ['Magnetic Phone Stand', 'Adjustable stand for filming and calls.', 'Est. 15% creator commission'],
      ['Cable Dock', 'Weighted dock for cleaner desks.', 'Est. 12% creator commission'],
      ['Creator Desk Mat', 'Large mat with a smooth filming surface.', 'Est. 15% creator commission'],
      ['Travel Tech Roll', 'Organizer roll for chargers and adapters.', 'Est. 15% creator commission']
    ]
  }
].map((brand) => ({
  ...brand,
  products: brand.products.map((product) => {
    if (!Array.isArray(product)) {
      return {
        ...product,
        slug: normalizeCode(product.slug || generateSlug(product.name))
      };
    }

    const [name, description, payout] = product;
    return {
      name,
      slug: generateSlug(name),
      description,
      payout
    };
  })
}));

app.post('/webhooks/shopify/orders-paid', express.raw({ type: '*/*' }), async (req, res) => {
  const shopDomain = String(req.get('X-Shopify-Shop-Domain') || '').trim().toLowerCase();
  const webhookId = req.get('X-Shopify-Webhook-Id') || null;

  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhookHmac(req.body, hmac)) {
      log('Shopify orders paid webhook rejected: invalid HMAC', {
        shopDomain,
        webhookId
      });
      return res.status(401).send('Invalid Shopify webhook signature.');
    }

    const result = await ingestShopifyOrdersPaidWebhook({
      rawBody: req.body,
      shopDomain,
      webhookId
    });

    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    log('Shopify orders paid webhook error:', {
      shopDomain,
      webhookId,
      message: error.message,
      stack: error.stack || null
    });
    res.status(500).json({ ok: false, error: 'Unable to process Shopify webhook.' });
  }
});

app.post('/webhooks/shopify/refunds-create', express.raw({ type: '*/*' }), async (req, res) => {
  const shopDomain = String(req.get('X-Shopify-Shop-Domain') || '').trim().toLowerCase();
  const webhookId = req.get('X-Shopify-Webhook-Id') || null;

  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhookHmac(req.body, hmac)) {
      log('Shopify refund webhook rejected: invalid HMAC', {
        shopDomain,
        webhookId
      });
      return res.status(401).send('Invalid Shopify webhook signature.');
    }

    const result = await ingestShopifyRefundWebhook({
      rawBody: req.body,
      shopDomain,
      webhookId
    });

    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    log('Shopify refund webhook error:', {
      shopDomain,
      webhookId,
      message: error.message,
      stack: error.stack || null
    });
    res.status(500).json({ ok: false, error: 'Unable to process Shopify refund webhook.' });
  }
});

app.post('/webhooks/shopify/app-uninstalled', express.raw({ type: '*/*' }), async (req, res) => {
  const shopDomain = String(req.get('X-Shopify-Shop-Domain') || '').trim().toLowerCase();
  const webhookId = req.get('X-Shopify-Webhook-Id') || null;

  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhookHmac(req.body, hmac)) {
      log('Shopify app uninstall webhook rejected: invalid HMAC', {
        shopDomain,
        webhookId
      });
      return res.status(401).send('Invalid Shopify webhook signature.');
    }

    const payload = req.body && req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    const resolvedShopDomain = shopDomain || payload.myshopify_domain || payload.shop_domain || payload.domain;
    if (!resolvedShopDomain) {
      return res.status(400).json({ ok: false, error: 'Missing Shopify shop domain.' });
    }
    const result = await markShopifyStoreUninstalled({ shopDomain: resolvedShopDomain });
    log('Shopify app uninstall webhook processed:', {
      shopDomain: result.shop_domain,
      brandId: result.brand_id || null,
      status: result.status || result.reason,
      webhookId
    });

    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    log('Shopify app uninstall webhook error:', {
      shopDomain,
      webhookId,
      message: error.message,
      stack: error.stack || null
    });
    res.status(500).json({ ok: false, error: 'Unable to process Shopify uninstall webhook.' });
  }
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(injectSupportWidgetMiddleware);
app.get('/styles.css', (req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const staticPageRoutes = {
  '/privacy': 'privacy.html',
  '/terms': 'terms.html',
  '/faq': 'faq.html',
  '/about': 'about.html',
  '/contact': 'contact.html',
  '/support': 'support.html',
  '/creators': 'creators.html',
  '/brands': 'brands.html',
  '/data-attribution': 'data-attribution.html'
};

Object.entries(staticPageRoutes).forEach(([route, fileName]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', fileName));
  });
});

app.get('/join/brand/:brandSlug', async (req, res) => {
  try {
    const brandCode = normalizeCode(req.params.brandSlug);
    const brand = await getBrandByIdentifier(brandCode);
    if (!brand) {
      return res.status(404).json({ error: 'Brand invite not found' });
    }

    const signedInDashboardPath = await getSignedInCreatorDashboardPath(req, res);
    if (signedInDashboardPath) {
      return res.redirect(signedInDashboardPath);
    }

    let brandInviteSessionId = req.cookies.partnerlinks_brand_invite_sid;
    if (!brandInviteSessionId) {
      brandInviteSessionId = generateSessionId();
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const ipHash = hashIp(clientIp);
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    try {
      await recordBrandInviteSession({
        invitingBrandId: brand.id,
        sessionId: brandInviteSessionId,
        ipHash,
        userAgent,
        referrer,
        inviteCode: brandCode
      });
      log('Brand invite session recorded', {
        brandId: brand.id,
        inviteCode: brandCode,
        hasSessionId: Boolean(brandInviteSessionId)
      });
    } catch (sessionError) {
      log('Brand invite session record failed; continuing with invite cookie fallback', {
        brandId: brand.id,
        inviteCode: brandCode,
        message: sessionError.message
      });
    }

    res.cookie('partnerlinks_brand_invite_sid', brandInviteSessionId, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.cookie('partnerlinks_brand_invite_id', String(brand.id), {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.clearCookie('partnerlinks_invite_sid');

    res.redirect(`/signup?brand=${encodeURIComponent(generateCanonicalSlug(brand.name))}`);
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

    const signedInDashboardPath = await getSignedInCreatorDashboardPath(req, res);
    if (signedInDashboardPath) {
      return res.redirect(signedInDashboardPath);
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
    res.clearCookie('partnerlinks_brand_invite_sid');

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

app.get('/r/:brandSlug/:creatorCode/:productSlug', async (req, res) => {
  try {
    const brandSlug = normalizeCode(req.params.brandSlug);
    const creatorCode = normalizeCode(req.params.creatorCode);
    const productSlug = normalizeCode(req.params.productSlug);
    let sessionId = req.cookies.partnerlinks_sid;
    if (!sessionId) {
      sessionId = generateSessionId();
    }
    const productDestination = getShopifyProductDestination(brandSlug, productSlug, creatorCode, sessionId);
    if (productDestination.blockedReason) {
      log('Product referral blocked by incomplete Shopify product metadata:', {
        brandSlug,
        creatorCode,
        productSlug,
        reason: productDestination.blockedReason,
        shopDomain: productDestination.shopDomain || null
      });
      return res.status(503).json({ error: 'Product route is not fully configured for Shopify checkout attribution.' });
    }
    const productDestinationUrl = productDestination.url;
    const mappedShopDomain = getPublicShopifyBrandDomain(brandSlug);

    const brand = await getBrandForProductReferral(brandSlug);
    if (!brand) {
      if (productDestinationUrl) {
        log('Product referral forwarding without DB brand match:', {
          brandSlug,
          creatorCode,
          productSlug,
          shopDomain: mappedShopDomain || null
        });
        return res.redirect(productDestinationUrl);
      }
      return res.status(404).json({ error: 'Brand not found' });
    }

    const destinationUrl = productDestinationUrl || brand.destination_url;
    if (!destinationUrl) {
      return res.status(400).json({ error: 'Product destination URL not configured' });
    }

    const creator = await getCreatorForProductReferral(creatorCode, brand.id);
    if (!creator) {
      if (productDestinationUrl) {
        log('Product referral forwarding without DB creator match:', { brandId: brand.id, brandSlug, creatorCode, productSlug });
        return res.redirect(productDestinationUrl);
      }
      return res.status(404).json({ error: 'Creator not found' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const ipHash = hashIp(clientIp);
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    const click = await recordClick(
      brand.id,
      creator.id,
      sessionId,
      ipHash,
      userAgent,
      referrer,
      destinationUrl,
      {
        creatorCode,
        referralCode: creator.referral_code || creator.creator_code || creatorCode,
        brandSlug,
        productSlug,
        shopDomain: mappedShopDomain,
        partnerlinksRef: sessionId
      }
    );

    await upsertAttributionSession(brand.id, sessionId, creator.id, click.id);

    res.cookie('partnerlinks_sid', sessionId, {
      maxAge: 14 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.redirect(destinationUrl);
  } catch (error) {
    log('Product referral redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', async (req, res) => {
  try {
    const creator = await getHomepageCreator(req, res);
    res.set('Cache-Control', 'no-store, max-age=0');
    res.send(renderHomepage(creator));
  } catch (error) {
    log('Homepage auth-aware render error:', error);
    res.set('Cache-Control', 'no-store, max-age=0');
    res.send(renderHomepage(null));
  }
});
app.get('/brands/:brandSlug', async (req, res) => {
  res.status(404).send(renderSimpleMessagePage(
    'Demo brand page unavailable',
    'PartnerLinks public demo cards are display-only examples. Use an approved brand referral link or return home.',
    '/',
    'Return home'
  ));
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
    const brandInviteSessionId = req.cookies.partnerlinks_brand_invite_sid;
    const brandInviteId = req.cookies.partnerlinks_brand_invite_id;

    if (inviteSessionId) {
      await bindCreatorToInviteSession(creator.id, inviteSessionId);
    } else if (brandInviteSessionId) {
      let brandSessionBound = null;
      try {
        brandSessionBound = await bindCreatorToBrandInviteSession(creator.id, brandInviteSessionId);
      } catch (brandSessionError) {
        log('Brand invite session bind failed; using brand id fallback if available', {
          creatorId: creator.id,
          hasBrandInviteId: Boolean(brandInviteId),
          message: brandSessionError.message
        });
      }
      if (!brandSessionBound && brandInviteId) {
        await bindCreatorToBrandOrigin(creator.id, brandInviteId);
      }
    } else if (brandInviteId) {
      await bindCreatorToBrandOrigin(creator.id, brandInviteId);
    }

    res.clearCookie('partnerlinks_invite_sid');
    res.clearCookie('partnerlinks_brand_invite_sid');
    res.clearCookie('partnerlinks_brand_invite_id');
    const safeReturnPath = getSafeAuthReturnPath(req.cookies[AUTH_RETURN_COOKIE_NAME]);
    if (safeReturnPath) {
      res.clearCookie(AUTH_RETURN_COOKIE_NAME, authReturnClearCookieOptions());
      log('Auth callback returning to safe internal path', {
        authUserId: authUser.id,
        returnPath: safeReturnPath
      });
      return res.redirect(safeReturnPath);
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
app.get('/dashboard', async (req, res) => {
  try {
    const authUser = await getCurrentAuthUser(req, res);
    if (!authUser) {
      log('Creator dashboard auth check: no persisted auth user');
      return res.send(renderCreatorDashboardEntryPage());
    }

    const creator = await getCreatorByAuthUserId(authUser.id);
    if (!creator || !creator.creator_code) {
      log('Creator dashboard auth check: auth user has no creator row', { authUserId: authUser.id });
      return res.send(renderCreatorDashboardEntryPage());
    }

    log('Creator dashboard auth check: redirecting signed-in creator', { creatorCode: normalizeCode(creator.creator_code) });
    res.redirect(`/dashboard/${encodeURIComponent(normalizeCode(creator.creator_code))}`);
  } catch (error) {
    log('Creator dashboard session lookup error:', error);
    res.send(renderCreatorDashboardEntryPage());
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

    const authUser = await getCurrentAuthUser(req, res);
    if (!authUser) {
      return res.status(401).send(renderSimpleMessagePage(
        'Sign in required',
        'Please sign in with the Google account that owns this creator dashboard.',
        '/signup',
        'Sign in with Google'
      ));
    }

    const ownerCanClaim = Boolean(
      dashboard.creator.auth_user_id &&
      String(dashboard.creator.auth_user_id) === String(authUser.id)
    );
    if (!ownerCanClaim) {
      return res.status(403).send(renderSimpleMessagePage(
        'Creator access blocked',
        'This creator dashboard is only available to the signed-in owner.',
        '/dashboard',
        'Open my dashboard'
      ));
    }

    const claimStatus = ['success', 'blocked'].includes(req.query.claim) ? req.query.claim : null;
    const payoutClaimGate = getPayoutClaimGate();

    res.set('Cache-Control', 'no-store, max-age=0');
    res.send(renderCreatorDashboardPage(dashboard, { ownerCanClaim, claimStatus, payoutClaimGate }));
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
app.post('/earnings/claim', async (req, res) => {
  try {
    const creator = await getScopedSignedInCreator(req, res, {
      creatorCode: req.body ? req.body.creator_code : null,
      requireExplicitCreatorCode: true
    });
    if (!creator || !creator.creator_code) {
      return res.redirect('/dashboard');
    }

    if (creator.stripe_onboarding_status !== 'payouts_enabled') {
      log('Claim earnings blocked: Stripe payouts not enabled', {
        creatorId: creator.id,
        creatorCode: creator.creator_code,
        stripeStatus: creator.stripe_onboarding_status
      });
      return res.redirect(`/dashboard/${encodeURIComponent(normalizeCode(creator.creator_code))}`);
    }

    const payoutClaimGate = getPayoutClaimGate();
    if (!payoutClaimGate.allowed) {
      log('Claim earnings blocked by payout mode gate', {
        creatorId: creator.id,
        creatorCode: creator.creator_code,
        payoutMode: payoutClaimGate.mode,
        modeRecognized: payoutClaimGate.recognized,
        reason: payoutClaimGate.reason
      });
      return res.redirect(`/dashboard/${encodeURIComponent(normalizeCode(creator.creator_code))}?claim=blocked`);
    }

    const claimResult = await claimCreatorEarnings({
      creatorId: creator.id,
      stripeAccountId: creator.stripe_account_id,
      payoutClaimGate
    });

    log('Claim earnings ledger update completed', {
      creatorId: creator.id,
      creatorCode: creator.creator_code,
      claimed: claimResult.claimed,
      claimBatchId: claimResult.claimBatchId,
      totalClaimedAmount: claimResult.totalClaimedAmount,
      stripeTransferId: claimResult.stripeTransferId || null,
      stripeTransferStatus: claimResult.stripeTransferStatus || null
    });

    const query = claimResult.claimed ? '?claim=success' : '';
    res.redirect(`/dashboard/${encodeURIComponent(normalizeCode(creator.creator_code))}${query}`);
  } catch (error) {
    log('Claim earnings error:', {
      stripeErrorMessage: error.message,
      stripeErrorType: error.stripeErrorType || null,
      stripeErrorCode: error.stripeErrorCode || null,
      transferPayloadAttempted: error.transferPayloadAttempted || null,
      creatorStripeAccountId: error.creatorStripeAccountId || null,
      claimBatchId: error.claimBatchId || null,
      transferAmount: error.transferAmount || null,
      transferGroupUsed: Boolean(error.transferGroupUsed),
      stack: error.stack || null
    });
    res.status(500).send(renderSimpleMessagePage(
      'Unable to claim earnings',
      `No money was moved. Stripe sandbox error: ${error.message || 'Unknown Stripe transfer error.'}`,
      '/dashboard',
      'Back to dashboard'
    ));
  }
});
app.get('/stripe/connect/start', async (req, res) => {
  try {
    const requestedCreatorCode = normalizeCode(req.query.creator_code);
    const creator = await getScopedSignedInCreator(req, res, {
      creatorCode: requestedCreatorCode,
      requireExplicitCreatorCode: Boolean(requestedCreatorCode)
    });
    if (!creator) {
      return res.redirect('/dashboard');
    }

    const onboardingUrl = await createStripeOnboardingLinkForCreator(creator);
    const creatorDashboardPath = `/dashboard/${encodeURIComponent(normalizeCode(creator.creator_code))}`;
    if (!onboardingUrl) {
      log('Stripe Connect onboarding start: account already submitted, returning to dashboard', {
        creatorId: creator.id,
        creatorCode: creator.creator_code
      });
      return res.redirect(creatorDashboardPath);
    }

    log('Stripe Connect onboarding start: redirecting to hosted onboarding', {
      creatorId: creator.id,
      creatorCode: creator.creator_code
    });
    res.redirect(onboardingUrl);
  } catch (error) {
    log('Stripe Connect onboarding start error:', error);
    res.status(500).send(renderSimpleMessagePage(
      'Unable to start Stripe setup',
      'Please confirm Stripe test keys are configured, then try again.',
      '/dashboard',
      'Back to dashboard'
    ));
  }
});
app.get('/stripe/connect/debug', async (req, res) => {
  try {
    const requestedCreatorCode = normalizeCode(req.query.creator_code);
    const creator = await getScopedSignedInCreator(req, res, {
      creatorCode: requestedCreatorCode,
      requireExplicitCreatorCode: true
    });
    if (!creator) {
      return res.status(403).json({
        error: 'Sign in required or creator access denied',
        creator_code_required: true
      });
    }

    const debug = await getCreatorStripeDebugStatus(creator);
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json(debug);
  } catch (error) {
    log('Stripe Connect debug error:', error);
    res.status(500).json({ error: 'Unable to load Stripe debug status' });
  }
});
app.get('/stripe/connect/refresh', async (req, res) => {
  const creatorCode = normalizeCode(req.query.creator_code);
  log('Stripe Connect refresh URL hit; regenerating onboarding link', {
    creatorCode: creatorCode || null
  });
  const query = creatorCode ? `?creator_code=${encodeURIComponent(creatorCode)}` : '';
  res.redirect(`/stripe/connect/start${query}`);
});
app.get('/stripe/connect/return', async (req, res) => {
  let redirectPath = '/dashboard';
  try {
    const requestedCreatorCode = normalizeCode(req.query.creator_code);
    const creator = await getScopedSignedInCreator(req, res, {
      creatorCode: requestedCreatorCode,
      requireExplicitCreatorCode: Boolean(requestedCreatorCode)
    });
    if (creator) {
      redirectPath = `/dashboard/${encodeURIComponent(normalizeCode(creator.creator_code))}`;
      const updatedCreator = await refreshCreatorStripeStatus(creator);
      log('Stripe Connect return URL hit; status refreshed', {
        creatorId: creator.id,
        creatorCode: creator.creator_code,
        status: updatedCreator ? updatedCreator.stripe_onboarding_status : creator.stripe_onboarding_status
      });
    } else {
      log('Stripe Connect return URL hit without signed-in creator');
    }
  } catch (error) {
    log('Stripe Connect return status refresh error:', error);
  }

  res.redirect(redirectPath);
});
app.get('/brand-dashboard', async (req, res) => {
  try {
    const brandEntry = await getSignedInBrandOwnerEntry(req, res);
    if (brandEntry && brandEntry.redirectPath) {
      return res.redirect(brandEntry.redirectPath);
    }
    res.send(renderBrandDashboardEntryPage());
  } catch (error) {
    log('Brand dashboard entry error:', error);
    res.send(renderBrandDashboardEntryPage());
  }
});
app.get('/brand-dashboard/:brandSlug', async (req, res) => {
  try {
    const brandSlug = String(req.params.brandSlug || '').trim().toLowerCase();
    const brand = await findBrandBySlug(brandSlug);
    if (!brand) {
      return res.redirect('/register-business');
    }

    const brandAccess = await getScopedSignedInBrandOwner(req, res, {
      brandId: brand.id,
      action: 'view_brand_dashboard'
    });
    if (!brandAccess.allowed) {
      return sendBrandAccessBlocked(res, brandAccess);
    }

    const setup = await getBrandSetupData(brand.id);
    if (setup && setup.store && setup.shopifyConnectionState && !setup.shopifyConnectionState.connected) {
      return res.redirect(`/brand/setup/${encodeURIComponent(brand.id)}/reconnect-shopify`);
    }

    const dashboard = await getBrandDashboardBySlug(brandSlug);
    if (!dashboard) {
      return res.redirect('/register-business');
    }

    res.set('Cache-Control', 'no-store, max-age=0');
    res.send(renderBrandDashboardPage(dashboard));
  } catch (error) {
    log('Brand dashboard error:', error);
    res.status(500).send(renderSimpleMessagePage(
      'Dashboard unavailable',
      'Unable to load this brand dashboard. Please try again.',
      '/brand-dashboard',
      'Brand dashboard'
    ));
  }
});
app.get('/auth/google', (req, res) => {
  res.redirect('/signup');
});
app.get('/api/shopify/start', async (req, res) => {
  try {
    const authUser = await getCurrentAuthUser(req, res);
    if (!authUser) {
      log('Shopify OAuth start blocked: signed-in brand owner required');
      return res.status(401).send(renderSimpleMessagePage(
        'Sign in to connect Shopify',
        'Brand setup requires a signed-in owner so PartnerLinks can scope the Shopify store to the correct brand admin.',
        '/signup',
        'Sign in with Google'
      ));
    }

    const { shop } = req.query;
    const state = generateShopifyState();
    const { installUrl, shopDomain } = buildShopifyInstallUrl(shop, state);
    const oauthDebug = getShopifyOAuthDebugInfo(shopDomain, state);
    log('Shopify OAuth start redirect prepared', {
      authUserId: authUser.id,
      shopDomain,
      scopeString: SHOPIFY_SCOPES,
      parsedScopes: oauthDebug.parsed_scopes,
      writeWebhooksPresent: oauthDebug.write_webhooks_present,
      redirectUri: oauthDebug.redirect_uri
    });

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
app.get('/brand/setup/:brandId/reconnect-shopify', async (req, res) => {
  try {
    const brandId = normalizeCode(req.params.brandId);
    const brandAccess = await getScopedSignedInBrandOwner(req, res, {
      brandId,
      action: 'reconnect_shopify'
    });
    if (!brandAccess.allowed) {
      if (req.query.debug === '1') {
        return res.status(brandAccess.status || 403).json({
          ownership_passed: false,
          brand_id: brandId || null,
          reason: brandAccess.reason || 'brand_access_blocked'
        });
      }
      if (brandAccess.status === 401) {
        const reconnectPath = `/brand/setup/${encodeURIComponent(brandId)}/reconnect-shopify`;
        res.cookie(AUTH_RETURN_COOKIE_NAME, reconnectPath, authReturnCookieOptions());
        log('Brand-scoped Shopify reconnect stored auth return target', {
          brandId,
          returnPath: reconnectPath
        });
        return res.redirect('/auth/google/start');
      }
      return sendBrandAccessBlocked(res, brandAccess);
    }

    const setup = await getBrandSetupData(brandId);
    if (!setup || !setup.store || !setup.store.shop_domain) {
      if (req.query.debug === '1') {
        return res.status(404).json({
          ownership_passed: true,
          brand_id: brandId,
          shop_domain: null,
          would_redirect_to_shopify: false,
          reason: 'shopify_store_not_found'
        });
      }
      return res.status(404).send(renderSimpleMessagePage(
        'Shopify store not found',
        'This brand does not have a Shopify store row to reconnect. Start from brand setup or contact an operator.',
        `/brand/setup/${encodeURIComponent(brandId)}`,
        'Back to setup'
      ));
    }

    const state = generateShopifyState();
    const { installUrl, shopDomain } = buildShopifyInstallUrl(setup.store.shop_domain, state);
    const oauthDebug = getShopifyOAuthDebugInfo(shopDomain, state);
    if (req.query.debug === '1') {
      const parsedInstallUrl = new URL(installUrl);
      return res.json({
        ownership_passed: true,
        brand_id: brandId,
        shop_domain: shopDomain,
        runtime_shopify_app_url: oauthDebug.shopify_app_url,
        redirect_uri: oauthDebug.redirect_uri,
        oauth_host: parsedInstallUrl.host,
        oauth_path: parsedInstallUrl.pathname,
        scope_string: oauthDebug.scope_string,
        would_redirect_to_shopify: true,
        generated_oauth_url_present: Boolean(installUrl),
        reason: null
      });
    }
    log('Brand-scoped Shopify reconnect redirect prepared', {
      brandId,
      authUserId: brandAccess.authUser.id,
      shopDomain,
      scopeString: SHOPIFY_SCOPES,
      parsedScopes: oauthDebug.parsed_scopes,
      writeWebhooksPresent: oauthDebug.write_webhooks_present,
      redirectUri: oauthDebug.redirect_uri,
      existingStoreId: setup.store.id || null
    });

    res.cookie('partnerlinks_shopify_state', state, shopifyStateCookieOptions());
    res.cookie('partnerlinks_shopify_shop', shopDomain, shopifyStateCookieOptions());
    res.redirect(installUrl);
  } catch (error) {
    log('Brand-scoped Shopify reconnect error:', error);
    if (req.query.debug === '1') {
      return res.status(500).json({
        ownership_passed: false,
        brand_id: normalizeCode(req.params.brandId) || null,
        would_redirect_to_shopify: false,
        reason: 'shopify_reconnect_debug_error'
      });
    }
    res.status(500).send(renderSimpleMessagePage(
      'Shopify reconnect error',
      'Unable to start Shopify reconnect. Please try again.',
      `/brand/setup/${encodeURIComponent(req.params.brandId)}`,
      'Back to setup'
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

    const authUser = await getCurrentAuthUser(req, res);
    if (!authUser) {
      log('Shopify OAuth callback blocked: signed-in brand owner required');
      return res.status(401).send(renderSimpleMessagePage(
        'Sign in required',
        'Please sign in again before completing Shopify setup so this brand can be linked to the correct owner.',
        '/signup',
        'Sign in with Google'
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

    const shopifyToken = await exchangeShopifyCodeForToken(shop, code);
    const store = await upsertShopifyStore({
      shopDomain: shop,
      tokenData: shopifyToken
    });
    const webhookRegistration = await ensureRequiredWebhooks({
      shopDomain: store.shop_domain,
      accessToken: store.access_token
    });
    log('Shopify required webhook registration checked after install:', {
      shopDomain: store.shop_domain,
      brandId: store.brand_id,
      apiOk: webhookRegistration.api_ok,
      created: (webhookRegistration.created || []).map((row) => row.topic),
      missing: (webhookRegistration.required_webhooks || [])
        .filter((row) => !row.registered)
        .map((row) => row.topic),
      errors: webhookRegistration.errors || []
    });
    await ensureBrandOwner({
      brandId: store.brand_id,
      authUserId: authUser.id,
      email: authUser.email || null,
      sourceSystem: 'shopify_oauth',
      shopDomain: store.shop_domain,
      metadata: {
        oauth_shop: shop,
        owner_bound_at: new Date().toISOString()
      }
    });

    res.clearCookie('partnerlinks_shopify_state', shopifyStateClearCookieOptions());
    res.clearCookie('partnerlinks_shopify_shop', shopifyStateClearCookieOptions());
    const connectedBrand = await getBrandById(store.brand_id);
    if (connectedBrand) {
      res.cookie('partnerlinks_brand_slug', generateSlug(connectedBrand.name), brandStateCookieOptions());
    }

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
app.get('/register-business', async (req, res) => {
  try {
    const brandEntry = await getSignedInBrandOwnerEntry(req, res);
    if (brandEntry && brandEntry.redirectPath) {
      return res.redirect(brandEntry.redirectPath);
    }
    res.sendFile(path.join(__dirname, 'public', 'register-business.html'));
  } catch (error) {
    log('Register business entry error:', error);
    res.sendFile(path.join(__dirname, 'public', 'register-business.html'));
  }
});
app.get('/brand/setup/:brandId', async (req, res) => {
  try {
    const brandId = normalizeCode(req.params.brandId);
    const brandAccess = await getScopedSignedInBrandOwner(req, res, {
      brandId,
      action: 'view_brand_setup'
    });
    if (!brandAccess.allowed) {
      return sendBrandAccessBlocked(res, brandAccess);
    }

    const setup = await getBrandSetupData(brandId);
    if (!setup) {
      return res.status(404).send(renderSimpleMessagePage(
        'Brand not found',
        'We could not find that brand setup record.',
        '/register-business',
        'Connect Shopify'
      ));
    }
    if (setup.store && setup.shopifyConnectionState && !setup.shopifyConnectionState.connected) {
      return res.redirect(`/brand/setup/${encodeURIComponent(brandId)}/reconnect-shopify`);
    }

    res.send(renderBrandSetupPage(setup.brand, setup.store, setup.shopifyConnectionState));
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
    const brandAccess = await getScopedSignedInBrandOwner(req, res, {
      brandId,
      action: 'update_brand_setup'
    });
    if (!brandAccess.allowed) {
      return sendBrandAccessBlocked(res, brandAccess);
    }

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

    const store = stores ? stores[0] : null;
    const shopifyConnectionState = await resolveShopifyConnectionState(store);
    res.cookie('partnerlinks_brand_slug', generateSlug(brand.name), brandStateCookieOptions());
    res.send(renderBrandSetupSuccessPage(brand, store, shopifyConnectionState));
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

async function getHomepageCreator(req, res) {
  const authUser = await getCurrentAuthUser(req, res);
  if (!authUser) {
    log('Homepage auth check: no persisted auth user');
    return null;
  }

  const creator = await getCreatorByAuthUserId(authUser.id);
  if (!creator || !creator.creator_code) {
    log('Homepage auth check: auth user has no creator row', { authUserId: authUser.id });
    return null;
  }

  log('Homepage auth check: signed-in creator resolved', { creatorCode: normalizeCode(creator.creator_code) });
  return creator;
}

async function getSignedInCreatorDashboardPath(req, res) {
  const creator = await getSignedInCreator(req, res);
  if (!creator || !creator.creator_code) return null;

  const creatorCode = normalizeCode(creator.creator_code);
  return creatorCode ? `/dashboard/${encodeURIComponent(creatorCode)}` : null;
}

async function getSignedInCreator(req, res) {
  const authUser = await getCurrentAuthUser(req, res);
  if (!authUser) return null;

  const creator = await getCreatorByAuthUserId(authUser.id);
  return creator || null;
}

async function getScopedSignedInCreator(req, res, {
  creatorCode,
  requireExplicitCreatorCode = false
} = {}) {
  const authUser = await getCurrentAuthUser(req, res);
  if (!authUser) return null;

  const normalizedCreatorCode = normalizeCode(creatorCode);
  if (!normalizedCreatorCode) {
    if (requireExplicitCreatorCode) {
      log('Scoped creator resolution blocked: missing explicit creator_code', {
        authUserId: authUser.id
      });
      return null;
    }
    return await getCreatorByAuthUserId(authUser.id);
  }

  const creator = await getCreatorByCodeOrReferralCode(normalizedCreatorCode, null);
  if (!creator) {
    log('Scoped creator resolution blocked: creator not found', {
      authUserId: authUser.id,
      creatorCode: normalizedCreatorCode
    });
    return null;
  }

  if (String(creator.auth_user_id || '') !== String(authUser.id)) {
    log('Scoped creator resolution blocked: auth user does not own requested creator', {
      authUserId: authUser.id,
      requestedCreatorCode: normalizedCreatorCode,
      creatorId: creator.id,
      creatorAuthUserId: creator.auth_user_id || null
    });
    return null;
  }

  return creator;
}

async function getScopedSignedInBrandOwner(req, res, {
  brandId,
  action
} = {}) {
  const authUser = await getCurrentAuthUser(req, res);
  const normalizedBrandId = normalizeCode(brandId);
  if (!authUser) {
    log('Scoped brand owner resolution blocked: signed-in auth user required', {
      brandId: normalizedBrandId || null,
      action: action || null
    });
    return {
      allowed: false,
      reason: 'signed_in_brand_owner_required',
      status: 401
    };
  }

  if (!normalizedBrandId || !/^\d+$/.test(normalizedBrandId)) {
    log('Scoped brand owner resolution blocked: invalid brand id', {
      authUserId: authUser.id,
      brandId: normalizedBrandId || null,
      action: action || null
    });
    return {
      allowed: false,
      reason: 'invalid_brand_id',
      status: 404
    };
  }

  const ownsBrand = await userOwnsBrand({
    brandId: normalizedBrandId,
    authUserId: authUser.id
  });

  if (!ownsBrand) {
    log('Scoped brand owner resolution blocked: auth user does not own requested brand', {
      authUserId: authUser.id,
      brandId: normalizedBrandId,
      action: action || null
    });
    return {
      allowed: false,
      reason: 'brand_access_denied',
      status: 403
    };
  }

  return {
    allowed: true,
    authUser,
    brandId: normalizedBrandId
  };
}

async function getSignedInBrandOwnerEntry(req, res) {
  const authUser = await getCurrentAuthUser(req, res);
  if (!authUser) return null;

  const { data: ownerRows, error } = await supabase
    .from('brand_owners')
    .select('brand_id')
    .eq('auth_user_id', authUser.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;

  const ownerRow = ownerRows ? ownerRows[0] : null;
  if (!ownerRow || !ownerRow.brand_id) return null;

  const setup = await getBrandSetupData(ownerRow.brand_id);
  if (!setup || !setup.brand) return null;

  if (setup.store && setup.shopifyConnectionState && !setup.shopifyConnectionState.connected) {
    return {
      brandId: setup.brand.id,
      redirectPath: `/brand/setup/${encodeURIComponent(setup.brand.id)}/reconnect-shopify`,
      reason: setup.shopifyConnectionState.reason || 'shopify_reconnect_required'
    };
  }

  if (setup.store && setup.shopifyConnectionState && setup.shopifyConnectionState.connected) {
    return {
      brandId: setup.brand.id,
      redirectPath: `/brand-dashboard/${encodeURIComponent(generateSlug(setup.brand.name))}`,
      reason: 'shopify_connected'
    };
  }

  return {
    brandId: setup.brand.id,
    redirectPath: `/brand/setup/${encodeURIComponent(setup.brand.id)}`,
    reason: 'brand_setup_required'
  };
}

function sendBrandAccessBlocked(res, brandAccess) {
  const status = brandAccess && brandAccess.status ? brandAccess.status : 403;
  const isSignInRequired = status === 401;
  return res.status(status).send(renderSimpleMessagePage(
    isSignInRequired ? 'Sign in required' : 'Brand access blocked',
    isSignInRequired
      ? 'Please sign in with the Google account that owns this brand workspace.'
      : 'This brand workspace is only available to its signed-in owner or admin.',
    isSignInRequired ? '/signup' : '/',
    isSignInRequired ? 'Sign in with Google' : 'Return home'
  ));
}

function injectSupportWidgetMiddleware(_req, res, next) {
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    if (typeof body === 'string' && shouldInjectSupportWidget(body, res)) {
      return originalSend(injectSupportWidgetAssets(body));
    }
    return originalSend(body);
  };
  next();
}

function shouldInjectSupportWidget(body, res) {
  if (!body || !body.includes('</body>') || body.includes('/support-widget.js')) return false;
  const contentType = String(res.get('Content-Type') || '');
  return contentType.includes('text/html') || body.trim().startsWith('<!DOCTYPE html') || body.trim().startsWith('<html');
}

function injectSupportWidgetAssets(html) {
  const cssTag = '<link rel="stylesheet" href="/support-widget.css?v=1">';
  const scriptTags = '<script src="/support-knowledge-base.js?v=1" defer></script><script src="/support-widget.js?v=1" defer></script>';
  return html
    .replace('</head>', `  ${cssTag}\n</head>`)
    .replace('</body>', `  ${scriptTags}\n</body>`);
}

function renderHomepage(creator) {
  const homepagePath = path.join(__dirname, 'public', 'index.html');
  const template = fs.readFileSync(homepagePath, 'utf8');
  if (!creator || !creator.creator_code) return template;

  const creatorCode = normalizeCode(creator.creator_code);
  if (!creatorCode) return template;

  const dashboardHref = `/dashboard/${encodeURIComponent(creatorCode)}`;
  const inviteLink = `${PUBLIC_BASE_URL}/join/${creatorCode}`;
  return template
    .replace(
      '<a href="/dashboard">Creator Dashboard</a>',
      `<a href="${escapeHtml(dashboardHref)}">Creator Dashboard</a>`
    )
    .replace(
      `<div class="hero-actions">
            <a class="primary-button" href="/auth/google">Sign up with Google</a>
          </div>`,
      renderHomepageInvitePanel(creatorCode, inviteLink)
    )
    .replace('</body>', `${renderHomepageCopyScript()}</body>`);
}

function renderHomepageInvitePanel(creatorCode, inviteLink) {
  return `<div class="hero-actions hero-actions-signed-in">
            <div class="homepage-invite-panel">
              <div class="homepage-invite-copy">
                <span>Your creator code</span>
                <strong>${escapeHtml(creatorCode)}</strong>
                <p id="homepage-invite-link">${escapeHtml(inviteLink)}</p>
              </div>
              <button class="homepage-copy-button" type="button" data-homepage-copy data-copy-value="${escapeHtml(inviteLink)}">Copy Link</button>
            </div>
          </div>`;
}

function renderHomepageCopyScript() {
  return `<script>
    (function () {
      document.querySelectorAll('[data-homepage-copy]').forEach(function (button) {
        button.addEventListener('click', function () {
          var value = button.dataset.copyValue || '';
          var originalText = button.textContent;
          var markCopied = function () {
            button.textContent = 'Copied';
            window.setTimeout(function () {
              button.textContent = originalText;
            }, 1400);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(markCopied).catch(function () {});
            return;
          }

          var textarea = document.createElement('textarea');
          textarea.value = value;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            markCopied();
          } catch (error) {}
          document.body.removeChild(textarea);
        });
      });
    })();
  </script>`;
}

function getMockFeaturedBrand(brandSlug) {
  const normalizedSlug = normalizeCode(brandSlug);
  return MOCK_FEATURED_BRANDS.find((brand) => brand.slug === normalizedSlug) || null;
}

function renderBrandDiscoveryPage(brand, creatorCode) {
  const safeCreatorCode = normalizeCode(creatorCode) || 'creator';
  const brandReferralLink = buildDisplayReferralLink(brand.slug, safeCreatorCode);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | ${escapeHtml(brand.name)}</title>
  <link rel="stylesheet" href="/styles.css?v=brand-products-1">
</head>
<body>
  <div class="page-shell">
    <header class="site-header">
      <a class="brand" href="/">
        <div class="logo-mark">PL</div>
        <div>
          <span class="brand-name">PartnerLinks</span>
          <span class="brand-tag">Featured Brand</span>
        </div>
      </a>
      <nav class="main-nav">
        <a href="/">Home</a>
        <a href="/dashboard">Creator Dashboard</a>
        <a href="/register-business">Register Your Business</a>
      </nav>
    </header>

    <main>
      <section class="brand-detail-hero">
        <div>
          <a class="back-link" href="/#featured-brands-title">Featured Brands</a>
          <div class="brand-logo-placeholder brand-detail-logo">${escapeHtml(getBrandInitials(brand.name))}</div>
          <h1>${escapeHtml(brand.name)}</h1>
          <p>${escapeHtml(brand.description)}</p>
        </div>
        <div class="brand-referral-panel">
          <p class="brand-support-copy">Earn from any purchase across the brand's store</p>
          <span>Brand referral link</span>
          <strong class="mock-referral-link" id="brand-referral-link">${escapeHtml(brandReferralLink)}</strong>
          <button class="featured-copy-button" type="button" data-brand-copy="${escapeHtml(brandReferralLink)}">Copy Link</button>
        </div>
      </section>

      <section class="featured-products-section" aria-labelledby="featured-products-title">
        <div class="section-heading">
          <h2 id="featured-products-title" class="section-title">Featured Products</h2>
          <p class="section-support-copy">Promote a specific featured product</p>
        </div>
        <div class="featured-product-grid">
          ${brand.products.map((product) => renderFeaturedProductCard(brand.slug, safeCreatorCode, product)).join('')}
        </div>
      </section>
    </main>
  </div>
  ${renderBrandDiscoveryCopyScript()}
</body>
</html>`;
}

function renderFeaturedProductCard(brandSlug, creatorCode, product) {
  const referralLink = buildDisplayReferralLink(brandSlug, creatorCode, product.slug);
  return `<article class="featured-product-card">
            <div class="product-image-placeholder">${escapeHtml(product.imageLabel || getBrandInitials(product.name))}</div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
            <span class="product-payout-line">${escapeHtml(product.payout)}</span>
            <div class="mock-referral-link">${escapeHtml(referralLink)}</div>
            <button class="featured-copy-button" type="button" data-brand-copy="${escapeHtml(referralLink)}">Copy Link</button>
          </article>`;
}

function buildDisplayReferralLink(brandSlug, creatorCode, productSlug) {
  const parts = [REFERRAL_LINK_HOST, 'r', normalizeCode(brandSlug), normalizeCode(creatorCode)];
  if (productSlug) parts.push(normalizeCode(productSlug));
  return parts.join('/');
}

function getShopifyBackedProduct(brandSlug, productSlug) {
  const normalizedBrandSlug = normalizeCode(brandSlug);
  const normalizedProductSlug = normalizeCode(productSlug);
  return SHOPIFY_BACKED_PRODUCTS[normalizedBrandSlug]
    ? SHOPIFY_BACKED_PRODUCTS[normalizedBrandSlug][normalizedProductSlug] || null
    : null;
}

function getShopifyProductDestination(brandSlug, productSlug, creatorCode, partnerlinksRef) {
  const brand = getMockFeaturedBrand(brandSlug);
  const product = getShopifyBackedProduct(brandSlug, productSlug)
    || (brand ? brand.products.find((item) => normalizeCode(item.slug) === normalizeCode(productSlug)) : null);
  if (!product || !product.shopifyProductUrl) return { url: null, product: null, blockedReason: null, shopDomain: null };

  const normalizedCreatorCode = normalizeCode(creatorCode);
  const normalizedBrandSlug = normalizeCode(brandSlug);
  const normalizedProductSlug = normalizeCode(productSlug);
  const normalizedPartnerlinksRef = partnerlinksRef || normalizedCreatorCode || 'creator';

  if (product.requiresCartPermalink && !product.shopifyVariantId) {
    return {
      url: null,
      product,
      blockedReason: 'missing_shopify_variant_id',
      shopDomain: product.shopDomain || null
    };
  }

  if (product.shopifyVariantId) {
    const productUrl = new URL(product.shopifyProductUrl);
    const cartUrl = new URL(`/cart/${encodeURIComponent(String(product.shopifyVariantId))}:1`, productUrl.origin);
    cartUrl.searchParams.set('attributes[partnerlinks_ref]', normalizedPartnerlinksRef);
    cartUrl.searchParams.set('attributes[creator_code]', normalizedCreatorCode);
    cartUrl.searchParams.set('attributes[brand_slug]', normalizedBrandSlug);
    cartUrl.searchParams.set('attributes[product_slug]', normalizedProductSlug);
    if (product.shopDomain) {
      cartUrl.searchParams.set('attributes[shop_domain]', normalizeCode(product.shopDomain));
    }
    cartUrl.searchParams.set('ref', normalizedPartnerlinksRef);

    log('Shopify product referral using cart permalink attribution:', {
      brandSlug: normalizedBrandSlug,
      productSlug: normalizedProductSlug,
      creatorCode: normalizedCreatorCode,
      shopDomain: product.shopDomain || null,
      shopifyVariantId: String(product.shopifyVariantId),
      destinationUrl: cartUrl.toString(),
      partnerlinksRefPresent: Boolean(normalizedPartnerlinksRef)
    });

    return { url: cartUrl.toString(), product, blockedReason: null, shopDomain: product.shopDomain || null };
  }

  const url = new URL(product.shopifyProductUrl);
  if (normalizedCreatorCode && normalizedCreatorCode !== 'creator') {
    url.searchParams.set('creator_code', normalizedCreatorCode);
  }
  url.searchParams.set('partnerlinks_ref', normalizedPartnerlinksRef);
  url.searchParams.set('brand_slug', normalizedBrandSlug);
  url.searchParams.set('product_slug', normalizedProductSlug);
  log('Shopify product referral using product URL attribution params:', {
    brandSlug: normalizedBrandSlug,
    productSlug: normalizedProductSlug,
    creatorCode: normalizedCreatorCode,
    variantPathUsed: false,
    destinationUrl: url.toString(),
    partnerlinksRefPresent: Boolean(normalizedPartnerlinksRef)
  });
  return { url: url.toString(), product, blockedReason: null, shopDomain: product.shopDomain || null };
}

function getShopifyProductDestinationUrl(brandSlug, productSlug, creatorCode, partnerlinksRef) {
  return getShopifyProductDestination(brandSlug, productSlug, creatorCode, partnerlinksRef).url;
}

function getPublicShopifyBrandDomain(brandSlug) {
  return PUBLIC_SHOPIFY_BRAND_MAP[normalizeCode(brandSlug)] || null;
}

async function getBrandForProductReferral(brandSlug) {
  const normalizedBrandSlug = normalizeCode(brandSlug);
  const brand = await getBrandBySlug(normalizedBrandSlug);
  if (brand) return brand;

  const shopDomain = getPublicShopifyBrandDomain(normalizedBrandSlug);
  if (!shopDomain) return null;

  const { data: stores, error: storeError } = await supabase
    .from('shopify_stores')
    .select('brand_id, shop_domain')
    .eq('shop_domain', shopDomain)
    .order('created_at', { ascending: false })
    .limit(1);
  if (storeError) throw storeError;

  const store = stores ? stores[0] : null;
  if (!store || !store.brand_id) {
    log('Public Shopify brand mapping has no connected store brand:', {
      brandSlug: normalizedBrandSlug,
      shopDomain
    });
    return null;
  }

  const { data: brands, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', store.brand_id)
    .limit(1);
  if (brandError) throw brandError;

  const mappedBrand = brands ? brands[0] : null;
  if (mappedBrand) {
    log('Product referral public brand slug mapped to Shopify brand:', {
      brandSlug: normalizedBrandSlug,
      shopDomain,
      brandId: mappedBrand.id
    });
  }
  return mappedBrand || null;
}

async function getCreatorForProductReferral(creatorCode, brandId) {
  const normalizedCreatorCode = normalizeCode(creatorCode);
  const brandCreator = await getCreatorByCodeAndBrand(normalizedCreatorCode, brandId);
  if (brandCreator) return brandCreator;

  const { data: creatorMatches, error: creatorError } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_code', normalizedCreatorCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (creatorError) throw creatorError;
  if (creatorMatches && creatorMatches[0]) return creatorMatches[0];

  const { data: referralMatches, error: referralError } = await supabase
    .from('creators')
    .select('*')
    .eq('referral_code', normalizedCreatorCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (referralError) throw referralError;
  return referralMatches ? referralMatches[0] : null;
}

function getBrandInitials(name) {
  return String(name || '')
    .split(/\s+|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function renderBrandDiscoveryCopyScript() {
  return `<script>
    (function () {
      document.querySelectorAll('[data-brand-copy]').forEach((button) => {
        button.addEventListener('click', () => {
          const value = button.dataset.brandCopy || '';
          const originalText = button.textContent;
          const markCopied = () => {
            button.textContent = 'Copied';
            window.setTimeout(() => {
              button.textContent = originalText;
            }, 1400);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(markCopied).catch(() => {});
            return;
          }

          const textarea = document.createElement('textarea');
          textarea.value = value;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            markCopied();
          } catch (error) {}
          document.body.removeChild(textarea);
        });
      });
    })();
  </script>`;
}

function renderCreatorWelcomePage(creator) {
  const trackingLink = creator.tracking_link || 'Brand tracking link will appear after brand assignment.';
  const inviteLink = creator.join_referral_link || 'Invite link not available yet.';
  const creatorCode = normalizeCode(creator.creator_code);
  const dashboardHref = `/dashboard/${encodeURIComponent(creatorCode)}`;

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
      <div class="auth-actions">
        <a class="auth-primary-button" href="${escapeHtml(dashboardHref)}">Creator Dashboard</a>
        <a class="auth-secondary-button" href="/">Home</a>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderCreatorDashboardEntryPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Creator Dashboard</title>
  <link rel="stylesheet" href="/styles.css?v=creator-dashboard-entry">
</head>
<body>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">PartnerLinks</p>
      <h1>Access your Creator Dashboard</h1>
      <p>Sign in to continue to your creator workspace.</p>
      <div class="auth-actions">
        <a class="auth-primary-button" href="/auth/google/start">Sign in with Google</a>
        <a class="auth-secondary-button" href="/">Home</a>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderBrandDashboardEntryPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Brand Dashboard</title>
  <link rel="stylesheet" href="/styles.css?v=brand-dashboard-entry">
</head>
<body>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">PartnerLinks</p>
      <h1>Access your Brand Dashboard</h1>
      <p>Connect Shopify or return to your setup flow to open your brand workspace.</p>
      <div class="auth-actions">
        <a class="auth-primary-button" href="/register-business">Connect Shopify</a>
        <a class="auth-secondary-button" href="/">Home</a>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderBrandDashboardPage(dashboard) {
  const dashboardPath = `/brand-dashboard/${encodeURIComponent(dashboard.brandSlug)}`;
  const primaryStats = [
    ['tracked-revenue', 'Tracked Revenue', formatMoney(dashboard.totalTrackedRevenue), 'Revenue attributed through PartnerLinks'],
    ['active-creators', 'Active Creators', dashboard.activeCreators, 'Creators connected to this brand'],
    ['recorded-conversions', 'Conversions', dashboard.totalConversions, 'Recorded sales'],
    ['platform-fees', 'Platform Fees', formatMoney(dashboard.platformFeesGenerated), 'PartnerLinks platform revenue'],
    ['network-payouts', 'Network Payouts', formatMoney(dashboard.networkPayouts), 'Estimated network rewards owed'],
    ['conversion-rate', 'Conversion Rate', formatPercent(dashboard.conversionRate), 'Clicks to recorded conversions']
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PartnerLinks | Brand Dashboard</title>
  <link rel="stylesheet" href="/styles.css?v=brand-dashboard-1">
  <style>${renderCreatorDashboardCriticalStyles()}</style>
</head>
<body>
  <div class="creator-dashboard">
    <aside class="creator-sidebar" aria-label="Brand dashboard navigation">
      <a class="creator-sidebar-brand" href="/">
        <img class="dashboard-logo" src="/partnerlinks-logo.png" alt="PartnerLinks logo" width="44" height="44">
        <span>
          <span class="brand-name">PartnerLinks</span>
          <span class="brand-tag">Brand</span>
        </span>
      </a>
      <nav class="creator-sidebar-nav">
        <a href="${escapeHtml(dashboardPath)}#overview">Overview</a>
        <a href="${escapeHtml(dashboardPath)}#creator-onboarding">Creators</a>
        <a href="${escapeHtml(dashboardPath)}#tracked-revenue">Conversions</a>
        <a href="${escapeHtml(dashboardPath)}#network-payouts">Earnings</a>
        <a href="${escapeHtml(dashboardPath)}#recent-conversions">Tracking Links</a>
        <a href="${escapeHtml(dashboardPath)}#revenue-summary">Settings</a>
      </nav>
    </aside>

    <main class="creator-main">
      <header class="creator-topbar" id="overview">
        <div>
          <p class="eyebrow">Brand Dashboard</p>
          <h1>${escapeHtml(dashboard.brandName)}</h1>
          <p class="creator-code-line">Brand slug <strong>${escapeHtml(dashboard.brandSlug)}</strong></p>
        </div>
        <div class="creator-earnings-chip">
          <span>Total tracked revenue</span>
          <strong>${escapeHtml(formatMoney(dashboard.totalTrackedRevenue))}</strong>
        </div>
      </header>

      <section class="creator-action-panel" id="creator-onboarding">
        <div>
          <span>Creator onboarding link</span>
          <strong id="brand-creator-onboarding-link">${escapeHtml(dashboard.creatorOnboardingLink)}</strong>
          <p>Share this link to invite creators into your PartnerLinks program. It records brand-origin onboarding lineage after Google signup.</p>
        </div>
        <button class="copy-button" type="button" data-copy-target="brand-creator-onboarding-link">Copy Link</button>
      </section>

      <section class="creator-stat-grid" aria-label="Brand performance summary">
        ${primaryStats.map(([id, label, value, description]) => `
          <article class="creator-stat-card" id="${escapeHtml(id)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <p>${escapeHtml(description)}</p>
          </article>
        `).join('')}
      </section>

      <section class="creator-content-grid">
        <article class="creator-panel" id="recent-conversions">
          <div class="panel-heading">
            <span>Recent Conversions</span>
            <strong>${escapeHtml(String(dashboard.totalConversions))}</strong>
          </div>
          <div class="earnings-list">
            ${renderBrandRecentConversions(dashboard.recentConversions)}
          </div>
        </article>

        <article class="creator-panel creator-panel-accent">
          <div class="panel-heading">
            <span>Top Creators</span>
            <strong>${escapeHtml(String(dashboard.activeCreators))}</strong>
          </div>
          <div class="earnings-list">
            ${renderBrandTopCreators(dashboard.topCreators)}
          </div>
        </article>
      </section>

      <section class="creator-lower-grid">
        <article class="creator-panel" id="revenue-summary">
          <div class="panel-heading">
            <span>Revenue Summary</span>
            <strong>${escapeHtml(formatMoney(dashboard.totalTrackedRevenue))}</strong>
          </div>
          <p class="muted-panel-copy">Platform fees generated: ${escapeHtml(formatMoney(dashboard.platformFeesGenerated))}</p>
        </article>

        <article class="creator-panel">
          <div class="panel-heading">
            <span>Program Performance</span>
            <strong>${escapeHtml(formatPercent(dashboard.conversionRate))}</strong>
          </div>
          <p class="muted-panel-copy">Conversion rate is based on recorded clicks and conversions.</p>
        </article>

        <article class="creator-panel">
          <div class="panel-heading">
            <span>Creator Growth</span>
            <strong>${escapeHtml(String(dashboard.activeCreators))}</strong>
          </div>
          <p class="muted-panel-copy">Creator onboarding link: ${escapeHtml(dashboard.creatorOnboardingLink)}</p>
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
            button.textContent = 'Copy Link';
          }, 1400);
        } catch (error) {
          button.textContent = 'Select link';
        }
      });
    });
    ${renderDashboardNavScript()}
  </script>
</body>
</html>`;
}

function renderBrandRecentConversions(conversions) {
  if (!conversions.length) {
    return '<p class="muted-panel-copy">No conversions recorded yet.</p>';
  }

  return conversions.map((conversion) => `
    <div>
      <span>${escapeHtml(conversion.creator_code || 'unknown')} · ${escapeHtml(conversion.order_id || 'Manual conversion')}</span>
      <strong>${escapeHtml(formatMoney(conversion.order_value))}</strong>
    </div>
  `).join('');
}

function renderBrandTopCreators(creators) {
  if (!creators.length) {
    return '<p class="muted-panel-copy">No creator activity yet.</p>';
  }

  return creators.map((creator) => `
    <div>
      <span>${escapeHtml(creator.creatorCode)}</span>
      <strong>${escapeHtml(formatMoney(creator.revenue))}</strong>
    </div>
  `).join('');
}

function renderStripePayoutSetup(dashboard) {
  const hasStripeAccount = Boolean(dashboard.stripeAccountId);
  const status = dashboard.stripeOnboardingStatus || 'not_connected';

  if (status === 'payouts_enabled') {
    return `<div class="stripe-payout-module stripe-payout-connected">
              <span>Payouts status</span>
              <strong>Enabled</strong>
            </div>`;
  }

  if (status === 'connected') {
    return `<div class="stripe-payout-module stripe-payout-connected">
              <span>Stripe connected</span>
              <strong>Connected</strong>
            </div>`;
  }

  if (hasStripeAccount) {
    return `<div class="stripe-payout-module">
              <span>Finish payout setup</span>
              ${renderStripeConnectButton(dashboard.creatorCode)}
            </div>`;
  }

  return `<div class="stripe-payout-module">
            <span>Connect to withdraw earnings</span>
            ${renderStripeConnectButton(dashboard.creatorCode)}
          </div>`;
}

function renderStripeConnectButton(creatorCode) {
  const href = `/stripe/connect/start?creator_code=${encodeURIComponent(normalizeCode(creatorCode))}`;
  return `<a class="stripe-connect-button" href="${escapeHtml(href)}" aria-label="Connect with Stripe">
            <span>Stripe</span>
          </a>`;
}

function renderCreatorEarningsLifecycle(dashboard, options = {}) {
  const payoutClaimGate = options.payoutClaimGate || getPayoutClaimGate();
  const pendingSettlementEarnings = Number(dashboard.pendingSettlementEarnings || dashboard.pendingEarnings || 0);
  const accountedUnclaimedEarnings = Math.max(0, Number(dashboard.totalEarnings || 0) - Number(dashboard.claimedEarnings || 0));
  const canClaim = Boolean(
    options.ownerCanClaim &&
    payoutClaimGate.allowed &&
    dashboard.stripeOnboardingStatus === 'payouts_enabled' &&
    Number(dashboard.claimableEarnings || 0) > 0
  );
  const claimBlockedMessage = !canClaim && accountedUnclaimedEarnings > 0
    ? `<p class="claim-earnings-note">${escapeHtml(payoutClaimGate.dashboardMessage || 'Claims are unavailable until settlement or approval is enabled.')}</p>`
    : '';

  return `<div class="earnings-lifecycle-summary">
            <div>
              <span>Accounted earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.totalEarnings))}</strong>
            </div>
            <div>
              <span>Pending settlement</span>
              <strong>${escapeHtml(formatMoney(pendingSettlementEarnings))}</strong>
            </div>
            <div>
              <span>Claimable earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.claimableEarnings))}</strong>
            </div>
            <div>
              <span>Claimed earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.claimedEarnings))}</strong>
            </div>
            <form class="claim-earnings-form" method="POST" action="/earnings/claim">
              <input type="hidden" name="creator_code" value="${escapeHtml(dashboard.creatorCode)}">
              <button class="claim-earnings-button" type="submit"${canClaim ? '' : ' disabled'}>Claim earnings</button>
              ${claimBlockedMessage}
            </form>
          </div>`;
}

function renderCreatorDashboardPage(dashboard, options = {}) {
  const inviteLink = dashboard.inviteLink || `${PUBLIC_BASE_URL}/join/${dashboard.creatorCode}`;
  const dashboardPath = `/dashboard/${encodeURIComponent(dashboard.creatorCode)}`;
  const primaryStats = [
    ['accounted-earnings', 'Accounted Earnings', formatMoney(dashboard.totalEarnings), 'Recorded earnings before funding and settlement gates'],
    ['pending-settlement', 'Pending Settlement', formatMoney(dashboard.pendingSettlementEarnings || dashboard.pendingEarnings), 'Accounted earnings waiting for funding, approval, or reserve coverage'],
    ['claimable-earnings', 'Claimable Earnings', formatMoney(dashboard.claimableEarnings), 'Funding/approval-gated earnings available in the active payout mode'],
    ['claimed-earnings', 'Claimed Earnings', formatMoney(dashboard.claimedEarnings), 'Internally claimed earnings ledger'],
    ['order-value', 'Order Value', formatMoney(dashboard.totalOrderValue), 'Attributed creator sales'],
    ['creator-conversions', 'Conversions', dashboard.totalConversions, 'Recorded sales'],
    ['creator-network-earnings', 'Network Earnings', formatMoney(dashboard.networkEarnings), 'Creator referral overrides']
  ];
  const referralStats = [
    ['Direct Referrals', dashboard.directReferralsCount],
    ['Extended Referrals', dashboard.secondLevelReferralsCount],
    ['Network Referrals', dashboard.thirdLevelReferralsCount]
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
        <img class="dashboard-logo" src="/partnerlinks-logo.png" alt="PartnerLinks logo" width="44" height="44">
        <span>
          <span class="brand-name">PartnerLinks</span>
          <span class="brand-tag">Creator</span>
        </span>
      </a>
      <nav class="creator-sidebar-nav">
        <a href="${escapeHtml(dashboardPath)}#overview">Overview</a>
        <a href="${escapeHtml(dashboardPath)}#creator-invite">Referrals</a>
        <a href="${escapeHtml(dashboardPath)}#accounted-earnings">Earnings</a>
        <a href="${escapeHtml(dashboardPath)}#referral-performance">Links</a>
        <a href="${escapeHtml(dashboardPath)}#payout-history">Settings</a>
      </nav>
    </aside>

    <main class="creator-main">
      <header class="creator-topbar" id="overview">
        <div>
          <p class="eyebrow">Creator Dashboard</p>
          <h1>Welcome, ${escapeHtml(dashboard.displayName)}</h1>
          <p class="creator-code-line">Creator code <strong>${escapeHtml(dashboard.creatorCode)}</strong></p>
        </div>
        <div class="creator-earnings-chip">
          ${renderStripePayoutSetup(dashboard)}
          ${renderCreatorEarningsLifecycle(dashboard, options)}
          <span>Total earnings</span>
          <strong>${escapeHtml(formatMoney(dashboard.totalEarnings))}</strong>
        </div>
      </header>

          ${options.claimStatus === 'success' ? '<section class="creator-claim-success">Earnings claimed internally. No Stripe transfer was created.</section>' : ''}
          ${options.claimStatus === 'blocked' ? '<section class="creator-claim-success">Claims are unavailable until settlement or approval is enabled.</section>' : ''}

      <section class="creator-action-panel" id="creator-invite">
        <div>
          <span>Creator invite link</span>
          <strong id="invite-link">${escapeHtml(inviteLink)}</strong>
          <p>Share this link to invite creators into your PartnerLinks network.</p>
        </div>
        <button class="copy-button" type="button" data-copy-target="invite-link">Copy Link</button>
      </section>

      <section class="creator-stat-grid" aria-label="Creator performance summary">
        ${primaryStats.map(([id, label, value, description]) => `
          <article class="creator-stat-card" id="${escapeHtml(id)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <p>${escapeHtml(description)}</p>
          </article>
        `).join('')}
      </section>

      <section class="creator-content-grid">
        <article class="creator-panel" id="referral-performance">
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

        <article class="creator-panel creator-panel-accent">
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
            <div>
              <span>Pending earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.pendingEarnings))}</strong>
            </div>
            <div>
              <span>Claimable earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.claimableEarnings))}</strong>
            </div>
            <div>
              <span>Claimed earnings</span>
              <strong>${escapeHtml(formatMoney(dashboard.claimedEarnings))}</strong>
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

        <article class="creator-panel creator-payout-history-panel" id="payout-history">
          <div class="panel-heading">
            <span>Payout History</span>
            <strong>${escapeHtml(String(dashboard.payoutHistory.length))}</strong>
          </div>
          ${renderPayoutHistory(dashboard.payoutHistory)}
        </article>

        <article class="creator-panel">
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
    ${renderDashboardNavScript()}
  </script>
</body>
</html>`;
}

function renderDashboardNavScript() {
  return `
    const sidebarLinks = Array.from(document.querySelectorAll('.creator-sidebar-nav a[href*="#"]'));
    sidebarLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.hash ? link.hash.slice(1) : '';
        const section = id ? document.getElementById(id) : null;
        if (!section) return;
        event.preventDefault();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  `;
}

function renderPayoutHistory(payoutHistory) {
  if (!payoutHistory.length) {
    return '<p class="muted-panel-copy">No payouts claimed yet.</p>';
  }

  return `<div class="payout-history-table" role="table" aria-label="Payout claim history">
            <div class="payout-history-row payout-history-head" role="row">
              <span role="columnheader">Amount</span>
              <span role="columnheader">Claimed date</span>
              <span role="columnheader">Batch id</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Stripe transfer</span>
            </div>
            ${payoutHistory.map((claim) => `
              <div class="payout-history-row" role="row">
                <strong role="cell">${escapeHtml(formatMoney(claim.total_claimed_amount))}</strong>
                <span role="cell">${escapeHtml(formatDashboardDate(claim.created_at))}</span>
                <code role="cell">${escapeHtml(formatBatchId(claim.id))}</code>
                <span role="cell" class="payout-status-pill">${escapeHtml(formatPayoutStatus(claim.stripe_transfer_status || claim.status))}</span>
                <code role="cell" class="payout-transfer-id">${escapeHtml(claim.stripe_transfer_id || 'Not created yet')}</code>
              </div>
            `).join('')}
          </div>`;
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
    .dashboard-logo {
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      object-fit: cover;
      border-radius: 14px;
      box-shadow: 0 16px 34px rgba(84, 43, 255, 0.24);
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
    .creator-sidebar-nav a:hover {
      color: var(--text);
    }
    .creator-main { min-width: 0; display: grid; gap: 22px; }
    .creator-main [id] { scroll-margin-top: 120px; }
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
    .stripe-payout-module {
      display: grid;
      gap: 10px;
      margin-bottom: 12px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(8, 13, 28, 0.32);
    }
    .stripe-payout-module span {
      color: var(--text);
      font-size: 0.86rem;
      font-weight: 800;
      line-height: 1.35;
    }
    .stripe-connect-button {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 22px;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 10px;
      background: linear-gradient(135deg, #635bff 0%, #7a5cff 48%, #9b5cff 100%);
      color: white;
      font-size: 0.9rem;
      font-weight: 900;
      letter-spacing: 0;
      box-shadow: 0 16px 34px rgba(99, 91, 255, 0.28);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, filter 160ms ease;
    }
    .stripe-connect-button:hover {
      transform: translateY(-1px);
      border-color: rgba(255,255,255,0.24);
      filter: saturate(1.04);
      box-shadow: 0 20px 42px rgba(99, 91, 255, 0.34);
    }
    .stripe-payout-connected {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .stripe-payout-connected strong {
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(102, 255, 186, 0.12);
      color: #8cffc5;
      font-size: 0.78rem;
    }
    .earnings-lifecycle-summary {
      display: grid;
      gap: 8px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(8, 13, 28, 0.26);
    }
    .earnings-lifecycle-summary div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .earnings-lifecycle-summary strong {
      color: var(--text);
      font-size: 0.9rem;
      text-align: right;
    }
    .claim-earnings-form {
      margin: 4px 0 0;
    }
    .claim-earnings-button {
      min-height: 38px;
      width: 100%;
      margin-top: 4px;
      border: 0;
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(155, 92, 255, 0.78), rgba(255, 111, 97, 0.78));
      color: white;
      font-size: 0.84rem;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 14px 28px rgba(155, 92, 255, 0.18);
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    }
    .claim-earnings-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 18px 34px rgba(155, 92, 255, 0.24);
    }
    .claim-earnings-button:disabled {
      cursor: not-allowed;
      opacity: 0.72;
    }
    .creator-claim-success {
      padding: 14px 18px;
      border: 1px solid rgba(102, 255, 186, 0.18);
      border-radius: 14px;
      background: rgba(102, 255, 186, 0.08);
      color: #b8ffd9;
      font-size: 0.9rem;
      font-weight: 800;
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
    .creator-earnings-chip .stripe-payout-module span {
      color: var(--text);
      font-size: 0.86rem;
    }
    .creator-earnings-chip .earnings-lifecycle-summary span {
      font-size: 0.78rem;
    }
    .creator-earnings-chip > strong { font-size: clamp(2rem, 4vw, 3rem); }
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
      max-width: 100%;
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
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
    .creator-payout-history-panel { grid-column: 1 / -1; }
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
    .payout-history-table { display: grid; gap: 10px; min-width: 0; }
    .payout-history-row {
      display: grid;
      grid-template-columns: minmax(90px, 0.9fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(90px, 0.8fr) minmax(120px, 1fr);
      gap: 12px;
      align-items: center;
      padding: 14px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      background: rgba(255,255,255,0.045);
    }
    .payout-history-head {
      background: transparent;
      border-color: transparent;
      padding-block: 0;
    }
    .payout-history-row span,
    .payout-history-row code {
      min-width: 0;
      color: var(--muted);
      font-size: 0.84rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .payout-history-row strong {
      color: var(--text);
      font-size: 1rem;
    }
    .payout-history-row code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    .payout-status-pill {
      width: fit-content;
      padding: 6px 9px;
      border-radius: 999px;
      background: rgba(102, 255, 186, 0.1);
      color: #9dffd0 !important;
      font-weight: 800;
    }
    .payout-transfer-id { color: rgba(154, 167, 193, 0.72) !important; }
    @media (max-width: 1024px) {
      .creator-dashboard { grid-template-columns: 1fr; gap: 18px; }
      .creator-sidebar { position: static; min-height: auto; }
      .creator-sidebar-nav { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
      .creator-sidebar-nav a { flex: 0 0 auto; }
      .creator-stat-grid,
      .creator-lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .payout-history-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .payout-history-head { display: none; }
      .creator-content-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      html,
      body {
        max-width: 100%;
        overflow-x: hidden;
      }
      .creator-dashboard {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        padding: 12px;
        gap: 12px;
      }
      .creator-sidebar {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        padding: 14px;
        border-radius: 14px;
      }
      .creator-sidebar-nav {
        width: 100%;
        max-width: 100%;
        display: flex;
        gap: 6px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
      }
      .creator-sidebar-nav a {
        min-height: 40px;
        padding: 0 10px;
        white-space: nowrap;
      }
      .creator-main,
      .creator-topbar,
      .creator-action-panel,
      .creator-stat-grid,
      .creator-content-grid,
      .creator-lower-grid,
      .creator-panel,
      .creator-stat-card,
      .creator-earnings-chip {
        min-width: 0;
        max-width: 100%;
      }
      .creator-topbar,
      .creator-action-panel,
      .creator-stat-grid,
      .creator-lower-grid,
      .referral-levels,
      .payout-history-row { grid-template-columns: 1fr; }
      .creator-topbar > div:first-child,
      .creator-earnings-chip,
      .creator-action-panel,
      .creator-stat-card,
      .creator-panel {
        width: 100%;
        padding: 16px;
        border-radius: 14px;
      }
      .creator-topbar h1 {
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: clamp(1.85rem, 10vw, 2.35rem);
        line-height: 1.02;
      }
      .creator-action-panel strong,
      #invite-link,
      .creator-stat-card strong,
      .panel-heading strong,
      .referral-levels strong,
      .earnings-list strong {
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .creator-stat-card { min-height: auto; }
      .creator-stat-card strong { font-size: 1.55rem; }
      .creator-action-panel { gap: 14px; }
      .copy-button {
        width: 100%;
        min-width: 0;
      }
      .panel-heading {
        display: grid;
        gap: 8px;
      }
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

  const store = stores ? stores[0] : null;
  const shopifyConnectionState = await resolveShopifyConnectionState(store);

  return {
    brand,
    store,
    shopifyConnectionState
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
  return (brands || []).find((brand) => (
    generateSlug(brand.name) === normalizedBrandIdentifier ||
    generateCanonicalSlug(brand.name) === normalizedBrandIdentifier
  )) || null;
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

function renderBrandSetupPage(brand, store, shopifyConnectionState = null) {
  const destinationUrl = brand.destination_url || (store ? `https://${store.shop_domain}` : '');
  const shopifyConnected = Boolean(store && shopifyConnectionState && shopifyConnectionState.connected);
  const shopifyStatusText = store
    ? (shopifyConnected
      ? `${store.shop_domain} is connected.`
      : `${store.shop_domain} needs Shopify reconnect before it is treated as connected.`)
    : 'Connect Shopify to finish store setup.';
  const reconnectHref = store ? `/brand/setup/${encodeURIComponent(brand.id)}/reconnect-shopify` : '/register-business';
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
      <p>${escapeHtml(shopifyStatusText)}</p>
      ${store && !shopifyConnected ? `<div class="auth-actions"><a class="auth-secondary-button" href="${escapeHtml(reconnectHref)}">Reconnect Shopify</a></div>` : ''}
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

function renderBrandSetupSuccessPage(brand, store, shopifyConnectionState = null) {
  const links = buildBrandLinkExamples(brand);
  const brandSlug = generateSlug(brand.name);
  const brandDashboardHref = `/brand-dashboard/${encodeURIComponent(brandSlug)}`;
  const shopifyConnected = Boolean(store && shopifyConnectionState && shopifyConnectionState.connected);
  const shopifyStatus = store
    ? (shopifyConnected ? store.shop_domain : `${store.shop_domain} needs Shopify reconnect`)
    : 'Connected store not found';
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
        <p><strong>Shopify store</strong><br>${escapeHtml(shopifyStatus)}</p>
        <p><strong>Brand name</strong><br>${escapeHtml(brand.name)}</p>
        <p><strong>Creator commission</strong><br>${escapeHtml(brand.creator_commission_rate)}%</p>
        <p><strong>Creator onboarding link</strong><br>${escapeHtml(links.creatorSignupLink)}</p>
        <p><strong>Example tracking link format</strong><br>${escapeHtml(links.trackingLinkFormat)}</p>
        <p><strong>Next step</strong><br>Invite creators and share your onboarding link.</p>
      </div>
      <div class="auth-actions">
        <a class="auth-primary-button" href="${escapeHtml(brandDashboardHref)}">Brand Dashboard</a>
        <a class="auth-secondary-button" href="/">Home</a>
      </div>
    </section>
  </main>
  <script>
    localStorage.setItem('partnerlinks_brand_slug', '${escapeHtml(brandSlug)}');
  </script>
</body>
</html>`;
}

function buildBrandLinkExamples(brand) {
  const brandSlug = generateSlug(brand.name);
  const brandInviteSlug = generateCanonicalSlug(brand.name);
  return {
    creatorSignupLink: `${PUBLIC_BASE_URL}/join/brand/${brandInviteSlug}`,
    trackingLinkFormat: `${PUBLIC_BASE_URL}/r/${brandSlug}/:creator_code`
  };
}

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function brandStateCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function authReturnCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
    ...partnerlinksCookieDomainOption()
  };
}

function authReturnClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...partnerlinksCookieDomainOption()
  };
}

function getSafeAuthReturnPath(value) {
  const returnPath = String(value || '').trim();
  if (!returnPath) return null;
  if (!/^\/brand\/setup\/\d+\/reconnect-shopify$/.test(returnPath)) return null;
  return returnPath;
}

function partnerlinksCookieDomainOption() {
  try {
    const hostname = new URL(PUBLIC_BASE_URL).hostname;
    if (process.env.NODE_ENV === 'production' && (hostname === 'partnerlinks.app' || hostname === 'www.partnerlinks.app')) {
      return { domain: '.partnerlinks.app' };
    }
  } catch (error) {}

  return {};
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatDashboardDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function formatBatchId(value) {
  if (!value) return 'Not available';
  const batchId = String(value);
  if (batchId.length <= 12) return batchId;
  return `${batchId.slice(0, 8)}...${batchId.slice(-4)}`;
}

function formatPayoutStatus(value) {
  const normalizedStatus = String(value || 'claimed').toLowerCase();
  const labels = {
    claimed: 'Claimed',
    processing: 'Processing',
    paid: 'Paid',
    failed: 'Failed'
  };
  return labels[normalizedStatus] || 'Claimed';
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
