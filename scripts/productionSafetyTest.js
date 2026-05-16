#!/usr/bin/env node

const supabase = require('../database/database/supabase');
const { PUBLIC_BASE_URL } = require('../config/config/env');
const { normalizeCode } = require('../utils/slug');

const TEST_CODES = Array.from({ length: 10 }, (_, index) => `test-creator-${String(index + 1).padStart(2, '0')}`);
const CHAIN = [
  ['test-creator-02', 'test-creator-01'],
  ['test-creator-03', 'test-creator-02'],
  ['test-creator-04', 'test-creator-03']
];
const TEST_SIGNUP_SOURCE = 'production_safety_test';
const TEST_SHOP_DOMAIN = 'partnerlinks-test.myshopify.com';
const TEST_BRAND_SLUG = 'aria-wellness';
const TEST_PRODUCT_SLUG = 'test-product';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const effectiveDryRun = args.dryRun || !args.seedTestCreators;

  printHeader('PartnerLinks Production Safety Test');
  console.log(`Mode: ${effectiveDryRun ? 'DRY RUN / READ ONLY' : 'WRITE ENABLED FOR TEST CREATORS ONLY'}`);
  console.log(`Flags: ${process.argv.slice(2).join(' ') || '--dry-run (implicit)'}`);

  const context = await loadContext();

  if (args.seedTestCreators) {
    await seedTestCreators({ context, dryRun: effectiveDryRun });
  }

  if (args.validateTree || args.seedTestCreators) {
    const creators = await getTestCreators();
    validateTree(creators);
  }

  if (args.report || args.orderId || args.creatorCode || args.dryRun || !hasAnyAction(args)) {
    await printReport({
      context,
      orderId: args.orderId,
      creatorCode: args.creatorCode
    });
  }

  if (args.matrixReport || args.collisionTest || args.replayTest || args.payoutTest || args.stressTest) {
    await printReliabilityMatrix({
      context,
      orderId: args.orderId,
      creatorCode: args.creatorCode,
      includeCollision: args.matrixReport || args.collisionTest,
      includeReplay: args.matrixReport || args.replayTest,
      includePayout: args.matrixReport || args.payoutTest,
      includeStress: args.matrixReport || args.stressTest
    });
  }

  printHeader('Done');
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    seedTestCreators: false,
    validateTree: false,
    report: false,
    collisionTest: false,
    replayTest: false,
    payoutTest: false,
    stressTest: false,
    matrixReport: false,
    orderId: null,
    creatorCode: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--seed-test-creators') args.seedTestCreators = true;
    else if (arg === '--validate-tree') args.validateTree = true;
    else if (arg === '--report') args.report = true;
    else if (arg === '--collision-test') args.collisionTest = true;
    else if (arg === '--replay-test') args.replayTest = true;
    else if (arg === '--payout-test') args.payoutTest = true;
    else if (arg === '--stress-test') args.stressTest = true;
    else if (arg === '--matrix-report') args.matrixReport = true;
    else if (arg === '--order-id') {
      args.orderId = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--creator-code') {
      args.creatorCode = normalizeCode(argv[index + 1] || '');
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (args.creatorCode && !isAllowedTestCode(args.creatorCode)) {
    throw new Error(`Refusing creator_code outside test namespace: ${args.creatorCode}`);
  }

  return args;
}

function hasAnyAction(args) {
  return args.seedTestCreators ||
    args.validateTree ||
    args.report ||
    args.collisionTest ||
    args.replayTest ||
    args.payoutTest ||
    args.stressTest ||
    args.matrixReport ||
    args.orderId ||
    args.creatorCode ||
    args.dryRun;
}

async function loadContext() {
  const store = await getShopifyStore(TEST_SHOP_DOMAIN);
  const brand = store && store.brand_id ? await getBrand(store.brand_id) : await getLatestBrand();

  console.log('\nContext');
  console.log(`- Test shop domain: ${TEST_SHOP_DOMAIN}`);
  console.log(`- Store brand_id: ${store ? store.brand_id || 'none' : 'store not found'}`);
  console.log(`- Selected brand: ${brand ? `${brand.id} (${brand.name})` : 'none'}`);

  if (!brand) {
    console.warn('Warning: no brand found. Seeding may fail if creators.brand_id is required.');
  }

  return { store, brand };
}

