const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const { SHOPIFY_WEBHOOK_SECRET } = require('../config/config/env');
const { createNetworkEarningsForConversion } = require('./creatorNetworkService');
const { recordConversion } = require('./trackingService');
const { log } = require('./services/logger');
const { normalizeCode } = require('../utils/slug');

const DEFAULT_CREATOR_COMMISSION_RATE = 0;
const DEFAULT_PLATFORM_FEE_RATE = 5;
const ATTRIBUTION_KEYS = ['creator_code', 'referral_code', 'partnerlinks_ref', 'pl_ref'];
const CONTEXT_KEYS = ['brand_slug', 'product_slug'];

function verifyShopifyWebhookHmac(rawBody, hmacHeader) {
  if (!SHOPIFY_WEBHOOK_SECRET) {
    throw new Error('SHOPIFY_WEBHOOK_SECRET is not configured.');
  }
  if (!rawBody || !Buffer.isBuffer(rawBody) || !hmacHeader) {
    return false;
  }

  const digest = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');

  return safeCompare(digest, hmacHeader);
}

async function ingestShopifyOrdersPaidWebhook({
  rawBody,
  shopDomain,
  webhookId
}) {
  const order = JSON.parse(rawBody.toString('utf8'));
  const normalizedShopDomain = normalizeShopDomain(shopDomain || order.shop_domain || order.myshopify_domain);
  const shopifyOrderId = String(order.id || order.admin_graphql_api_id || order.order_number || '').trim();

  log('Shopify orders paid webhook received:', {
    webhookId: webhookId || null,
    shopDomain: normalizedShopDomain,
    shopifyOrderId
  });

  if (!shopifyOrderId) {
    log('Shopify orders paid webhook skipped: missing order id', { shopDomain: normalizedShopDomain });
    return { status: 'skipped', reason: 'missing_order_id' };
  }

  const store = await getShopifyStoreByDomain(normalizedShopDomain);
  if (!store || !store.brand_id) {
    log('Shopify orders paid webhook skipped: connected store/brand not found', {
      shopDomain: normalizedShopDomain,
      shopifyOrderId
    });
    return { status: 'skipped', reason: 'store_not_found' };
  }

  const brand = await getBrandById(store.brand_id);
  if (!brand) {
    log('Shopify orders paid webhook skipped: brand not found', {
      shopDomain: normalizedShopDomain,
      brandId: store.brand_id,
      shopifyOrderId
    });
    return { status: 'skipped', reason: 'brand_not_found' };
  }

  const orderId = `shopify:${normalizedShopDomain}:${shopifyOrderId}`;
  if (await conversionExists(brand.id, orderId)) {
    log('Shopify orders paid webhook duplicate order skipped:', {
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      brandId: brand.id,
      orderId
    });
    return { status: 'skipped', reason: 'duplicate_order' };
  }

  const attribution = extractShopifyAttribution(order);
  if (!attribution.creatorCode) {
    log('Shopify orders paid webhook unmatched order: no PartnerLinks attribution found', {
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      brandId: brand.id,
      checkedSources: attribution.checkedSources
    });
    return { status: 'skipped', reason: 'no_attribution' };
  }

  log('Shopify orders paid webhook attribution found:', {
    shopDomain: normalizedShopDomain,
    shopifyOrderId,
    brandId: brand.id,
    creatorCode: attribution.creatorCode,
    source: attribution.source,
    attributionKey: attribution.attributionKey,
    brandSlug: attribution.brandSlug || null,
    productSlug: attribution.productSlug || null
  });

  const creator = await findCreatorByReferralCode(attribution.creatorCode);
  if (!creator) {
    log('Shopify orders paid webhook invalid attribution: creator not found', {
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      brandId: brand.id,
      creatorCode: attribution.creatorCode,
      attribution
    });
    return { status: 'skipped', reason: 'invalid_creator' };
  }

  const orderValue = getOrderTotal(order);
  const currency = String(order.currency || order.presentment_currency || 'USD').toUpperCase();
  const commissionRate = Number(brand.creator_commission_rate ?? DEFAULT_CREATOR_COMMISSION_RATE);
  const platformFeeRate = Number(brand.platform_fee_rate ?? DEFAULT_PLATFORM_FEE_RATE);
  const commissionAmount = roundCurrency(orderValue * commissionRate / 100);
  const platformFeeAmount = roundCurrency(orderValue * platformFeeRate / 100);

  const conversion = await recordConversion({
    brandId: brand.id,
    creatorId: creator.id,
    orderId,
    orderValue,
    currency,
    commissionRate,
    commissionAmount,
    platformFeeAmount,
    source: 'shopify_webhook',
    notes: buildConversionNotes({
      normalizedShopDomain,
      shopifyOrderId,
      attribution
    })
  });

  const networkEarnings = await createNetworkEarningsForConversion({
    sourceCreatorId: creator.id,
    conversionId: conversion.id,
    platformFeeAmount
  });

  log('Shopify orders paid webhook conversion created:', {
    shopDomain: normalizedShopDomain,
    shopifyOrderId,
    brandId: brand.id,
    creatorId: creator.id,
    creatorCode: creator.creator_code,
    conversionId: conversion.id,
    orderId,
    orderValue,
    commissionAmount,
    platformFeeAmount,
    networkEarningsCreated: networkEarnings.length
  });

  return {
    status: 'created',
    conversionId: conversion.id,
    orderId,
    networkEarningsCreated: networkEarnings.length
  };
}

