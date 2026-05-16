const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const { SHOPIFY_WEBHOOK_SECRET } = require('../config/config/env');
const { createNetworkEarningsForConversion } = require('./creatorNetworkService');
const { recordConversion } = require('./trackingService');
const { log } = require('./services/logger');
const { normalizeCode } = require('../utils/slug');

const DEFAULT_CREATOR_COMMISSION_RATE = 0;
const DEFAULT_PLATFORM_FEE_RATE = 5;
const CREATOR_ATTRIBUTION_KEYS = ['creator_code', 'referral_code'];
const REFERENCE_ATTRIBUTION_KEYS = ['partnerlinks_ref', 'pl_ref'];
const ATTRIBUTION_KEYS = [...CREATOR_ATTRIBUTION_KEYS, ...REFERENCE_ATTRIBUTION_KEYS];
const CONTEXT_KEYS = ['brand_slug', 'product_slug'];
const EXACT_REF_ATTRIBUTION_WINDOW_HOURS = 24 * 30;
const RECENT_CLICK_FALLBACK_WINDOW_HOURS = 6;
const RECENT_CLICK_FALLBACK_LIMIT = 10;

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
    await recordShopifyAttributionDecision({
      shopDomain: normalizedShopDomain,
      decision: 'skipped',
      unmatchedReason: 'missing_order_id',
      attributionSource: 'unmatched',
      attributionConfidence: 'none'
    });
    return { status: 'skipped', reason: 'missing_order_id' };
  }

  const store = await getShopifyStoreByDomain(normalizedShopDomain);
  if (!store || !store.brand_id) {
    log('Shopify orders paid webhook skipped: connected store/brand not found', {
      shopDomain: normalizedShopDomain,
      shopifyOrderId
    });
    await recordShopifyAttributionDecision({
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      decision: 'skipped',
      unmatchedReason: 'store_not_found',
      attributionSource: 'unmatched',
      attributionConfidence: 'none'
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
    await recordShopifyAttributionDecision({
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      brandId: store.brand_id,
      decision: 'skipped',
      unmatchedReason: 'brand_not_found',
      attributionSource: 'unmatched',
      attributionConfidence: 'none'
    });
    return { status: 'skipped', reason: 'brand_not_found' };
  }

  const orderId = `shopify:${normalizedShopDomain}:${shopifyOrderId}`;
  if (await conversionExists(brand.id, orderId)) {
    const duplicateDecision = {
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      brandId: brand.id,
      orderId,
      decision: 'duplicate_skipped',
      duplicateOrder: true,
      unmatchedReason: 'duplicate_order'
    };
    log('Shopify orders paid webhook duplicate order skipped:', duplicateDecision);
    await recordShopifyAttributionDecision(duplicateDecision);
    return { status: 'skipped', reason: 'duplicate_order' };
  }

  const attributionContext = extractShopifyAttribution(order);
  const attribution = await resolveShopifyAttribution({
    attributionContext,
    shopDomain: normalizedShopDomain,
    brandId: brand.id,
    order
  });

  if (!attribution.creatorCode && !attribution.creatorId) {
    const unmatchedDecision = buildAttributionDecision({
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      orderId,
      brandId: brand.id,
      attribution,
      decision: 'skipped',
      unmatchedReason: attribution.unmatchedReason || 'no_attribution'
    });
    log('Shopify orders paid webhook unmatched order: no PartnerLinks attribution found', unmatchedDecision);
    await recordShopifyAttributionDecision(unmatchedDecision);
    return { status: 'skipped', reason: 'no_attribution' };
  }

  log('Shopify orders paid webhook attribution found:', {
    shopDomain: normalizedShopDomain,
    shopifyOrderId,
    brandId: brand.id,
    creatorCode: attribution.creatorCode,
    source: attribution.source,
    resolutionSource: attribution.resolutionSource || null,
    attributionKey: attribution.attributionKey,
    partnerlinksRef: attribution.partnerlinksRef || null,
    confidence: attribution.confidence || null,
    fallbackUsed: Boolean(attribution.fallbackUsed),
    clickId: attribution.clickId || null,
    timeDeltaFromClickSeconds: attribution.timeDeltaFromClickSeconds ?? null,
    brandSlug: attribution.brandSlug || null,
    productSlug: attribution.productSlug || null
  });

  const creator = attribution.creatorId
    ? await findCreatorById(attribution.creatorId)
    : await findCreatorByReferralCode(attribution.creatorCode);
  if (!creator) {
    const invalidDecision = buildAttributionDecision({
      shopDomain: normalizedShopDomain,
      shopifyOrderId,
      orderId,
      brandId: brand.id,
      attribution,
      decision: 'skipped',
      unmatchedReason: 'invalid_creator'
    });
    log('Shopify orders paid webhook invalid attribution: creator not found', invalidDecision);
    await recordShopifyAttributionDecision(invalidDecision);
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
    clickId: attribution.clickId || null,
    sessionId: attribution.sessionId || null,
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

  await recordShopifyAttributionDecision(buildAttributionDecision({
    shopDomain: normalizedShopDomain,
    shopifyOrderId,
    orderId,
    brandId: brand.id,
    attribution,
    creator,
    decision: 'conversion_created',
    conversionId: conversion.id,
    duplicateOrder: false
  }));

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
      candidates.push(buildAttributionCandidate('discount_codes.code', discount.code, 'exact_code'));
    }
  }

  for (const attribute of order.note_attributes || []) {
    if (!attribute) continue;
    if (attribute.name) checkedSources.push(`note_attributes.${attribute.name}`);
    if (attribute.value) {
      candidates.push(buildAttributionCandidate(`note_attributes.${attribute.name || 'value'}`, attribute.value, 'note_attributes'));
    }
  }

  for (const key of ['landing_site', 'referring_site', 'source_url', 'note', 'tags']) {
    if (order[key]) {
      checkedSources.push(key);
      candidates.push(buildAttributionCandidate(key, order[key], key));
    }
  }

  collectNestedAttribution(order, candidates, checkedSources);

  return {
    candidates: candidates.filter((candidate) => candidate.parsed.creatorCode || candidate.parsed.partnerlinksRef || candidate.parsed.brandSlug || candidate.parsed.productSlug),
    checkedSources
  };
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
      candidates.push(buildAttributionCandidate(childPath, String(childValue), getNestedSourceGroup(childPath, true)));
    }

    if (typeof childValue === 'string' && looksAttributionBearing(childValue)) {
      checkedSources.push(childPath);
      candidates.push(buildAttributionCandidate(childPath, childValue, getNestedSourceGroup(childPath, false)));
    }

    if (typeof childValue === 'object') {
      collectNestedAttribution(childValue, candidates, checkedSources, childPath, depth + 1);
    }
  }
}

