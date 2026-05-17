#!/usr/bin/env node

const crypto = require('crypto');
const supabase = require('../database/database/supabase');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    report: false,
    createDraft: false,
    brandId: null,
    shopDomain: null,
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
    else if (arg === '--brand-id') {
      args.brandId = argv[index + 1] ? Number(argv[index + 1]) : null;
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

  if (!args.dryRun && !args.createDraft) args.dryRun = true;
  if (args.createDraft && args.dryRun) {
    throw new Error('Use either --dry-run or --create-draft, not both.');
  }
  if (!args.report && !args.createDraft) args.report = true;
  if (!args.brandId && !args.shopDomain) {
    throw new Error('Provide --brand-id or --shop-domain.');
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
  console.log(`Mode: ${args.createDraft ? 'CREATE DRAFT' : 'DRY RUN / READ ONLY'}`);
  console.log(`Flags: ${process.argv.slice(2).join(' ') || '--dry-run --report (implicit)'}`);

  const context = await resolveContext(args);
  const proposal = await buildSettlementProposal(context, args);

  printProposal(proposal);

  if (args.createDraft) {
    const result = await createDraftSettlementBatch(proposal, args);
    printMutationResult(result);
  }

  printHeader('Done');
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

function sanitizeKey(value) {
  const key = String(value || '').trim();
  if (!key) return null;
  if (key.length > 180) throw new Error('--batch-key must be 180 characters or fewer.');
  if (!/^[a-zA-Z0-9:_./-]+$/.test(key)) {
    throw new Error('--batch-key may only contain letters, numbers, colon, underscore, dash, dot, or slash.');
  }
  return key;
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

main().catch((error) => {
  console.error('\nSettlement batch operator failed:');
  console.error(error);
  process.exit(1);
});