function extractShopifyAttribution(order) {
  const candidates = [];
  const checkedSources = [];

  for (const discount of order.discount_codes || []) {
    if (discount && discount.code) {
      candidates.push({ source: 'discount_codes.code', value: discount.code });
    }
  }

  for (const attribute of order.note_attributes || []) {
    if (!attribute) continue;
    if (attribute.name) checkedSources.push(`note_attributes.${attribute.name}`);
    if (attribute.value) candidates.push({ source: `note_attributes.${attribute.name || 'value'}`, value: attribute.value });
  }

  for (const key of ['landing_site', 'referring_site', 'source_url', 'note', 'tags']) {
    if (order[key]) {
      checkedSources.push(key);
      candidates.push({ source: key, value: order[key] });
    }
  }

  collectNestedAttribution(order, candidates, checkedSources);

  for (const candidate of candidates) {
    const direct = findAttributionValue(candidate.value);
    if (direct.creatorCode) {
      return {
        ...direct,
        source: candidate.source,
        checkedSources
      };
    }
  }

  return { creatorCode: null, checkedSources };
}

function collectNestedAttribution(value, candidates, checkedSources, path = 'order', depth = 0) {
  if (!value || depth > 4) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNestedAttribution(item, candidates, checkedSources, `${path}[${index}]`, depth + 1));
    return;
  }

  if (typeof value !== 'object') return;

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = normalizeCode(key);

    if ([...ATTRIBUTION_KEYS, ...CONTEXT_KEYS].includes(normalizedKey) && childValue != null) {
      checkedSources.push(childPath);
      candidates.push({ source: childPath, value: String(childValue) });
    }

    if (typeof childValue === 'string' && looksAttributionBearing(childValue)) {
      checkedSources.push(childPath);
      candidates.push({ source: childPath, value: childValue });
    }

    if (typeof childValue === 'object') {
      collectNestedAttribution(childValue, candidates, checkedSources, childPath, depth + 1);
    }
  }
}

function findAttributionValue(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return { creatorCode: null };

  const urlParams = extractUrlParams(rawValue);
  for (const key of ATTRIBUTION_KEYS) {
    const paramValue = urlParams.get(key);
    if (paramValue) {
      return {
        creatorCode: normalizeCode(paramValue),
        brandSlug: normalizeCode(urlParams.get('brand_slug')),
        productSlug: normalizeCode(urlParams.get('product_slug')),
        attributionKey: key
      };
    }
  }

  const keyValueMatch = rawValue.match(/(?:creator_code|referral_code|partnerlinks_ref|pl_ref)\s*[=:]\s*([a-zA-Z0-9_-]+)/i);
  if (keyValueMatch) {
    return {
      creatorCode: normalizeCode(keyValueMatch[1]),
      brandSlug: extractInlineValue(rawValue, 'brand_slug'),
      productSlug: extractInlineValue(rawValue, 'product_slug'),
      attributionKey: 'inline'
    };
  }

  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/.test(rawValue)) {
    return {
      creatorCode: normalizeCode(rawValue),
      brandSlug: null,
      productSlug: null,
      attributionKey: 'direct_code'
    };
  }

  return { creatorCode: null };
}