function buildAttributionCandidate(source, value, sourceGroup) {
  return {
    source,
    sourceGroup,
    value,
    parsed: findAttributionValue(value)
  };
}

function getNestedSourceGroup(path, explicitKey) {
  if (/note_attributes/i.test(path)) return 'note_attributes';
  if (/landing_site/i.test(path)) return 'landing_site';
  if (/source_url/i.test(path)) return 'source_url';
  if (/referring_site/i.test(path)) return 'referring_site';
  return explicitKey ? 'nested_explicit' : 'nested_text';
}

function findAttributionValue(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return { creatorCode: null, partnerlinksRef: null };

  const urlParams = extractUrlParams(rawValue);
  for (const key of CREATOR_ATTRIBUTION_KEYS) {
    const paramValue = urlParams.get(key);
    if (paramValue) {
      return {
        creatorCode: normalizeCode(paramValue),
        partnerlinksRef: normalizeReference(urlParams.get('partnerlinks_ref') || urlParams.get('pl_ref')),
        brandSlug: normalizeCode(urlParams.get('brand_slug')),
        productSlug: normalizeCode(urlParams.get('product_slug')),
        attributionKey: key
      };
    }
  }

  for (const key of REFERENCE_ATTRIBUTION_KEYS) {
    const paramValue = urlParams.get(key);
    if (paramValue) {
      return {
        creatorCode: null,
        partnerlinksRef: normalizeReference(paramValue),
        brandSlug: normalizeCode(urlParams.get('brand_slug')),
        productSlug: normalizeCode(urlParams.get('product_slug')),
        attributionKey: key
      };
    }
  }

  const creatorKeyValueMatch = rawValue.match(/(?:creator_code|referral_code)\s*[=:]\s*([a-zA-Z0-9_-]+)/i);
  if (creatorKeyValueMatch) {
    return {
      creatorCode: normalizeCode(creatorKeyValueMatch[1]),
      partnerlinksRef: extractInlineReference(rawValue, 'partnerlinks_ref') || extractInlineReference(rawValue, 'pl_ref'),
      brandSlug: extractInlineValue(rawValue, 'brand_slug'),
      productSlug: extractInlineValue(rawValue, 'product_slug'),
      attributionKey: 'inline'
    };
  }

  const referenceKeyValueMatch = rawValue.match(/(?:partnerlinks_ref|pl_ref)\s*[=:]\s*([a-zA-Z0-9_-]+)/i);
  if (referenceKeyValueMatch) {
    return {
      creatorCode: null,
      partnerlinksRef: normalizeReference(referenceKeyValueMatch[1]),
      brandSlug: extractInlineValue(rawValue, 'brand_slug'),
      productSlug: extractInlineValue(rawValue, 'product_slug'),
      attributionKey: 'inline_ref'
    };
  }

  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/.test(rawValue)) {
    return {
      creatorCode: normalizeCode(rawValue),
      partnerlinksRef: null,
      brandSlug: null,
      productSlug: null,
      attributionKey: 'direct_code'
    };
  }

  return { creatorCode: null, partnerlinksRef: null };
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

