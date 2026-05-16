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

  const accountId = creator.stripe_account_id || await createConnectedAccount(creator);
  if (!creator.stripe_account_id) {
    await updateCreatorStripeState(creator.id, {
      stripe_account_id: accountId,
      stripe_onboarding_status: 'pending'
    });
  }

  const account = await retrieveConnectedAccount(accountId);
  await persistOnboardingStatus(creator.id, account);

  const link = await createAccountLink(accountId);
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
  if (account && account.details_submitted && account.payouts_enabled) {
    return 'complete';
  }
  if (account && account.details_submitted) {
    return 'pending';
  }
  return 'pending';
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
  refreshCreatorStripeStatus
};
