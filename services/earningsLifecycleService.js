const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const {
  createStripeTestTransfer,
  findStripeTestTransferForClaim
} = require('./stripeConnectService');
const { log } = require('./services/logger');

const DEFAULT_PENDING_WINDOW_HOURS = 24;

const PENDING_WINDOW_HOURS = Number(process.env.EARNINGS_PENDING_WINDOW_HOURS || DEFAULT_PENDING_WINDOW_HOURS);
const EARNING_STATUS_PENDING = 'pending';
const EARNING_STATUS_CLAIMABLE = 'claimable';
const EARNING_STATUS_CLAIMED = 'claimed';

function getClaimableAt(createdAt = new Date()) {
  const baseDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return new Date(baseDate.getTime() + PENDING_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

function resolveLifecycleStatus(row, now = new Date()) {
  const status = row.payout_status || EARNING_STATUS_PENDING;
  if (status === EARNING_STATUS_CLAIMED) return EARNING_STATUS_CLAIMED;
  if (status === EARNING_STATUS_CLAIMABLE) return EARNING_STATUS_CLAIMABLE;

  const claimableAt = row.claimable_at ? new Date(row.claimable_at) : null;
  if (claimableAt && claimableAt <= now) return EARNING_STATUS_CLAIMABLE;
  return EARNING_STATUS_PENDING;
}

function sumLifecycleAmounts(rows, amountField = 'commission_amount', now = new Date()) {
  return (rows || []).reduce((totals, row) => {
    const amount = Number(row[amountField] || 0);
    const status = resolveLifecycleStatus(row, now);

    totals.lifetime += amount;
    if (status === EARNING_STATUS_PENDING) totals.pending += amount;
    if (status === EARNING_STATUS_CLAIMABLE) totals.claimable += amount;
    if (status === EARNING_STATUS_CLAIMED) totals.claimed += amount;
    return totals;
  }, {
    pending: 0,
    claimable: 0,
    claimed: 0,
    lifetime: 0
  });
}

async function promoteClaimableEarningsForCreator(creatorId) {
  const now = new Date().toISOString();

  const { error: conversionError } = await supabase
    .from('conversions')
    .update({ payout_status: EARNING_STATUS_CLAIMABLE })
    .eq('creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_PENDING)
    .lte('claimable_at', now);
  if (conversionError) throw conversionError;

  const { error: networkError } = await supabase
    .from('creator_network_earnings')
    .update({ payout_status: EARNING_STATUS_CLAIMABLE })
    .eq('earning_creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_PENDING)
    .lte('claimable_at', now);
  if (networkError) throw networkError;
}

async function claimCreatorEarnings({
  creatorId,
  stripeAccountId,
  currency = 'USD'
}) {
  await promoteClaimableEarningsForCreator(creatorId);

  const existingClaimBatchId = await getExistingReservedClaimBatchId(creatorId);
  const claimBatchId = existingClaimBatchId || crypto.randomUUID();
  if (!existingClaimBatchId) {
    await reserveClaimableEarnings(creatorId, claimBatchId);
  }

  const {
    reservedConversions,
    reservedNetworkEarnings
  } = await getReservedClaimRows(creatorId, claimBatchId);

  let directCommissionAmount = sumAmounts(reservedConversions);
  let networkEarningAmount = sumAmounts(reservedNetworkEarnings);
  const totalClaimedAmount = roundCurrency(directCommissionAmount + networkEarningAmount);

  if (totalClaimedAmount <= 0) {
    return {
      claimed: false,
      claimBatchId: null,
      directCommissionAmount: 0,
      networkEarningAmount: 0,
      totalClaimedAmount: 0
    };
  }

  let transfer = null;
  let claimRecord = await getClaimRecord(claimBatchId);
  if (!claimRecord) {
    if (existingClaimBatchId) {
      transfer = await findStripeTestTransferForClaim({
        destinationAccountId: stripeAccountId,
        claimBatchId
      });
      if (!transfer) {
        throw new Error(`Reserved claim batch ${claimBatchId} has no claim ledger row and no recoverable Stripe transfer. Manual review required to avoid duplicate transfer.`);
      }
      claimRecord = await createProcessingClaimRecord({
        claimBatchId,
        creatorId,
        directCommissionAmount,
        networkEarningAmount,
        totalClaimedAmount,
        currency,
        stripeAccountId
      });
    } else {
      try {
        claimRecord = await createProcessingClaimRecord({
          claimBatchId,
          creatorId,
          directCommissionAmount,
          networkEarningAmount,
          totalClaimedAmount,
          currency,
          stripeAccountId
        });
      } catch (error) {
        await clearClaimReservation(claimBatchId);
        throw error;
      }
    }
  } else {
    directCommissionAmount = Number(claimRecord.direct_commission_amount || directCommissionAmount);
    networkEarningAmount = Number(claimRecord.network_earning_amount || networkEarningAmount);
  }

  if (claimRecord.stripe_transfer_id) {
    transfer = {
      id: claimRecord.stripe_transfer_id,
      created: claimRecord.stripe_transfer_created_at
        ? Math.floor(new Date(claimRecord.stripe_transfer_created_at).getTime() / 1000)
        : null
    };
    log('Claim earnings recovering existing Stripe transfer claim:', {
      creatorId,
      claimBatchId,
      stripeTransferId: claimRecord.stripe_transfer_id,
      status: claimRecord.status
    });
  } else if (!transfer) {
    try {
      transfer = await createStripeTestTransfer({
        amount: Number(claimRecord.total_claimed_amount || totalClaimedAmount),
        currency: claimRecord.currency || currency,
        destinationAccountId: stripeAccountId,
        claimBatchId,
        creatorId,
        idempotencyKey: claimBatchId
      });
    } catch (error) {
      log('Claim earnings Stripe transfer failed before earnings were marked claimed:', {
        stripeErrorMessage: error.message,
        stripeErrorType: error.stripeErrorType || null,
        stripeErrorCode: error.stripeErrorCode || null,
        transferPayloadAttempted: error.transferPayloadAttempted || null,
        creatorStripeAccountId: error.creatorStripeAccountId || stripeAccountId || null,
        claimBatchId: error.claimBatchId || claimBatchId,
        transferAmount: error.transferAmount || Math.round(Number(totalClaimedAmount || 0) * 100),
        transferGroupUsed: Boolean(error.transferGroupUsed),
        stack: error.stack || null
      });
      await clearClaimReservation(claimBatchId);
      throw error;
    }
  }

  const claimedAt = new Date().toISOString();
  const transferStatus = transfer && transfer.id ? 'paid' : 'processing';
  const transferCreatedAt = transfer && transfer.created
    ? new Date(Number(transfer.created) * 1000).toISOString()
    : claimedAt;

  claimRecord = await updateClaimRecordWithTransfer({
    claimBatchId,
    stripeTransferId: transfer ? transfer.id : null,
    transferStatus,
    transferCreatedAt
  });

  await finalizeReservedClaimRows({
    creatorId,
    claimBatchId,
    claimedAt
  });

  return {
    claimed: true,
    claimBatchId,
    claimedAt,
    directCommissionAmount,
    networkEarningAmount,
    totalClaimedAmount: Number(claimRecord.total_claimed_amount || totalClaimedAmount),
    stripeTransferId: transfer ? transfer.id : null,
    stripeTransferStatus: transferStatus,
    claimRecord
  };
}

async function reserveClaimableEarnings(creatorId, claimBatchId) {
  const { error: conversionsError } = await supabase
    .from('conversions')
    .update({ claim_batch_id: claimBatchId })
    .eq('creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .is('claim_batch_id', null);
  if (conversionsError) throw conversionsError;

  const { error: networkError } = await supabase
    .from('creator_network_earnings')
    .update({ claim_batch_id: claimBatchId })
    .eq('earning_creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .is('claim_batch_id', null);
  if (networkError) throw networkError;
}

async function getExistingReservedClaimBatchId(creatorId) {
  const batchIds = new Set();

  const { data: conversionRows, error: conversionError } = await supabase
    .from('conversions')
    .select('claim_batch_id')
    .eq('creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .not('claim_batch_id', 'is', null);
  if (conversionError) throw conversionError;
  for (const row of conversionRows || []) batchIds.add(row.claim_batch_id);

  const { data: networkRows, error: networkError } = await supabase
    .from('creator_network_earnings')
    .select('claim_batch_id')
    .eq('earning_creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .not('claim_batch_id', 'is', null);
  if (networkError) throw networkError;
  for (const row of networkRows || []) batchIds.add(row.claim_batch_id);

  const cleanBatchIds = [...batchIds].filter(Boolean);
  if (cleanBatchIds.length > 1) {
    log('Multiple reserved claim batches found; using oldest visible batch for recovery:', {
      creatorId,
      claimBatchIds: cleanBatchIds
    });
  }
  return cleanBatchIds[0] || null;
}

async function getReservedClaimRows(creatorId, claimBatchId) {
  const { data: reservedConversions, error: conversionError } = await supabase
    .from('conversions')
    .select('id, commission_amount')
    .eq('creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .eq('claim_batch_id', claimBatchId);
  if (conversionError) throw conversionError;

  const { data: reservedNetworkEarnings, error: networkError } = await supabase
    .from('creator_network_earnings')
    .select('id, commission_amount')
    .eq('earning_creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .eq('claim_batch_id', claimBatchId);
  if (networkError) throw networkError;

  return {
    reservedConversions: reservedConversions || [],
    reservedNetworkEarnings: reservedNetworkEarnings || []
  };
}

async function getClaimRecord(claimBatchId) {
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .select('*')
    .eq('id', claimBatchId)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function createProcessingClaimRecord({
  claimBatchId,
  creatorId,
  directCommissionAmount,
  networkEarningAmount,
  totalClaimedAmount,
  currency,
  stripeAccountId
}) {
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .insert({
      id: claimBatchId,
      creator_id: creatorId,
      direct_commission_amount: directCommissionAmount,
      network_earning_amount: networkEarningAmount,
      total_claimed_amount: totalClaimedAmount,
      currency,
      stripe_account_id: stripeAccountId,
      status: 'processing',
      stripe_transfer_status: 'processing',
      notes: 'Stripe test-mode transfer pending. No live money movement.'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateClaimRecordWithTransfer({
  claimBatchId,
  stripeTransferId,
  transferStatus,
  transferCreatedAt
}) {
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .update({
      stripe_transfer_id: stripeTransferId,
      stripe_transfer_status: transferStatus,
      stripe_transfer_created_at: transferCreatedAt,
      status: transferStatus,
      notes: 'Stripe test-mode transfer created. No live money movement.'
    })
    .eq('id', claimBatchId)
    .select()
    .single();
  if (error) {
    log('Claim earnings DB finalization failed after Stripe transfer succeeded:', {
      claimBatchId,
      stripeTransferId,
      transferStatus,
      transferCreatedAt,
      errorMessage: error.message,
      stack: error.stack || null
    });
    throw error;
  }
  return data;
}

async function finalizeReservedClaimRows({
  creatorId,
  claimBatchId,
  claimedAt
}) {
  const { error: finalizeConversionsError } = await supabase
    .from('conversions')
    .update({
      payout_status: EARNING_STATUS_CLAIMED,
      claimed_at: claimedAt
    })
    .eq('creator_id', creatorId)
    .eq('claim_batch_id', claimBatchId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE);
  if (finalizeConversionsError) throw finalizeConversionsError;

  const { error: finalizeNetworkError } = await supabase
    .from('creator_network_earnings')
    .update({
      payout_status: EARNING_STATUS_CLAIMED,
      claimed_at: claimedAt
    })
    .eq('earning_creator_id', creatorId)
    .eq('claim_batch_id', claimBatchId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE);
  if (finalizeNetworkError) throw finalizeNetworkError;
}

async function clearClaimReservation(claimBatchId) {
  const { error: conversionError } = await supabase
    .from('conversions')
    .update({ claim_batch_id: null })
    .eq('claim_batch_id', claimBatchId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE);
  if (conversionError) throw conversionError;

  const { error: networkError } = await supabase
    .from('creator_network_earnings')
    .update({ claim_batch_id: null })
    .eq('claim_batch_id', claimBatchId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE);
  if (networkError) throw networkError;
}

function sumAmounts(rows) {
  return roundCurrency((rows || []).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0));
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  PENDING_WINDOW_HOURS,
  EARNING_STATUS_PENDING,
  EARNING_STATUS_CLAIMABLE,
  EARNING_STATUS_CLAIMED,
  getClaimableAt,
  resolveLifecycleStatus,
  sumLifecycleAmounts,
  promoteClaimableEarningsForCreator,
  claimCreatorEarnings
};