function extractInlineReference(rawValue, key) {
  const match = String(rawValue || '').match(new RegExp(`${key}\\s*[=:]\\s*([a-zA-Z0-9_-]+)`, 'i'));
  return match ? normalizeReference(match[1]) : null;
}

function normalizeReference(value) {
  return String(value || '').trim();
}

function looksAttributionBearing(value) {
  return /creator_code|referral_code|partnerlinks_ref|pl_ref|brand_slug|product_slug|\/r\//i.test(value);
}

async function resolveShopifyAttribution({
  attributionContext,
  shopDomain,
  brandId,
  order
}) {
  const candidates = attributionContext.candidates || [];
  const checkedSources = attributionContext.checkedSources || [];
  const orderTimestamp = getOrderTimestamp(order);

  const partnerlinksRefCandidate = firstCandidate(candidates, (candidate) => candidate.parsed.partnerlinksRef);
  if (partnerlinksRefCandidate) {
    const clickMatch = await findClickByPartnerlinksRef({
      shopDomain,
      partnerlinksRef: partnerlinksRefCandidate.parsed.partnerlinksRef,
      productSlug: partnerlinksRefCandidate.parsed.productSlug,
      orderTimestamp
    });

    if (clickMatch.click) {
      return mergeClickAttribution(
        candidateAttribution(partnerlinksRefCandidate, 'partnerlinks_ref', 'exact', false, checkedSources),
        clickMatch.click,
        'partnerlinks_ref',
        clickMatch.timeDeltaFromClickSeconds
      );
    }

  }

  const exactCodeCandidate = firstCandidate(candidates, (candidate) => {
    if (!candidate.parsed.creatorCode) return false;
    return ['exact_code', 'nested_explicit'].includes(candidate.sourceGroup);
  });
  if (exactCodeCandidate) {
    return candidateAttribution(exactCodeCandidate, exactCodeCandidate.parsed.attributionKey || 'creator_code', 'high', false, checkedSources);
  }

  const noteCandidate = firstCandidate(candidates, (candidate) => {
    return candidate.sourceGroup === 'note_attributes' && (candidate.parsed.creatorCode || candidate.parsed.partnerlinksRef);
  });
  if (noteCandidate) {
    const noteAttribution = candidateAttribution(noteCandidate, 'note_attributes', 'high', false, checkedSources);
    if (noteAttribution.partnerlinksRef) {
      const clickMatch = await findClickByPartnerlinksRef({
        shopDomain,
        partnerlinksRef: noteAttribution.partnerlinksRef,
        productSlug: noteAttribution.productSlug,
        orderTimestamp
      });
      if (clickMatch.click) {
        return mergeClickAttribution(noteAttribution, clickMatch.click, 'partnerlinks_ref', clickMatch.timeDeltaFromClickSeconds);
      }
    }
    return noteAttribution;
  }

  const landingCandidate = firstCandidate(candidates, (candidate) => {
    return candidate.sourceGroup === 'landing_site' && (candidate.parsed.creatorCode || candidate.parsed.partnerlinksRef);
  });
  if (landingCandidate) {
    return candidateAttribution(landingCandidate, 'landing_site', 'medium', false, checkedSources);
  }

  const sourceUrlCandidate = firstCandidate(candidates, (candidate) => {
    return candidate.sourceGroup === 'source_url' && (candidate.parsed.creatorCode || candidate.parsed.partnerlinksRef);
  });
  if (sourceUrlCandidate) {
    return candidateAttribution(sourceUrlCandidate, 'source_url', 'medium', false, checkedSources);
  }

  const referringCandidate = firstCandidate(candidates, (candidate) => {
    return candidate.sourceGroup === 'referring_site' && (candidate.parsed.creatorCode || candidate.parsed.partnerlinksRef);
  });
  if (referringCandidate) {
    return candidateAttribution(referringCandidate, 'referring_site', 'medium', false, checkedSources);
  }

  if (partnerlinksRefCandidate) {
    const sessionMatch = await findAttributionSessionByPartnerlinksRef({
      brandId,
      partnerlinksRef: partnerlinksRefCandidate.parsed.partnerlinksRef,
      orderTimestamp
    });

    if (sessionMatch) {
      return {
        ...candidateAttribution(partnerlinksRefCandidate, 'attribution_session', 'high', false, checkedSources),
        creatorId: sessionMatch.creatorId || null,
        creatorCode: sessionMatch.creatorCode || partnerlinksRefCandidate.parsed.creatorCode || null,
        clickId: sessionMatch.clickId || null,
        sessionId: sessionMatch.sessionId || partnerlinksRefCandidate.parsed.partnerlinksRef,
        timeDeltaFromClickSeconds: sessionMatch.timeDeltaFromClickSeconds ?? null,
        resolutionSource: 'attribution_session'
      };
    }
  }

  if (partnerlinksRefCandidate) {
    return {
      ...candidateAttribution(partnerlinksRefCandidate, 'partnerlinks_ref', 'none', false, checkedSources),
      creatorCode: null,
      unmatchedReason: 'partnerlinks_ref_not_found'
    };
  }

  const fallbackContextCandidate = firstCandidate(candidates, (candidate) => candidate.parsed.productSlug || candidate.parsed.brandSlug || candidate.parsed.creatorCode);
  const fallback = await findRecentClickFallback({
    shopDomain,
    productSlug: fallbackContextCandidate ? fallbackContextCandidate.parsed.productSlug : null,
    brandSlug: fallbackContextCandidate ? fallbackContextCandidate.parsed.brandSlug : null,
    creatorCode: fallbackContextCandidate ? fallbackContextCandidate.parsed.creatorCode : null,
    orderTimestamp
  });

  if (fallback.ambiguous) {
    log('Shopify orders paid webhook recent click fallback ambiguous; skipping attribution:', {
      shopDomain,
      reason: fallback.reason,
      candidateCount: fallback.candidateCount,
      productSlug: fallbackContextCandidate ? fallbackContextCandidate.parsed.productSlug : null,
      creatorCode: fallbackContextCandidate ? fallbackContextCandidate.parsed.creatorCode : null
    });
    return {
      creatorCode: null,
      partnerlinksRef: null,
      checkedSources,
      attributionSource: 'unmatched',
      source: 'unmatched',
      confidence: 'none',
      fallbackUsed: true,
      unmatchedReason: fallback.reason || 'ambiguous_recent_click_fallback'
    };
  }

  if (fallback.click) {
    log('Shopify orders paid webhook using low-confidence recent click fallback attribution:', {
      shopDomain,
      clickId: fallback.click.id,
      creatorCode: fallback.click.creator_code || null,
      productSlug: fallback.click.product_slug || null,
      timeDeltaFromClickSeconds: fallback.timeDeltaFromClickSeconds ?? null,
      fallbackReason: 'shopify_params_stripped'
    });
    return mergeClickAttribution(
      {
        creatorCode: null,
        partnerlinksRef: null,
        brandSlug: fallbackContextCandidate ? fallbackContextCandidate.parsed.brandSlug : null,
        productSlug: fallbackContextCandidate ? fallbackContextCandidate.parsed.productSlug : null,
        checkedSources,
        attributionSource: 'recent_click_fallback',
        source: 'recent_click_fallback',
        attributionKey: 'recent_click_fallback',
        confidence: 'low',
        fallbackUsed: true
      },
      fallback.click,
      'recent_click_fallback',
      fallback.timeDeltaFromClickSeconds
    );
  }

  return {
    creatorCode: null,
    partnerlinksRef: null,
    checkedSources,
    attributionSource: 'unmatched',
    source: 'unmatched',
    confidence: 'none',
    fallbackUsed: false,
    unmatchedReason: 'no_partnerlinks_attribution'
  };
}

