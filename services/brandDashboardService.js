const supabase = require('../database/database/supabase');
const {
  getBrandSalesDashboardStats,
  getCreatorLeaderboardStats
} = require('./trackingService');
const { PUBLIC_BASE_URL } = require('../config/config/env');
const { generateSlug, normalizeCode } = require('../utils/slug');

async function getBrandDashboardBySlug(brandSlug) {
  const normalizedBrandSlug = normalizeCode(brandSlug);
  if (!normalizedBrandSlug) return null;

  const brand = await findBrandBySlug(normalizedBrandSlug);
  if (!brand) return null;

  const [
    stats,
    activeCreators,
    topCreators,
    recentConversions
  ] = await Promise.all([
    getBrandSalesDashboardStats(brand.id),
    countActiveCreators(brand.id),
    getCreatorLeaderboardStats(brand.id, 5),
    getRecentConversions(brand.id)
  ]);

  const brandSlugCanonical = generateSlug(brand.name);
  const conversionRate = stats.totalClicks > 0
    ? (stats.totalConversions / stats.totalClicks) * 100
    : 0;

  return {
    brand,
    brandName: brand.name,
    brandSlug: brandSlugCanonical,
    totalTrackedRevenue: stats.totalRevenue,
    activeCreators,
    totalConversions: stats.totalConversions,
    platformFeesGenerated: stats.totalPlatformFees,
    networkPayouts: stats.totalCreatorNetworkEarningsOwed,
    conversionRate,
    recentConversions,
    topCreators,
    trackingLinkPreview: `${PUBLIC_BASE_URL}/r/${brandSlugCanonical}/:creator_code`,
    creatorOnboardingLink: `${PUBLIC_BASE_URL}/join/brand/${brandSlugCanonical}`
  };
}

async function findBrandBySlug(brandSlug) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || []).find((brand) => generateSlug(brand.name) === brandSlug) || null;
}

async function countActiveCreators(brandId) {
  const { count, error } = await supabase
    .from('creators')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId);
  if (error) throw error;
  return count || 0;
}

async function getRecentConversions(brandId) {
  const { data, error } = await supabase
    .from('conversions')
    .select('id, creator_id, order_id, order_value, commission_amount, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;

  const conversions = data || [];
  const creatorIds = [...new Set(conversions.map((row) => row.creator_id).filter(Boolean))];
  if (!creatorIds.length) return conversions.map((row) => ({ ...row, creator_code: 'unknown' }));

  const { data: creators, error: creatorsError } = await supabase
    .from('creators')
    .select('id, creator_code')
    .in('id', creatorIds);
  if (creatorsError) throw creatorsError;

  const creatorCodes = new Map((creators || []).map((creator) => [creator.id, creator.creator_code]));
  return conversions.map((row) => ({
    ...row,
    creator_code: creatorCodes.get(row.creator_id) || 'unknown'
  }));
}

module.exports = {
  getBrandDashboardBySlug
};