async function seedTestCreators({ context, dryRun }) {
  printHeader('Seed Test Creators');
  const existing = await getTestCreators();
  const existingByCode = new Map(existing.map((creator) => [normalizeCode(creator.creator_code), creator]));
  const desired = buildDesiredCreators(context.brand);

  for (const row of desired) {
    assertTestCreatorPayload(row);
    const current = existingByCode.get(row.creator_code);

    if (!current) {
      console.log(`${dryRun ? '[dry-run] would insert' : 'inserting'} ${row.creator_code}`);
      if (!dryRun) await insertCreator(row);
      continue;
    }

    assertTestCreator(current);
    const updates = diffCreatorUpdates(current, row);
    if (!Object.keys(updates).length) {
      console.log(`unchanged ${row.creator_code} -> id ${current.id}`);
      continue;
    }

    console.log(`${dryRun ? '[dry-run] would update' : 'updating'} ${row.creator_code} -> id ${current.id}`, updates);
    if (!dryRun) await updateCreator(current.id, updates);
  }

  const refreshed = dryRun ? existing : await getTestCreators();
  const byCode = new Map(refreshed.map((creator) => [normalizeCode(creator.creator_code), creator]));

  for (const [childCode, parentCode] of CHAIN) {
    const child = byCode.get(childCode);
    const parent = byCode.get(parentCode);
    if (!child || !parent) {
      console.log(`${dryRun ? '[dry-run]' : '[skip]'} parent link ${childCode} -> ${parentCode}: missing child or parent until inserts exist`);
      continue;
    }

    if (child.parent_creator_id === parent.id) {
      console.log(`parent ok ${childCode} -> ${parentCode}`);
      continue;
    }

    assertTestCreator(child);
    const updates = {
      parent_creator_id: parent.id,
      referred_at: child.referred_at || new Date().toISOString()
    };
    console.log(`${dryRun ? '[dry-run] would set parent' : 'setting parent'} ${childCode} -> ${parentCode}`, updates);
    if (!dryRun) await updateCreator(child.id, updates);
  }
}

function buildDesiredCreators(brand) {
  return TEST_CODES.map((code, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      discord_user_id: `pltest${number}${Date.now()}`.slice(0, 18),
      discord_username: `TEST Creator ${number}`,
      creator_code: code,
      referral_code: code,
      referral_link: null,
      tracking_link: `${PUBLIC_BASE_URL}/r/${TEST_BRAND_SLUG}/${code}`,
      join_referral_link: `${PUBLIC_BASE_URL}/join/${code}`,
      brand_id: brand ? brand.id : null,
      approved: true,
      display_name: `TEST Creator ${number}`,
      signup_source: TEST_SIGNUP_SOURCE
    };
  });
}

function diffCreatorUpdates(current, desired) {
  const updates = {};
  for (const key of [
    'discord_username',
    'creator_code',
    'referral_code',
    'tracking_link',
    'join_referral_link',
    'brand_id',
    'approved',
    'display_name',
    'signup_source'
  ]) {
    if (desired[key] !== undefined && current[key] !== desired[key]) {
      updates[key] = desired[key];
    }
  }
  return updates;
}

async function printReport({ context, orderId, creatorCode }) {
  printHeader('Report');
  const creators = await getTestCreators();
  const scopedCreators = creatorCode ? creators.filter((creator) => normalizeCode(creator.creator_code) === creatorCode) : creators;
  const creatorIds = scopedCreators.map((creator) => creator.id);
  const allTestCreatorIds = creators.map((creator) => creator.id);

  printCreatorTable(creators);
  validateTree(creators);

  const clicks = await getClicks({ creatorIds, orderId });
  printRows('Clicks By Test Creators', clicks, (row) => ({
    id: row.id,
    creator_id: row.creator_id,
    creator_code: row.creator_code,
    product_slug: row.product_slug,
    shop_domain: row.shop_domain,
    partnerlinks_ref: row.partnerlinks_ref,
    created_at: row.created_at
  }));

  const sessions = await getAttributionSessions({ creatorIds, clicks });
  printRows('Attribution Sessions', sessions, (row) => ({
    id: row.id,
    brand_id: row.brand_id,
    session_id: row.session_id,
    current_creator_id: row.current_creator_id,
    last_click_id: row.last_click_id,
    updated_at: row.updated_at
  }));

  const conversions = await getConversions({ creatorIds, orderId });
  printRows('Conversions', conversions, (row) => ({
    id: row.id,
    order_id: row.order_id,
    creator_id: row.creator_id,
    order_value: row.order_value,
    commission_rate: row.commission_rate,
    commission_amount: row.commission_amount,
    platform_fee_amount: row.platform_fee_amount,
    payout_status: row.payout_status,
    claimable_at: row.claimable_at
  }));

  const conversionIds = conversions.map((row) => row.id);
  const networkEarnings = await getCreatorNetworkEarnings({
    testCreatorIds: orderId ? [] : allTestCreatorIds,
    conversionIds
  });
  printRows('Creator Network Earnings', networkEarnings, (row) => ({
    id: row.id,
    earning_creator_id: row.earning_creator_id,
    source_creator_id: row.source_creator_id,
    conversion_id: row.conversion_id,
    level: row.level,
    platform_fee_amount: row.platform_fee_amount,
    commission_rate: row.commission_rate,
    commission_amount: row.commission_amount,
    payout_status: row.payout_status
  }));

  const brandNetworkEarnings = await getBrandNetworkEarnings({ conversionIds });
  printRows('Brand Network Earnings', brandNetworkEarnings, (row) => ({
    id: row.id,
    earning_brand_id: row.earning_brand_id,
    source_creator_id: row.source_creator_id,
    conversion_id: row.conversion_id,
    level: row.level,
    commission_amount: row.commission_amount,
    payout_status: row.payout_status
  }));

  const attributionEvents = await getAttributionEvents({ orderId, creatorCodes: scopedCreators.map((creator) => creator.creator_code) });
  printRows('Shopify Attribution Events', attributionEvents, (row) => ({
    id: row.id,
    order_id: row.order_id,
    shopify_order_id: row.shopify_order_id,
    shop_domain: row.shop_domain,
    brand_id: row.brand_id,
    matched_creator_code: row.matched_creator_code,
    matched_product_slug: row.matched_product_slug,
    partnerlinks_ref: row.partnerlinks_ref,
    attribution_source: row.attribution_source,
    attribution_confidence: row.attribution_confidence,
    fallback_used: row.fallback_used,
    recent_click_id: row.recent_click_id,
    click_id: row.click_id,
    session_id: row.session_id,
    time_delta_from_click_seconds: row.time_delta_from_click_seconds,
    decision: row.decision,
    unmatched_reason: row.unmatched_reason,
    duplicate_order: row.duplicate_order,
    conversion_id: row.conversion_id,
    checked_sources: row.checked_sources
  }));

  if (orderId) {
    printAttributionFailureDiagnostics(attributionEvents);
  }

  if (orderId) {
    printEconomicsValidation({
      orderId,
      creators,
      conversions,
      networkEarnings,
      brandNetworkEarnings
    });
  }

  console.log('\nManual test URL');
  console.log(`${PUBLIC_BASE_URL}/r/${TEST_BRAND_SLUG}/test-creator-04/${TEST_PRODUCT_SLUG}`);
  if (context.brand) console.log(`Selected brand for test creators: ${context.brand.id} (${context.brand.name})`);
}

