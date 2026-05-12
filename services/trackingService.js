const supabase = require('../database/database/supabase');
const crypto = require('crypto');
const { generateSlug } = require('../utils/slug');

async function getBrandBySlug(slug) {
  console.log('getBrandBySlug incoming slug:', slug);
  const { data: brands, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  console.log('getBrandBySlug candidate brand names:', brands.map(b => b.name));
  for (const brand of brands) {
    const normalized = generateSlug(brand.name);
    console.log(`getBrandBySlug checking ${brand.name} -> ${normalized} vs ${slug}`);
    if (normalized === slug) {
      console.log('getBrandBySlug matched brand:', brand);
      return brand;
    }
  }
  console.log('getBrandBySlug no match found');
  return null;
}

async function getCreatorByCodeAndBrand(creatorCode, brandId) {
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

async function recordClick(brandId, creatorId, sessionId, ipHash, userAgent, referrer, destinationUrl) {
  const { data, error } = await supabase
    .from('clicks')
    .insert({
      brand_id: brandId,
      creator_id: creatorId,
      session_id: sessionId,
      ip_hash: ipHash,
      user_agent: userAgent,
      referrer: referrer,
      destination_url: destinationUrl
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertAttributionSession(brandId, sessionId, creatorId, clickId) {
  const updatedAt = new Date().toISOString();

  console.log('upsertAttributionSession checking existing:', { brandId, sessionId, creatorId, clickId });

  const { data: existingRows, error: existingError } = await supabase
    .from('attribution_sessions')
    .select('*')
    .eq('brand_id', brandId)
    .eq('session_id', sessionId)
    .limit(1);
  if (existingError) {
    console.warn('upsertAttributionSession existing lookup failed:', existingError.message);
    throw existingError;
  }

  const existing = existingRows ? existingRows[0] : null;
  if (existing) {
    const { data, error } = await supabase
      .from('attribution_sessions')
      .update({
        current_creator_id: creatorId || existing.current_creator_id,
        last_click_id: clickId || existing.last_click_id,
        updated_at: updatedAt
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      console.warn('upsertAttributionSession existing update failed:', error.message);
      throw error;
    }
    console.log('upsertAttributionSession reused existing session:', { id: data.id, brandId, sessionId });
    return data;
  }

  const { data, error } = await supabase
    .from('attribution_sessions')
    .insert({
      brand_id: brandId,
      session_id: sessionId,
      current_creator_id: creatorId || null,
      last_click_id: clickId || null,
      updated_at: updatedAt
    })
    .select()
    .single();

  if (!error) {
    console.log('upsertAttributionSession created session:', { id: data.id, brandId, sessionId });
    return data;
  }

  if (error.code !== '23505') {
    console.warn('upsertAttributionSession insert failed:', error.message);
    throw error;
  }

  console.warn('upsertAttributionSession duplicate insert raced existing session; reusing session:', { brandId, sessionId });

  const { data: racedRows, error: racedLookupError } = await supabase
    .from('attribution_sessions')
    .select('*')
    .eq('brand_id', brandId)
    .eq('session_id', sessionId)
    .limit(1);
  if (racedLookupError) {
    console.warn('upsertAttributionSession raced lookup failed:', racedLookupError.message);
    throw racedLookupError;
  }

  const raced = racedRows ? racedRows[0] : null;
  if (!raced) {
    throw error;
  }

  const { data: updatedRace, error: racedUpdateError } = await supabase
    .from('attribution_sessions')
    .update({
      current_creator_id: creatorId || raced.current_creator_id,
      last_click_id: clickId || raced.last_click_id,
      updated_at: updatedAt
    })
    .eq('id', raced.id)
    .select()
    .single();
  if (racedUpdateError) {
    console.warn('upsertAttributionSession raced update failed:', racedUpdateError.message);
    throw racedUpdateError;
  }

  return updatedRace;
}

async function getLatestAttributionSessionForCreator(brandId, creatorId) {
  const { data, error } = await supabase
    .from('attribution_sessions')
    .select('*')
    .eq('brand_id', brandId)
    .eq('current_creator_id', creatorId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data ? data[0] : null;
}

async function recordConversion({
  brandId,
  creatorId,
  attributionSessionId,
  clickId,
  sessionId,
  orderId,
  orderValue,
  currency = 'USD',
  commissionRate,
  commissionAmount,
  source = 'manual',
  notes
}) {
  const { data, error } = await supabase
    .from('conversions')
    .insert({
      brand_id: brandId,
      creator_id: creatorId,
      attribution_session_id: attributionSessionId || null,
      click_id: clickId || null,
      session_id: sessionId || null,
      order_id: orderId || null,
      order_value: orderValue,
      currency,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      source,
      notes: notes || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getCreatorTrackingStats(creatorId) {
  const { data, error } = await supabase
    .from('clicks')
    .select('session_id, created_at')
    .eq('creator_id', creatorId);
  if (error) throw error;

  const { data: conversions, error: conversionsError } = await supabase
    .from('conversions')
    .select('order_value, commission_amount')
    .eq('creator_id', creatorId);
  if (conversionsError && conversionsError.code !== '42P01') throw conversionsError;

  const totalClicks = data.length;
  const uniqueSessions = new Set(data.map((row) => row.session_id)).size;
  const lastClickRow = data
    .filter((row) => row.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const lastClick = lastClickRow ? new Date(lastClickRow.created_at).toISOString() : 'No clicks yet';
  const conversionRows = conversions || [];
  const totalConversions = conversionRows.length;
  const totalRevenue = conversionRows.reduce((sum, row) => sum + Number(row.order_value || 0), 0);
  const estimatedCommission = conversionRows.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);

  return { totalClicks, uniqueSessions, lastClick, totalConversions, totalRevenue, estimatedCommission };
}

async function getBrandSalesDashboardStats(brandId) {
  const { data: clicks, error: clicksError } = await supabase
    .from('clicks')
    .select('session_id')
    .eq('brand_id', brandId);
  if (clicksError) throw clicksError;

  const { data: conversions, error: conversionsError } = await supabase
    .from('conversions')
    .select('order_value, commission_amount, created_at')
    .eq('brand_id', brandId);
  if (conversionsError) throw conversionsError;

  const conversionRows = conversions || [];
  const latestConversionRow = conversionRows
    .filter((row) => row.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  return {
    totalClicks: clicks.length,
    uniqueSessions: new Set(clicks.map((row) => row.session_id)).size,
    totalConversions: conversionRows.length,
    totalRevenue: conversionRows.reduce((sum, row) => sum + Number(row.order_value || 0), 0),
    estimatedCommissionsOwed: conversionRows.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0),
    latestConversionDate: latestConversionRow ? new Date(latestConversionRow.created_at).toISOString() : null
  };
}

async function getCreatorLeaderboardStats(brandId, limit = 10) {
  const { data: creators, error: creatorsError } = await supabase
    .from('creators')
    .select('id, creator_code')
    .eq('brand_id', brandId);
  if (creatorsError) throw creatorsError;

  if (!creators.length) {
    return [];
  }

  const { data: clicks, error: clicksError } = await supabase
    .from('clicks')
    .select('creator_id')
    .eq('brand_id', brandId);
  if (clicksError) throw clicksError;

  const { data: conversions, error: conversionsError } = await supabase
    .from('conversions')
    .select('creator_id, order_value, commission_amount')
    .eq('brand_id', brandId);
  if (conversionsError) throw conversionsError;

  const clickCounts = new Map();
  for (const click of clicks) {
    if (!click.creator_id) continue;
    clickCounts.set(click.creator_id, (clickCounts.get(click.creator_id) || 0) + 1);
  }

  const conversionStats = new Map();
  for (const conversion of conversions || []) {
    if (!conversion.creator_id) continue;
    const current = conversionStats.get(conversion.creator_id) || {
      conversions: 0,
      revenue: 0,
      estimatedCommission: 0
    };
    current.conversions += 1;
    current.revenue += Number(conversion.order_value || 0);
    current.estimatedCommission += Number(conversion.commission_amount || 0);
    conversionStats.set(conversion.creator_id, current);
  }

  return creators
    .map((creator) => {
      const stats = conversionStats.get(creator.id) || {
        conversions: 0,
        revenue: 0,
        estimatedCommission: 0
      };

      return {
        creatorCode: creator.creator_code,
        clicks: clickCounts.get(creator.id) || 0,
        conversions: stats.conversions,
        revenue: stats.revenue,
        estimatedCommission: stats.estimatedCommission
      };
    })
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.conversions !== a.conversions) return b.conversions - a.conversions;
      return b.clicks - a.clicks;
    })
    .slice(0, limit);
}

function generateSessionId() {
  return crypto.randomUUID();
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

module.exports = {
  getBrandBySlug,
  getCreatorByCodeAndBrand,
  recordClick,
  upsertAttributionSession,
  getLatestAttributionSessionForCreator,
  recordConversion,
  getCreatorTrackingStats,
  getBrandSalesDashboardStats,
  getCreatorLeaderboardStats,
  generateSessionId,
  hashIp
};
