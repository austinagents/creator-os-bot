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

async function ingestShopifyRefundWebhook({
  rawBody,
  shopDomain,
  webhookId
}) {
  const refund = JSON.parse(rawBody.toString('utf8'));
  const normalizedShopDomain = normalizeShopDomain(shopDomain || refund.shop_domain || refund.myshopify_domain);
  const refundId = String(refund.id || refund.admin_graphql_api_id || webhookId || '').trim();
  const shopifyOrderId = String(refund.order_id || refund.order && refund.order.id || '').trim();
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const idempotencyKey = `shopify:refund:${normalizedShopDomain}:${refundId || webhookId || bodyHash}`;

  log('Shopify refund webhook received:', {
    webhookId: webhookId || null,
    shopDomain: normalizedShopDomain,
    refundId: refundId || null,
    shopifyOrderId: shopifyOrderId || null
  });

  const store = await getShopifyStoreByDomain(normalizedShopDomain);
  const brandId = store && store.brand_id ? store.brand_id : null;
  const orderId = shopifyOrderId ? `shopify:${normalizedShopDomain}:${shopifyOrderId}` : null;
  const conversion = orderId ? await findConversionByOrderId({ brandId, orderId }) : null;
  const reversedOrderAmount = getRefundTotal(refund);
  const originalOrderAmount = conversion ? Number(conversion.order_value || 0) : null;
  const reversalRatio = originalOrderAmount && reversedOrderAmount
    ? Math.min(1, roundRatio(reversedOrderAmount / originalOrderAmount))
    : null;
  const reversalType = originalOrderAmount && reversedOrderAmount && reversedOrderAmount < originalOrderAmount
    ? 'partial_refund'
    : 'refund';

  const eventPayload = {
    idempotency_key: idempotencyKey,
    source_system: 'shopify',
    source_event_id: refundId || webhookId || null,
    brand_id: brandId,
    shop_domain: normalizedShopDomain,
    order_id: orderId,
    shopify_order_id: shopifyOrderId || null,
    conversion_id: conversion ? conversion.id : null,
    reversal_type: reversalType,
    reversal_reason: 'shopify_refund_webhook',
    reversal_status: conversion ? 'detected' : 'pending_review',
    currency: String(refund.currency || conversion && conversion.currency || 'USD').toUpperCase(),
    original_order_amount: originalOrderAmount,
    reversed_order_amount: reversedOrderAmount,
    reversal_ratio: reversalRatio,
    evidence: buildRefundEvidence({
      refund,
      webhookId,
      conversionFound: Boolean(conversion)
    }),
    notes: [
      'Diagnostic-only Shopify refund capture.',
      'No payout_status, claimability, dashboard total, Stripe transfer, settlement state, or earnings row was changed.'
    ].join(' ')
  };

  log('Financial reversal event insert attempt:', {
    idempotencyKey,
    shopDomain: normalizedShopDomain,
    refundId: refundId || null,
    orderId,
    brandId,
    conversionId: conversion ? conversion.id : null,
    reversedOrderAmount,
    reversalType
  });

  const { data: eventRow, error: eventError } = await supabase
    .from('financial_reversal_events')
    .insert(eventPayload)
    .select()
    .single();

  if (eventError) {
    if (eventError.code === '23505') {
      log('Financial reversal event duplicate skipped:', {
        idempotencyKey,
        shopDomain: normalizedShopDomain,
        refundId: refundId || null,
        orderId
      });
      return {
        status: 'duplicate_skipped',
        idempotencyKey,
        orderId,
        conversionId: conversion ? conversion.id : null
      };
    }

    if (['42P01', 'PGRST205', 'PGRST204'].includes(eventError.code)) {
      log('Financial reversal ledger unavailable; refund capture skipped safely:', {
        idempotencyKey,
        shopDomain: normalizedShopDomain,
        refundId: refundId || null,
        code: eventError.code || null,
        message: eventError.message
      });
      return {
        status: 'skipped',
        reason: 'reversal_ledger_unavailable',
        idempotencyKey
      };
    }

    throw eventError;
  }

  const itemRows = conversion
    ? await buildFinancialReversalItems({
      reversalEventId: eventRow.id,
      conversion,
      reversalRatio,
      reversedOrderAmount,
      currency: eventPayload.currency
    })
    : [];

  if (itemRows.length) {
    const { error: itemError } = await supabase
      .from('financial_reversal_items')
      .insert(itemRows);
    if (itemError) {
      log('Financial reversal item insert failed; event retained for manual review:', {
        reversalEventId: eventRow.id,
        idempotencyKey,
        code: itemError.code || null,
        message: itemError.message
      });
      return {
        status: 'captured_pending_item_review',
        reversalEventId: eventRow.id,
        idempotencyKey,
        orderId,
        conversionId: conversion.id,
        itemRowsCreated: 0
      };
    }
  }

  log('Financial reversal event captured:', {
    reversalEventId: eventRow.id,
    idempotencyKey,
    shopDomain: normalizedShopDomain,
    refundId: refundId || null,
    orderId,
    conversionId: conversion ? conversion.id : null,
    itemRowsCreated: itemRows.length
  });

  return {
    status: 'captured',
    reversalEventId: eventRow.id,
    idempotencyKey,
    orderId,
    conversionId: conversion ? conversion.id : null,
    itemRowsCreated: itemRows.length
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
    const attributeName = normalizeCode(attribute.name);
    const attributeSource = `note_attributes.${attributeName || 'value'}`;
    if (attribute.name) checkedSources.push(attributeSource);
    if (attribute.value != null) {
      const candidateValue = [...ATTRIBUTION_KEYS, ...CONTEXT_KEYS].includes(attributeName)
        ? `${attributeName}=${attribute.value}`
        : attribute.value;
      if ([...ATTRIBUTION_KEYS, ...CONTEXT_KEYS].includes(attributeName)) {
        log('Shopify webhook found named attribution attribute:', {
          source: attributeSource,
          key: attributeName,
          hasValue: Boolean(attribute.value)
        });
      }
      candidates.push(buildAttributionCandidate(attributeSource, candidateValue, 'note_attributes'));
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
      log('Shopify webhook found nested attribution attribute:', {
        source: childPath,
        key: normalizedKey,
        hasValue: Boolean(childValue)
      });
      candidates.push(buildAttributionCandidate(childPath, `${normalizedKey}=${childValue}`, getNestedSourceGroup(childPath, true)));
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

async function findConversionByOrderId({ brandId, orderId }) {
  let query = supabase
    .from('conversions')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;
  if (error) throw error;
  return data ? data[0] : null;
}

async function buildFinancialReversalItems({
  reversalEventId,
  conversion,
  reversalRatio,
  reversedOrderAmount,
  currency
}) {
  const ratio = Number(reversalRatio || 0);
  const effectiveRatio = ratio > 0 ? ratio : 1;
  const rows = [];

  rows.push({
    reversal_event_id: reversalEventId,
    item_type: 'direct_commission',
    conversion_id: conversion.id,
    affected_creator_id: conversion.creator_id || null,
    original_amount: Number(conversion.commission_amount || 0),
    reversed_amount: roundCurrency(Number(conversion.commission_amount || 0) * effectiveRatio),
    currency,
    payout_status_at_reversal: conversion.payout_status || null,
    offset_required: isOffsetRequired(conversion),
    offset_status: isOffsetRequired(conversion) ? 'required' : 'none',
    notes: 'Diagnostic-only direct commission reversal item. No earning row was mutated.'
  });

  if (Number(conversion.platform_fee_amount || 0) > 0) {
    rows.push({
      reversal_event_id: reversalEventId,
      item_type: 'platform_fee',
      conversion_id: conversion.id,
      affected_brand_id: conversion.brand_id || null,
      original_amount: Number(conversion.platform_fee_amount || 0),
      reversed_amount: roundCurrency(Number(conversion.platform_fee_amount || 0) * effectiveRatio),
      currency,
      payout_status_at_reversal: conversion.payout_status || null,
      offset_required: false,
      offset_status: 'none',
      notes: 'Diagnostic-only PartnerLinks platform fee reversal item. No settlement or payout row was mutated.'
    });
  }

  const creatorNetworkRows = await getCreatorNetworkEarningsByConversionId(conversion.id);
  for (const earning of creatorNetworkRows) {
    rows.push({
      reversal_event_id: reversalEventId,
      item_type: 'creator_network_override',
      conversion_id: conversion.id,
      creator_network_earning_id: earning.id,
      affected_creator_id: earning.earning_creator_id || null,
      original_amount: Number(earning.commission_amount || 0),
      reversed_amount: roundCurrency(Number(earning.commission_amount || 0) * effectiveRatio),
      currency: String(earning.currency || currency || 'USD').toUpperCase(),
      payout_status_at_reversal: earning.payout_status || null,
      offset_required: isOffsetRequired(earning),
      offset_status: isOffsetRequired(earning) ? 'required' : 'none',
      notes: 'Diagnostic-only creator network override reversal item. No earning row was mutated.'
    });
  }

  const brandNetworkRows = await getBrandNetworkEarningsByConversionId(conversion.id);
  for (const earning of brandNetworkRows) {
    rows.push({
      reversal_event_id: reversalEventId,
      item_type: 'brand_network_override',
      conversion_id: conversion.id,
      brand_network_earning_id: earning.id,
      affected_brand_id: earning.earning_brand_id || null,
      original_amount: Number(earning.commission_amount || 0),
      reversed_amount: roundCurrency(Number(earning.commission_amount || 0) * effectiveRatio),
      currency: String(earning.currency || currency || 'USD').toUpperCase(),
      payout_status_at_reversal: earning.payout_status || null,
      offset_required: isOffsetRequired(earning),
      offset_status: isOffsetRequired(earning) ? 'required' : 'none',
      notes: 'Diagnostic-only brand network override reversal item. No earning row was mutated.'
    });
  }

  log('Financial reversal items prepared:', {
    reversalEventId,
    conversionId: conversion.id,
    reversedOrderAmount,
    reversalRatio: ratio || null,
    itemCount: rows.length
  });

  return rows;
}

async function getCreatorNetworkEarningsByConversionId(conversionId) {
  const { data, error } = await supabase
    .from('creator_network_earnings')
    .select('*')
    .eq('conversion_id', conversionId);
  if (error) throw error;
  return data || [];
}

async function getBrandNetworkEarningsByConversionId(conversionId) {
  const { data, error } = await supabase
    .from('brand_network_earnings')
    .select('*')
    .eq('conversion_id', conversionId);
  if (error) throw error;
  return data || [];
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

function getRefundTotal(refund) {
  const transactionTotal = (refund.transactions || []).reduce((total, transaction) => {
    const kind = String(transaction.kind || '').toLowerCase();
    const status = String(transaction.status || '').toLowerCase();
    if (kind && kind !== 'refund') return total;
    if (status && !['success', 'succeeded'].includes(status)) return total;
    return total + Number(transaction.amount || 0);
  }, 0);
  if (transactionTotal > 0) return roundCurrency(transactionTotal);

  const lineItemTotal = (refund.refund_line_items || []).reduce((total, item) => {
    return total + Number(item.subtotal || item.total || item.line_item && item.line_item.price || 0);
  }, 0);
  const adjustmentTotal = (refund.order_adjustments || []).reduce((total, adjustment) => {
    return total + Math.abs(Number(adjustment.amount || 0));
  }, 0);

  return roundCurrency(lineItemTotal + adjustmentTotal);
}

function buildRefundEvidence({
  refund,
  webhookId,
  conversionFound
}) {
  return {
    webhook_id: webhookId || null,
    refund_id: refund.id || null,
    admin_graphql_api_id: refund.admin_graphql_api_id || null,
    order_id: refund.order_id || (refund.order && refund.order.id) || null,
    created_at: refund.created_at || null,
    processed_at: refund.processed_at || null,
    currency: refund.currency || null,
    transaction_count: Array.isArray(refund.transactions) ? refund.transactions.length : 0,
    refund_line_item_count: Array.isArray(refund.refund_line_items) ? refund.refund_line_items.length : 0,
    order_adjustment_count: Array.isArray(refund.order_adjustments) ? refund.order_adjustments.length : 0,
    conversion_found: Boolean(conversionFound)
  };
}

function isOffsetRequired(row) {
  return row && (row.payout_status === 'claimed' || Boolean(row.claim_batch_id));
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
  const normalizedDecision = normalizeAttributionDecision(decision);
  const payload = {
    order_id: normalizedDecision.orderId,
    shopify_order_id: normalizedDecision.shopifyOrderId,
    shop_domain: normalizedDecision.shopDomain,
    brand_id: normalizedDecision.brandId,
    matched_creator_id: normalizedDecision.matchedCreatorId,
    matched_creator_code: normalizedDecision.matchedCreatorCode ? normalizeCode(normalizedDecision.matchedCreatorCode) : null,
    matched_product_slug: normalizedDecision.matchedProductSlug ? normalizeCode(normalizedDecision.matchedProductSlug) : null,
    partnerlinks_ref: normalizedDecision.partnerlinksRef,
    attribution_source: normalizedDecision.attributionSource,
    attribution_confidence: normalizedDecision.attributionConfidence,
    fallback_used: Boolean(normalizedDecision.fallbackUsed),
    recent_click_id: normalizedDecision.recentClickId,
    click_id: normalizedDecision.clickId,
    session_id: normalizedDecision.sessionId,
    time_delta_from_click_seconds: normalizedDecision.timeDeltaFromClickSeconds,
    decision: normalizedDecision.decision,
    unmatched_reason: normalizedDecision.unmatchedReason,
    duplicate_order: Boolean(normalizedDecision.duplicateOrder),
    conversion_id: normalizedDecision.conversionId,
    checked_sources: normalizedDecision.checkedSources
  };

  log('Shopify attribution diagnostics insert attempt:', {
    orderId: payload.order_id,
    shopifyOrderId: payload.shopify_order_id,
    shopDomain: payload.shop_domain,
    brandId: payload.brand_id,
    matchedCreatorCode: payload.matched_creator_code,
    productSlug: payload.matched_product_slug,
    partnerlinksRefPresent: Boolean(payload.partnerlinks_ref),
    attributionSource: payload.attribution_source,
    attributionConfidence: payload.attribution_confidence,
    fallbackUsed: payload.fallback_used,
    decision: payload.decision,
    unmatchedReason: payload.unmatched_reason,
    conversionId: payload.conversion_id
  });

  const { data, error } = await supabase
    .from('shopify_attribution_events')
    .insert(payload)
    .select('id, created_at')
    .single();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204') {
      log('Shopify attribution diagnostics table unavailable; run migration 014_shopify_attribution_events.sql.', {
        code: error.code,
        message: error.message,
        details: error.details || null,
        hint: error.hint || null,
        orderId: payload.order_id,
        shopDomain: payload.shop_domain,
        decision: payload.decision
      });
      return;
    }
    log('Shopify attribution diagnostics insert failed:', {
      code: error.code || null,
      message: error.message,
      details: error.details || null,
      hint: error.hint || null,
      orderId: payload.order_id,
      shopifyOrderId: payload.shopify_order_id,
      shopDomain: payload.shop_domain,
      decision: payload.decision
    });
    return;
  }

  log('Shopify attribution diagnostics insert success:', {
    id: data ? data.id : null,
    createdAt: data ? data.created_at : null,
    orderId: payload.order_id,
    shopifyOrderId: payload.shopify_order_id,
    shopDomain: payload.shop_domain,
    decision: payload.decision,
    attributionSource: payload.attribution_source
  });
}

function normalizeAttributionDecision(decision = {}) {
  return {
    orderId: decision.order_id || decision.orderId || null,
    shopifyOrderId: decision.shopify_order_id || decision.shopifyOrderId || null,
    shopDomain: decision.shop_domain || decision.shopDomain || null,
    brandId: decision.brand_id || decision.brandId || null,
    matchedCreatorId: decision.matched_creator_id || decision.matchedCreatorId || null,
    matchedCreatorCode: decision.matched_creator_code || decision.matchedCreatorCode || null,
    matchedProductSlug: decision.matched_product_slug || decision.matchedProductSlug || null,
    partnerlinksRef: decision.partnerlinks_ref || decision.partnerlinksRef || null,
    attributionSource: decision.attribution_source || decision.attributionSource || 'unmatched',
    attributionConfidence: decision.attribution_confidence || decision.attributionConfidence || 'none',
    fallbackUsed: decision.fallback_used ?? decision.fallbackUsed ?? false,
    recentClickId: decision.recent_click_id || decision.recentClickId || null,
    clickId: decision.click_id || decision.clickId || null,
    sessionId: decision.session_id || decision.sessionId || null,
    timeDeltaFromClickSeconds: decision.time_delta_from_click_seconds ?? decision.timeDeltaFromClickSeconds ?? null,
    decision: decision.decision || 'unknown',
    unmatchedReason: decision.unmatched_reason || decision.unmatchedReason || null,
    duplicateOrder: decision.duplicate_order ?? decision.duplicateOrder ?? false,
    conversionId: decision.conversion_id || decision.conversionId || null,
    checkedSources: decision.checked_sources || decision.checkedSources || []
  };
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

function roundRatio(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

module.exports = {
  verifyShopifyWebhookHmac,
  ingestShopifyOrdersPaidWebhook,
  ingestShopifyRefundWebhook
};
