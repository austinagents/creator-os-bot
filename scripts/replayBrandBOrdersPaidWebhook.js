#!/usr/bin/env node

const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const {
  SHOPIFY_APP_URL,
  SHOPIFY_WEBHOOK_SECRET
} = require('../config/config/env');

const BRAND = {
  id: 11,
  name: 'novo-loom',
  slug: 'novo-loom-myshopify-',
  shopDomain: 'novo-loom.myshopify.com'
};

const SOURCE_CLICK = {
  partnerlinksRef: '2a802b26-f101-41d0-9b28-e13f42d254d5',
  creatorCode: 'solrocks',
  productSlug: 'novo-gummies'
};

const SHOPIFY_ORDER_ID = '6176193511508';
const ORDER_ID = `shopify:${BRAND.shopDomain}:${SHOPIFY_ORDER_ID}`;
const ENDPOINT = `${stripTrailingSlash(SHOPIFY_APP_URL || 'https://partnerlinks.app')}/webhooks/shopify/orders-paid`;
const WEBHOOK_ID = `brand-b-sandbox-replay-orders-paid-${SHOPIFY_ORDER_ID}`;

const EXPECTED = {
  orderValue: 25,
  directCommission: 6.25,
  platformFee: 1.25,
  levels: [
    { creatorCode: 'goatse', level: 1, amount: 0.38 },
    { creatorCode: 'gibby', level: 2, amount: 0.04 },
    { creatorCode: 'ctofnf', level: 3, amount: 0.03 }
  ],
  blockedLevel4CreatorCode: 'epep'
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.verifyOnly) {
    await verifyReplayResult();
    return;
  }

  const rawBody = JSON.stringify(buildPayload());
  const canSign = Boolean(SHOPIFY_WEBHOOK_SECRET);
  const hmac = canSign ? createShopifyHmac(rawBody) : null;
  const headers = buildHeaders({ hmac, triggeredAt: new Date().toISOString() });

  printPlan({
    args,
    rawBody,
    headers,
    canSign
  });

  if (!args.execute) {
    console.log('\nDRY RUN: request not sent. Re-run with --execute --confirm-sandbox-webhook-replay only after explicit approval.');
    return;
  }

  if (!args.confirmSandboxWebhookReplay) {
    throw new Error('Refusing execution: --confirm-sandbox-webhook-replay is required.');
  }
  if (!SHOPIFY_WEBHOOK_SECRET) {
    throw new Error('Refusing execution: SHOPIFY_WEBHOOK_SECRET is required to generate a valid Shopify HMAC.');
  }

  await sendReplay({ rawBody, headers });
  await verifyReplayResult();
}

function parseArgs(argv) {
  const args = {
    execute: false,
    confirmSandboxWebhookReplay: false,
    verifyOnly: false
  };

  for (const arg of argv) {
    if (arg === '--execute') args.execute = true;
    else if (arg === '--confirm-sandbox-webhook-replay') args.confirmSandboxWebhookReplay = true;
    else if (arg === '--verify-only') args.verifyOnly = true;
    else if (arg === '--dry-run') args.execute = false;
  }

  return args;
}

