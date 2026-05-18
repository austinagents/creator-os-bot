const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES,
  SHOPIFY_APP_URL,
  DEFAULT_REF_TEMPLATE,
  NODE_ENV
} = require('../config/config/env');

const SHOPIFY_API_VERSION = '2025-01';
const REQUIRED_WEBHOOKS = [
  {
    topic: 'orders/paid',
    path: '/webhooks/shopify/orders-paid'
  },
  {
    topic: 'refunds/create',
    path: '/webhooks/shopify/refunds-create'
  }
];

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

function getShopifyOAuthDebugInfo(shop, state = 'diagnostic-state') {
  const shopDomain = normalizeShopDomain(shop);
  const redirectUri = new URL('/api/shopify/callback', SHOPIFY_APP_URL).toString();
  const scopeString = SHOPIFY_SCOPES || '';
  const parsedScopes = parseShopifyScopeList(scopeString);
  let installUrl = null;
  if (SHOPIFY_API_KEY) {
    const oauthUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
    oauthUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    oauthUrl.searchParams.set('scope', scopeString);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', state);
    installUrl = oauthUrl.toString();
  }

  return {
    shopDomain,
    shopify_app_url: SHOPIFY_APP_URL,
    shopify_api_key_present: Boolean(SHOPIFY_API_KEY),
    shopify_api_secret_present: Boolean(SHOPIFY_API_SECRET),
    scope_string: scopeString,
    parsed_scopes: parsedScopes,
    write_webhooks_present: parsedScopes.includes('write_webhooks'),
    oauth_url_scope_param: scopeString,
    redirect_uri: redirectUri,
    generated_oauth_url: installUrl
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
  const body = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
    expiring: '1'
  });
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Shopify token exchange did not return an access token.');
  }

  return normalizeTokenResponse(data);
}