async function findClickByPartnerlinksRef({
  shopDomain,
  partnerlinksRef,
  productSlug,
  orderTimestamp
}) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const windowStart = new Date(Date.now() - EXACT_REF_ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('clicks')
    .select('id, creator_id, session_id, creator_code, referral_code, brand_slug, product_slug, shop_domain, partnerlinks_ref, destination_url, created_at')
    .eq('shop_domain', normalizedShopDomain)
    .eq('partnerlinks_ref', partnerlinksRef)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(5);

  if (productSlug) query = query.eq('product_slug', normalizeCode(productSlug));

  const { data, error } = await query;
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      log('Shopify click attribution fallback unavailable until click metadata migration is run:', {
        shopDomain: normalizedShopDomain,
        error: error.message
      });
      return null;
    }
    throw error;
  }

  const click = data ? data[0] : null;
  return {
    click,
    timeDeltaFromClickSeconds: click ? secondsBetween(click.created_at, orderTimestamp) : null
  };
}

async function findRecentClickFallback({
  shopDomain,
  productSlug,
  brandSlug,
  creatorCode,
  orderTimestamp
}) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  const referenceTime = orderTimestamp ? new Date(orderTimestamp).getTime() : Date.now();
  const windowStart = new Date(referenceTime - RECENT_CLICK_FALLBACK_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(referenceTime + 15 * 60 * 1000).toISOString();

  let query = supabase
    .from('clicks')
    .select('id, creator_id, session_id, creator_code, referral_code, brand_slug, product_slug, shop_domain, partnerlinks_ref, destination_url, created_at')
    .eq('shop_domain', normalizedShopDomain)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .order('created_at', { ascending: false })
    .limit(RECENT_CLICK_FALLBACK_LIMIT);

  if (productSlug) query = query.eq('product_slug', normalizeCode(productSlug));
  if (brandSlug) query = query.eq('brand_slug', normalizeCode(brandSlug));
  if (creatorCode) query = query.eq('creator_code', normalizeCode(creatorCode));

  const { data, error } = await query;
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      log('Shopify recent click fallback unavailable until click metadata migration is run:', {
        shopDomain: normalizedShopDomain,
        error: error.message
      });
      return { click: null, ambiguous: false, reason: 'click_metadata_unavailable' };
    }
    throw error;
  }

  const clicks = data || [];
  if (!clicks.length) {
    return { click: null, ambiguous: false, reason: 'no_recent_clicks' };
  }

  const uniqueAttributionKeys = new Set(clicks.map((click) => [
    click.creator_id || '',
    normalizeCode(click.creator_code || click.referral_code),
    normalizeCode(click.product_slug)
  ].join('|')));

  const hasStrongContext = Boolean(productSlug || creatorCode);
  if (uniqueAttributionKeys.size > 1 && !hasStrongContext) {
    return {
      click: null,
      ambiguous: true,
      reason: 'ambiguous_recent_click_fallback',
      candidateCount: clicks.length
    };
  }

  const click = clicks[0];
  return {
    click,
    ambiguous: false,
    candidateCount: clicks.length,
    timeDeltaFromClickSeconds: secondsBetween(click.created_at, orderTimestamp)
  };
}

