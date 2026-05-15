const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_BASE_URL, NODE_ENV } = require('../config/config/env');

function createAuthClient(req, res) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: false,
      storage: {
        getItem: (key) => req.cookies[key] || null,
        setItem: (key, value) => {
          res.cookie(key, value, authCookieOptions());
        },
        removeItem: (key) => {
          res.clearCookie(key, authClearCookieOptions());
        }
      }
    }
  });
}

async function getGoogleOAuthUrl(req, res, inviteCode) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const supabaseAuth = createAuthClient(req, res);
  const callbackUrl = new URL('/auth/callback', PUBLIC_BASE_URL);
  if (inviteCode) {
    callbackUrl.searchParams.set('invite', inviteCode);
  }

  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString()
    }
  });

  if (error) throw error;
  return data.url;
}

async function exchangeAuthCodeForUser(req, res, code) {
  const supabaseAuth = createAuthClient(req, res);
  const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data || !data.session || !data.session.user) {
    throw new Error('Supabase auth callback did not return a user session.');
  }
  return data.session.user;
}

async function getCurrentAuthUser(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const supabaseAuth = createAuthClient(req, res);
  const { data, error } = await supabaseAuth.auth.getUser();
  if (error) return null;
  return data && data.user ? data.user : null;
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function authClearCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}

module.exports = {
  getGoogleOAuthUrl,
  exchangeAuthCodeForUser,
  getCurrentAuthUser
};
