const supabase = require('../database/database/supabase');
const { normalizeCode } = require('../utils/slug');

async function getCreatorDashboardByCode(creatorCode) {
  const normalizedCreatorCode = normalizeCode(creatorCode);
  if (!normalizedCreatorCode) return null;

  const creator = await findCreatorByCode(normalizedCreatorCode);
  if (!creator) return null;

  const [
    directReferralsCount,
    secondLevelReferralsCount,
    thirdLevelReferralsCount,
    conversionStats,
    networkEarnings
  ] = await Promise.all([
    countDirectReferrals(creator.id),
    countNestedReferrals(creator.id, 2),
    countNestedReferrals(creator.id, 3),
    getConversionStats(creator.id),
    getNetworkEarnings(creator.id)
  ]);

  const directCommissionEarned = conversionStats.directCommissionEarned;
  const totalEarnings = directCommissionEarned + networkEarnings;

  return {
    creator,
    displayName: creator.display_name || creator.discord_username || creator.creator_code,
    creatorCode: normalizeCode(creator.creator_code),
    inviteLink: creator.join_referral_link || null,
    directReferralsCount,
    secondLevelReferralsCount,
    thirdLevelReferralsCount,
    totalConversions: conversionStats.totalConversions,
    totalOrderValue: conversionStats.totalOrderValue,
    directCommissionEarned,
    networkEarnings,
    totalEarnings
  };
}

async function findCreatorByCode(creatorCode) {
  const normalizedCreatorCode = normalizeCode(creatorCode);
  const { data: creatorCodeMatches, error: creatorCodeError } = await supabase
    .from('creators')
    .select('*')
    .ilike('creator_code', normalizedCreatorCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (creatorCodeError) throw creatorCodeError;
  if (creatorCodeMatches && creatorCodeMatches[0]) return creatorCodeMatches[0];

  const { data: referralCodeMatches, error: referralCodeError } = await supabase
    .from('creators')
    .select('*')
    .ilike('referral_code', normalizedCreatorCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (referralCodeError) throw referralCodeError;
  return referralCodeMatches ? referralCodeMatches[0] : null;
}

async function countDirectReferrals(creatorId) {
  const { count, error } = await supabase
    .from('creators')
    .select('id', { count: 'exact', head: true })
    .eq('parent_creator_id', creatorId);
  if (error) throw error;
  return count || 0;
}

async function countNestedReferrals(rootCreatorId, level) {
  let currentParentIds = [rootCreatorId];

  for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
    const { data, error } = await supabase
      .from('creators')
      .select('id')
      .in('parent_creator_id', currentParentIds);
    if (error) throw error;

    const childIds = (data || []).map((creator) => creator.id);
    if (currentLevel === level) return childIds.length;
    if (!childIds.length) return 0;
    currentParentIds = childIds;
  }

  return 0;
}

async function getConversionStats(creatorId) {
  const { data, error } = await supabase
    .from('conversions')
    .select('order_value, commission_amount')
    .eq('creator_id', creatorId);
  if (error) throw error;

  const conversions = data || [];
  return {
    totalConversions: conversions.length,
    totalOrderValue: conversions.reduce((sum, row) => sum + Number(row.order_value || 0), 0),
    directCommissionEarned: conversions.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0)
  };
}

async function getNetworkEarnings(creatorId) {
  const { data, error } = await supabase
    .from('creator_network_earnings')
    .select('commission_amount')
    .eq('earning_creator_id', creatorId);
  if (error) throw error;

  return (data || []).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
}

module.exports = {
  getCreatorDashboardByCode
};