async function findAttributionSessionByPartnerlinksRef({
  brandId,
  partnerlinksRef,
  orderTimestamp
}) {
  const { data: sessions, error } = await supabase
    .from('attribution_sessions')
    .select('*')
    .eq('brand_id', brandId)
    .eq('session_id', partnerlinksRef)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;

  const session = sessions ? sessions[0] : null;
  if (!session) return null;

  let click = null;
  if (session.last_click_id) {
    const { data: clicks, error: clickError } = await supabase
      .from('clicks')
      .select('id, creator_id, session_id, creator_code, referral_code, brand_slug, product_slug, shop_domain, partnerlinks_ref, destination_url, created_at')
      .eq('id', session.last_click_id)
      .limit(1);
    if (clickError && !['PGRST204', '42703'].includes(clickError.code)) throw clickError;
    click = clicks ? clicks[0] : null;
  }

  return {
    creatorId: session.current_creator_id || (click ? click.creator_id : null),
    creatorCode: click ? normalizeCode(click.creator_code || click.referral_code) : null,
    clickId: click ? click.id : session.last_click_id || null,
    sessionId: session.session_id,
    timeDeltaFromClickSeconds: click ? secondsBetween(click.created_at, orderTimestamp) : null
  };
}

function firstCandidate(candidates, predicate) {
  return (candidates || []).find(predicate);
}

