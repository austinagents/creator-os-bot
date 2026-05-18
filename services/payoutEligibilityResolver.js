const supabase = require('../database/database/supabase');
const {
  getPayoutClaimGate,
  isRowClaimableByPayoutMode
} = require('./payoutModeService');

const BLOCKING_REVERSAL_STATUSES = new Set([
  'refund_pending',
  'reversed',
  'offset_required',
  'chargeback_review'
]);

const BLOCKING_RISK_STATUSES = new Set(['high', 'hold']);
const BLOCKING_RISK_REVIEW_STATUSES = new Set(['held', 'rejected', 'pending_review']);

async function resolvePayoutEligibility({
  conversions = [],
  creatorNetworkEarnings = [],
  brandNetworkEarnings = [],
  payoutClaimGate = getPayoutClaimGate()
} = {}) {
  const settlementItems = await loadSettlementItems({
    conversions,
    creatorNetworkEarnings,
    brandNetworkEarnings
  });
  const reversalItems = await loadReversalItems({
    conversions,
    creatorNetworkEarnings,
    brandNetworkEarnings
  });

  return [
    ...conversions.map((row) => resolveRowEligibility({
      sourceType: 'conversion_direct_commission',
      row,
      recipientType: 'creator',
      recipientId: row.creator_id,
      settlementItems,
      reversalItems,
      payoutClaimGate
    })),
    ...creatorNetworkEarnings.map((row) => resolveRowEligibility({
      sourceType: 'creator_network_override',
      row,
      recipientType: 'creator',
      recipientId: row.earning_creator_id,
      settlementItems,
      reversalItems,
      payoutClaimGate
    })),
    ...brandNetworkEarnings.map((row) => resolveRowEligibility({
      sourceType: 'brand_network_override',
      row,
      recipientType: 'brand',
      recipientId: row.earning_brand_id,
      settlementItems,
      reversalItems,
      payoutClaimGate
    }))
  ];
}

function resolveRowEligibility({
  sourceType,
  row,
  recipientType,
  recipientId,
  settlementItems,
  reversalItems,
  payoutClaimGate
}) {
  const linkedSettlementItems = findLinkedSettlementItems({ sourceType, row, settlementItems });
  const linkedReversalItems = findLinkedReversalItems({ sourceType, row, reversalItems });
  const checks = buildChecks({
    sourceType,
    row,
    recipientType,
    recipientId,
    linkedSettlementItems,
    linkedReversalItems,
    payoutClaimGate
  });
  const blockers = checks.filter((check) => check.status === 'BLOCK').map((check) => check.reason);
  const warnings = checks.filter((check) => check.status === 'CHECK').map((check) => check.reason);

  return {
    source_type: sourceType,
    source_table: getSourceTable(sourceType),
    source_id: row.id,
    conversion_id: row.conversion_id || row.id || null,
    order_id: row.order_id || null,
    recipient_type: recipientType,
    recipient_id: recipientId || null,
    amount: Number(row.commission_amount || 0),
    payout_status: row.payout_status || null,
    settlement_status: row.settlement_status || null,
    reversal_status: row.reversal_status || null,
    risk_status: row.risk_status || null,
    risk_review_status: row.risk_review_status || null,
    claim_batch_id: row.claim_batch_id || null,
    eligibility_state: blockers.length ? 'blocked' : 'eligible_read_only',
    eligible_for_live_payout: false,
    eligible_for_current_mode: !blockers.length,
    blockers,
    warnings,
    checks,
    linked_settlement_item_ids: linkedSettlementItems.map((item) => item.id),
    linked_reversal_item_ids: linkedReversalItems.map((item) => item.id),
    note: 'Read-only diagnostic. This resolver does not mark rows claimable, release claims, call Stripe, or prove live payout authorization.'
  };
}