function printAttributionFailureDiagnostics(attributionEvents) {
  printHeader('Attribution Failure Diagnostics');
  if (!attributionEvents.length) {
    console.log('No shopify_attribution_events rows found for this order.');
    return;
  }

  for (const event of attributionEvents) {
    const checkedSources = Array.isArray(event.checked_sources) ? event.checked_sources : [];
    const partnerlinksRefMissing = !event.partnerlinks_ref;
    const fallbackRejected = event.decision === 'skipped' && String(event.unmatched_reason || '').includes('fallback');
    const ambiguityRejected = String(event.unmatched_reason || '').includes('ambiguous');
    const timingRejected = String(event.unmatched_reason || '').includes('recent') || String(event.unmatched_reason || '').includes('click');

    console.log(JSON.stringify({
      event_id: event.id,
      decision: event.decision,
      unmatched_reason: event.unmatched_reason || null,
      partnerlinks_ref_missing: partnerlinksRefMissing,
      partnerlinks_ref: event.partnerlinks_ref || null,
      attribution_source: event.attribution_source || null,
      attribution_confidence: event.attribution_confidence || null,
      fallback_used: event.fallback_used,
      recent_click_id: event.recent_click_id || null,
      click_id: event.click_id || null,
      session_id: event.session_id || null,
      time_delta_from_click_seconds: event.time_delta_from_click_seconds ?? null,
      matched_creator_code: event.matched_creator_code || null,
      matched_product_slug: event.matched_product_slug || null,
      checked_sources: checkedSources,
      inference: {
        partnerlinks_ref_was_missing_from_diagnostic_row: partnerlinksRefMissing,
        fallback_rejected: fallbackRejected,
        ambiguity_rejected: ambiguityRejected,
        possible_timing_or_missing_recent_click_context: timingRejected
      }
    }, null, 2));
  }
}

function printCreatorTable(creators) {
  printHeader('Test Creators');
  for (const code of TEST_CODES) {
    const creator = creators.find((row) => normalizeCode(row.creator_code) === code);
    if (!creator) {
      console.log(`- ${code}: missing`);
      continue;
    }
    console.log(`- ${code}: id=${creator.id}, parent=${creator.parent_creator_id || 'none'}, brand=${creator.brand_id || 'none'}, signup_source=${creator.signup_source || 'none'}`);
  }
}