function candidateAttribution(candidate, attributionSource, confidence, fallbackUsed, checkedSources) {
  return {
    creatorCode: candidate.parsed.creatorCode || null,
    partnerlinksRef: candidate.parsed.partnerlinksRef || null,
    brandSlug: candidate.parsed.brandSlug || null,
    productSlug: candidate.parsed.productSlug || null,
    checkedSources,
    attributionSource,
    source: candidate.source,
    attributionKey: candidate.parsed.attributionKey || attributionSource,
    confidence,
    fallbackUsed
  };
}

function mergeClickAttribution(attribution, click, resolutionSource, timeDeltaFromClickSeconds) {
  return {
    ...attribution,
    creatorCode: attribution.creatorCode || normalizeCode(click.creator_code || click.referral_code),
    creatorId: click.creator_id || attribution.creatorId || null,
    partnerlinksRef: attribution.partnerlinksRef || click.partnerlinks_ref || null,
    brandSlug: attribution.brandSlug || normalizeCode(click.brand_slug),
    productSlug: attribution.productSlug || normalizeCode(click.product_slug),
    clickId: click.id || null,
    sessionId: click.session_id || null,
    recentClickId: resolutionSource === 'recent_click_fallback' ? click.id : null,
    timeDeltaFromClickSeconds: timeDeltaFromClickSeconds ?? null,
    attributionSource: resolutionSource,
    resolutionSource,
    source: attribution.source || resolutionSource,
    attributionKey: attribution.attributionKey || resolutionSource
  };
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

async function findCreatorById(creatorId) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('id', creatorId)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
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

function getOrderTimestamp(order) {
  const value = order.processed_at || order.created_at || order.updated_at || null;
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
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
    `attribution_confidence=${attribution.confidence || 'unknown'}`,
    attribution.resolutionSource ? `resolution_source=${attribution.resolutionSource}` : null,
    attribution.partnerlinksRef ? `partnerlinks_ref=${attribution.partnerlinksRef}` : null,
    attribution.clickId ? `click_id=${attribution.clickId}` : null,
    attribution.timeDeltaFromClickSeconds != null ? `time_delta_from_click_seconds=${attribution.timeDeltaFromClickSeconds}` : null,
    attribution.productSlug ? `product_slug=${attribution.productSlug}` : null,
    attribution.brandSlug ? `brand_slug=${attribution.brandSlug}` : null
  ].filter(Boolean).join('; ');
}

