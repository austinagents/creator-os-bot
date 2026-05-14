const supabase = require('../database/database/supabase');

const LEVEL_ONE_RATE = 30;
const LEVEL_TWO_RATE = 3;
const LEVEL_THREE_RATE = 2;
const NETWORK_RATES_BY_LEVEL = {
  1: LEVEL_ONE_RATE,
  2: LEVEL_TWO_RATE,
  3: LEVEL_THREE_RATE
};

async function getCreatorByInviteCode(inviteCode) {
  const { data: referralMatches, error: referralError } = await supabase
    .from('creators')
    .select('*')
    .eq('referral_code', inviteCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (referralError) throw referralError;
  if (referralMatches && referralMatches[0]) return referralMatches[0];

  const { data: creatorCodeMatches, error: creatorCodeError } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_code', inviteCode)
    .order('created_at', { ascending: false })
    .limit(1);
  if (creatorCodeError) throw creatorCodeError;
  return creatorCodeMatches ? creatorCodeMatches[0] : null;
}

async function recordCreatorInviteSession({
  inviterCreatorId,
  sessionId,
  ipHash,
  userAgent,
  referrer,
  inviteCode
}) {
  const { data, error } = await supabase
    .from('creator_invite_sessions')
    .insert({
      inviter_creator_id: inviterCreatorId,
      session_id: sessionId,
      ip_hash: ipHash || null,
      user_agent: userAgent || null,
      referrer: referrer || null,
      invite_code: inviteCode
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bindCreatorToInviteSession(creatorId, sessionId) {
  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select('id, parent_creator_id')
    .eq('id', creatorId)
    .single();
  if (creatorError) throw creatorError;
  if (!creator || creator.parent_creator_id) return null;

  const { data: sessions, error: sessionError } = await supabase
    .from('creator_invite_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (sessionError) throw sessionError;

  const inviteSession = sessions ? sessions[0] : null;
  if (!inviteSession || inviteSession.inviter_creator_id === creator.id) return null;

  const { data, error } = await supabase
    .from('creators')
    .update({
      parent_creator_id: inviteSession.inviter_creator_id,
      referred_at: new Date().toISOString()
    })
    .eq('id', creator.id)
    .is('parent_creator_id', null)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bindCreatorToBrandOrigin(creatorId, brandId) {
  if (!creatorId || !brandId) return null;

  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select('id, parent_creator_id, invited_by_brand_id')
    .eq('id', creatorId)
    .single();
  if (creatorError) throw creatorError;
  if (!creator || creator.parent_creator_id || creator.invited_by_brand_id) return null;

  const { data: brandRows, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .limit(1);
  if (brandError) throw brandError;
  const brand = brandRows ? brandRows[0] : null;
  if (!brand) return null;

  const { data, error } = await supabase
    .from('creators')
    .update({
      invited_by_brand_id: brand.id,
      brand_referred_at: new Date().toISOString()
    })
    .eq('id', creator.id)
    .is('invited_by_brand_id', null)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createNetworkEarningsForConversion({
  sourceCreatorId,
  conversionId,
  platformFeeAmount
}) {
  const feeAmount = Number(platformFeeAmount || 0);
  if (!feeAmount || feeAmount <= 0) return [];

  const creatorEarnings = [];
  const visitedCreatorIds = new Set([sourceCreatorId]);
  let currentCreatorId = sourceCreatorId;
  let parentCreatorId = await getParentCreatorId(sourceCreatorId);
  let level = 1;

  while (parentCreatorId && level <= 3 && !visitedCreatorIds.has(parentCreatorId)) {
    visitedCreatorIds.add(parentCreatorId);
    creatorEarnings.push(buildCreatorEarningRow({
      earningCreatorId: parentCreatorId,
      sourceCreatorId,
      conversionId,
      platformFeeAmount: feeAmount,
      commissionRate: NETWORK_RATES_BY_LEVEL[level],
      level
    }));

    currentCreatorId = parentCreatorId;
    parentCreatorId = await getParentCreatorId(parentCreatorId);
    level += 1;
  }

  const createdRows = [];

  if (creatorEarnings.length) {
    const { data, error } = await supabase
      .from('creator_network_earnings')
      .insert(creatorEarnings)
      .select();
    if (error) throw error;
    createdRows.push(...(data || []));
  }

  if (level <= 3 && !parentCreatorId) {
    const originBrandId = await getCreatorOriginBrandId(currentCreatorId);
    if (originBrandId) {
      const brandEarning = buildBrandEarningRow({
        earningBrandId: originBrandId,
        sourceCreatorId,
        conversionId,
        platformFeeAmount: feeAmount,
        commissionRate: NETWORK_RATES_BY_LEVEL[level],
        level
      });

      const { data, error } = await supabase
        .from('brand_network_earnings')
        .insert(brandEarning)
        .select();
      if (error) throw error;
      createdRows.push(...(data || []));
    }
  }

  return createdRows;
}

async function getParentCreatorId(creatorId) {
  const { data, error } = await supabase
    .from('creators')
    .select('parent_creator_id')
    .eq('id', creatorId)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0].parent_creator_id : null;
}

async function getCreatorOriginBrandId(creatorId) {
  const { data, error } = await supabase
    .from('creators')
    .select('invited_by_brand_id')
    .eq('id', creatorId)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0].invited_by_brand_id : null;
}

async function getCreatorNetworkStats(creatorId) {
  const { data: directCreators, error: directError } = await supabase
    .from('creators')
    .select('id')
    .eq('parent_creator_id', creatorId);
  if (directError) throw directError;

  const directIds = directCreators.map((creator) => creator.id);
  let secondLevelCount = 0;
  let thirdLevelCount = 0;

  if (directIds.length) {
    const { data: secondLevelCreators, error: secondLevelError } = await supabase
      .from('creators')
      .select('id')
      .in('parent_creator_id', directIds);
    if (secondLevelError) throw secondLevelError;
    secondLevelCount = secondLevelCreators.length;

    const secondLevelIds = secondLevelCreators.map((creator) => creator.id);
    if (secondLevelIds.length) {
      const { data: thirdLevelCreators, error: thirdLevelError } = await supabase
        .from('creators')
        .select('id')
        .in('parent_creator_id', secondLevelIds);
      if (thirdLevelError) throw thirdLevelError;
      thirdLevelCount = thirdLevelCreators.length;
    }
  }

  const { data: earnings, error: earningsError } = await supabase
    .from('creator_network_earnings')
    .select('commission_amount')
    .eq('earning_creator_id', creatorId);
  if (earningsError) throw earningsError;

  return {
    directReferredCreators: directCreators.length,
    secondLevelCreators: secondLevelCount,
    thirdLevelCreators: thirdLevelCount,
    networkEarnings: (earnings || []).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0)
  };
}

function buildCreatorEarningRow({
  earningCreatorId,
  sourceCreatorId,
  conversionId,
  platformFeeAmount,
  commissionRate,
  level
}) {
  return {
    earning_creator_id: earningCreatorId,
    source_creator_id: sourceCreatorId,
    conversion_id: conversionId,
    platform_fee_amount: platformFeeAmount,
    commission_rate: commissionRate,
    commission_amount: roundCurrency(platformFeeAmount * commissionRate / 100),
    level,
    notes: `Level ${level} creator-network override from PartnerLinks platform fee`
  };
}

function buildBrandEarningRow({
  earningBrandId,
  sourceCreatorId,
  conversionId,
  platformFeeAmount,
  commissionRate,
  level
}) {
  return {
    earning_brand_id: earningBrandId,
    source_creator_id: sourceCreatorId,
    conversion_id: conversionId,
    platform_fee_amount: platformFeeAmount,
    commission_rate: commissionRate,
    commission_amount: roundCurrency(platformFeeAmount * commissionRate / 100),
    level,
    notes: `Level ${level} brand-origin network reward from PartnerLinks platform fee`
  };
}

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

module.exports = {
  LEVEL_ONE_RATE,
  LEVEL_TWO_RATE,
  LEVEL_THREE_RATE,
  getCreatorByInviteCode,
  recordCreatorInviteSession,
  bindCreatorToInviteSession,
  bindCreatorToBrandOrigin,
  createNetworkEarningsForConversion,
  getCreatorNetworkStats
};
