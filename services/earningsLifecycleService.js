const crypto = require('crypto');
const supabase = require('../database/database/supabase');
const { createStripeTestTransfer } = require('./stripeConnectService');

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

  const claimBatchId = crypto.randomUUID();
  const claimedAt = new Date().toISOString();

  const { data: reservedConversions, error: conversionsError } = await supabase
    .from('conversions')
    .update({ claim_batch_id: claimBatchId })
    .eq('creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .is('claim_batch_id', null)
    .select('id, commission_amount');
  if (conversionsError) throw conversionsError;

  const { data: reservedNetworkEarnings, error: networkError } = await supabase
    .from('creator_network_earnings')
    .update({ claim_batch_id: claimBatchId })
    .eq('earning_creator_id', creatorId)
    .eq('payout_status', EARNING_STATUS_CLAIMABLE)
    .is('claim_batch_id', null)
    .select('id, commission_amount');
  if (networkError) throw networkError;

  const directCommissionAmount = sumAmounts(reservedConversions);
  const networkEarningAmount = sumAmounts(reservedNetworkEarnings);
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

  let transfer;
  try {
    transfer = await createStripeTestTransfer({
      amount: totalClaimedAmount,
      currency,
      destinationAccountId: stripeAccountId,
      claimBatchId,
      creatorId
    });
  } catch (error) {
    await clearClaimReservation(claimBatchId);
    throw error;
  }

  const transferStatus = transfer && transfer.id ? 'paid' : 'processing';
  const transferCreatedAt = transfer && transfer.created
    ? new Date(Number(transfer.created) * 1000).toISOString()
    : claimedAt;

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

  const { data: claimRecord, error: claimError } = await supabase
    .from('creator_earning_claims')
    .insert({
      id: claimBatchId,
      creator_id: creatorId,
      direct_commission_amount: directCommissionAmount,
      network_earning_amount: networkEarningAmount,
      total_claimed_amount: totalClaimedAmount,
      currency,
      stripe_account_id: stripeAccountId,
      stripe_transfer_id: transfer ? transfer.id : null,
      stripe_transfer_status: transferStatus,
      stripe_transfer_created_at: transferCreatedAt,
      status: transferStatus,
      notes: 'Stripe test-mode transfer created. No live money movement.'
    })
    .select()
    .single();
  if (claimError) throw claimError;

  return {
    claimed: true,
    claimBatchId,
    claimedAt,
    directCommissionAmount,
    networkEarningAmount,
    totalClaimedAmount,
    stripeTransferId: transfer ? transfer.id : null,
    stripeTransferStatus: transferStatus,
    claimRecord
  };
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