function buildAttributionDecision({
  shopDomain,
  shopifyOrderId,
  orderId,
  brandId,
  attribution = {},
  creator,
  decision,
  conversionId,
  duplicateOrder = false,
  unmatchedReason
}) {
  return {
    order_id: orderId || null,
    shopifyOrderId: shopifyOrderId || null,
    shopDomain,
    brandId: brandId || null,
    matchedCreatorId: creator ? creator.id : attribution.creatorId || null,
    matchedCreatorCode: creator ? creator.creator_code : attribution.creatorCode || null,
    matchedProductSlug: attribution.productSlug || null,
    partnerlinksRef: attribution.partnerlinksRef || null,
    attributionSource: attribution.attributionSource || attribution.resolutionSource || attribution.source || 'unmatched',
    attributionConfidence: attribution.confidence || 'none',
    fallbackUsed: Boolean(attribution.fallbackUsed || attribution.resolutionSource === 'recent_click_fallback'),
    recentClickId: attribution.recentClickId || (attribution.resolutionSource === 'recent_click_fallback' ? attribution.clickId : null),
    clickId: attribution.clickId || null,
    sessionId: attribution.sessionId || null,
    timeDeltaFromClickSeconds: attribution.timeDeltaFromClickSeconds ?? null,
    decision,
    unmatchedReason: unmatchedReason || attribution.unmatchedReason || null,
    duplicateOrder: Boolean(duplicateOrder),
    conversionId: conversionId || null,
    checkedSources: attribution.checkedSources || []
  };
}

async function recordShopifyAttributionDecision(decision) {
  const payload = {
    order_id: decision.order_id || null,
    shopify_order_id: decision.shopifyOrderId || null,
    shop_domain: decision.shopDomain || null,
    brand_id: decision.brandId || null,
    matched_creator_id: decision.matchedCreatorId || null,
    matched_creator_code: decision.matchedCreatorCode ? normalizeCode(decision.matchedCreatorCode) : null,
    matched_product_slug: decision.matchedProductSlug ? normalizeCode(decision.matchedProductSlug) : null,
    partnerlinks_ref: decision.partnerlinksRef || null,
    attribution_source: decision.attributionSource || 'unmatched',
    attribution_confidence: decision.attributionConfidence || 'none',
    fallback_used: Boolean(decision.fallbackUsed),
    recent_click_id: decision.recentClickId || null,
    click_id: decision.clickId || null,
    session_id: decision.sessionId || null,
    time_delta_from_click_seconds: decision.timeDeltaFromClickSeconds ?? null,
    decision: decision.decision || 'unknown',
    unmatched_reason: decision.unmatchedReason || null,
    duplicate_order: Boolean(decision.duplicateOrder),
    conversion_id: decision.conversionId || null,
    checked_sources: decision.checkedSources || []
  };

  const { error } = await supabase
    .from('shopify_attribution_events')
    .insert(payload);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204') {
      log('Shopify attribution diagnostics table unavailable; run migration 014_shopify_attribution_events.sql.', {
        orderId: decision.order_id || null,
        shopDomain: decision.shopDomain || null,
        decision: decision.decision || null
      });
      return;
    }
    log('Shopify attribution diagnostics insert failed:', {
      error: error.message,
      orderId: decision.order_id || null,
      shopDomain: decision.shopDomain || null
    });
  }
}

function secondsBetween(clickCreatedAt, orderTimestamp) {
  if (!clickCreatedAt || !orderTimestamp) return null;
  const clickTime = new Date(clickCreatedAt).getTime();
  const orderTime = new Date(orderTimestamp).getTime();
  if (Number.isNaN(clickTime) || Number.isNaN(orderTime)) return null;
  return Math.round((orderTime - clickTime) / 1000);
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
