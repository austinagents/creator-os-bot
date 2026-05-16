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

module.exports = {
  PENDING_WINDOW_HOURS,
  EARNING_STATUS_PENDING,
  EARNING_STATUS_CLAIMABLE,
  EARNING_STATUS_CLAIMED,
  getClaimableAt,
  resolveLifecycleStatus,
  sumLifecycleAmounts
};
