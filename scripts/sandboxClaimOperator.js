#!/usr/bin/env node

const supabase = require('../database/database/supabase');
const { STRIPE_SECRET_KEY } = require('../config/config/env');
const { normalizeCode } = require('../utils/slug');
const { claimCreatorEarnings } = require('../services/earningsLifecycleService');
const {
  getPayoutClaimGate,
  isRowClaimableByPayoutMode
} = require('../services/payoutModeService');
const { resolvePayoutEligibility } = require('../services/payoutEligibilityResolver');

const REQUIRED_CREATOR_CODE = 'test-creator-04';
const REQUIRED_PAYOUT_MODE = 'sandbox_time_based';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.execute ? 'EXECUTE SANDBOX STRIPE TEST TRANSFER' : 'DRY RUN / READ ONLY';

  printHeader('PartnerLinks Sandbox Claim Operator');
  console.log(`Mode: ${mode}`);
  console.log(`Flags: ${process.argv.slice(2).join(' ') || '--dry-run (implicit)'}`);

  const preflight = await buildPreflight(args);
  printPreflight(preflight);

  if (!args.execute) {
    printHeader('Dry Run Complete');
    console.log('No rows reserved. No claim ledger row created. No Stripe call made. No payout_status changed.');
    return;
  }

  if (preflight.blockers.length) {
    throw new Error(`Refusing sandbox claim execution: ${preflight.blockers.join('; ')}`);
  }

  const claimResult = await claimCreatorEarnings({
    creatorId: preflight.creator.id,
    stripeAccountId: preflight.creator.stripe_account_id,
    payoutClaimGate: preflight.payoutGate
  });

  const postflight = await buildPostflight({
    creator: preflight.creator,
    conversionId: args.conversionId,
    claimResult
  });

  printExecutionResult({ claimResult, postflight });
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    execute: false,
    confirmSandboxStripeTransfer: false,
    creatorCode: null,
    conversionId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--execute') args.execute = true;
    else if (arg === '--confirm-sandbox-stripe-transfer') args.confirmSandboxStripeTransfer = true;
    else if (arg === '--creator-code') {
      args.creatorCode = normalizeCode(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--conversion-id') {
      args.conversionId = argv[index + 1] ? Number(argv[index + 1]) : null;
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (args.dryRun && args.execute) {
    throw new Error('Use either --dry-run or --execute, not both.');
  }
  if (!args.execute) args.dryRun = true;
  if (args.creatorCode !== REQUIRED_CREATOR_CODE) {
    throw new Error(`--creator-code must be exactly ${REQUIRED_CREATOR_CODE}.`);
  }
  if (!Number.isInteger(args.conversionId) || args.conversionId <= 0) {
    throw new Error('--conversion-id must be a positive integer.');
  }
  if (args.execute && !args.confirmSandboxStripeTransfer) {
    throw new Error('--confirm-sandbox-stripe-transfer is required with --execute.');
  }

  return args;
}

async function buildPreflight(args) {
  const payoutGate = getPayoutClaimGate();
  const stripeKeyMode = getStripeKeyMode();
  const creator = await getCreator(args.creatorCode);
  const conversion = creator ? await getConversion(args.conversionId) : null;
  const directRows = creator ? await getDirectRows(creator.id) : [];
  const networkRows = creator ? await getNetworkRows(creator.id) : [];
  const claimRows = buildClaimPreviewRows({ directRows, networkRows, payoutGate });
  const reservableRows = claimRows.filter((row) => row.would_reserve);
  const nonTargetReservableRows = reservableRows.filter((row) => !(
    row.source_table === 'conversions'
    && Number(row.source_id) === Number(args.conversionId)
  ));
  const targetReservableRow = reservableRows.find((row) => (
    row.source_table === 'conversions'
    && Number(row.source_id) === Number(args.conversionId)
  ));
  const existingClaims = creator ? await getCreatorClaims(creator.id) : [];
  const duplicateTransferRisks = await getDuplicateTransferRisks();
  const stuckReservations = findStuckReservations({ directRows, networkRows, existingClaims });
  const eligibilityResults = conversion
    ? await resolvePayoutEligibility({ conversions: [conversion], payoutClaimGate: payoutGate })
    : [];
  const blockers = buildBlockers({
    args,
    creator,
    conversion,
    payoutGate,
    stripeKeyMode,
    targetReservableRow,
    nonTargetReservableRows,
    duplicateTransferRisks,
    stuckReservations
  });

  return {
    args,
    creator,
    conversion,
    payoutGate,
    stripeKeyMode,
    claimRows,
    reservableRows,
    targetReservableRow,
    nonTargetReservableRows,
    existingClaims,
    duplicateTransferRisks,
    stuckReservations,
    eligibilityResults,
    blockers
  };
}

async function buildPostflight({ creator, conversionId, claimResult }) {
  const conversion = await getConversion(conversionId);
  const claims = await getCreatorClaims(creator.id);
  const duplicateTransferRisks = await getDuplicateTransferRisks();
  const directRows = await getDirectRows(creator.id);
  const networkRows = await getNetworkRows(creator.id);
  const stuckReservations = findStuckReservations({ directRows, networkRows, existingClaims: claims });
  const eligibilityResults = await resolvePayoutEligibility({ conversions: [conversion] });
  return {
    conversion,
    claims,
    duplicateTransferRisks,
    stuckReservations,
    eligibilityResults,
    claimResult
  };
}

function buildBlockers({
  args,
  creator,
  conversion,
  payoutGate,
  stripeKeyMode,
  targetReservableRow,
  nonTargetReservableRows,
  duplicateTransferRisks,
  stuckReservations
}) {
  const blockers = [];
  if (stripeKeyMode !== 'test') blockers.push('STRIPE_SECRET_KEY is not test mode.');
  if (payoutGate.mode !== REQUIRED_PAYOUT_MODE) blockers.push(`PAYOUT_MODE must be ${REQUIRED_PAYOUT_MODE}.`);
  if (!payoutGate.allowed) blockers.push(`Payout mode blocks claims: ${payoutGate.reason}`);
  if (!creator) blockers.push(`Creator ${args.creatorCode} not found.`);
  if (creator && creator.creator_code !== REQUIRED_CREATOR_CODE) blockers.push('Resolved creator_code mismatch.');
  if (creator && !creator.auth_user_id) blockers.push('Creator has no auth_user_id binding.');
  if (creator && !creator.stripe_account_id) blockers.push('Creator has no Stripe connected account id.');
  if (creator && creator.stripe_onboarding_status !== 'payouts_enabled') {
    blockers.push(`Creator Stripe onboarding status is ${creator.stripe_onboarding_status || 'not_connected'}, not payouts_enabled.`);
  }
  if (!conversion) blockers.push(`Conversion ${args.conversionId} not found.`);
  if (conversion && creator && Number(conversion.creator_id) !== Number(creator.id)) {
    blockers.push(`Conversion ${args.conversionId} does not belong to ${REQUIRED_CREATOR_CODE}.`);
  }
  if (conversion && conversion.payout_status === 'claimed') blockers.push('Conversion is already claimed.');
  if (conversion && conversion.claim_batch_id) blockers.push('Conversion already has claim_batch_id.');
  if (!targetReservableRow) blockers.push(`Conversion ${args.conversionId} is not the target reservable row.`);
  if (nonTargetReservableRows.length) blockers.push('Additional reservable rows exist for this creator; refusing creator-scoped claim.');
  if (duplicateTransferRisks.length) blockers.push('Duplicate Stripe transfer ids exist in claim ledger.');
  if (stuckReservations.length) blockers.push('Stuck claim reservations exist.');
  return blockers;
}

function printPreflight(preflight) {
  printHeader('Sandbox Claim Preflight');
  console.log(JSON.stringify({
    classification: 'SANDBOX ONLY',
    runtime_effect: preflight.args.execute
      ? 'would execute only if blockers are empty and confirmation flag is present'
      : 'dry-run only; no rows reserved, no claim ledger row created, no Stripe call made',
    creator: preflight.creator ? {
      id: preflight.creator.id,
      creator_code: preflight.creator.creator_code,
      email: preflight.creator.email,
      auth_user_id_present: Boolean(preflight.creator.auth_user_id),
      stripe_account_id: preflight.creator.stripe_account_id || null,
      stripe_onboarding_status: preflight.creator.stripe_onboarding_status || 'not_connected'
    } : null,
    stripe: {
      key_mode: preflight.stripeKeyMode,
      live_transfer_allowed: false,
      destination_account_id: preflight.creator ? preflight.creator.stripe_account_id || null : null
    },
    payout_mode: {
      mode: preflight.payoutGate.mode,
      allowed: preflight.payoutGate.allowed,
      claimability_rule: preflight.payoutGate.claimabilityRule,
      reason: preflight.payoutGate.reason
    },
    requested_conversion: preflight.conversion ? summarizeConversion(preflight.conversion) : null,
    dry_run_claim_preview: {
      would_call_stripe_now: false,
      would_create_stripe_test_transfer: !preflight.blockers.length,
      proposed_claim_batch_behavior: 'new random UUID generated by claimCreatorEarnings() at execution',
      expected_direct_commission_amount: preflight.targetReservableRow ? preflight.targetReservableRow.amount : 0,
      expected_network_earning_amount: 0,
      expected_total_amount: preflight.targetReservableRow ? preflight.targetReservableRow.amount : 0,
      currency: 'USD',
      reservable_row_count: preflight.reservableRows.length
    },
    duplicate_transfer_risk_count: preflight.duplicateTransferRisks.length,
    stuck_reservation_count: preflight.stuckReservations.length,
    eligible_for_live_payout: false,
    blockers: preflight.blockers,
    tables_that_would_mutate_on_success: [
      'conversions row 26: payout_status, claim_batch_id, claimed_at',
      'creator_earning_claims: one new immutable claim ledger row'
    ],
    tables_that_must_not_mutate: [
      'settlement_batches',
      'settlement_items',
      'settlement_audit_events',
      'financial_reversal_events',
      'financial_reversal_items',
      'brand billing/charging tables',
      'brand reserve tables'
    ]
  }, null, 2));

  printRows('Rows That Would Be Reserved', preflight.reservableRows, (row) => row);
  printRows('Rows Not Reservable And Why', preflight.claimRows.filter((row) => !row.would_reserve), (row) => row);
  printRows('Duplicate Transfer Risks', preflight.duplicateTransferRisks, (row) => row);
  printRows('Stuck Reservations', preflight.stuckReservations, (row) => row);
  printRows('Live Eligibility Rows', preflight.eligibilityResults, (row) => ({
    source_type: row.source_type,
    source_id: row.source_id,
    amount: row.amount,
    payout_status: row.payout_status,
    claim_batch_id: row.claim_batch_id,
    eligible_for_live_payout: row.eligible_for_live_payout,
    blockers: row.blockers
  }));
}

function printExecutionResult({ claimResult, postflight }) {
  printHeader('Sandbox Claim Execution Result');
  console.log(JSON.stringify({
    classification: 'SANDBOX ONLY',
    stripe_transfer_id: claimResult.stripeTransferId || null,
    stripe_transfer_status: claimResult.stripeTransferStatus || null,
    claim_batch_id: claimResult.claimBatchId || null,
    direct_commission_amount: claimResult.directCommissionAmount,
    network_earning_amount: claimResult.networkEarningAmount,
    total_claimed_amount: claimResult.totalClaimedAmount,
    conversion: postflight.conversion ? summarizeConversion(postflight.conversion) : null,
    duplicate_transfer_risk_count: postflight.duplicateTransferRisks.length,
    stuck_reservation_count: postflight.stuckReservations.length,
    eligible_for_live_payout: false,
    live_payouts_go_no_go: 'NO-GO'
  }, null, 2));

  printRows('Creator Claim Ledger Rows', postflight.claims, (row) => ({
    id: row.id,
    creator_id: row.creator_id,
    total_claimed_amount: row.total_claimed_amount,
    direct_commission_amount: row.direct_commission_amount,
    network_earning_amount: row.network_earning_amount,
    status: row.status,
    stripe_transfer_id: row.stripe_transfer_id,
    stripe_transfer_status: row.stripe_transfer_status,
    created_at: row.created_at
  }));
  printRows('Duplicate Transfer Risks After Execution', postflight.duplicateTransferRisks, (row) => row);
  printRows('Stuck Reservations After Execution', postflight.stuckReservations, (row) => row);
  printRows('Live Eligibility Rows After Execution', postflight.eligibilityResults, (row) => ({
    source_type: row.source_type,
    source_id: row.source_id,
    amount: row.amount,
    payout_status: row.payout_status,
    claim_batch_id: row.claim_batch_id,
    eligible_for_live_payout: row.eligible_for_live_payout,
    blockers: row.blockers
  }));
}

async function getCreator(creatorCode) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_code', creatorCode)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function getConversion(conversionId) {
  const { data, error } = await supabase
    .from('conversions')
    .select('*')
    .eq('id', conversionId)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function getDirectRows(creatorId) {
  const { data, error } = await supabase
    .from('conversions')
    .select('id, order_id, creator_id, commission_amount, platform_fee_amount, payout_status, claimable_at, claim_batch_id, settlement_status, manual_approved_at, settlement_collected_at, reserve_covered_at, claimed_at')
    .eq('creator_id', creatorId)
    .in('payout_status', ['pending', 'claimable', 'claimed']);
  if (error) throw error;
  return data || [];
}

async function getNetworkRows(creatorId) {
  const { data, error } = await supabase
    .from('creator_network_earnings')
    .select('id, conversion_id, earning_creator_id, commission_amount, payout_status, claimable_at, claim_batch_id, settlement_status, manual_approved_at, settlement_collected_at, reserve_covered_at, claimed_at')
    .eq('earning_creator_id', creatorId)
    .in('payout_status', ['pending', 'claimable', 'claimed']);
  if (error) throw error;
  return data || [];
}

async function getCreatorClaims(creatorId) {
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getDuplicateTransferRisks() {
  const { data, error } = await supabase
    .from('creator_earning_claims')
    .select('id, stripe_transfer_id')
    .not('stripe_transfer_id', 'is', null);
  if (error) throw error;
  return duplicateGroups(data || [], (row) => row.stripe_transfer_id).map((group) => ({
    stripe_transfer_id: group.key,
    count: group.count,
    claim_ids: group.ids
  }));
}

function buildClaimPreviewRows({ directRows, networkRows, payoutGate }) {
  return directRows.map((row) => buildClaimPreviewRow({
    sourceTable: 'conversions',
    sourceType: 'direct_commission',
    sourceId: row.id,
    conversionId: row.id,
    amount: row.commission_amount,
    row,
    payoutGate
  })).concat(networkRows.map((row) => buildClaimPreviewRow({
    sourceTable: 'creator_network_earnings',
    sourceType: 'creator_network_override',
    sourceId: row.id,
    conversionId: row.conversion_id,
    amount: row.commission_amount,
    row,
    payoutGate
  })));
}

function buildClaimPreviewRow({
  sourceTable,
  sourceType,
  sourceId,
  conversionId,
  amount,
  row,
  payoutGate
}) {
  const reasons = [];
  const status = row.payout_status || 'pending';
  const claimableAt = row.claimable_at ? new Date(row.claimable_at) : null;
  const timeBasedReady = claimableAt && claimableAt <= new Date();
  const rowAllowedByMode = isRowClaimableByPayoutMode(row, payoutGate);

  if (status === 'claimed') reasons.push('row is already claimed');
  if (row.claim_batch_id) reasons.push('row already has claim_batch_id reservation');
  if (status !== 'claimable' && !(status === 'pending' && timeBasedReady)) {
    reasons.push('row is not claimable or promotable by time window');
  }
  if (!rowAllowedByMode) reasons.push('row is not claimable under current payout mode');

  return {
    source_table: sourceTable,
    source_type: sourceType,
    source_id: sourceId,
    conversion_id: conversionId,
    order_id: row.order_id || null,
    amount: roundMoney(amount),
    payout_status: status,
    claimable_at: row.claimable_at || null,
    claim_batch_id: row.claim_batch_id || null,
    would_promote_from_pending: status === 'pending' && Boolean(timeBasedReady) && rowAllowedByMode,
    would_reserve: reasons.length === 0,
    blocker_reasons: reasons
  };
}

function findStuckReservations({ directRows, networkRows, existingClaims }) {
  const claimIds = new Set((existingClaims || []).map((row) => row.id));
  return directRows.concat(networkRows)
    .filter((row) => row.claim_batch_id && row.payout_status !== 'claimed' && !claimIds.has(row.claim_batch_id))
    .map((row) => ({
      source_table: row.order_id ? 'conversions' : 'creator_network_earnings',
      source_id: row.id,
      claim_batch_id: row.claim_batch_id,
      payout_status: row.payout_status
    }));
}

function summarizeConversion(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    creator_id: row.creator_id,
    commission_amount: Number(row.commission_amount || 0),
    platform_fee_amount: Number(row.platform_fee_amount || 0),
    payout_status: row.payout_status || null,
    claim_batch_id: row.claim_batch_id || null,
    claimable_at: row.claimable_at || null,
    claimed_at: row.claimed_at || null
  };
}

function duplicateGroups(rows, keyFn) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .filter(([, groupedRows]) => groupedRows.length > 1)
    .map(([key, groupedRows]) => ({
      key,
      count: groupedRows.length,
      ids: groupedRows.map((row) => row.id)
    }));
}

function getStripeKeyMode() {
  const key = String(STRIPE_SECRET_KEY || '');
  if (!key) return 'missing';
  if (/^sk_test_/.test(key)) return 'test';
  if (/^sk_live_/.test(key)) return 'live';
  return 'unknown';
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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
  console.error('\nSandbox claim operator failed:');
  console.error(error.message);
  process.exitCode = 1;
});
