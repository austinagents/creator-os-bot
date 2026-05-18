const supabase = require('../database/database/supabase');
const { log } = require('./services/logger');

function isMissingBrandOwnersTableError(error) {
  return error && ['42P01', 'PGRST205', 'PGRST116'].includes(error.code);
}

async function ensureBrandOwner({
  brandId,
  authUserId,
  email = null,
  role = 'owner',
  sourceSystem = 'shopify_oauth',
  shopDomain = null,
  metadata = {}
}) {
  if (!brandId || !authUserId) {
    throw new Error('brandId and authUserId are required to bind brand ownership.');
  }

  const payload = {
    brand_id: Number(brandId),
    auth_user_id: authUserId,
    email,
    role,
    source_system: sourceSystem,
    shop_domain: shopDomain,
    updated_at: new Date().toISOString(),
    revoked_at: null,
    metadata
  };

  const { data, error } = await supabase
    .from('brand_owners')
    .upsert(payload, { onConflict: 'brand_id,auth_user_id' })
    .select()
    .single();

  if (error) {
    if (isMissingBrandOwnersTableError(error)) {
      log('Brand ownership binding blocked: brand_owners table is missing', {
        brandId,
        authUserId,
        sourceSystem
      });
    }
    throw error;
  }

  log('Brand ownership bound', {
    brandId,
    authUserId,
    role,
    sourceSystem,
    shopDomain
  });
  return data;
}

async function getActiveBrandOwner({ brandId, authUserId }) {
  if (!brandId || !authUserId) return null;

  const { data, error } = await supabase
    .from('brand_owners')
    .select('*')
    .eq('brand_id', Number(brandId))
    .eq('auth_user_id', authUserId)
    .is('revoked_at', null)
    .limit(1);

  if (error) {
    if (isMissingBrandOwnersTableError(error)) {
      log('Brand ownership lookup blocked: brand_owners table is missing', {
        brandId,
        authUserId
      });
      return null;
    }
    throw error;
  }

  return data && data[0] ? data[0] : null;
}

async function userOwnsBrand({ brandId, authUserId }) {
  const owner = await getActiveBrandOwner({ brandId, authUserId });
  return Boolean(owner);
}

module.exports = {
  ensureBrandOwner,
  getActiveBrandOwner,
  userOwnsBrand
};