function validateTree(creators) {
  printHeader('Parent Graph Validation');
  const byCode = new Map(creators.map((creator) => [normalizeCode(creator.creator_code), creator]));
  for (const [childCode, parentCode] of CHAIN) {
    const child = byCode.get(childCode);
    const parent = byCode.get(parentCode);
    const ok = Boolean(child && parent && child.parent_creator_id === parent.id);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${childCode}.parent_creator_id should equal ${parentCode}.id`, {
      child_id: child ? child.id : null,
      actual_parent_id: child ? child.parent_creator_id : null,
      expected_parent_id: parent ? parent.id : null
    });
  }
}

function printEconomicsValidation({
  orderId,
  creators,
  conversions,
  networkEarnings,
  brandNetworkEarnings
}) {
  printHeader(`Expected Vs Actual Economics For ${orderId}`);
  const byCode = new Map(creators.map((creator) => [normalizeCode(creator.creator_code), creator]));
  const conversion = conversions.find((row) => row.order_id === orderId) || conversions[0];
  if (!conversion) {
    console.log('No conversion found for this order.');
    return;
  }

  const source = creators.find((creator) => creator.id === conversion.creator_id);
  console.log('Direct conversion:', {
    conversion_id: conversion.id,
    source_creator_code: source ? source.creator_code : null,
    direct_commission_amount: conversion.commission_amount,
    platform_fee_amount: conversion.platform_fee_amount,
    payout_status: conversion.payout_status
  });

  if (!source || normalizeCode(source.creator_code) !== 'test-creator-04') {
    console.log('Order is not attributed to test-creator-04; Level 1/2/3 expected chain check skipped.');
    return;
  }

  const platformFee = Number(conversion.platform_fee_amount || 0);
  const expected = [
    { code: 'test-creator-03', level: 1, rate: 30, amount: roundCurrency(platformFee * 0.30) },
    { code: 'test-creator-02', level: 2, rate: 3, amount: roundCurrency(platformFee * 0.03) },
    { code: 'test-creator-01', level: 3, rate: 2, amount: roundCurrency(platformFee * 0.02) }
  ];

  for (const row of expected) {
    const creator = byCode.get(row.code);
    const actual = networkEarnings.find((earning) => (
      creator &&
      earning.conversion_id === conversion.id &&
      earning.earning_creator_id === creator.id &&
      Number(earning.level) === row.level
    ));
    console.log(`${actual && Number(actual.commission_amount) === row.amount ? 'PASS' : 'CHECK'} ${row.code} Level ${row.level}`, {
      expected_rate: row.rate,
      expected_amount: row.amount,
      actual_amount: actual ? Number(actual.commission_amount) : null,
      actual_row_id: actual ? actual.id : null
    });
  }

  const levelFourRows = networkEarnings.filter((earning) => earning.conversion_id === conversion.id && Number(earning.level) > 3);
  console.log(`${levelFourRows.length === 0 ? 'PASS' : 'FAIL'} no Level 4+ creator network earnings`, {
    level_4_plus_rows: levelFourRows.length
  });
  console.log('Brand network earnings for conversion:', brandNetworkEarnings.filter((row) => row.conversion_id === conversion.id).length);
}

async function printReliabilityMatrix({
  context,
  orderId,
  creatorCode,
  includeCollision,
  includeReplay,
  includePayout,
  includeStress
}) {
  printHeader('Reliability Matrix');
  console.log('Mode: read-only diagnostics. This does not replay webhooks, alter payout rows, or create Stripe transfers.');

  const creators = await getTestCreators();
  const scopedCreators = creatorCode
    ? creators.filter((creator) => normalizeCode(creator.creator_code) === creatorCode)
    : creators;
  const creatorIds = scopedCreators.map((creator) => creator.id);
  const allTestCreatorIds = creators.map((creator) => creator.id);
  const attributionEvents = await getAttributionEvents({ orderId, creatorCodes: scopedCreators.map((creator) => creator.creator_code) });
  const clicks = await getClicks({ creatorIds, orderId });
  const conversions = await getConversions({ creatorIds, orderId });
  const conversionIds = conversions.map((row) => row.id);
  const networkEarnings = await getCreatorNetworkEarnings({
    testCreatorIds: orderId ? [] : allTestCreatorIds,
    conversionIds
  });
  const brandNetworkEarnings = await getBrandNetworkEarnings({ conversionIds });

  const results = [];

  if (includeCollision) {
    results.push(...await analyzeCollisionSafety({ creators: scopedCreators, attributionEvents }));
  }

  if (includeReplay) {
    results.push(...await analyzeReplayIdempotency({ conversions, attributionEvents, networkEarnings, brandNetworkEarnings }));
  }

  if (includePayout) {
    results.push(...await analyzePayoutLifecycle({ creators: scopedCreators, conversions, networkEarnings }));
  }

  if (includeStress) {
    results.push(...await analyzeAttributionStress({ context, creators: scopedCreators, clicks, attributionEvents }));
  }

  printRows('Reliability Matrix Results', results, (row) => row);
  printReliabilitySummary(results);
  printManualReliabilityChecklist();
}

async function analyzeCollisionSafety({ creators, attributionEvents }) {
  printHeader('Collision Testing Diagnostics');
  const creatorCodes = creators.map((creator) => normalizeCode(creator.creator_code));
  const recentClicks = await getRecentTestClicks({ creatorCodes, limit: 200 });
  const clusters = buildClickCollisionClusters(recentClicks, 120000);
  const ambiguousEvents = attributionEvents.filter((event) => String(event.unmatched_reason || '').includes('ambiguous'));
  const deterministicEvents = attributionEvents.filter((event) => (
    event.decision === 'conversion_created' &&
    event.partnerlinks_ref &&
    event.fallback_used === false
  ));

  printRows('Recent Collision Click Clusters', clusters.slice(0, 10), (cluster) => ({
    shop_domain: cluster.shop_domain,
    product_slug: cluster.product_slug,
    click_count: cluster.click_count,
    creators: cluster.creators,
    first_click_at: cluster.first_click_at,
    last_click_at: cluster.last_click_at,
    window_seconds: cluster.window_seconds
  }));

  return [
    reliabilityResult({
      area: 'collision',
      check: 'strict ambiguous fallback skips instead of guessing',
      status: ambiguousEvents.length ? 'PASS' : 'CHECK',
      detail: ambiguousEvents.length
        ? `${ambiguousEvents.length} ambiguous fallback event(s) found and skipped.`
        : 'No ambiguous fallback event found in the current query window; run close-together manual clicks to validate again.'
    }),
    reliabilityResult({
      area: 'collision',
      check: 'deterministic partnerlinks_ref wins when present',
      status: deterministicEvents.length ? 'PASS' : 'CHECK',
      detail: deterministicEvents.length
        ? `${deterministicEvents.length} deterministic non-fallback conversion event(s) found.`
        : 'No deterministic non-fallback conversion event found in the current query window.'
    }),
    reliabilityResult({
      area: 'collision',
      check: 'multiple creator click clusters are visible for operator review',
      status: clusters.length ? 'PASS' : 'CHECK',
      detail: clusters.length
        ? `${clusters.length} close-together multi-creator click cluster(s) found.`
        : 'No close-together multi-creator click cluster found in recent test clicks.'
    })
  ];
}

async function analyzeReplayIdempotency({
  conversions,
  attributionEvents,
  networkEarnings,
  brandNetworkEarnings
}) {
  printHeader('Replay / Idempotency Diagnostics');
  const conversionsByOrder = groupBy(conversions, (row) => row.order_id);
  const duplicateConversionGroups = [...conversionsByOrder.entries()].filter(([, rows]) => rows.length > 1);
  const duplicateDiagnostics = attributionEvents.filter((event) => event.duplicate_order || event.decision === 'duplicate_skipped');
  const duplicateNetworkRows = findDuplicateEarningRows(networkEarnings, ['earning_creator_id', 'source_creator_id', 'conversion_id', 'level']);
  const duplicateBrandRows = findDuplicateEarningRows(brandNetworkEarnings, ['earning_brand_id', 'source_creator_id', 'conversion_id', 'level']);

  printRows('Duplicate Diagnostic Events', duplicateDiagnostics, (event) => ({
    id: event.id,
    order_id: event.order_id,
    decision: event.decision,
    duplicate_order: event.duplicate_order,
    unmatched_reason: event.unmatched_reason,
    created_at: event.created_at
  }));

  return [
    reliabilityResult({
      area: 'idempotency',
      check: 'no duplicate conversions for same order id in scoped results',
      status: duplicateConversionGroups.length ? 'FAIL' : 'PASS',
      detail: duplicateConversionGroups.length
        ? `${duplicateConversionGroups.length} duplicated order id group(s) found.`
        : 'No duplicate conversion order_id groups found in scoped results.'
    }),
    reliabilityResult({
      area: 'idempotency',
      check: 'duplicate webhook diagnostics are explainable when present',
      status: duplicateDiagnostics.length ? 'PASS' : 'CHECK',
      detail: duplicateDiagnostics.length
        ? `${duplicateDiagnostics.length} duplicate_skipped diagnostic event(s) found.`
        : 'No duplicate webhook replay diagnostic found in scoped results; replay can be tested manually with the original Shopify webhook payload.'
    }),
    reliabilityResult({
      area: 'idempotency',
      check: 'no duplicate creator network earnings rows for conversion/level',
      status: duplicateNetworkRows.length ? 'FAIL' : 'PASS',
      detail: duplicateNetworkRows.length
        ? `${duplicateNetworkRows.length} duplicate creator network earning key(s) found.`
        : 'No duplicate creator network earning keys found.'
    }),
    reliabilityResult({
      area: 'idempotency',
      check: 'no duplicate brand network earnings rows for conversion/level',
      status: duplicateBrandRows.length ? 'FAIL' : 'PASS',
      detail: duplicateBrandRows.length
        ? `${duplicateBrandRows.length} duplicate brand network earning key(s) found.`
        : 'No duplicate brand network earning keys found.'
    })
  ];
}

async function analyzePayoutLifecycle({ creators, conversions, networkEarnings }) {
  printHeader('Payout Lifecycle Diagnostics');
  const creatorIds = creators.map((creator) => creator.id);
  const claims = await getCreatorClaims({ creatorIds });
  const reservedRows = [
    ...conversions.filter((row) => row.claim_batch_id && row.payout_status !== 'claimed'),
    ...networkEarnings.filter((row) => row.claim_batch_id && row.payout_status !== 'claimed')
  ];
  const claimedRowsMissingTimestamp = [
    ...conversions.filter((row) => row.payout_status === 'claimed' && !row.claimed_at),
    ...networkEarnings.filter((row) => row.payout_status === 'claimed' && !row.claimed_at)
  ];
  const claimTotalsById = new Map(claims.map((claim) => [claim.id, Number(claim.total_claimed_amount || 0)]));
  const claimedRowTotalsByBatch = sumClaimedRowsByBatch({ conversions, networkEarnings });
  const mismatchedClaims = [];
  for (const [claimBatchId, rowTotal] of claimedRowTotalsByBatch.entries()) {
    const claimTotal = claimTotalsById.get(claimBatchId);
    if (claimTotal != null && roundCurrency(claimTotal) !== roundCurrency(rowTotal)) {
      mismatchedClaims.push({ claimBatchId, claimTotal, rowTotal: roundCurrency(rowTotal) });
    }
  }

  printRows('Creator Claim Ledger Rows', claims, (claim) => ({
    id: claim.id,
    creator_id: claim.creator_id,
    total_claimed_amount: claim.total_claimed_amount,
    status: claim.status,
    stripe_transfer_id: claim.stripe_transfer_id,
    stripe_transfer_status: claim.stripe_transfer_status,
    created_at: claim.created_at
  }));

  return [
    reliabilityResult({
      area: 'payout',
      check: 'claim ledger exists for claimed/processed payouts',
      status: claims.length ? 'PASS' : 'CHECK',
      detail: claims.length
        ? `${claims.length} creator_earning_claims row(s) found for test creators.`
        : 'No claim ledger rows found for test creators yet.'
    }),
    reliabilityResult({
      area: 'payout',
      check: 'no stuck reserved claim batches in scoped rows',
      status: reservedRows.length ? 'CHECK' : 'PASS',
      detail: reservedRows.length
        ? `${reservedRows.length} row(s) have claim_batch_id while not claimed; inspect for in-progress or interrupted claim.`
        : 'No non-claimed rows with claim_batch_id found.'
    }),
    reliabilityResult({
      area: 'payout',
      check: 'claimed rows have claimed_at timestamps',
      status: claimedRowsMissingTimestamp.length ? 'FAIL' : 'PASS',
      detail: claimedRowsMissingTimestamp.length
        ? `${claimedRowsMissingTimestamp.length} claimed row(s) missing claimed_at.`
        : 'All scoped claimed rows include claimed_at when present.'
    }),
    reliabilityResult({
      area: 'payout',
      check: 'claim ledger totals match claimed row totals',
      status: mismatchedClaims.length ? 'FAIL' : 'PASS',
      detail: mismatchedClaims.length
        ? `${mismatchedClaims.length} claim total mismatch(es): ${JSON.stringify(mismatchedClaims)}`
        : 'No claim ledger total mismatches found in scoped rows.'
    })
  ];
}

async function analyzeAttributionStress({ context, creators, clicks, attributionEvents }) {
  printHeader('Attribution Persistence Stress Diagnostics');
  const creatorCodes = creators.map((creator) => normalizeCode(creator.creator_code));
  const recentClicks = clicks.length ? clicks : await getRecentTestClicks({ creatorCodes, limit: 200 });
  const repeatedClickGroups = [...groupBy(recentClicks, (click) => [
    click.creator_code || click.creator_id,
    click.product_slug || 'no-product',
    click.shop_domain || 'no-shop'
  ].join('|')).entries()].filter(([, rows]) => rows.length > 1);
  const missingPartnerlinksRefClicks = recentClicks.filter((click) => !click.partnerlinks_ref);
  const deterministicEvents = attributionEvents.filter((event) => (
    event.decision === 'conversion_created' &&
    event.partnerlinks_ref &&
    event.fallback_used === false
  ));
  const fallbackEvents = attributionEvents.filter((event) => event.fallback_used);
  const unmatchedEvents = attributionEvents.filter((event) => event.decision === 'skipped');

  printRows('Repeated Click Groups', repeatedClickGroups.slice(0, 10), ([key, rows]) => ({
    key,
    click_count: rows.length,
    first_click_at: rows[rows.length - 1].created_at,
    last_click_at: rows[0].created_at,
    partnerlinks_refs: unique(rows.map((row) => row.partnerlinks_ref)).slice(0, 5)
  }));

  return [
    reliabilityResult({
      area: 'attribution',
      check: 'test clicks persist partnerlinks_ref',
      status: missingPartnerlinksRefClicks.length ? 'FAIL' : 'PASS',
      detail: missingPartnerlinksRefClicks.length
        ? `${missingPartnerlinksRefClicks.length} recent test click(s) missing partnerlinks_ref.`
        : 'All recent test clicks include partnerlinks_ref.'
    }),
    reliabilityResult({
      area: 'attribution',
      check: 'deterministic Shopify attributes can avoid fallback',
      status: deterministicEvents.length ? 'PASS' : 'CHECK',
      detail: deterministicEvents.length
        ? `${deterministicEvents.length} non-fallback conversion event(s) found.`
        : 'No non-fallback conversion event found in current query; confirm cart permalink env/deploy before next checkout.'
    }),
    reliabilityResult({
      area: 'attribution',
      check: 'fallback events remain visible and confidence-labeled',
      status: fallbackEvents.every((event) => event.attribution_confidence === 'low' || event.decision === 'skipped') ? 'PASS' : 'CHECK',
      detail: `${fallbackEvents.length} fallback event(s), ${unmatchedEvents.length} skipped/unmatched event(s).`
    }),
    reliabilityResult({
      area: 'attribution',
      check: 'current test target URL',
      status: 'INFO',
      detail: `${PUBLIC_BASE_URL}/r/${TEST_BRAND_SLUG}/test-creator-04/${TEST_PRODUCT_SLUG}; brand=${context.brand ? context.brand.id : 'none'}`
    })
  ];
}

async function getShopifyStore(shopDomain) {
  const { data, error } = await supabase
    .from('shopify_stores')
    .select('*')
    .eq('shop_domain', shopDomain)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getBrand(brandId) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getLatestBrand() {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getTestCreators() {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .in('creator_code', TEST_CODES)
    .order('creator_code', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function insertCreator(payload) {
  assertTestCreatorPayload(payload);
  const { data, error } = await supabase
    .from('creators')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateCreator(creatorId, updates) {
  if (!Object.keys(updates).length) return null;
  const { data: currentRows, error: currentError } = await supabase
    .from('creators')
    .select('id, creator_code')
    .eq('id', creatorId)
    .limit(1);
  if (currentError) throw currentError;
  const current = currentRows ? currentRows[0] : null;
  assertTestCreator(current);

  const { data, error } = await supabase
    .from('creators')
    .update(updates)
    .eq('id', creatorId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getClicks({ creatorIds, orderId }) {
  const ids = creatorIds.length ? creatorIds : [-1];
  let query = supabase
    .from('clicks')
    .select('*')
    .in('creator_id', ids)
    .order('created_at', { ascending: false })
    .limit(50);

  if (orderId) {
    const events = await getAttributionEvents({ orderId, creatorCodes: [] });
    const clickIds = unique(events.flatMap((event) => [event.click_id, event.recent_click_id].filter(Boolean)));
    if (clickIds.length) {
      query = supabase
        .from('clicks')
        .select('*')
        .in('id', clickIds)
        .order('created_at', { ascending: false });
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getAttributionSessions({ creatorIds, clicks }) {
  const sessionRows = [];
  if (creatorIds.length) {
    const { data, error } = await supabase
      .from('attribution_sessions')
      .select('*')
      .in('current_creator_id', creatorIds)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    sessionRows.push(...(data || []));
  }

  const clickIds = unique((clicks || []).map((click) => click.id));
  if (clickIds.length) {
    const { data, error } = await supabase
      .from('attribution_sessions')
      .select('*')
      .in('last_click_id', clickIds)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    sessionRows.push(...(data || []));
  }

  return uniqueById(sessionRows);
}

async function getConversions({ creatorIds, orderId }) {
  if (orderId) {
    const { data, error } = await supabase
      .from('conversions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  if (!creatorIds.length) return [];
  const { data, error } = await supabase
    .from('conversions')
    .select('*')
    .in('creator_id', creatorIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

async function getCreatorNetworkEarnings({ testCreatorIds, conversionIds }) {
  const rows = [];
  if (testCreatorIds.length) {
    const { data, error } = await supabase
      .from('creator_network_earnings')
      .select('*')
      .or(`earning_creator_id.in.(${testCreatorIds.join(',')}),source_creator_id.in.(${testCreatorIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    rows.push(...(data || []));
  }

  if (conversionIds.length) {
    const { data, error } = await supabase
      .from('creator_network_earnings')
      .select('*')
      .in('conversion_id', conversionIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    rows.push(...(data || []));
  }

  return uniqueById(rows);
}

async function getBrandNetworkEarnings({ conversionIds }) {
  if (!conversionIds.length) return [];
  const { data, error } = await supabase
    .from('brand_network_earnings')
    .select('*')
    .in('conversion_id', conversionIds)
    .order('created_at', { ascending: false });
  if (error && error.code === '42P01') return [];
  if (error) throw error;
  return data || [];
}

async function getAttributionEvents({ orderId, creatorCodes }) {
  let query = supabase
    .from('shopify_attribution_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (orderId) {
    query = query.or(`order_id.eq.${escapeFilter(orderId)},shopify_order_id.eq.${escapeFilter(orderId)}`);
  } else if (creatorCodes.length) {
    query = query.in('matched_creator_code', creatorCodes.map(normalizeCode));
  }

  const { data, error } = await query;
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

async function getRecentTestClicks({ creatorCodes, limit = 200 }) {
  const normalizedCreatorCodes = (creatorCodes || []).map(normalizeCode).filter(Boolean);
  if (!normalizedCreatorCodes.length) return [];

  const { data, error } = await supabase
    .from('clicks')
    .select('*')
    .in('creator_code', normalizedCreatorCodes)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getCreatorClaims({ creatorIds }) {
  if (!creatorIds.length) return [];
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .select('*')
    .in('creator_id', creatorIds)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

function printRows(title, rows, mapper) {
  printHeader(`${title} (${rows.length})`);
  if (!rows.length) {
    console.log('none');
    return;
  }
  for (const row of rows) {
    console.log(JSON.stringify(mapper(row), null, 2));
  }
}

function assertTestCreatorPayload(payload) {
  if (!payload || !isAllowedTestCode(payload.creator_code) || !isAllowedTestCode(payload.referral_code)) {
    throw new Error(`Refusing unsafe test creator payload: ${JSON.stringify(payload)}`);
  }
}

function assertTestCreator(creator) {
  if (!creator || !isAllowedTestCode(creator.creator_code)) {
    throw new Error(`Refusing to modify non-test creator: ${creator ? creator.creator_code : 'missing'}`);
  }
}

function isAllowedTestCode(value) {
  return TEST_CODES.includes(normalizeCode(value));
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function uniqueById(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    if (row && row.id != null) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function escapeFilter(value) {
  return String(value || '').replace(/,/g, '\\,').replace(/\)/g, '\\)');
}

function buildClickCollisionClusters(clicks, windowMs) {
  const sorted = [...(clicks || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const clusters = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const base = sorted[index];
    const baseTime = new Date(base.created_at).getTime();
    const clusterRows = sorted.filter((candidate) => {
      if ((candidate.shop_domain || '') !== (base.shop_domain || '')) return false;
      if ((candidate.product_slug || '') !== (base.product_slug || '')) return false;
      const candidateTime = new Date(candidate.created_at).getTime();
      return Math.abs(candidateTime - baseTime) <= windowMs;
    });
    const creators = unique(clusterRows.map((row) => normalizeCode(row.creator_code)));
    if (creators.length < 2) continue;

    const first = clusterRows[0];
    const last = clusterRows[clusterRows.length - 1];
    clusters.push({
      shop_domain: base.shop_domain || null,
      product_slug: base.product_slug || null,
      click_count: clusterRows.length,
      creators,
      first_click_at: first.created_at,
      last_click_at: last.created_at,
      window_seconds: Math.round((new Date(last.created_at) - new Date(first.created_at)) / 1000)
    });
  }

  return uniqueCollisionClusters(clusters);
}

function uniqueCollisionClusters(clusters) {
  const seen = new Set();
  const uniqueClusters = [];
  for (const cluster of clusters) {
    const key = [
      cluster.shop_domain,
      cluster.product_slug,
      cluster.creators.join(','),
      cluster.first_click_at,
      cluster.last_click_at
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueClusters.push(cluster);
  }
  return uniqueClusters;
}

function findDuplicateEarningRows(rows, keys) {
  const groups = groupBy(rows || [], (row) => keys.map((key) => row[key] ?? 'null').join('|'));
  return [...groups.entries()]
    .filter(([, groupRows]) => groupRows.length > 1)
    .map(([key, groupRows]) => ({ key, count: groupRows.length, ids: groupRows.map((row) => row.id) }));
}

function sumClaimedRowsByBatch({ conversions, networkEarnings }) {
  const totals = new Map();
  for (const row of [...(conversions || []), ...(networkEarnings || [])]) {
    if (row.payout_status !== 'claimed' || !row.claim_batch_id) continue;
    const current = totals.get(row.claim_batch_id) || 0;
    totals.set(row.claim_batch_id, roundCurrency(current + Number(row.commission_amount || 0)));
  }
  return totals;
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function reliabilityResult({ area, check, status, detail }) {
  return { area, check, status, detail };
}

function printReliabilitySummary(results) {
  printHeader('Reliability Summary');
  const counts = results.reduce((memo, row) => {
    memo[row.status] = (memo[row.status] || 0) + 1;
    return memo;
  }, {});
  console.log(JSON.stringify(counts, null, 2));
}

function printManualReliabilityChecklist() {
  printHeader('Manual Reliability Test Checklist');
  console.log(JSON.stringify({
    collision: [
      'Open /r/aria-wellness/test-creator-05/test-product and /r/aria-wellness/test-creator-06/test-product close together in separate browsers.',
      'Complete only one checkout.',
      'Run --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:{order_id}.',
      'Expected: exact partnerlinks_ref wins if cart attributes survived; otherwise ambiguous fallback skips instead of guessing.'
    ],
    replay: [
      'Use Shopify/Railway webhook replay only with the original signed payload if available.',
      'Expected: duplicate_skipped diagnostic, no second conversion, no duplicate network rows.'
    ],
    payout: [
      'Only use Stripe test mode.',
      'Claim only when Stripe payouts are enabled and claimable > 0.',
      'Expected: claim ledger row, no duplicate transfer on retry, claimed rows keep claim_batch_id and claimed_at.'
    ],
    stress: [
      'Repeat same creator/product clicks multiple times.',
      'Try delayed checkout after the click.',
      'Expected: clicks keep partnerlinks_ref; exact cart/order attributes avoid fallback; fallback remains visible and low confidence when used.'
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error('\nProduction safety test failed:');
  console.error(error);
  process.exit(1);
});
