#!/usr/bin/env node

const supabase = require('../database/database/supabase');
const { normalizeCode } = require('../utils/slug');

const TEST_SIGNUP_SOURCE = 'production_safety_test';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const creatorCode = normalizeCode(args.creatorCode);
  const email = normalizeEmail(args.email);

  if (!creatorCode) throw new Error('Missing required --creator-code.');
  if (!email) throw new Error('Missing required --email.');
  if (!creatorCode.startsWith('test-creator-')) {
    throw new Error(`Refusing non-test creator code: ${creatorCode}`);
  }

  const creator = await getCreatorByCode(creatorCode);
  if (!creator) throw new Error(`Creator not found: ${creatorCode}`);
  if (!normalizeCode(creator.creator_code).startsWith('test-creator-')) {
    throw new Error(`Refusing non-test creator row: ${creator.creator_code}`);
  }

  const matchingUsers = await findAuthUsersByEmail(email);
  const authUser = matchingUsers.length === 1 ? matchingUsers[0] : null;
  const updates = authUser && !creator.auth_user_id ? buildUpdates({ creator, authUser, email }) : {};
  const safeToProceed = Boolean(
    creator &&
    !creator.auth_user_id &&
    matchingUsers.length === 1 &&
    authUser &&
    Object.keys(updates).length > 0
  );

  printVerification({
    args,
    creator,
    email,
    matchingUsers,
    authUser,
    updates,
    safeToProceed
  });

  if (args.verify && !args.apply) return;

  if (!args.apply) {
    console.log('\nDRY RUN: no changes written. Add --apply to bind this test creator after approval.');
    return;
  }

  if (!safeToProceed) {
    throw new Error('Refusing to apply because preflight checks did not pass.');
  }

  await updateCreatorAuthBinding(creator.id, updates);
  console.log('\nAPPLIED: test creator auth binding updated.');
  const refreshed = await getCreatorByCode(creatorCode);
  printVerification({
    args: { ...args, apply: false, verify: true },
    creator: refreshed,
    email,
    matchingUsers,
    authUser,
    updates: {},
    safeToProceed: false
  });
}

function parseArgs(argv) {
  const args = {
    creatorCode: null,
    email: null,
    apply: false,
    verify: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--creator-code') {
      args.creatorCode = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--email') {
      args.email = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--verify') {
      args.verify = true;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return args;
}

async function getCreatorByCode(creatorCode) {
  const { data, error } = await supabase
    .from('creators')
    .select('id, creator_code, auth_user_id, email, signup_source, stripe_account_id, stripe_onboarding_status')
    .eq('creator_code', creatorCode)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function findAuthUsersByEmail(email) {
  const matches = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data && data.users ? data.users : [];
    matches.push(...users.filter((user) => normalizeEmail(user.email) === email));
    if (users.length < perPage) break;
    page += 1;
  }

  return matches;
}

function buildUpdates({ creator, authUser, email }) {
  const updates = {
    auth_user_id: authUser.id,
    email
  };
  if (!creator.signup_source || creator.signup_source === TEST_SIGNUP_SOURCE) {
    updates.signup_source = TEST_SIGNUP_SOURCE;
  }
  return updates;
}

async function updateCreatorAuthBinding(creatorId, updates) {
  const allowedKeys = new Set(['auth_user_id', 'email', 'signup_source']);
  const unsafeKeys = Object.keys(updates).filter((key) => !allowedKeys.has(key));
  if (unsafeKeys.length) {
    throw new Error(`Refusing unsafe update keys: ${unsafeKeys.join(', ')}`);
  }

  const { error } = await supabase
    .from('creators')
    .update(updates)
    .eq('id', creatorId);
  if (error) throw error;
}

function printVerification({
  args,
  creator,
  email,
  matchingUsers,
  authUser,
  updates,
  safeToProceed
}) {
  console.log(JSON.stringify({
    mode: args.apply ? 'APPLY' : 'DRY_RUN',
    creator_code: creator ? creator.creator_code : normalizeCode(args.creatorCode),
    creator_id: creator ? creator.id : null,
    current_auth_user_id_present: Boolean(creator && creator.auth_user_id),
    current_email: creator ? creator.email || null : null,
    current_signup_source: creator ? creator.signup_source || null : null,
    stripe_account_id_present: Boolean(creator && creator.stripe_account_id),
    stripe_onboarding_status: creator ? creator.stripe_onboarding_status || 'not_connected' : null,
    requested_email: email,
    matching_auth_user_count: matchingUsers.length,
    matching_auth_user_id: authUser ? authUser.id : null,
    would_update: Object.keys(updates || {}).length > 0,
    update_fields: Object.keys(updates || {}),
    safe_to_proceed: safeToProceed,
    apply_requested: Boolean(args.apply),
    writes_enabled: Boolean(args.apply && safeToProceed)
  }, null, 2));

  if (creator && creator.auth_user_id) {
    console.log('Refusal reason: creator already has auth_user_id.');
  }
  if (matchingUsers.length === 0) {
    console.log('Refusal reason: no Supabase Auth user found for requested email.');
  }
  if (matchingUsers.length > 1) {
    console.log('Refusal reason: multiple Supabase Auth users matched requested email.');
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

main().catch((error) => {
  console.error('\nBind test creator auth failed:');
  console.error(error.message);
  process.exit(1);
});