function buildPayload() {
  return {
    id: Number(SHOPIFY_ORDER_ID),
    admin_graphql_api_id: `gid://shopify/Order/${SHOPIFY_ORDER_ID}`,
    order_number: 1001,
    name: '#BRAND-B-SANDBOX-6176193511508',
    email: 'brand-b-sandbox-replay@example.com',
    currency: 'USD',
    total_price: '25.00',
    subtotal_price: '25.00',
    total_discounts: '0.00',
    financial_status: 'paid',
    confirmed: true,
    test: true,
    source_name: 'partnerlinks_sandbox_signed_replay',
    processed_at: '2026-05-18T00:00:00.000Z',
    landing_site: `/cart?partnerlinks_ref=${SOURCE_CLICK.partnerlinksRef}`,
    referring_site: `https://partnerlinks.app/r/${BRAND.slug}/${SOURCE_CLICK.creatorCode}/${SOURCE_CLICK.productSlug}`,
    shop_domain: BRAND.shopDomain,
    note_attributes: [
      { name: 'brand_slug', value: BRAND.slug },
      { name: 'creator_code', value: SOURCE_CLICK.creatorCode },
      { name: 'partnerlinks_ref', value: SOURCE_CLICK.partnerlinksRef },
      { name: 'product_slug', value: SOURCE_CLICK.productSlug },
      { name: 'shop_domain', value: BRAND.shopDomain },
      { name: 'partnerlinks_replay_context', value: 'sandbox_only_signed_operator_replay' }
    ],
    line_items: [
      {
        title: 'Novo Gummies',
        name: 'Novo Gummies',
        quantity: 1,
        price: '25.00',
        product_exists: true,
        product_id: 9996176193511508,
        variant_id: 46875206287444,
        sku: 'NOVO-GUMMIES-SANDBOX',
        properties: [
          { name: 'brand_slug', value: BRAND.slug },
          { name: 'creator_code', value: SOURCE_CLICK.creatorCode },
          { name: 'partnerlinks_ref', value: SOURCE_CLICK.partnerlinksRef },
          { name: 'product_slug', value: SOURCE_CLICK.productSlug },
          { name: 'shop_domain', value: BRAND.shopDomain }
        ]
      }
    ]
  };
}

function createShopifyHmac(rawBody) {
  return crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64');
}

function buildHeaders({ hmac, triggeredAt }) {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Domain': BRAND.shopDomain,
    'X-Shopify-Topic': 'orders/paid',
    'X-Shopify-Webhook-Id': WEBHOOK_ID,
    'X-Shopify-Hmac-Sha256': hmac || 'computed_from_SHOPIFY_WEBHOOK_SECRET_at_runtime',
    'X-Shopify-Triggered-At': triggeredAt
  };
}

function printPlan({ args, rawBody, headers, canSign }) {
  console.log('SANDBOX ONLY: Brand B signed Shopify orders/paid webhook replay');
  console.log('');
  console.log('Purpose: exercise the real PartnerLinks webhook handler path with valid Shopify HMAC verification.');
  console.log('This is not production webhook approval and not live Shopify protected customer data readiness.');
  console.log('');
  console.log(JSON.stringify({
    mode: args.execute ? 'EXECUTE REQUEST' : 'DRY RUN / READ ONLY',
    endpoint: ENDPOINT,
    order_id: ORDER_ID,
    shop_domain: BRAND.shopDomain,
    brand_id: BRAND.id,
    creator_code: SOURCE_CLICK.creatorCode,
    product_slug: SOURCE_CLICK.productSlug,
    partnerlinks_ref: SOURCE_CLICK.partnerlinksRef,
    has_shopify_webhook_secret: canSign,
    would_call_webhook_now: Boolean(args.execute),
    would_use_real_webhook_handler: true,
    would_verify_shopify_hmac: true,
    would_create_stripe_transfer: false,
    would_touch_payouts_or_claims: false,
    expected_economics: EXPECTED
  }, null, 2));

  console.log('\nHeaders:');
  console.log(JSON.stringify({
    ...headers,
    'X-Shopify-Hmac-Sha256': redactHmac(headers['X-Shopify-Hmac-Sha256'])
  }, null, 2));

  console.log('\nPayload:');
  console.log(rawBody);

  console.log('\nRows/tables expected to mutate only when the webhook creates a new conversion:');
  console.log(JSON.stringify({
    shopify_attribution_events: 'insert conversion_created, or duplicate_skipped on replay',
    conversions: 'insert one Brand B conversion if missing',
    creator_network_earnings: 'insert Level 1/2/3 creator override rows if missing',
    brand_network_earnings: 'no row expected for this deepest-chain sale because Level 1/2/3 creator cap is consumed'
  }, null, 2));

  console.log('\nRows/tables that must not mutate:');
  console.log(JSON.stringify([
    'creator_earning_claims',
    'settlement_batches',
    'settlement_items',
    'settlement_audit_events',
    'financial_reversal_events',
    'financial_reversal_items',
    'Stripe transfers',
    'Stripe PaymentIntents',
    'brand billing/charging tables',
    'payout_status/claimability release beyond normal conversion pending accounting'
  ], null, 2));

  console.log('\nExecute command after explicit approval:');
  console.log('SHOPIFY_APP_URL=https://partnerlinks.app node scripts/replayBrandBOrdersPaidWebhook.js --execute --confirm-sandbox-webhook-replay');

  console.log('\nPost-replay verification commands:');
  console.log(`node scripts/replayBrandBOrdersPaidWebhook.js --verify-only`);
  console.log(`node scripts/productionSafetyTest.js --dry-run --order-report --economic-report --lineage-report --order-id ${ORDER_ID}`);
  console.log('node scripts/settlementBatchOperator.js --dry-run --report --brand-id 11 --order-id shopify:novo-loom.myshopify.com:6176193511508 --verify-reconciliation');
}

