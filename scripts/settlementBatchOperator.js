#!/usr/bin/env node

const crypto = require('crypto');
const supabase = require('../database/database/supabase');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    report: false,
    createDraft: false,
    reviewDraft: false,
    verifyReconciliation: false,
    brandId: null,
    shopDomain: null,
    batchId: null,
    orderIds: [],
    dateFrom: null,
    dateTo: null,
    batchKey: null,
    operator: null,
    notes: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--report') args.report = true;
    else if (arg === '--create-draft') args.createDraft = true;
    else if (arg === '--review-draft') args.reviewDraft = true;
    else if (arg === '--verify-reconciliation') args.verifyReconciliation = true;
    else if (arg === '--brand-id') {
      args.brandId = argv[index + 1] ? Number(argv[index + 1]) : null;
      index += 1;
    } else if (arg === '--batch-id') {
      args.batchId = sanitizeUuid(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--shop-domain') {
      args.shopDomain = normalizeShopDomain(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--order-id') {
      args.orderIds.push(...splitList(argv[index + 1] || ''));
      index += 1;
    } else if (arg === '--date-from') {
      args.dateFrom = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--date-to') {
      args.dateTo = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--batch-key') {
      args.batchKey = sanitizeKey(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--operator') {
      args.operator = String(argv[index + 1] || '').trim();
      index += 1;
    } else if (arg === '--notes') {
      args.notes = String(argv[index + 1] || '').trim();
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  args.orderIds = unique(args.orderIds.map((orderId) => String(orderId).trim()).filter(Boolean));

  if (!args.dryRun && !args.createDraft && !args.reviewDraft) args.dryRun = true;
  if (args.createDraft && args.dryRun) {
    throw new Error('Use either --dry-run or --create-draft, not both.');
  }
  if (args.createDraft && args.reviewDraft) {
    throw new Error('Use either --create-draft or --review-draft, not both.');
  }
  if (!args.report && !args.createDraft && !args.reviewDraft && !args.verifyReconciliation) args.report = true;
  if (args.reviewDraft && !args.batchId && !args.batchKey) {
    throw new Error('Provide --batch-id or --batch-key for --review-draft.');
  }
  if (!args.reviewDraft && !args.brandId && !args.shopDomain) {
    throw new Error('Provide --brand-id or --shop-domain.');
  }
  if (args.reviewDraft && !args.dryRun && !args.operator) {
    throw new Error('--operator is required when writing --review-draft.');
  }
  if (args.brandId && (!Number.isInteger(args.brandId) || args.brandId <= 0)) {
    throw new Error('--brand-id must be a positive integer.');
  }
  if (args.dateFrom && !isIsoDate(args.dateFrom)) throw new Error('--date-from must be YYYY-MM-DD.');
  if (args.dateTo && !isIsoDate(args.dateTo)) throw new Error('--date-to must be YYYY-MM-DD.');

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  printHeader('PartnerLinks Settlement Batch Operator');
  console.log(`Mode: ${getOperatorMode(args)}`);
  console.log(`Flags: ${process.argv.slice(2).join(' ') || '--dry-run --report (implicit)'}`);

  if (args.reviewDraft) {
    const result = await reviewDraftSettlementBatch(args);
    printReviewDraftResult(result);
    printHeader('Done');
    return;
  }

  const context = await resolveContext(args);
  const proposal = await buildSettlementProposal(context, args);

  printProposal(proposal);

  if (args.verifyReconciliation) {
    const verification = await verifySettlementReconciliation(proposal);
    printReconciliationVerification(verification);
  }

  if (args.createDraft) {
    const result = await createDraftSettlementBatch(proposal, args);
    printMutationResult(result);
  }

  printHeader('Done');
}

async function verifySettlementReconciliation(proposal) {
  const [allItems, allAuditEvents] = await Promise.all([
    getSettlementItemsForBrand(proposal.context.brand.id),
    getSettlementAuditEventsForBrand(proposal.context.brand.id)
  ]);
  const expectedByKey = new Map(proposal.items.map((item) => [item.idempotency_key, item]));
  const batchItems = proposal.existing.batch
    ? allItems.filter((item) => item.settlement_batch_id === proposal.existing.batch.id)
    : [];
  const batchItemsByKey = new Map(batchItems.map((item) => [item.idempotency_key, item]));
  const missingExpectedItems = proposal.items.filter((item) => !batchItemsByKey.has(item.idempotency_key));
  const unexpectedBatchItems = batchItems.filter((item) => !expectedByKey.has(item.idempotency_key));
  const mismatchedItems = batchItems
    .map((item) => compareSettlementItemToExpected(item, expectedByKey.get(item.idempotency_key)))
    .filter(Boolean);
  const duplicateItemKeys = duplicateGroups(allItems, (item) => item.idempotency_key);
  const duplicateAuditKeys = duplicateGroups(allAuditEvents, (event) => event.idempotency_key);
  const orphanItems = await findOrphanSettlementItems(allItems);
  const multiBatchAssignments = findMultiBatchSourceAssignments(allItems);
  const creatorLevelViolations = proposal.creatorNetworkEarnings.filter((earning) => Number(earning.level || 0) > 3);
  const brandLevelViolations = proposal.brandNetworkEarnings.filter((earning) => Number(earning.level || 0) > 3);
  const selfGeneratedCreatorOverrides = proposal.creatorNetworkEarnings.filter((earning) => (
    earning.earning_creator_id && earning.source_creator_id && Number(earning.earning_creator_id) === Number(earning.source_creator_id)
  ));
  const batchFundingCheck = proposal.existing.batch
    ? checkBatchFundingTotals(proposal.existing.batch, batchItems)
    : {
      status: 'CHECK',
      reason: 'No existing settlement batch for this deterministic scope; dry-run proposal only.'
    };

  return {
    proposal,
    allItems,
    allAuditEvents,
    batchItems,
    missingExpectedItems,
    unexpectedBatchItems,
    mismatchedItems,
    duplicateItemKeys,
    duplicateAuditKeys,
    orphanItems,
    multiBatchAssignments,
    creatorLevelViolations,
    brandLevelViolations,
    selfGeneratedCreatorOverrides,
    batchFundingCheck,
    summary: buildReconciliationSummary({
      proposal,
      batchItems,
      missingExpectedItems,
      unexpectedBatchItems,
      mismatchedItems,
      duplicateItemKeys,
      duplicateAuditKeys,
      orphanItems,
      multiBatchAssignments,
      creatorLevelViolations,
      brandLevelViolations,
      selfGeneratedCreatorOverrides,
      batchFundingCheck
    })
  };
}

async function resolveContext(args) {
  let brand = null;
  let store = null;

  if (args.brandId) {
    brand = await getBrand(args.brandId);
    if (!brand) throw new Error(`No brand found for brand_id=${args.brandId}`);
  }

  if (args.shopDomain) {
    store = await getShopifyStore(args.shopDomain);
    if (!store) throw new Error(`No Shopify store found for shop_domain=${args.shopDomain}`);
    if (!brand && store.brand_id) brand = await getBrand(store.brand_id);
  }

  if (!brand) throw new Error('Unable to resolve brand.');
  if (store && store.brand_id && Number(store.brand_id) !== Number(brand.id)) {
    throw new Error(`Brand/shop mismatch: brand_id=${brand.id}, shop_domain brand_id=${store.brand_id}`);
  }

  return {
    brand,
    shopDomain: args.shopDomain || normalizeShopDomain(brand.name || ''),
    store
  };
}

async function buildSettlementProposal(context, args) {
  const conversions = await getConversionsForBatch({
    brandId: context.brand.id,
    orderIds: args.orderIds,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo
  });
  const conversionIds = conversions.map((row) => row.id);
  const creatorNetworkEarnings = conversionIds.length
    ? await getCreatorNetworkEarnings(conversionIds)
    : [];
  const brandNetworkEarnings = conversionIds.length
    ? await getBrandNetworkEarnings(conversionIds)
    : [];

  const totals = calculateTotals({
    conversions,
    creatorNetworkEarnings,
    brandNetworkEarnings
  });
  const scope = {
    brand_id: context.brand.id,
    shop_domain: context.shopDomain,
    order_ids: args.orderIds,
    date_from: args.dateFrom,
    date_to: args.dateTo,
    conversion_ids: conversionIds
  };
  const batchKey = args.batchKey || buildBatchKey(scope);
  const items = buildSettlementItems({
    batchKey,
    brandId: context.brand.id,
    conversions,
    creatorNetworkEarnings,
    brandNetworkEarnings
  });
  const existing = await getExistingSettlementState(batchKey, items.map((item) => item.idempotency_key));

  return {
    batchKey,
    context,
    scope,
    conversions,
    creatorNetworkEarnings,
    brandNetworkEarnings,
    items,
    totals,
    existing,
    safety: {
      brand_charging: false,
      stripe_payment_intent: false,
      stripe_transfer: false,
      creator_payout: false,
      claim_release: false,
      payout_status_change: false,
      existing_financial_row_mutation: false
    }
  };
}

function buildSettlementItems({ batchKey, brandId, conversions, creatorNetworkEarnings, brandNetworkEarnings }) {
  const items = [];

  for (const conversion of conversions) {
    const directAmount = money(conversion.commission_amount);
    if (directAmount > 0) {
      items.push({
        idempotency_key: `${batchKey}:conversion:${conversion.id}:direct_commission`,
        brand_id: brandId,
        conversion_id: conversion.id,
        item_type: 'direct_commission',
        amount: directAmount,
        metadata: {
          order_id: conversion.order_id,
          creator_id: conversion.creator_id,
          source_table: 'conversions',
          source_amount_field: 'commission_amount'
        }
      });
    }

    const platformFeeAmount = money(conversion.platform_fee_amount);
    if (platformFeeAmount > 0) {
      items.push({
        idempotency_key: `${batchKey}:conversion:${conversion.id}:platform_fee`,
        brand_id: brandId,
        conversion_id: conversion.id,
        item_type: 'platform_fee',
        amount: platformFeeAmount,
        metadata: {
          order_id: conversion.order_id,
          creator_id: conversion.creator_id,
          source_table: 'conversions',
          source_amount_field: 'platform_fee_amount'
        }
      });
    }
  }

  for (const earning of creatorNetworkEarnings) {
    const amount = money(earning.commission_amount);
    if (amount <= 0) continue;
    items.push({
      idempotency_key: `${batchKey}:creator_network_earning:${earning.id}`,
      brand_id: brandId,
      creator_network_earning_id: earning.id,
      conversion_id: earning.conversion_id,
      item_type: 'creator_network_override',
      amount,
      metadata: {
        earning_creator_id: earning.earning_creator_id,
        source_creator_id: earning.source_creator_id,
        level: earning.level,
        source_table: 'creator_network_earnings',
        source_amount_field: 'commission_amount',
        funded_from: 'platform_fee_amount'
      }
    });
  }

  for (const earning of brandNetworkEarnings) {
    const amount = money(earning.commission_amount);
    if (amount <= 0) continue;
    items.push({
      idempotency_key: `${batchKey}:brand_network_earning:${earning.id}`,
      brand_id: brandId,
      brand_network_earning_id: earning.id,
      conversion_id: earning.conversion_id,
      item_type: 'brand_network_override',
      amount,
      metadata: {
        earning_brand_id: earning.earning_brand_id,
        source_creator_id: earning.source_creator_id,
        level: earning.level,
        source_table: 'brand_network_earnings',
        source_amount_field: 'commission_amount',
        funded_from: 'platform_fee_amount'
      }
    });
  }

  return items;
}

async function createDraftSettlementBatch(proposal, args) {
  const batch = await findOrCreateBatch(proposal, args);
  const items = await createMissingItems(batch, proposal, args);
  const auditEvents = await createMissingAuditEvents(batch, items, proposal, args);

  return {
    batch,
    items,
    auditEvents
  };
}

async function findOrCreateBatch(proposal, args) {
  const existing = await getSettlementBatchByKey(proposal.batchKey);
  if (existing) return { row: existing, created: false };

  const payload = {
    idempotency_key: proposal.batchKey,
    brand_id: proposal.context.brand.id,
    shop_domain: proposal.context.shopDomain,
    settlement_status: 'settlement_pending',
    settlement_method: 'manual',
    currency: 'USD',
    gross_amount: proposal.totals.brand_funding_obligation,
    collected_amount: 0,
    audit_notes: args.notes || 'Draft settlement batch created for operator reconciliation. No money movement.',
    metadata: {
      mode: 'operator_draft',
      review_status: 'pending_review',
      operator: args.operator || null,
      scope: proposal.scope,
      totals: proposal.totals,
      safety: proposal.safety
    }
  };

  const { data, error } = await supabase
    .from('settlement_batches')
    .insert(payload)
    .select()
    .single();

  if (error && error.code === '23505') {
    const row = await getSettlementBatchByKey(proposal.batchKey);
    return { row, created: false };
  }
  if (error) throw error;
  return { row: data, created: true };
}

async function createMissingItems(batch, proposal, args) {
  const results = [];
  const existingKeys = new Set(proposal.existing.items.map((row) => row.idempotency_key));
  for (const item of proposal.items) {
    if (existingKeys.has(item.idempotency_key)) {
      const existing = proposal.existing.items.find((row) => row.idempotency_key === item.idempotency_key);
      results.push({ row: existing, created: false });
      continue;
    }

    const payload = {
      idempotency_key: item.idempotency_key,
      settlement_batch_id: batch.row.id,
      brand_id: item.brand_id,
      conversion_id: item.conversion_id || null,
      creator_network_earning_id: item.creator_network_earning_id || null,
      brand_network_earning_id: item.brand_network_earning_id || null,
      item_type: item.item_type,
      settlement_status: 'settlement_pending',
      currency: 'USD',
      amount: item.amount,
      collected_amount: 0,
      risk_status: 'unreviewed',
      risk_review_status: 'pending_review',
      audit_notes: args.notes || 'Draft settlement item created for operator reconciliation. No money movement.',
      metadata: {
        ...item.metadata,
        operator: args.operator || null,
        batch_key: proposal.batchKey,
        safety: proposal.safety
      }
    };

    const { data, error } = await supabase
      .from('settlement_items')
      .insert(payload)
      .select()
      .single();

    if (error && error.code === '23505') {
      const existing = await getSettlementItemByKey(item.idempotency_key);
      results.push({ row: existing, created: false });
      continue;
    }
    if (error) throw error;
    results.push({ row: data, created: true });
  }
  return results;
}

async function createMissingAuditEvents(batch, itemResults, proposal, args) {
  const events = [
    {
      idempotency_key: `settlement_audit:${proposal.batchKey}:batch_created`,
      event_type: 'batch_created',
      settlement_batch_id: batch.row.id,
      brand_id: proposal.context.brand.id,
      shop_domain: proposal.context.shopDomain,
      financial_table: 'settlement_batches',
      to_status: 'settlement_pending',
      transition_reason: 'Draft settlement batch prepared for operator reconciliation.',
      evidence: {
        batch_created: batch.created,
        totals: proposal.totals,
        scope: proposal.scope
      }
    },
    ...itemResults.map((result) => ({
      idempotency_key: `settlement_audit:${proposal.batchKey}:item_created:${result.row.idempotency_key}`,
      event_type: 'item_created',
      settlement_batch_id: batch.row.id,
      settlement_item_id: result.row.id,
      brand_id: proposal.context.brand.id,
      shop_domain: proposal.context.shopDomain,
      financial_table: 'settlement_items',
      conversion_id: result.row.conversion_id,
      creator_network_earning_id: result.row.creator_network_earning_id,
      brand_network_earning_id: result.row.brand_network_earning_id,
      to_status: 'settlement_pending',
      transition_reason: 'Draft settlement item prepared for operator reconciliation.',
      evidence: {
        item_created: result.created,
        item_type: result.row.item_type,
        amount: result.row.amount,
        source_idempotency_key: result.row.idempotency_key
      }
    }))
  ];

  const results = [];
  for (const event of events) {
    const existing = await getSettlementAuditEventByKey(event.idempotency_key);
    if (existing) {
      results.push({ row: existing, created: false });
      continue;
    }

    const payload = {
      ...event,
      event_status: 'recorded',
      source_system: 'operator',
      transition_allowed: true,
      operator_actor: args.operator || null,
      operator_notes: args.notes || null,
      metadata: {
        mode: 'operator_draft',
        no_money_movement: true,
        safety: proposal.safety
      }
    };

    const { data, error } = await supabase
      .from('settlement_audit_events')
      .insert(payload)
      .select()
      .single();

    if (error && error.code === '23505') {
      const row = await getSettlementAuditEventByKey(event.idempotency_key);
      results.push({ row, created: false });
      continue;
    }
    if (error) throw error;
    results.push({ row: data, created: true });
  }
  return results;
}

async function reviewDraftSettlementBatch(args) {
  const batch = await getSettlementBatchForReview(args);
  const now = new Date().toISOString();
  const auditKey = batch ? `settlement_audit:${batch.id}:manually_reviewed` : null;
  const existingAuditEvent = auditKey ? await getSettlementAuditEventByKey(auditKey) : null;
  const reviewStatus = getBatchReviewStatus(batch);
  const safety = {
    charged_brand: false,
    created_stripe_payment_intent: false,
    created_stripe_transfer: false,
    released_claims: false,
    changed_payout_status: false,
    changed_claimability: false,
    changed_financial_rows: false,
    changed_settlement_collected_state: false
  };

  if (!batch) {
    return {
      mode: args.dryRun ? 'DRY RUN / READ ONLY' : 'WRITE REQUEST BLOCKED',
      status: 'BLOCKED',
      reason: 'No settlement batch found for the provided --batch-id or --batch-key.',
      batch: null,
      audit_event: null,
      safety
    };
  }

  if (batch.settlement_status !== 'settlement_pending') {
    return {
      mode: args.dryRun ? 'DRY RUN / READ ONLY' : 'WRITE REQUEST BLOCKED',
      status: 'BLOCKED',
      reason: `Only settlement_pending draft batches can be manually reviewed. Found settlement_status=${batch.settlement_status}.`,
      batch: reviewBatchSummary(batch),
      audit_event: existingAuditEvent ? { id: existingAuditEvent.id, idempotency_key: existingAuditEvent.idempotency_key, created: false } : null,
      safety
    };
  }

  if (reviewStatus === 'manually_reviewed') {
    const recoveryAuditEvent = existingAuditEvent || (!args.dryRun
      ? await createManualReviewAuditEvent({ batch, args, now, alreadyReviewed: true })
      : null);
    return {
      mode: args.dryRun ? 'DRY RUN / READ ONLY' : 'WRITE',
      status: 'ALREADY_REVIEWED',
      reason: 'Settlement batch is already marked manually_reviewed. No state change was made.',
      batch: reviewBatchSummary(batch),
      audit_event: recoveryAuditEvent ? {
        id: recoveryAuditEvent.id,
        idempotency_key: recoveryAuditEvent.idempotency_key,
        created: !existingAuditEvent
      } : (existingAuditEvent ? {
        id: existingAuditEvent.id,
        idempotency_key: existingAuditEvent.idempotency_key,
        created: false
      } : null),
      safety
    };
  }

  const nextMetadata = {
    ...(batch.metadata || {}),
    review_status: 'manually_reviewed',
    reviewed_at: now,
    reviewed_by: args.operator || null,
    review_notes: args.notes || null,
    review_audit_event_key: auditKey,
    review_no_money_movement: true
  };

  if (args.dryRun) {
    return {
      mode: 'DRY RUN / READ ONLY',
      status: 'WOULD_REVIEW',
      reason: 'Dry-run only. No settlement batch or audit rows were mutated.',
      batch: {
        ...reviewBatchSummary(batch),
        before_review_status: reviewStatus,
        after_review_status: 'manually_reviewed'
      },
      audit_event: {
        idempotency_key: auditKey,
        would_create: !existingAuditEvent,
        existing: Boolean(existingAuditEvent)
      },
      metadata_preview: nextMetadata,
      safety
    };
  }

  const updatedBatch = await updateBatchManualReviewMetadata({
    batch,
    nextMetadata,
    notes: args.notes,
    now
  });
  const auditEvent = existingAuditEvent || await createManualReviewAuditEvent({
    batch: updatedBatch,
    args,
    now,
    alreadyReviewed: false,
    fromReviewStatus: reviewStatus
  });

  return {
    mode: 'WRITE',
    status: 'REVIEWED',
    reason: 'Settlement batch was marked manually_reviewed for operator reconciliation only. Funding and payout states remain unchanged.',
    batch: {
      ...reviewBatchSummary(updatedBatch),
      before_review_status: reviewStatus,
      after_review_status: getBatchReviewStatus(updatedBatch)
    },
    audit_event: {
      id: auditEvent.id,
      idempotency_key: auditEvent.idempotency_key,
      created: !existingAuditEvent
    },
    safety
  };
}

async function getSettlementBatchForReview(args) {
  if (args.batchId) return getSettlementBatchById(args.batchId);
  if (args.batchKey) return getSettlementBatchByKey(args.batchKey);
  return null;
}

async function updateBatchManualReviewMetadata({ batch, nextMetadata, notes, now }) {
  const { data, error } = await supabase
    .from('settlement_batches')
    .update({
      metadata: nextMetadata,
      audit_notes: notes || batch.audit_notes || 'Settlement batch manually reviewed by operator. No money movement.',
      updated_at: now
    })
    .eq('id', batch.id)
    .eq('settlement_status', 'settlement_pending')
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function createManualReviewAuditEvent({
  batch,
  args,
  now,
  alreadyReviewed,
  fromReviewStatus = null
}) {
  const reviewStatus = fromReviewStatus || getBatchReviewStatus(batch);
  const payload = {
    idempotency_key: `settlement_audit:${batch.id}:manually_reviewed`,
    event_type: 'batch_status_transition',
    event_status: alreadyReviewed ? 'ignored' : 'recorded',
    source_system: 'operator',
    settlement_batch_id: batch.id,
    brand_id: batch.brand_id,
    shop_domain: batch.shop_domain,
    financial_table: 'settlement_batches',
    from_status: batch.settlement_status,
    to_status: batch.settlement_status,
    transition_allowed: !alreadyReviewed,
    transition_reason: alreadyReviewed
      ? 'Manual review transition replay observed after batch was already reviewed. No state change made.'
      : 'Draft settlement batch marked manually_reviewed for operator reconciliation. This does not indicate funding collection.',
    operator_actor: args.operator || null,
    operator_notes: args.notes || null,
    evidence: {
      batch_id: batch.id,
      batch_key: batch.idempotency_key,
      before_settlement_status: batch.settlement_status,
      after_settlement_status: batch.settlement_status,
      before_review_status: reviewStatus,
      after_review_status: 'manually_reviewed',
      reviewed_at: now,
      no_money_movement: true,
      no_claim_release: true,
      already_reviewed: Boolean(alreadyReviewed)
    },
    metadata: {
      mode: 'operator_manual_review',
      review_status: 'manually_reviewed',
      no_money_movement: true
    }
  };

  const { data, error } = await supabase
    .from('settlement_audit_events')
    .insert(payload)
    .select()
    .single();

  if (error && error.code === '23505') {
    return getSettlementAuditEventByKey(payload.idempotency_key);
  }
  if (error) throw error;
  return data;
}

async function getConversionsForBatch({ brandId, orderIds, dateFrom, dateTo }) {
  let query = supabase
    .from('conversions')
    .select('id, brand_id, creator_id, order_id, order_value, commission_rate, commission_amount, platform_fee_amount, payout_status, claimable_at, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });

  if (orderIds.length) query = query.in('order_id', orderIds);
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getCreatorNetworkEarnings(conversionIds) {
  const { data, error } = await supabase
    .from('creator_network_earnings')
    .select('id, earning_creator_id, source_creator_id, conversion_id, level, platform_fee_amount, commission_rate, commission_amount, payout_status, created_at')
    .in('conversion_id', conversionIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getBrandNetworkEarnings(conversionIds) {
  const { data, error } = await supabase
    .from('brand_network_earnings')
    .select('id, earning_brand_id, source_creator_id, conversion_id, level, platform_fee_amount, commission_rate, commission_amount, payout_status, created_at')
    .in('conversion_id', conversionIds)
    .order('created_at', { ascending: true });
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
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

async function getExistingSettlementState(batchKey, itemKeys) {
  const [batch, items] = await Promise.all([
    getSettlementBatchByKey(batchKey),
    getSettlementItemsByKeys(itemKeys)
  ]);
  return {
    batch,
    items
  };
}

async function getSettlementBatchByKey(idempotencyKey) {
  const { data, error } = await supabase
    .from('settlement_batches')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getSettlementBatchById(batchId) {
  const { data, error } = await supabase
    .from('settlement_batches')
    .select('*')
    .eq('id', batchId)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getSettlementItemsByKeys(idempotencyKeys) {
  if (!idempotencyKeys.length) return [];
  const { data, error } = await supabase
    .from('settlement_items')
    .select('*')
    .in('idempotency_key', idempotencyKeys);
  if (error) throw error;
  return data || [];
}

async function getSettlementItemByKey(idempotencyKey) {
  const { data, error } = await supabase
    .from('settlement_items')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getSettlementAuditEventByKey(idempotencyKey) {
  const { data, error } = await supabase
    .from('settlement_audit_events')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getSettlementItemsForBrand(brandId) {
  const { data, error } = await supabase
    .from('settlement_items')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getSettlementAuditEventsForBrand(brandId) {
  const { data, error } = await supabase
    .from('settlement_audit_events')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function findOrphanSettlementItems(items) {
  const batchIds = unique(items.map((item) => item.settlement_batch_id).filter(Boolean));
  const conversionIds = unique(items.map((item) => item.conversion_id).filter(Boolean));
  const creatorNetworkIds = unique(items.map((item) => item.creator_network_earning_id).filter(Boolean));
  const brandNetworkIds = unique(items.map((item) => item.brand_network_earning_id).filter(Boolean));
  const [batches, conversions, creatorNetwork, brandNetwork] = await Promise.all([
    getRowsByIds('settlement_batches', batchIds),
    getRowsByIds('conversions', conversionIds),
    getRowsByIds('creator_network_earnings', creatorNetworkIds),
    getRowsByIds('brand_network_earnings', brandNetworkIds)
  ]);
  const batchSet = new Set(batches.map((row) => row.id));
  const conversionSet = new Set(conversions.map((row) => row.id));
  const creatorNetworkSet = new Set(creatorNetwork.map((row) => row.id));
  const brandNetworkSet = new Set(brandNetwork.map((row) => row.id));

  return items
    .map((item) => {
      const reasons = [];
      if (item.settlement_batch_id && !batchSet.has(item.settlement_batch_id)) reasons.push('missing settlement_batch');
      if (item.conversion_id && !conversionSet.has(item.conversion_id)) reasons.push('missing conversion');
      if (item.creator_network_earning_id && !creatorNetworkSet.has(item.creator_network_earning_id)) reasons.push('missing creator_network_earning');
      if (item.brand_network_earning_id && !brandNetworkSet.has(item.brand_network_earning_id)) reasons.push('missing brand_network_earning');
      if (!item.conversion_id && !item.creator_network_earning_id && !item.brand_network_earning_id) reasons.push('no source financial row reference');
      return reasons.length ? { item, reasons } : null;
    })
    .filter(Boolean);
}

async function getRowsByIds(table, ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .in('id', ids);
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

function compareSettlementItemToExpected(item, expected) {
  if (!expected) return null;
  const mismatches = [];
  if (item.item_type !== expected.item_type) mismatches.push(`item_type expected ${expected.item_type}, found ${item.item_type}`);
  if (money(item.amount) !== money(expected.amount)) mismatches.push(`amount expected ${expected.amount}, found ${item.amount}`);
  if (numberOrNull(item.conversion_id) !== numberOrNull(expected.conversion_id)) mismatches.push('conversion_id mismatch');
  if (numberOrNull(item.creator_network_earning_id) !== numberOrNull(expected.creator_network_earning_id)) mismatches.push('creator_network_earning_id mismatch');
  if (numberOrNull(item.brand_network_earning_id) !== numberOrNull(expected.brand_network_earning_id)) mismatches.push('brand_network_earning_id mismatch');
  return mismatches.length ? { item, expected, mismatches } : null;
}

function findMultiBatchSourceAssignments(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = getSettlementItemSourceKey(item);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  return [...grouped.entries()]
    .map(([key, rows]) => ({
      key,
      settlement_batch_ids: unique(rows.map((row) => row.settlement_batch_id).filter(Boolean)),
      rows
    }))
    .filter((group) => group.settlement_batch_ids.length > 1);
}

function getSettlementItemSourceKey(item) {
  if (item.item_type === 'direct_commission' || item.item_type === 'platform_fee') {
    return item.conversion_id ? `conversion:${item.conversion_id}:${item.item_type}` : null;
  }
  if (item.item_type === 'creator_network_override') {
    return item.creator_network_earning_id ? `creator_network_earning:${item.creator_network_earning_id}` : null;
  }
  if (item.item_type === 'brand_network_override') {
    return item.brand_network_earning_id ? `brand_network_earning:${item.brand_network_earning_id}` : null;
  }
  return null;
}

function checkBatchFundingTotals(batch, batchItems) {
  const directCommission = sumMoney(batchItems.filter((item) => item.item_type === 'direct_commission'), 'amount');
  const platformFee = sumMoney(batchItems.filter((item) => item.item_type === 'platform_fee'), 'amount');
  const networkOverrides = sumMoney(batchItems.filter((item) => (
    item.item_type === 'creator_network_override' || item.item_type === 'brand_network_override'
  )), 'amount');
  const expectedFunding = money(directCommission + platformFee);
  const batchGrossAmount = money(batch.gross_amount);
  const status = batchGrossAmount === expectedFunding ? 'PASS' : 'FAIL';

  return {
    status,
    batch_gross_amount: batchGrossAmount,
    expected_brand_funding_obligation: expectedFunding,
    direct_commission_total: directCommission,
    platform_fee_total: platformFee,
    network_override_total: networkOverrides,
    network_override_treatment: 'allocation visibility only; not added to brand funding obligation'
  };
}

function buildReconciliationSummary({
  proposal,
  batchItems,
  missingExpectedItems,
  unexpectedBatchItems,
  mismatchedItems,
  duplicateItemKeys,
  duplicateAuditKeys,
  orphanItems,
  multiBatchAssignments,
  creatorLevelViolations,
  brandLevelViolations,
  selfGeneratedCreatorOverrides,
  batchFundingCheck
}) {
  const rows = [
    {
      check: 'existing deterministic batch for scope',
      status: proposal.existing.batch ? 'PASS' : 'CHECK',
      detail: proposal.existing.batch ? proposal.existing.batch.id : 'No existing batch; dry-run proposal can still be reviewed.'
    },
    {
      check: 'settlement item completeness for existing batch',
      status: !proposal.existing.batch ? 'CHECK' : (missingExpectedItems.length ? 'FAIL' : 'PASS'),
      expected_item_count: proposal.items.length,
      actual_batch_item_count: batchItems.length,
      missing_count: missingExpectedItems.length
    },
    {
      check: 'no unexpected settlement items in batch',
      status: unexpectedBatchItems.length ? 'FAIL' : 'PASS',
      count: unexpectedBatchItems.length
    },
    {
      check: 'settlement item amounts and source references match recomputation',
      status: mismatchedItems.length ? 'FAIL' : 'PASS',
      count: mismatchedItems.length
    },
    {
      check: 'no duplicate settlement item idempotency keys',
      status: duplicateItemKeys.length ? 'FAIL' : 'PASS',
      count: duplicateItemKeys.length
    },
    {
      check: 'no duplicate settlement audit idempotency keys',
      status: duplicateAuditKeys.length ? 'FAIL' : 'PASS',
      count: duplicateAuditKeys.length
    },
    {
      check: 'no orphan settlement items',
      status: orphanItems.length ? 'FAIL' : 'PASS',
      count: orphanItems.length
    },
    {
      check: 'no source financial row assigned to multiple settlement batches',
      status: multiBatchAssignments.length ? 'FAIL' : 'PASS',
      count: multiBatchAssignments.length
    },
    {
      check: 'no Level 4+ settlement behavior',
      status: creatorLevelViolations.length || brandLevelViolations.length ? 'FAIL' : 'PASS',
      creator_level_violations: creatorLevelViolations.length,
      brand_level_violations: brandLevelViolations.length
    },
    {
      check: 'no self-generated creator network override settlement items',
      status: selfGeneratedCreatorOverrides.length ? 'FAIL' : 'PASS',
      count: selfGeneratedCreatorOverrides.length
    },
    {
      check: 'batch gross amount equals direct commission plus platform fee',
      status: batchFundingCheck.status,
      detail: batchFundingCheck
    },
    {
      check: 'network overrides remain allocation visibility only',
      status: 'PASS',
      network_override_total: proposal.totals.network_override_total,
      brand_funding_obligation: proposal.totals.brand_funding_obligation
    }
  ];

  return {
    status_counts: rows.reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, {}),
    rows
  };
}

function calculateTotals({ conversions, creatorNetworkEarnings, brandNetworkEarnings }) {
  const directCommission = sumMoney(conversions, 'commission_amount');
  const platformFee = sumMoney(conversions, 'platform_fee_amount');
  const creatorNetworkOverrides = sumMoney(creatorNetworkEarnings, 'commission_amount');
  const brandNetworkOverrides = sumMoney(brandNetworkEarnings, 'commission_amount');
  return {
    conversion_count: conversions.length,
    creator_network_earning_count: creatorNetworkEarnings.length,
    brand_network_earning_count: brandNetworkEarnings.length,
    direct_commission_total: directCommission,
    platform_fee_total: platformFee,
    creator_network_override_total: creatorNetworkOverrides,
    brand_network_override_total: brandNetworkOverrides,
    network_override_total: money(creatorNetworkOverrides + brandNetworkOverrides),
    brand_funding_obligation: money(directCommission + platformFee),
    settlement_item_total: money(directCommission + platformFee + creatorNetworkOverrides + brandNetworkOverrides)
  };
}

function printProposal(proposal) {
  printHeader('Settlement Batch Proposal');
  console.log(JSON.stringify({
    batch_key: proposal.batchKey,
    brand_id: proposal.context.brand.id,
    brand_name: proposal.context.brand.name,
    shop_domain: proposal.context.shopDomain,
    scope: proposal.scope,
    totals: proposal.totals,
    existing: {
      batch_exists: Boolean(proposal.existing.batch),
      existing_item_count: proposal.existing.items.length
    },
    safety: proposal.safety
  }, null, 2));

  printRows('Included Conversions', proposal.conversions, (row) => ({
    id: row.id,
    order_id: row.order_id,
    creator_id: row.creator_id,
    order_value: row.order_value,
    commission_amount: row.commission_amount,
    platform_fee_amount: row.platform_fee_amount,
    payout_status: row.payout_status,
    created_at: row.created_at
  }));

  printRows('Included Creator Network Earnings', proposal.creatorNetworkEarnings, (row) => ({
    id: row.id,
    conversion_id: row.conversion_id,
    earning_creator_id: row.earning_creator_id,
    source_creator_id: row.source_creator_id,
    level: row.level,
    commission_amount: row.commission_amount,
    payout_status: row.payout_status
  }));

  printRows('Included Brand Network Earnings', proposal.brandNetworkEarnings, (row) => ({
    id: row.id,
    conversion_id: row.conversion_id,
    earning_brand_id: row.earning_brand_id,
    source_creator_id: row.source_creator_id,
    level: row.level,
    commission_amount: row.commission_amount,
    payout_status: row.payout_status
  }));

  printRows('Proposed Settlement Items', proposal.items, (row) => ({
    idempotency_key: row.idempotency_key,
    item_type: row.item_type,
    amount: row.amount,
    conversion_id: row.conversion_id || null,
    creator_network_earning_id: row.creator_network_earning_id || null,
    brand_network_earning_id: row.brand_network_earning_id || null
  }));
}

function printMutationResult(result) {
  printHeader('Draft Creation Result');
  console.log(JSON.stringify({
    batch: {
      id: result.batch.row.id,
      idempotency_key: result.batch.row.idempotency_key,
      created: result.batch.created,
      settlement_status: result.batch.row.settlement_status,
      gross_amount: result.batch.row.gross_amount,
      collected_amount: result.batch.row.collected_amount
    },
    items: {
      created: result.items.filter((item) => item.created).length,
      existing: result.items.filter((item) => !item.created).length
    },
    audit_events: {
      created: result.auditEvents.filter((event) => event.created).length,
      existing: result.auditEvents.filter((event) => !event.created).length
    },
    safety: {
      charged_brand: false,
      created_stripe_payment_intent: false,
      created_stripe_transfer: false,
      released_claims: false,
      changed_payout_status: false,
      mutated_existing_financial_rows: false
    }
  }, null, 2));
}

function printReviewDraftResult(result) {
  printHeader('Manual Review Transition Result');
  console.log(JSON.stringify(result, null, 2));
}

function printReconciliationVerification(verification) {
  printHeader('Settlement Reconciliation Verification');
  console.log(JSON.stringify({
    mode: 'READ ONLY',
    batch_key: verification.proposal.batchKey,
    summary: verification.summary,
    expected_item_count: verification.proposal.items.length,
    existing_batch_item_count: verification.batchItems.length,
    all_brand_settlement_item_count: verification.allItems.length,
    all_brand_audit_event_count: verification.allAuditEvents.length,
    safety: {
      mutated_rows: false,
      charged_brand: false,
      created_stripe_payment_intent: false,
      created_stripe_transfer: false,
      released_claims: false,
      changed_payout_status: false
    }
  }, null, 2));

  printRows('Missing Expected Settlement Items', verification.missingExpectedItems, (row) => ({
    idempotency_key: row.idempotency_key,
    item_type: row.item_type,
    amount: row.amount,
    conversion_id: row.conversion_id || null,
    creator_network_earning_id: row.creator_network_earning_id || null,
    brand_network_earning_id: row.brand_network_earning_id || null
  }));
  printRows('Unexpected Batch Settlement Items', verification.unexpectedBatchItems, settlementItemSummary);
  printRows('Mismatched Settlement Items', verification.mismatchedItems, (row) => ({
    idempotency_key: row.item.idempotency_key,
    mismatches: row.mismatches
  }));
  printRows('Duplicate Settlement Item Keys', verification.duplicateItemKeys, duplicateSummary);
  printRows('Duplicate Settlement Audit Keys', verification.duplicateAuditKeys, duplicateSummary);
  printRows('Orphan Settlement Items', verification.orphanItems, (row) => ({
    item: settlementItemSummary(row.item),
    reasons: row.reasons
  }));
  printRows('Multi-Batch Source Assignments', verification.multiBatchAssignments, (row) => ({
    key: row.key,
    settlement_batch_ids: row.settlement_batch_ids,
    row_count: row.rows.length
  }));
  printRows('Level 4+ Creator Network Violations', verification.creatorLevelViolations, (row) => ({
    id: row.id,
    conversion_id: row.conversion_id,
    level: row.level
  }));
  printRows('Level 4+ Brand Network Violations', verification.brandLevelViolations, (row) => ({
    id: row.id,
    conversion_id: row.conversion_id,
    level: row.level
  }));
  printRows('Self-Generated Creator Override Violations', verification.selfGeneratedCreatorOverrides, (row) => ({
    id: row.id,
    conversion_id: row.conversion_id,
    earning_creator_id: row.earning_creator_id,
    source_creator_id: row.source_creator_id
  }));
}

function buildBatchKey(scope) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      brand_id: scope.brand_id,
      shop_domain: scope.shop_domain,
      order_ids: [...scope.order_ids].sort(),
      date_from: scope.date_from || null,
      date_to: scope.date_to || null,
      conversion_ids: [...scope.conversion_ids].sort((a, b) => a - b)
    }))
    .digest('hex')
    .slice(0, 16);
  return `settlement_batch:${scope.brand_id}:${hash}`;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function duplicateGroups(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return [...grouped.entries()]
    .filter(([, groupRows]) => groupRows.length > 1)
    .map(([key, groupRows]) => ({
      key,
      count: groupRows.length,
      ids: groupRows.map((row) => row.id),
      rows: groupRows
    }));
}

function sanitizeKey(value) {
  const key = String(value || '').trim();
  if (!key) return null;
  if (key.length > 180) throw new Error('--batch-key must be 180 characters or fewer.');
  if (!/^[a-zA-Z0-9:_./-]+$/.test(key)) {
    throw new Error('--batch-key may only contain letters, numbers, colon, underscore, dash, dot, or slash.');
  }
  return key;
}

function sanitizeUuid(value) {
  const uuid = String(value || '').trim();
  if (!uuid) return null;
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(uuid)) {
    throw new Error('--batch-id must be a valid UUID.');
  }
  return uuid;
}

function getOperatorMode(args) {
  if (args.createDraft) return 'CREATE DRAFT';
  if (args.reviewDraft && args.dryRun) return 'DRY RUN REVIEW';
  if (args.reviewDraft) return 'REVIEW DRAFT';
  return 'DRY RUN / READ ONLY';
}

function getBatchReviewStatus(batch) {
  if (!batch) return null;
  return (batch.metadata && batch.metadata.review_status) || 'draft';
}

function reviewBatchSummary(batch) {
  if (!batch) return null;
  return {
    id: batch.id,
    idempotency_key: batch.idempotency_key,
    brand_id: batch.brand_id,
    shop_domain: batch.shop_domain,
    settlement_status: batch.settlement_status,
    review_status: getBatchReviewStatus(batch),
    gross_amount: batch.gross_amount,
    collected_amount: batch.collected_amount,
    settlement_collected_at: batch.settlement_collected_at,
    manual_approved_at: batch.manual_approved_at,
    reserve_covered_at: batch.reserve_covered_at,
    updated_at: batch.updated_at
  };
}

function normalizeShopDomain(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function money(value) {
  const number = Number(value || 0);
  return Math.round(number * 100) / 100;
}

function numberOrNull(value) {
  return value === undefined || value === null ? null : Number(value);
}

function sumMoney(rows, field) {
  return money(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0));
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
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

function settlementItemSummary(row) {
  return {
    id: row.id,
    idempotency_key: row.idempotency_key,
    settlement_batch_id: row.settlement_batch_id,
    item_type: row.item_type,
    amount: row.amount,
    conversion_id: row.conversion_id || null,
    creator_network_earning_id: row.creator_network_earning_id || null,
    brand_network_earning_id: row.brand_network_earning_id || null,
    settlement_status: row.settlement_status
  };
}

function duplicateSummary(row) {
  return {
    key: row.key,
    count: row.count,
    ids: row.ids
  };
}

main().catch((error) => {
  console.error('\nSettlement batch operator failed:');
  console.error(error);
  process.exit(1);
});
