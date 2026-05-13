const supabase = require('../database/database/supabase');
const { generateSlug, generateUniqueSlug } = require('../utils/slug');
const { PUBLIC_BASE_URL } = require('../config/config/env');

async function getCreatorByDiscordUserAndBrand(discordUserId, brandId) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (data && data.length > 1) {
    console.warn(`Multiple creators found for user ${discordUserId} and brand ${brandId}, returning latest`);
  }
  return data ? data[0] : null;
}

async function getCreatorByCode(creatorCode, brandId) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_code', creatorCode)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (data && data.length > 1) {
    console.warn(`Multiple creators found for code ${creatorCode} and brand ${brandId}, returning latest`);
  }
  return data ? data[0] : null;
}

async function getCreatorByCodeOrReferralCode(creatorCode, brandId) {
  const { data: creatorCodeMatches, error: creatorCodeError } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_code', creatorCode)
    .order('created_at', { ascending: false });
  if (creatorCodeError) throw creatorCodeError;

  const { data: referralCodeMatches, error: referralCodeError } = await supabase
    .from('creators')
    .select('*')
    .eq('referral_code', creatorCode)
    .order('created_at', { ascending: false });
  if (referralCodeError) throw referralCodeError;

  const matchesById = new Map();
  for (const creator of creatorCodeMatches || []) {
    matchesById.set(creator.id, creator);
  }
  for (const creator of referralCodeMatches || []) {
    matchesById.set(creator.id, creator);
  }

  const matches = Array.from(matchesById.values());
  if (!matches.length) return null;

  const brandMatch = matches.find((creator) => String(creator.brand_id) === String(brandId));
  if (brandMatch) return brandMatch;

  const unassignedMatch = matches.find((creator) => !creator.brand_id);
  if (unassignedMatch) return unassignedMatch;

  console.warn(`Creator code ${creatorCode} did not match brand ${brandId}; returning latest global match`);
  return matches[0];
}

async function getCreatorByAuthUserId(authUserId) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getCreatorByEmail(email) {
  if (!email) return null;
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function getCreatorById(creatorId) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('id', creatorId)
    .single();
  if (error) throw error;
  return data;
}

function buildTrackingLink(brandName, creatorCode) {
  const brandSlug = generateSlug(brandName);
  return `${PUBLIC_BASE_URL}/r/${brandSlug}/${creatorCode}`;
}

function buildJoinReferralLink(creatorCode) {
  return `${PUBLIC_BASE_URL}/join/${creatorCode}`;
}

