const supabase = require('../database/database/supabase');
const { STRIPE_SECRET_KEY, PUBLIC_BASE_URL } = require('../config/config/env');
const { log } = require('./services/logger');

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function createStripeOnboardingLinkForCreator(creator) {
  if (!creator || !creator.id) {
    throw new Error('Creator is required for Stripe onboarding.');
  }
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  if (!/^sk_test_/.test(STRIPE_SECRET_KEY)) {
    throw new Error('Stripe Connect onboarding is restricted to test mode for this MVP.');
  }

  log('Stripe onboarding start requested:', {
    creatorId: creator.id,
    hasStripeAccount: Boolean(creator.stripe_account_id),
    currentStatus: creator.stripe_onboarding_status || 'not_connected'
  });

  const accountId = creator.stripe_account_id || await createConnectedAccount(creator);
  if (!creator.stripe_account_id) {
    await updateCreatorStripeState(creator.id, {
      stripe_account_id: accountId,
      stripe_onboarding_status: 'pending'
    });
  }

  const account = await retrieveConnectedAccount(accountId);
  const updatedCreator = await persistOnboardingStatus(creator.id, account);
  logStripeDebugState('Stripe onboarding start account decision:', creator, account, updatedCreator.stripe_onboarding_status);
  if (isOnboardingAlreadySubmitted(account)) {
    log('Stripe onboarding already submitted; skipping new account link:', {
      creatorId: creator.id,
      accountId,
      status: updatedCreator.stripe_onboarding_status
    });
    return null;
  }

  const link = await createAccountLink(accountId);
  log('Stripe onboarding account link generated:', {
    creatorId: creator.id,
    accountId,
    status: updatedCreator.stripe_onboarding_status
  });
  return link.url;
}

async function refreshCreatorStripeStatus(creator) {
  if (!creator || !creator.id || !creator.stripe_account_id || !STRIPE_SECRET_KEY) {
    return creator;
  }

  try {
    const account = await retrieveConnectedAccount(creator.stripe_account_id);
    return await persistOnboardingStatus(creator.id, account);
  } catch (error) {
    log('Stripe status refresh failed:', { creatorId: creator.id, message: error.message });
    return creator;
  }
}

async function getCreatorStripeDebugStatus(creator) {
  if (!creator || !creator.id) {
    throw new Error('Creator is required for Stripe debug status.');
  }
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  if (!creator.stripe_account_id) {
    return {
      creator_code: creator.creator_code || null,
      stripe_account_id: null,
      stripe_onboarding_status: creator.stripe_onboarding_status || 'not_connected',
      details_submitted: null,
      charges_enabled: null,
      payouts_enabled: null,
      requirements: {
        currently_due: [],
        eventually_due: [],
        disabled_reason: null
      },
      app_decision: 'would_generate_onboarding_link'
    };
  }

  const account = await retrieveConnectedAccount(creator.stripe_account_id);
  const status = getOnboardingStatus(account);
  const updatedCreator = await persistOnboardingStatus(creator.id, account);
  const debug = buildStripeDebugPayload(creator, account, updatedCreator.stripe_onboarding_status || status);
  log('Stripe debug route account state:', debug);
  return debug;
}

async function createConnectedAccount(creator) {
  const body = new URLSearchParams();
  body.set('type', 'express');
  body.set('country', 'US');
  body.set('capabilities[transfers][requested]', 'true');
  if (creator.email) body.set('email', creator.email);
  body.set('metadata[creator_id]', String(creator.id));
  if (creator.creator_code) body.set('metadata[creator_code]', creator.creator_code);

  const account = await stripeRequest('/accounts', {
    method: 'POST',
    body
  });

  return account.id;
}

async function retrieveConnectedAccount(accountId) {
  return stripeRequest(`/accounts/${encodeURIComponent(accountId)}`, { method: 'GET' });
}

async function createAccountLink(accountId) {
  const body = new URLSearchParams();
  body.set('account', accountId);
  body.set('refresh_url', new URL('/stripe/connect/refresh', PUBLIC_BASE_URL).toString());
  body.set('return_url', new URL('/stripe/connect/return', PUBLIC_BASE_URL).toString());
  body.set('type', 'account_onboarding');

  return stripeRequest('/account_links', {
    method: 'POST',
    body
  });
}

async function persistOnboardingStatus(creatorId, account) {
  const status = getOnboardingStatus(account);
  logStripeAccountState('Stripe account status refreshed:', creatorId, account, status);
  const { data, error } = await supabase
    .from('creators')
    .update({ stripe_onboarding_status: status })
    .eq('id', creatorId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function updateCreatorStripeState(creatorId, values) {
  const { data, error } = await supabase
    .from('creators')
    .update(values)
    .eq('id', creatorId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

function getOnboardingStatus(account) {
  if (!account) return 'pending';
  if (account.payouts_enabled) {
    return 'payouts_enabled';
  }
  if (account.details_submitted && account.charges_enabled) {
    return 'connected';
  }
  if (account.details_submitted) {
    return 'connected';
  }
  return 'pending';
}

function isOnboardingAlreadySubmitted(account) {
  return Boolean(account && account.details_submitted);
}

function logStripeAccountState(message, creatorId, account, status) {
  log(message, {
    creatorId,
    accountId: account ? account.id : null,
    details_submitted: Boolean(account && account.details_submitted),
    charges_enabled: Boolean(account && account.charges_enabled),
    payouts_enabled: Boolean(account && account.payouts_enabled),
    requirements_currently_due: getRequirementList(account, 'currently_due'),
    requirements_eventually_due: getRequirementList(account, 'eventually_due'),
    requirements_disabled_reason: account && account.requirements ? account.requirements.disabled_reason || null : null,
    mappedStatus: status
  });
}

function logStripeDebugState(message, creator, account, status) {
  log(message, buildStripeDebugPayload(creator, account, status));
}

function buildStripeDebugPayload(creator, account, status) {
  return {
    creator_code: creator ? creator.creator_code || null : null,
    stripe_account_id: account ? account.id : creator ? creator.stripe_account_id || null : null,
    stripe_onboarding_status: status || (creator ? creator.stripe_onboarding_status || 'not_connected' : 'not_connected'),
    details_submitted: account ? Boolean(account.details_submitted) : null,
    charges_enabled: account ? Boolean(account.charges_enabled) : null,
    payouts_enabled: account ? Boolean(account.payouts_enabled) : null,
    requirements: {
      currently_due: getRequirementList(account, 'currently_due'),
      eventually_due: getRequirementList(account, 'eventually_due'),
      disabled_reason: account && account.requirements ? account.requirements.disabled_reason || null : null
    },
    app_decision: account && isOnboardingAlreadySubmitted(account)
      ? 'show_connected_do_not_generate_onboarding_link'
      : 'would_generate_onboarding_link'
  };
}

function getRequirementList(account, key) {
  if (!account || !account.requirements || !Array.isArray(account.requirements[key])) {
    return [];
  }
  return account.requirements[key];
}

async function stripeRequest(path, options) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options && options.headers ? options.headers : {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && data.error && data.error.message ? data.error.message : `Stripe request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

module.exports = {
  createStripeOnboardingLinkForCreator,
  getCreatorStripeDebugStatus,
  refreshCreatorStripeStatus
};
