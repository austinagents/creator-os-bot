const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_BASE_URL, NODE_ENV } = require('../config/config/env');
const { log } = require('./services/logger');

const ACCESS_COOKIE_NAME = 'partnerlinks_auth_access';
const REFRESH_COOKIE_NAME = 'partnerlinks_auth_refresh';
const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
          if (isSupabaseSessionStorageKey(key)) {
            logAuthDebug('Skipped oversized Supabase session storage cookie', { key });
            return;
          }
          logAuthDebug('Setting Supabase auth helper cookie', {
            key,
            maxAgeMs: AUTH_COOKIE_MAX_AGE_MS,
            secure: NODE_ENV === 'production'
          });
          res.cookie(key, value, authCookieOptions());
        },
        removeItem: (key) => {
          logAuthDebug('Clearing Supabase auth helper cookie', { key });
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
  setAuthSessionCookies(res, data.session);
  logAuthDebug('OAuth callback persisted auth session cookies', {
    hasAccessToken: Boolean(data.session.access_token),
    hasRefreshToken: Boolean(data.session.refresh_token),
    maxAgeMs: AUTH_COOKIE_MAX_AGE_MS,
    secure: NODE_ENV === 'production'
  });
  return data.session.user;
}

async function getCurrentAuthUser(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  const supabaseAuth = createAuthClient(req, res);
  const accessToken = req.cookies[ACCESS_COOKIE_NAME];
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
  logAuthDebug('Restoring auth session from cookies', {
    hasAccessCookie: Boolean(accessToken),
    hasRefreshCookie: Boolean(refreshToken)
  });

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data: sessionData, error: sessionError } = await supabaseAuth.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (sessionError || !sessionData || !sessionData.session) {
    logAuthDebug('Auth session restore failed', {
      hasSessionError: Boolean(sessionError),
      message: sessionError ? sessionError.message : 'No session returned'
    });
    clearAuthSessionCookies(res);
    return null;
  }

  setAuthSessionCookies(res, sessionData.session);

  const { data, error } = await supabaseAuth.auth.getUser(sessionData.session.access_token);
  if (error) {
    logAuthDebug('Auth user lookup failed', { message: error.message });
    clearAuthSessionCookies(res);
    return null;
  }

  logAuthDebug('Auth user lookup succeeded', {
    hasUser: Boolean(data && data.user),
    userId: data && data.user ? data.user.id : null
  });
  return data && data.user ? data.user : null;
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
    ...authCookieDomainOption()
  };
}

function authClearCookieOptions() {
  return {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...authCookieDomainOption()
  };
}

function setAuthSessionCookies(res, session) {
  if (!session || !session.access_token || !session.refresh_token) return;

  res.cookie(ACCESS_COOKIE_NAME, session.access_token, authCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, session.refresh_token, authCookieOptions());
}

function clearAuthSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, authClearCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, authClearCookieOptions());
}

function isSupabaseSessionStorageKey(key) {
  return typeof key === 'string' && /-auth-token$/.test(key);
}

function authCookieDomainOption() {
  try {
    const hostname = new URL(PUBLIC_BASE_URL).hostname;
    if (NODE_ENV === 'production' && (hostname === 'partnerlinks.app' || hostname === 'www.partnerlinks.app')) {
      return { domain: '.partnerlinks.app' };
    }
  } catch (error) {}

  return {};
}

function logAuthDebug(message, details) {
  log(`[auth] ${message}`, details || {});
}

module.exports = {
  getGoogleOAuthUrl,
  exchangeAuthCodeForUser,
  getCurrentAuthUser
};