async function createCreator(discordUserId, discordUsername, brandId, refLinkTemplate, brandName) {
  // Generate unique creator code
  const existingCodes = await getAllCreatorCodes(brandId);
  const creatorCode = generateUniqueSlug(discordUsername, existingCodes);

  // Generate referral link (brand's direct link)
  const referralLink = refLinkTemplate.replace(/\{creator_slug\}|\{creator_code\}/g, creatorCode);

  // Generate tracking link (PartnerLinks-owned)
  const trackingLink = buildTrackingLink(brandName, creatorCode);
  const joinReferralLink = buildJoinReferralLink(creatorCode);

  const { data, error } = await supabase
    .from('creators')
    .insert({
      discord_user_id: discordUserId,
      discord_username: discordUsername,
      creator_code: creatorCode,
      referral_code: creatorCode,
      referral_link: referralLink,
      tracking_link: trackingLink,
      join_referral_link: joinReferralLink,
      brand_id: brandId,
      approved: true
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function findOrCreateWebCreator(authUser) {
  const email = authUser.email ? authUser.email.toLowerCase() : null;
  const metadata = authUser.user_metadata || {};
  const displayName = metadata.full_name || metadata.name || emailPrefix(email) || 'creator';
  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  let creator = await getCreatorByAuthUserId(authUser.id);
  if (creator) {
    return ensureWebCreatorFields(creator, {
      authUserId: authUser.id,
      email,
      displayName,
      avatarUrl
    });
  }

  creator = await getCreatorByEmail(email);
  if (creator) {
    return ensureWebCreatorFields(creator, {
      authUserId: authUser.id,
      email,
      displayName,
      avatarUrl
    });
  }

  return createWebCreator({
    authUserId: authUser.id,
    email,
    displayName,
    avatarUrl
  });
}

async function ensureTrackingLink(creator, brandName) {
  return ensureCreatorLinks(creator, brandName);
}

async function ensureCreatorLinks(creator, brandName) {
  const expectedLink = brandName ? buildTrackingLink(brandName, creator.creator_code) : creator.tracking_link;
  const expectedJoinLink = buildJoinReferralLink(creator.referral_code || creator.creator_code);
  const expectedReferralCode = creator.referral_code || creator.creator_code;
  if (
    creator.tracking_link !== expectedLink ||
    creator.join_referral_link !== expectedJoinLink ||
    creator.referral_code !== expectedReferralCode
  ) {
    const { data, error } = await supabase
      .from('creators')
      .update({
        tracking_link: expectedLink,
        join_referral_link: expectedJoinLink,
        referral_code: expectedReferralCode
      })
      .eq('id', creator.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  return creator;
}

async function ensureWebCreatorFields(creator, { authUserId, email, displayName, avatarUrl }) {
  const expectedReferralCode = creator.referral_code || creator.creator_code;
  const expectedJoinLink = buildJoinReferralLink(expectedReferralCode);
  const updates = {
    auth_user_id: creator.auth_user_id || authUserId,
    email: creator.email || email,
    display_name: creator.display_name || displayName,
    avatar_url: creator.avatar_url || avatarUrl,
    signup_source: creator.signup_source || 'google',
    referral_code: expectedReferralCode,
    join_referral_link: expectedJoinLink
  };

  const { data, error } = await supabase
    .from('creators')
    .update(updates)
    .eq('id', creator.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createWebCreator({ authUserId, email, displayName, avatarUrl }) {
  const existingCodes = await getAllCreatorCodesAcrossBrands();
  const baseName = displayName || emailPrefix(email) || 'creator';
  const creatorCode = generateUniqueSlug(baseName, existingCodes);
  const insertPayload = {
    discord_user_id: null,
    discord_username: displayName || emailPrefix(email) || creatorCode,
    auth_user_id: authUserId,
    email,
    display_name: displayName,
    avatar_url: avatarUrl,
    signup_source: 'google',
    creator_code: creatorCode,
    referral_code: creatorCode,
    referral_link: null,
    tracking_link: null,
    join_referral_link: buildJoinReferralLink(creatorCode),
    brand_id: null,
    approved: true
  };

  const firstAttempt = await supabase
    .from('creators')
    .insert(insertPayload)
    .select()
    .single();

  if (!firstAttempt.error) return firstAttempt.data;

  if (firstAttempt.error.code !== '23502') {
    throw firstAttempt.error;
  }

  const fallbackBrand = await getLatestBrand();
  if (!fallbackBrand) {
    throw firstAttempt.error;
  }

  const fallbackPayload = {
    ...insertPayload,
    discord_user_id: buildWebDiscordPlaceholder(),
    brand_id: fallbackBrand.id,
    referral_link: fallbackBrand.ref_link_template
      ? fallbackBrand.ref_link_template.replace(/\{creator_slug\}|\{creator_code\}/g, creatorCode)
      : null,
    tracking_link: buildTrackingLink(fallbackBrand.name, creatorCode)
  };

  const { data, error } = await supabase
    .from('creators')
    .insert(fallbackPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function buildWebDiscordPlaceholder() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 18);
}

async function getAllCreatorCodes(brandId) {
  const { data, error } = await supabase
    .from('creators')
    .select('creator_code')
    .eq('brand_id', brandId);
  if (error) throw error;
  return data.map(row => row.creator_code);
}

async function getAllCreatorCodesAcrossBrands() {
  const { data, error } = await supabase
    .from('creators')
    .select('creator_code, referral_code');
  if (error) throw error;
  return data.flatMap((row) => [row.creator_code, row.referral_code].filter(Boolean));
}

async function getLatestBrand() {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

function emailPrefix(email) {
  return email ? email.split('@')[0] : null;
}

async function getCreatorsByBrand(brandId) {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('brand_id', brandId);
  if (error) throw error;
  return data;
}

async function getTopCreatorsBySubmissions(brandId, limit = 10) {
  // Get creators and their submission counts
  const { data: creators, error: creatorsError } = await supabase
    .from('creators')
    .select('*')
    .eq('brand_id', brandId);
  if (creatorsError) throw creatorsError;

  const creatorsWithCounts = await Promise.all(creators.map(async (creator) => {
    const { count, error } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creator.id);
    if (error) throw error;
    return { ...creator, submissionCount: count };
  }));

  creatorsWithCounts.sort((a, b) => b.submissionCount - a.submissionCount);
  return creatorsWithCounts.slice(0, limit);
}

async function getCreatorStats(creatorId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact' })
    .eq('creator_id', creatorId);
  if (error) throw error;
  return { submissionCount: data.length };
}

module.exports = {
  getCreatorByDiscordUserAndBrand,
  getCreatorByCode,
  getCreatorByCodeOrReferralCode,
  getCreatorByAuthUserId,
  getCreatorByEmail,
  getCreatorById,
  createCreator,
  findOrCreateWebCreator,
  ensureTrackingLink,
  ensureCreatorLinks,
  buildTrackingLink,
  buildJoinReferralLink,
  getCreatorsByBrand,
  getTopCreatorsBySubmissions,
  getCreatorStats
};