async function refreshShopifyAccessToken({ shopDomain, refreshToken }) {
  assertShopifyConfig();
  if (!refreshToken) {
    throw new Error('Shopify refresh token is required to refresh an expiring offline token.');
  }
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const body = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = await fetch(`https://${normalizedShopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Shopify token refresh failed (${response.status}): ${compactShopifyError(responseBody)}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Shopify token refresh did not return an access token.');
  }

  return normalizeTokenResponse(data);
}

async function upsertShopifyStore({ shopDomain, accessToken, tokenData = null, brandId = null }) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const existingStore = await getShopifyStoreByDomain(normalizedShopDomain);
  const linkedBrandId = brandId || (existingStore ? existingStore.brand_id : null) || (await ensureBrandForShopifyStore(normalizedShopDomain)).id;
  const normalizedToken = normalizeTokenInput(accessToken, tokenData);

  const { data, error } = await supabase
    .from('shopify_stores')
    .upsert({
      brand_id: linkedBrandId,
      shop_domain: normalizedShopDomain,
      access_token: normalizedToken.accessToken,
      refresh_token: normalizedToken.refreshToken || existingStore?.refresh_token || null,
      access_token_expires_at: normalizedToken.accessTokenExpiresAt || existingStore?.access_token_expires_at || null,
      refresh_token_expires_at: normalizedToken.refreshTokenExpiresAt || existingStore?.refresh_token_expires_at || null,
      granted_scopes: normalizedToken.scope || existingStore?.granted_scopes || null,
      token_type: normalizedToken.tokenType,
      token_last_refreshed_at: normalizedToken.tokenLastRefreshedAt,
      installed_at: new Date().toISOString()
    }, {
      onConflict: 'shop_domain'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function refreshStoredShopifyTokenIfNeeded(store) {
  if (!store || !store.shop_domain) throw new Error('Shopify store row is required.');
  if (!store.refresh_token) {
    return {
      refreshed: false,
      accessToken: store.access_token,
      reason: 'missing_refresh_token'
    };
  }
  if (!isAccessTokenExpiringSoon(store.access_token_expires_at)) {
    return {
      refreshed: false,
      accessToken: store.access_token,
      reason: 'access_token_still_valid'
    };
  }

  const tokenData = await refreshShopifyAccessToken({
    shopDomain: store.shop_domain,
    refreshToken: store.refresh_token
  });

  const { data, error } = await supabase
    .from('shopify_stores')
    .update({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken || store.refresh_token || null,
      access_token_expires_at: tokenData.accessTokenExpiresAt,
      refresh_token_expires_at: tokenData.refreshTokenExpiresAt || store.refresh_token_expires_at || null,
      granted_scopes: tokenData.scope,
      token_type: tokenData.tokenType,
      token_last_refreshed_at: new Date().toISOString()
    })
    .eq('id', store.id)
    .select()
    .single();
  if (error) throw error;

  return {
    refreshed: true,
    accessToken: data.access_token,
    store: data,
    reason: 'refreshed_expiring_offline_token'
  };
}

async function ensureRequiredWebhooks({ shopDomain, accessToken }) {
  const report = await getWebhookRegistrationStatus({ shopDomain, accessToken });
  const created = [];
  const errors = [];

  if (!report.api_ok) {
    return {
      ...report,
      created,
      errors: [
        {
          topic: 'all',
          message: report.last_error || 'Unable to list existing Shopify webhooks.'
        }
      ]
    };
  }

  for (const required of report.required_webhooks) {
    if (required.registered) continue;
    const createResult = await createWebhookSubscription({
      shopDomain,
      accessToken,
      topic: required.topic,
      address: required.callback_url
    });
    if (createResult.ok) {
      created.push({
        topic: required.topic,
        id: createResult.webhook ? createResult.webhook.id : null,
        address: required.callback_url
      });
    } else {
      errors.push({
        topic: required.topic,
        status: createResult.status,
        message: createResult.error
      });
    }
  }

  const refreshed = await getWebhookRegistrationStatus({ shopDomain, accessToken });
  return {
    ...refreshed,
    created,
    errors
  };
}

async function getWebhookRegistrationStatus({ shopDomain, accessToken }) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const required = buildRequiredWebhookDefinitions();
  if (!accessToken) {
    return {
      shop_domain: normalizedShopDomain,
      access_token_present: false,
      api_ok: false,
      last_error: 'missing_access_token',
      required_webhooks: required.map((webhook) => ({ ...webhook, registered: false, matches: [] })),
      existing_webhooks: []
    };
  }

  const listResult = await listWebhookSubscriptions({
    shopDomain: normalizedShopDomain,
    accessToken
  });
  if (!listResult.ok) {
    return {
      shop_domain: normalizedShopDomain,
      access_token_present: true,
      api_ok: false,
      api_status: listResult.status,
      last_error: listResult.error,
      required_webhooks: required.map((webhook) => ({ ...webhook, registered: false, matches: [] })),
      existing_webhooks: []
    };
  }

  const existing = listResult.webhooks || [];
  return {
    shop_domain: normalizedShopDomain,
    access_token_present: true,
    api_ok: true,
    last_error: null,
    required_webhooks: required.map((webhook) => {
      const matches = existing.filter((existingWebhook) => (
        String(existingWebhook.topic || '').toLowerCase() === webhook.topic &&
        String(existingWebhook.address || '') === webhook.callback_url
      ));
      return {
        ...webhook,
        registered: matches.length > 0,
        matches: matches.map((match) => ({
          id: match.id,
          topic: match.topic,
          address: match.address,
          created_at: match.created_at,
          updated_at: match.updated_at
        }))
      };
    }),
    existing_webhooks: existing.map((webhook) => ({
      id: webhook.id,
      topic: webhook.topic,
      address: webhook.address,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at
    }))
  };
}

async function listWebhookSubscriptions({ shopDomain, accessToken }) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const response = await fetch(`https://${normalizedShopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
    headers: shopifyAdminHeaders(accessToken)
  });
  const body = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: compactShopifyError(body)
    };
  }
  const parsed = JSON.parse(body || '{}');
  return {
    ok: true,
    status: response.status,
    webhooks: parsed.webhooks || []
  };
}