function buildChecks({
  sourceType,
  row,
  recipientId,
  linkedSettlementItems,
  linkedReversalItems,
  payoutClaimGate
}) {
  const isSelfGeneratedCreatorOverride = sourceType === 'creator_network_override'
    && row.earning_creator_id
    && row.source_creator_id
    && Number(row.earning_creator_id) === Number(row.source_creator_id);

  return [
    {
      name: 'source_row_exists',
      status: row && row.id ? 'PASS' : 'BLOCK',
      reason: row && row.id ? 'source row exists' : 'missing source row'
    },
    {
      name: 'recipient_present',
      status: recipientId ? 'PASS' : 'BLOCK',
      reason: recipientId ? 'recipient id present' : 'missing recipient id'
    },
    {
      name: 'level_cap',
      status: isNetworkSource(sourceType) && Number(row.level || 0) > 3 ? 'BLOCK' : 'PASS',
      reason: isNetworkSource(sourceType) && Number(row.level || 0) > 3 ? 'Level 4+ network row is not payout eligible' : 'network level is within cap or not applicable'
    },
    {
      name: 'self_generated_override',
      status: isSelfGeneratedCreatorOverride ? 'BLOCK' : 'PASS',
      reason: isSelfGeneratedCreatorOverride ? 'self-generated creator network override is blocked' : 'no self-generated creator override detected'
    },
    {
      name: 'claim_state_allows',
      status: row.payout_status === 'claimed' || row.claim_batch_id ? 'BLOCK' : 'PASS',
      reason: row.payout_status === 'claimed'
        ? 'row is already claimed'
        : row.claim_batch_id
          ? 'row is already reserved in a claim batch'
          : 'row is not claimed or reserved'
    },
    {
      name: 'payout_mode_allows',
      status: payoutClaimGate.allowed ? 'PASS' : 'BLOCK',
      reason: payoutClaimGate.allowed ? payoutClaimGate.reason : `payout mode blocks claims: ${payoutClaimGate.reason}`
    },
    {
      name: 'row_matches_active_payout_mode',
      status: isRowClaimableByPayoutMode(row, payoutClaimGate) ? 'PASS' : 'BLOCK',
      reason: isRowClaimableByPayoutMode(row, payoutClaimGate)
        ? `row satisfies ${payoutClaimGate.claimabilityRule} payout eligibility`
        : `row does not satisfy ${payoutClaimGate.claimabilityRule} payout eligibility`
    },
    {
      name: 'settlement_item_present',
      status: linkedSettlementItems.length ? 'PASS' : 'CHECK',
      reason: linkedSettlementItems.length ? 'settlement item exists' : 'no settlement item linked yet'
    },
    {
      name: 'settlement_safe',
      status: hasSafeSettlementEvidence(row, linkedSettlementItems) ? 'PASS' : 'BLOCK',
      reason: hasSafeSettlementEvidence(row, linkedSettlementItems)
        ? 'settlement/manual/reserve evidence exists'
        : 'missing settlement_collected, manual_approved, or reserve_covered evidence'
    },
    {
      name: 'refund_or_reversal_clear',
      status: hasBlockingReversal(row, linkedReversalItems) ? 'BLOCK' : 'PASS',
      reason: hasBlockingReversal(row, linkedReversalItems) ? 'refund/reversal/offset block exists' : 'no blocking reversal state detected'
    },
    {
      name: 'risk_hold_clear',
      status: hasBlockingRisk(row, linkedSettlementItems) ? 'BLOCK' : 'PASS',
      reason: hasBlockingRisk(row, linkedSettlementItems) ? 'risk hold/review block exists' : 'no blocking risk state detected'
    },
    {
      name: 'live_money_disabled',
      status: 'BLOCK',
      reason: 'live payout release remains disabled; Phase 6 is intentionally blocked'
    }
  ];
}

function hasSafeSettlementEvidence(row, linkedSettlementItems) {
  return Boolean(
    row.settlement_collected_at
    || row.manual_approved_at
    || row.reserve_covered_at
    || ['settlement_collected', 'manual_approved', 'reserve_covered'].includes(row.settlement_status)
    || linkedSettlementItems.some((item) => (
      item.settlement_collected_at
      || item.manual_approved_at
      || item.reserve_covered_at
      || ['settlement_collected', 'manual_approved', 'reserve_covered'].includes(item.settlement_status)
    ))
  );
}