function extractUrlParams(rawValue) {
  const params = new URLSearchParams();
  const candidates = [rawValue];
  if (rawValue.startsWith('/')) candidates.push(`https://partnerlinks.app${rawValue}`);

  if (rawValue.includes('=')) {
    const queryText = rawValue.includes('?') ? rawValue.split('?').slice(1).join('?') : rawValue;
    try {
      const queryParams = new URLSearchParams(queryText.replace(/^[?#]/, ''));
      for (const [key, value] of queryParams.entries()) {
        params.set(normalizeCode(key), value);
      }
    } catch (error) {}
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      for (const [key, value] of url.searchParams.entries()) {
        params.set(normalizeCode(key), value);
      }

      const pathParts = url.pathname.split('/').filter(Boolean).map(normalizeCode);
      const rIndex = pathParts.indexOf('r');
      if (rIndex >= 0 && pathParts[rIndex + 2]) {
        params.set('brand_slug', pathParts[rIndex + 1] || '');
        params.set('creator_code', pathParts[rIndex + 2]);
        if (pathParts[rIndex + 3]) params.set('product_slug', pathParts[rIndex + 3]);
      }
    } catch (error) {}
  }

  return params;
}

function extractInlineValue(rawValue, key) {
  const match = String(rawValue || '').match(new RegExp(`${key}\\s*[=:]\\s*([a-zA-Z0-9_-]+)`, 'i'));
  return match ? normalizeCode(match[1]) : null;
}

function looksAttributionBearing(value) {
  return /creator_code|referral_code|partnerlinks_ref|pl_ref|brand_slug|product_slug|\/r\//i.test(value);
}

async function findCreatorByReferralCode(creatorCode) {
  const normalizedCreatorCode = normalizeCode(creatorCode);

  const { data: creatorMatches, error: creatorError } = await supabase
    .from('creators')
    .select('*')
    .ilike('creator_code', normalizedCreatorCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (creatorError) throw creatorError;
  if (creatorMatches && creatorMatches[0]) return creatorMatches[0];

  const { data: referralMatches, error: referralError } = await supabase
    .from('creators')
    .select('*')
    .ilike('referral_code', normalizedCreatorCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (referralError) throw referralError;
  return referralMatches ? referralMatches[0] : null;
}

async function conversionExists(brandId, orderId) {
  const { data, error } = await supabase
    .from('conversions')
    .select('id')
    .eq('brand_id', brandId)
    .eq('order_id', orderId)
    .limit(1);
  if (error) throw error;
  return Boolean(data && data[0]);
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

async function getBrandById(brandId) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

function getOrderTotal(order) {
  return Number(order.total_price || order.current_total_price || order.subtotal_price || 0);
}

function buildConversionNotes({
  normalizedShopDomain,
  shopifyOrderId,
  attribution
}) {
  return [
    'Shopify orders/paid webhook conversion',
    `shop=${normalizedShopDomain}`,
    `shopify_order_id=${shopifyOrderId}`,
    `attribution_source=${attribution.source || 'unknown'}`,
    `attribution_key=${attribution.attributionKey || 'unknown'}`,
    attribution.productSlug ? `product_slug=${attribution.productSlug}` : null,
    attribution.brandSlug ? `brand_slug=${attribution.brandSlug}` : null
  ].filter(Boolean).join('; ');
}

function normalizeShopDomain(shop) {
  const value = String(shop || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return value.includes('.') ? value : `${value}.myshopify.com`;
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  verifyShopifyWebhookHmac,
  ingestShopifyOrdersPaidWebhook
};