async function createWebhookSubscription({ shopDomain, accessToken, topic, address }) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const response = await fetch(`https://${normalizedShopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
    method: 'POST',
    headers: shopifyAdminHeaders(accessToken),
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: 'json'
      }
    })
  });
  const body = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: compactShopifyError(body)
    };
  }
  const parsed = JSON.parse(body || '{}');
  return {
    ok: true,
    status: response.status,
    webhook: parsed.webhook || null
  };
}

function buildRequiredWebhookDefinitions() {
  return REQUIRED_WEBHOOKS.map((webhook) => ({
    topic: webhook.topic,
    callback_url: new URL(webhook.path, SHOPIFY_APP_URL).toString()
  }));
}

function shopifyAdminHeaders(accessToken) {
  return {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

function normalizeTokenInput(accessToken, tokenData) {
  if (tokenData && typeof tokenData === 'object') {
    return {
      accessToken: tokenData.accessToken || tokenData.access_token || accessToken,
      refreshToken: tokenData.refreshToken || tokenData.refresh_token || null,
      accessTokenExpiresAt: tokenData.accessTokenExpiresAt || tokenData.access_token_expires_at || null,
      refreshTokenExpiresAt: tokenData.refreshTokenExpiresAt || tokenData.refresh_token_expires_at || null,
      scope: tokenData.scope || tokenData.granted_scopes || null,
      tokenType: tokenData.tokenType || tokenData.token_type || 'offline_expiring',
      tokenLastRefreshedAt: new Date().toISOString()
    };
  }

  return {
    accessToken,
    refreshToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    tokenType: 'offline_legacy',
    tokenLastRefreshedAt: null
  };
}

function parseShopifyScopeList(scopeText) {
  return String(scopeText || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .sort();
}

function normalizeTokenResponse(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    accessTokenExpiresAt: secondsFromNowToIso(data.expires_in),
    refreshTokenExpiresAt: secondsFromNowToIso(data.refresh_token_expires_in),
    scope: data.scope || null,
    tokenType: data.refresh_token ? 'offline_expiring' : 'offline_legacy',
    raw: {
      expires_in: data.expires_in || null,
      refresh_token_expires_in: data.refresh_token_expires_in || null,
      scope: data.scope || null
    }
  };
}

function secondsFromNowToIso(seconds) {
  const numericSeconds = Number(seconds || 0);
  if (!numericSeconds || numericSeconds <= 0) return null;
  return new Date(Date.now() + numericSeconds * 1000).toISOString();
}

function isAccessTokenExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const expiryMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryMs)) return true;
  return expiryMs <= Date.now() + 5 * 60 * 1000;
}

function compactShopifyError(body) {
  if (!body) return 'empty Shopify API error response';
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed).slice(0, 500);
  } catch (_) {
    return String(body).slice(0, 500);
  }
}

async function getShopifyStoreByDomain(shopDomain) {
  const { data, error } = await supabase
    .from('shopify_stores')
    .select('*')
    .eq('shop_domain', shopDomain)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function ensureBrandForShopifyStore(shopDomain) {
  const existingByName = await getBrandByName(shopDomain);
  if (existingByName) return existingByName;

  const shopifyGuildId = buildShopifyBrandGuildId(shopDomain);
  const existingByGuildId = await getBrandByGuildId(shopifyGuildId);
  if (existingByGuildId) return existingByGuildId;

  const basePayload = {
    name: shopDomain,
    ref_link_template: DEFAULT_REF_TEMPLATE || `https://${shopDomain}?ref={creator_code}`,
    destination_url: `https://${shopDomain}`
  };

  const firstAttempt = await supabase
    .from('brands')
    .insert(basePayload)
    .select()
    .single();

  if (!firstAttempt.error) return firstAttempt.data;

  if (firstAttempt.error.code !== '23502') {
    throw firstAttempt.error;
  }

  const fallbackPayload = {
    ...basePayload,
    guild_id: shopifyGuildId
  };

  const { data, error } = await supabase
    .from('brands')
    .insert(fallbackPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getBrandByName(name) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getBrandByGuildId(guildId) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
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

function buildShopifyBrandGuildId(shopDomain) {
  const hash = crypto.createHash('sha256').update(`shopify:${shopDomain}`).digest('hex');
  const numericHash = parseInt(hash.slice(0, 12), 16);
  return -1 * (numericHash % 900000000000000);
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

function shopifyStateClearCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
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
  getShopifyOAuthDebugInfo,
  validateShopifyCallback,
  exchangeShopifyCodeForToken,
  refreshShopifyAccessToken,
  upsertShopifyStore,
  refreshStoredShopifyTokenIfNeeded,
  ensureRequiredWebhooks,
  getWebhookRegistrationStatus,
  normalizeShopDomain,
  generateShopifyState,
  ensureBrandForShopifyStore,
  shopifyStateCookieOptions,
  shopifyStateClearCookieOptions
};