function hasBlockingReversal(row, linkedReversalItems) {
  return Boolean(
    BLOCKING_REVERSAL_STATUSES.has(row.reversal_status)
    || linkedReversalItems.some((item) => Number(item.reversed_amount || 0) > 0 || item.offset_required)
  );
}

function hasBlockingRisk(row, linkedSettlementItems) {
  return Boolean(
    BLOCKING_RISK_STATUSES.has(row.risk_status)
    || BLOCKING_RISK_REVIEW_STATUSES.has(row.risk_review_status)
    || linkedSettlementItems.some((item) => (
      BLOCKING_RISK_STATUSES.has(item.risk_status)
      || BLOCKING_RISK_REVIEW_STATUSES.has(item.risk_review_status)
    ))
  );
}

function findLinkedSettlementItems({ sourceType, row, settlementItems }) {
  if (sourceType === 'conversion_direct_commission') {
    return settlementItems.filter((item) => Number(item.conversion_id) === Number(row.id) && item.item_type === 'direct_commission');
  }
  if (sourceType === 'creator_network_override') {
    return settlementItems.filter((item) => Number(item.creator_network_earning_id) === Number(row.id));
  }
  if (sourceType === 'brand_network_override') {
    return settlementItems.filter((item) => Number(item.brand_network_earning_id) === Number(row.id));
  }
  return [];
}

function findLinkedReversalItems({ sourceType, row, reversalItems }) {
  if (sourceType === 'conversion_direct_commission') {
    return reversalItems.filter((item) => Number(item.conversion_id) === Number(row.id) && item.item_type === 'direct_commission');
  }
  if (sourceType === 'creator_network_override') {
    return reversalItems.filter((item) => Number(item.creator_network_earning_id) === Number(row.id));
  }
  if (sourceType === 'brand_network_override') {
    return reversalItems.filter((item) => Number(item.brand_network_earning_id) === Number(row.id));
  }
  return [];
}

async function loadSettlementItems({ conversions, creatorNetworkEarnings, brandNetworkEarnings }) {
  const filters = buildSourceFilters({ conversions, creatorNetworkEarnings, brandNetworkEarnings });
  if (!filters.length) return [];

  const { data, error } = await supabase
    .from('settlement_items')
    .select('*')
    .or(filters.join(','))
    .order('created_at', { ascending: false });
  if (error && ['42P01', 'PGRST205', 'PGRST204'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

async function loadReversalItems({ conversions, creatorNetworkEarnings, brandNetworkEarnings }) {
  const filters = buildSourceFilters({ conversions, creatorNetworkEarnings, brandNetworkEarnings });
  if (!filters.length) return [];

  const { data, error } = await supabase
    .from('financial_reversal_items')
    .select('*')
    .or(filters.join(','))
    .order('created_at', { ascending: false });
  if (error && ['42P01', 'PGRST205', 'PGRST204'].includes(error.code)) return [];
  if (error) throw error;
  return data || [];
}

function buildSourceFilters({ conversions, creatorNetworkEarnings, brandNetworkEarnings }) {
  const filters = [];
  const conversionIds = ids(conversions);
  const creatorNetworkIds = ids(creatorNetworkEarnings);
  const brandNetworkIds = ids(brandNetworkEarnings);
  if (conversionIds.length) filters.push(`conversion_id.in.(${conversionIds.join(',')})`);
  if (creatorNetworkIds.length) filters.push(`creator_network_earning_id.in.(${creatorNetworkIds.join(',')})`);
  if (brandNetworkIds.length) filters.push(`brand_network_earning_id.in.(${brandNetworkIds.join(',')})`);
  return filters;
}

function ids(rows) {
  return [...new Set((rows || []).map((row) => row.id).filter(Boolean))];
}

function isNetworkSource(sourceType) {
  return sourceType === 'creator_network_override' || sourceType === 'brand_network_override';
}

function getSourceTable(sourceType) {
  if (sourceType === 'conversion_direct_commission') return 'conversions';
  if (sourceType === 'creator_network_override') return 'creator_network_earnings';
  if (sourceType === 'brand_network_override') return 'brand_network_earnings';
  return null;
}

module.exports = {
  resolvePayoutEligibility
};
