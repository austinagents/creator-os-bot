#!/usr/bin/env node

const supabase = require('../database/database/supabase');
const {
  ensureRequiredWebhooks,
  getShopifyOAuthDebugInfo,
  getWebhookRegistrationStatus,
  refreshStoredShopifyTokenIfNeeded
} = require('../services/shopifyService');

function parseArgs(argv) {
  const args = {
    dryRun: true,
    report: false,
    oauthDebug: false,
    register: false,
    brandId: null,
    shopDomain: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--report') args.report = true;
    else if (arg === '--oauth-debug') args.oauthDebug = true;
    else if (arg === '--register') {
      args.register = true;
      args.dryRun = false;
    }
    else if (arg === '--brand-id') {
      args.brandId = argv[index + 1] ? Number(argv[index + 1]) : null;
      index += 1;
    } else if (arg === '--shop-domain') {
      args.shopDomain = String(argv[index + 1] || '').trim().toLowerCase();
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stores = await getStores(args);

  console.log('\n=== Shopify Webhook Operator ===');
  console.log(`Mode: ${args.register && !args.dryRun ? 'REGISTER WEBHOOKS' : 'DRY RUN / READ ONLY'}`);
  console.log(`Stores: ${stores.length}`);
  console.log('Safety: no payouts, Stripe, settlement, claims, reserves, refunds, or earnings math are touched.');

  if (!stores.length) {
    console.log('No matching Shopify stores found.');
    return;
  }

  for (const store of stores) {
    if (args.oauthDebug) {
      printOAuthDebug(store);
      if (!args.report && !args.register) continue;
    }

    const tokenReadiness = getTokenReadiness(store);
    const tokenResult = args.register && !args.dryRun
      ? await refreshStoredShopifyTokenIfNeeded(store)
      : {
        refreshed: false,
        accessToken: store.access_token,
        reason: tokenReadiness.needs_refresh ? 'dry_run_refresh_not_attempted' : 'dry_run_no_refresh_needed'
      };
    const activeStore = tokenResult.store || store;
    const status = args.register && !args.dryRun
      ? await ensureRequiredWebhooks({
        shopDomain: activeStore.shop_domain,
        accessToken: tokenResult.accessToken
      })
      : await getWebhookRegistrationStatus({
        shopDomain: activeStore.shop_domain,
        accessToken: tokenResult.accessToken
      });
    const liveScopeStatus = await getLiveGrantedScopes({
      shopDomain: activeStore.shop_domain,
      accessToken: tokenResult.accessToken
    });

    printStoreStatus(activeStore, status, args, tokenReadiness, tokenResult, liveScopeStatus);
  }
}

function printOAuthDebug(store) {
  const debug = getShopifyOAuthDebugInfo(store.shop_domain, 'diagnostic-state');
  const parsedUrl = debug.generated_oauth_url ? new URL(debug.generated_oauth_url) : null;
  console.log('\n--- OAuth Debug ---');
  console.log(JSON.stringify({
    brand_id: store.brand_id,
    shop_domain: store.shop_domain,
    runtime_shopify_app_url: debug.shopify_app_url,
    shopify_api_key_present: debug.shopify_api_key_present,
    shopify_api_secret_present: debug.shopify_api_secret_present,
    runtime_shopify_scopes: debug.scope_string,
    parsed_scope_list: debug.parsed_scopes,
    oauth_url_scope_param: debug.oauth_url_scope_param,
    write_webhooks_present_before_redirect: debug.write_webhooks_present,
    redirect_uri: debug.redirect_uri,
    oauth_host: parsedUrl ? parsedUrl.host : null,
    oauth_path: parsedUrl ? parsedUrl.pathname : null,
    generated_oauth_url: debug.generated_oauth_url,
    secrets_printed: false,
    mutated_anything: false
  }, null, 2));
}

async function getStores(args) {
  let query = supabase
    .from('shopify_stores')
    .select('id, brand_id, shop_domain, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, granted_scopes, token_type, token_last_refreshed_at, installed_at, created_at')
    .order('brand_id', { ascending: true });

  if (args.brandId) query = query.eq('brand_id', args.brandId);
  if (args.shopDomain) query = query.eq('shop_domain', args.shopDomain);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function printStoreStatus(store, status, args, tokenReadiness, tokenResult, liveScopeStatus) {
  const required = status.required_webhooks || [];
  const missing = required.filter((webhook) => !webhook.registered).map((webhook) => webhook.topic);
  const registered = required.filter((webhook) => webhook.registered).map((webhook) => webhook.topic);
  const storedGrantedScopes = parseScopeList(store.granted_scopes);
  const liveGrantedScopes = liveScopeStatus.scopes || [];

  console.log('\n--- Store ---');
  console.log(JSON.stringify({
    brand_id: store.brand_id,
    shop_domain: store.shop_domain,
    access_token_present: Boolean(store.access_token),
    refresh_token_present: Boolean(store.refresh_token),
    token_type: store.token_type || 'unknown',
    access_token_expires_at: store.access_token_expires_at || null,
    refresh_token_expires_at: store.refresh_token_expires_at || null,
    token_last_refreshed_at: store.token_last_refreshed_at || null,
    stored_granted_scopes: storedGrantedScopes,
    live_granted_scopes: liveGrantedScopes,
    live_granted_scopes_ok: liveScopeStatus.ok,
    live_granted_scopes_status: liveScopeStatus.status || null,
    live_granted_scopes_error: liveScopeStatus.error || null,
    stored_granted_scopes_include_read_customers: storedGrantedScopes.includes('read_customers'),
    live_granted_scopes_include_read_customers: liveGrantedScopes.includes('read_customers'),
    stored_live_granted_scopes_differ: !sameStringList(storedGrantedScopes, liveGrantedScopes),
    write_webhooks_granted: storedGrantedScopes.includes('write_webhooks'),
    token_needs_refresh: tokenReadiness.needs_refresh,
    token_refresh_available: tokenReadiness.refresh_available,
    token_refresh_attempted: Boolean(tokenResult.refreshed),
    token_refresh_reason: tokenResult.reason || null,
    would_refresh_token_before_register: Boolean(args.register && args.dryRun && tokenReadiness.needs_refresh && tokenReadiness.refresh_available),
    installed_at: store.installed_at,
    api_ok: status.api_ok,
    last_error: status.last_error || null,
    registered_required_topics: registered,
    missing_required_topics: missing,
    callback_urls: required.map((webhook) => ({
      topic: webhook.topic,
      callback_url: webhook.callback_url,
      registered: webhook.registered,
      match_ids: (webhook.matches || []).map((match) => match.id)
    })),
    existing_webhook_count: (status.existing_webhooks || []).length,
    created_topics: status.created ? status.created.map((row) => row.topic) : [],
    errors: status.errors || [],
    would_register_missing_topics: args.register && args.dryRun ? missing : [],
    mutated_shopify_webhooks: Boolean(args.register && !args.dryRun)
  }, null, 2));
}

async function getLiveGrantedScopes({ shopDomain, accessToken }) {
  if (!accessToken) {
    return {
      ok: false,
      status: null,
      scopes: [],
      error: 'missing_access_token'
    };
  }

  const normalizedShopDomain = String(shopDomain || '').trim().toLowerCase();
  try {
    const response = await fetch(`https://${normalizedShopDomain}/admin/oauth/access_scopes.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        Accept: 'application/json'
      }
    });
    const body = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        scopes: [],
        error: compactError(body)
      };
    }

    const parsed = JSON.parse(body || '{}');
    return {
      ok: true,
      status: response.status,
      scopes: (parsed.access_scopes || [])
        .map((scope) => scope && scope.handle)
        .filter(Boolean)
        .sort(),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      scopes: [],
      error: error.message || String(error)
    };
  }
}

function getTokenReadiness(store) {
  const expiresAt = store.access_token_expires_at ? new Date(store.access_token_expires_at).getTime() : null;
  const needsRefresh = !expiresAt || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 5 * 60 * 1000;
  return {
    needs_refresh: needsRefresh,
    refresh_available: Boolean(store.refresh_token)
  };
}

function parseScopeList(scopeText) {
  return String(scopeText || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .sort();
}

function sameStringList(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function compactError(body) {
  if (!body) return 'empty_response';
  try {
    const parsed = JSON.parse(body);
    return parsed.errors || parsed.error || JSON.stringify(parsed);
  } catch (_error) {
    return body.slice(0, 500);
  }
}

main().catch((error) => {
  console.error('\nShopify webhook operator failed:');
  console.error(error);
  process.exit(1);
});
