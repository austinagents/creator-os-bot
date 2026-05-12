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

function buildTrackingLink(brandName, creatorCode) {
  const brandSlug = generateSlug(brandName);
  return `${PUBLIC_BASE_URL}/r/${brandSlug}/${creatorCode}`;
}

async function createCreator(discordUserId, discordUsername, brandId, refLinkTemplate, brandName) {
  // Generate unique creator code
  const existingCodes = await getAllCreatorCodes(brandId);
  const creatorCode = generateUniqueSlug(discordUsername, existingCodes);

  // Generate referral link (brand's direct link)
  const referralLink = refLinkTemplate.replace(/\{creator_slug\}|\{creator_code\}/g, creatorCode);

  // Generate tracking link (PartnerLinks-owned)
  const trackingLink = buildTrackingLink(brandName, creatorCode);

  const { data, error } = await supabase
    .from('creators')
    .insert({
      discord_user_id: discordUserId,
      discord_username: discordUsername,
      creator_code: creatorCode,
      referral_link: referralLink,
      tracking_link: trackingLink,
      brand_id: brandId,
      approved: true
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function ensureTrackingLink(creator, brandName) {
  const expectedLink = buildTrackingLink(brandName, creator.creator_code);
  if (creator.tracking_link !== expectedLink) {
    const { data, error } = await supabase
      .from('creators')
      .update({ tracking_link: expectedLink })
      .eq('id', creator.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  return creator;
}

async function getAllCreatorCodes(brandId) {
  const { data, error } = await supabase
    .from('creators')
    .select('creator_code')
    .eq('brand_id', brandId);
  if (error) throw error;
  return data.map(row => row.creator_code);
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
  createCreator,
  ensureTrackingLink,
  buildTrackingLink,
  getCreatorsByBrand,
  getTopCreatorsBySubmissions,
  getCreatorStats
};