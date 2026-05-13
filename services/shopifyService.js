const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES,
  SHOPIFY_APP_URL,
  NODE_ENV
} = require('../config/config/env');

function buildShopifyInstallUrl(shop, state) {
  assertShopifyConfig();
  const shopDomain = normalizeShopDomain(shop);
  const redirectUri = new URL('/api/shopify/callback', SHOPIFY_APP_URL).toString();
  const installUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);

  installUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
  installUrl.searchParams.set('scope', SHOPIFY_SCOPES);
  installUrl.searchParams.set('redirect_uri', redirectUri);
  installUrl.searchParams.set('state', state);

  return {
    shopDomain,
    installUrl: installUrl.toString()
  };
}

function validateShopifyCallback(query) {
  assertShopifyConfig();
  const { hmac } = query;
  if (!hmac || typeof hmac !== 'string') {
    return false;
  }

  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${Array.isArray(query[key]) ? query[key].join(',') : query[key]}`)
    .join('&');

  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  return safeCompare(digest, hmac);
}

async function exchangeShopifyCodeForToken(shop, code) {
  assertShopifyConfig();
  const shopDomain = normalizeShopDomain(shop);
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Shopify token exchange did not return an access token.');
  }

  return data.access_token;
}

async function upsertShopifyStore({ shopDomain, accessToken, brandId = null }) {
  const { data, error } = await supabase
    .from('shopify_stores')
    .upsert({
      brand_id: brandId,
      shop_domain: shopDomain,
      access_token: accessToken,
      installed_at: new Date().toISOString()
    }, {
      onConflict: 'shop_domain'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function normalizeShopDomain(shop) {
  if (!shop || typeof shop !== 'string') {
    throw new Error('Shopify store domain is required.');
  }

  const trimmed = shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const shopDomain = trimmed.includes('.') ? trimmed : `${trimmed}.myshopify.com`;

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    throw new Error('Enter a valid Shopify myshopify.com store domain.');
  }

  return shopDomain;
}

function generateShopifyState() {
  return crypto.randomBytes(24).toString('hex');
}

function shopifyStateCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/'
  };
}

function assertShopifyConfig() {
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    throw new Error('Shopify OAuth is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.');
  }
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  buildShopifyInstallUrl,
  validateShopifyCallback,
  exchangeShopifyCodeForToken,
  upsertShopifyStore,
  normalizeShopDomain,
  generateShopifyState,
  shopifyStateCookieOptions
};
