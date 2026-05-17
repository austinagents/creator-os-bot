const {
  PAYOUT_MODE,
  STRIPE_SECRET_KEY
} = require('../config/config/env');

const PAYOUT_MODES = new Set([
  'sandbox_time_based',
  'claims_disabled',
  'manual_approval',
  'settlement_gated'
]);

function getPayoutClaimGate() {
  const rawMode = String(PAYOUT_MODE || 'claims_disabled').trim().toLowerCase();
  const recognized = PAYOUT_MODES.has(rawMode);
  const mode = recognized ? rawMode : 'unknown';
  const stripeKeyIsTest = /^sk_test_/.test(String(STRIPE_SECRET_KEY || ''));

  if (mode === 'sandbox_time_based') {
    if (stripeKeyIsTest) {
      return {
        allowed: true,
        mode,
        recognized,
        stripeKeyIsTest,
        claimabilityRule: 'time_based',
        reason: 'Sandbox time-based claims are enabled with a Stripe test key.',
        dashboardMessage: null
      };
    }

    return blockGate({
      mode,
      recognized,
      stripeKeyIsTest,
      claimabilityRule: 'none',
      reason: 'sandbox_time_based requires STRIPE_SECRET_KEY to start with sk_test_.'
    });
  }

  if (mode === 'manual_approval') {
    if (stripeKeyIsTest) {
      return {
        allowed: true,
        mode,
        recognized,
        stripeKeyIsTest,
        claimabilityRule: 'manual_approval',
        reason: 'Only explicitly manual-approved earnings can be claimed. Stripe transfers remain test-mode only.',
        dashboardMessage: 'Only manually approved earnings are claimable. Other accounted earnings remain pending settlement.'
      };
    }

    return blockGate({
      mode,
      recognized,
      stripeKeyIsTest,
      claimabilityRule: 'manual_approval',
      reason: 'manual_approval claims require a Stripe test key until live payouts are approved.'
    });
  }

  if (mode === 'settlement_gated') {
    if (stripeKeyIsTest) {
      return {
        allowed: true,
        mode,
        recognized,
        stripeKeyIsTest,
        claimabilityRule: 'settlement_or_reserve',
        reason: 'Only settlement-collected or reserve-covered earnings can be claimed. Stripe transfers remain test-mode only.',
        dashboardMessage: 'Only settlement-collected or reserve-covered earnings are claimable. Other accounted earnings remain pending settlement.'
      };
    }

    return blockGate({
      mode,
      recognized,
      stripeKeyIsTest,
      claimabilityRule: 'settlement_or_reserve',
      reason: 'settlement_gated claims require a Stripe test key until live payouts are approved.'
    });
  }

  const messages = {
    claims_disabled: 'Claims are unavailable until funding, approval, or reserve coverage is enabled.',
    unknown: 'Claims are unavailable because payout mode is not recognized.'
  };

  return blockGate({
    mode,
    recognized,
    stripeKeyIsTest,
    claimabilityRule: 'none',
    reason: messages[mode] || messages.unknown
  });
}

function blockGate({
  mode,
  recognized,
  stripeKeyIsTest,
  claimabilityRule,
  reason
}) {
  return {
    allowed: false,
    mode,
    recognized,
    stripeKeyIsTest,
    claimabilityRule,
    reason,
    dashboardMessage: reason || 'Claims are unavailable until settlement or approval is enabled.'
  };
}

function isManualApproved(row) {
  return Boolean(
    row
    && (
      row.manual_approved_at
      || row.settlement_status === 'manual_approved'
    )
  );
}

function isSettlementCollected(row) {
  return Boolean(
    row
    && (
      row.settlement_collected_at
      || row.settlement_status === 'settlement_collected'
    )
  );
}

function isReserveCovered(row) {
  return Boolean(
    row
    && (
      row.reserve_covered_at
      || row.settlement_status === 'reserve_covered'
    )
  );
}

function isRowClaimableByPayoutMode(row, payoutClaimGate = getPayoutClaimGate()) {
  if (!row || !payoutClaimGate.allowed) return false;
  if (payoutClaimGate.claimabilityRule === 'time_based') return true;
  if (payoutClaimGate.claimabilityRule === 'manual_approval') return isManualApproved(row);
  if (payoutClaimGate.claimabilityRule === 'settlement_or_reserve') {
    return isSettlementCollected(row) || isReserveCovered(row);
  }
  return false;
}

function applyClaimabilityFilter(query, payoutClaimGate = getPayoutClaimGate()) {
  if (!payoutClaimGate.allowed) return query.eq('id', -1);
  if (payoutClaimGate.claimabilityRule === 'time_based') return query;
  if (payoutClaimGate.claimabilityRule === 'manual_approval') {
    return query.or('manual_approved_at.not.is.null,settlement_status.eq.manual_approved');
  }
  if (payoutClaimGate.claimabilityRule === 'settlement_or_reserve') {
    return query.or('settlement_collected_at.not.is.null,reserve_covered_at.not.is.null,settlement_status.eq.settlement_collected,settlement_status.eq.reserve_covered');
  }
  return query.eq('id', -1);
}

module.exports = {
  PAYOUT_MODES,
  getPayoutClaimGate,
  isRowClaimableByPayoutMode,
  applyClaimabilityFilter
};