async function sendReplay({ rawBody, headers }) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: rawBody
  });

  const responseText = await response.text();
  console.log('\nReplay response:');
  console.log(JSON.stringify({
    status: response.status,
    statusText: response.statusText,
    body: safeJsonText(responseText)
  }, null, 2));

  if (!response.ok) {
    throw new Error(`Webhook replay returned HTTP ${response.status}.`);
  }
}

async function verifyReplayResult() {
  console.log('\nRead-only post-replay verification');

  const { data: conversions, error: conversionError } = await supabase
    .from('conversions')
    .select('*')
    .eq('order_id', ORDER_ID)
    .order('created_at', { ascending: false });
  if (conversionError) throw conversionError;

  const conversion = conversions && conversions[0] ? conversions[0] : null;
  const conversionIds = (conversions || []).map((row) => row.id);
  const creatorIds = unique([
    conversion ? conversion.creator_id : null,
    32,
    33,
    34,
    35,
    36
  ].filter(Boolean));

  const creators = await fetchCreators(creatorIds);
  const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
  const creatorByCode = new Map(creators.map((creator) => [String(creator.creator_code || '').toLowerCase(), creator]));

  const networkRows = conversionIds.length ? await fetchCreatorNetworkRows(conversionIds) : [];
  const brandNetworkRows = conversionIds.length ? await fetchBrandNetworkRows(conversionIds) : [];
  const attributionEvents = await fetchAttributionEvents();
  const claims = await fetchRecentClaims(creatorIds);

  const summary = {
    order_id: ORDER_ID,
    conversion_count: conversions ? conversions.length : 0,
    conversion_id: conversion ? conversion.id : null,
    conversion_brand_id: conversion ? conversion.brand_id : null,
    conversion_creator_code: conversion && creatorById.get(conversion.creator_id)
      ? creatorById.get(conversion.creator_id).creator_code
      : null,
    direct_commission_amount: conversion ? Number(conversion.commission_amount || 0) : null,
    platform_fee_amount: conversion ? Number(conversion.platform_fee_amount || 0) : null,
    payout_status: conversion ? conversion.payout_status : null,
    claim_batch_id: conversion ? conversion.claim_batch_id || null : null,
    claimed_at: conversion ? conversion.claimed_at || null : null,
    attribution_event_count: attributionEvents.length,
    latest_attribution_decision: attributionEvents[0] ? attributionEvents[0].decision : null,
    latest_attribution_source: attributionEvents[0] ? attributionEvents[0].attribution_source : null,
    latest_attribution_confidence: attributionEvents[0] ? attributionEvents[0].attribution_confidence : null,
    latest_fallback_used: attributionEvents[0] ? attributionEvents[0].fallback_used : null,
    creator_network_earnings: networkRows.map((row) => ({
      id: row.id,
      earning_creator_code: creatorById.get(row.earning_creator_id)
        ? creatorById.get(row.earning_creator_id).creator_code
        : null,
      source_creator_code: creatorById.get(row.source_creator_id)
        ? creatorById.get(row.source_creator_id).creator_code
        : null,
      level: row.level,
      commission_amount: Number(row.commission_amount || 0),
      payout_status: row.payout_status
    })),
    brand_network_earning_count: brandNetworkRows.length,
    recent_claim_rows_for_chain: claims.length
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log('\nVerification checks:');
  printCheck('one conversion exists for the Brand B order id', summary.conversion_count === 1);
  printCheck('conversion belongs to Brand B', summary.conversion_brand_id === BRAND.id);
  printCheck('conversion is attributed to solrocks', summary.conversion_creator_code === SOURCE_CLICK.creatorCode);
  printCheck('direct commission is $6.25', currencyEquals(summary.direct_commission_amount, EXPECTED.directCommission));
  printCheck('platform fee is $1.25', currencyEquals(summary.platform_fee_amount, EXPECTED.platformFee));
  printCheck('latest attribution decision is conversion_created or duplicate_skipped', ['conversion_created', 'duplicate_skipped'].includes(summary.latest_attribution_decision));
  printCheck('fallback was not used for exact partnerlinks_ref attribution', summary.latest_fallback_used === false || summary.latest_attribution_decision === 'duplicate_skipped');

  for (const expected of EXPECTED.levels) {
    const creator = creatorByCode.get(expected.creatorCode);
    const row = networkRows.find((earning) => (
      creator &&
      earning.earning_creator_id === creator.id &&
      Number(earning.level) === expected.level
    ));
    printCheck(`Level ${expected.level} ${expected.creatorCode} receives expected amount`, Boolean(row) && currencyEquals(Number(row.commission_amount || 0), expected.amount), {
      expected_amount: expected.amount,
      actual_amount: row ? Number(row.commission_amount || 0) : null,
      row_id: row ? row.id : null
    });
  }

  const epep = creatorByCode.get(EXPECTED.blockedLevel4CreatorCode);
  const epepRows = epep ? networkRows.filter((row) => row.earning_creator_id === epep.id) : [];
  printCheck('Level 4+ is blocked; epep receives no creator network row', epepRows.length === 0, { rows: epepRows.length });

  const selfRows = networkRows.filter((row) => row.earning_creator_id === row.source_creator_id);
  printCheck('no self-generated override rows exist', selfRows.length === 0, { rows: selfRows.length });
  printCheck('no brand-network row is expected for this deepest-chain sale', brandNetworkRows.length === 0, { rows: brandNetworkRows.length });
  printCheck('no creator earning claim rows were created by webhook replay', claims.length === 0, { recent_claim_rows_for_chain: claims.length });
}

async function fetchCreators(creatorIds) {
  if (!creatorIds.length) return [];
  const { data, error } = await supabase
    .from('creators')
    .select('id, creator_code, email, parent_creator_id, invited_by_brand_id, brand_id')
    .in('id', creatorIds);
  if (error) throw error;
  return data || [];
}

async function fetchCreatorNetworkRows(conversionIds) {
  const { data, error } = await supabase
    .from('creator_network_earnings')
    .select('*')
    .in('conversion_id', conversionIds)
    .order('level', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchBrandNetworkRows(conversionIds) {
  const { data, error } = await supabase
    .from('brand_network_earnings')
    .select('*')
    .in('conversion_id', conversionIds);
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

async function fetchAttributionEvents() {
  const { data, error } = await supabase
    .from('shopify_attribution_events')
    .select('*')
    .or(`order_id.eq.${ORDER_ID},shopify_order_id.eq.${SHOPIFY_ORDER_ID}`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

async function fetchRecentClaims(creatorIds) {
  if (!creatorIds.length) return [];
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .select('*')
    .in('creator_id', creatorIds)
    .order('created_at', { ascending: false })
    .limit(25);
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

function printCheck(label, ok, details = null) {
  console.log(`${ok ? 'PASS' : 'CHECK'} ${label}${details ? ` ${JSON.stringify(details)}` : ''}`);
}

function currencyEquals(actual, expected) {
  return Math.abs(Number(actual || 0) - Number(expected || 0)) < 0.005;
}

function redactHmac(hmac) {
  if (!hmac || hmac.includes('computed_from')) return hmac;
  return `${hmac.slice(0, 8)}...redacted`;
}

function safeJsonText(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function unique(values) {
  return [...new Set(values)];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
