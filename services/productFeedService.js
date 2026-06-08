const supabase = require('../database/database/supabase');
const { generateCanonicalSlug, normalizeCode } = require('../utils/slug');

function buildProductSlug(productName, externalProductId = null) {
  const baseSlug = generateCanonicalSlug(productName, 72);
  if (!externalProductId) return baseSlug;

  const suffix = generateCanonicalSlug(externalProductId, 12);
  return suffix && suffix !== 'brand' ? `${baseSlug}-${suffix}`.slice(0, 96).replace(/-+$/g, '') : baseSlug;
}

function appendAwinClickref(destinationUrl, sessionId) {
  if (!destinationUrl || !sessionId) return destinationUrl;

  const url = new URL(destinationUrl);
  url.searchParams.set('clickref', sessionId);
  return url.toString();
}

async function getProductFeedDestination(brandSlug, productSlug) {
  const normalizedBrandSlug = normalizeCode(brandSlug);
  const normalizedProductSlug = normalizeCode(productSlug);
  if (!normalizedBrandSlug || !normalizedProductSlug) return null;

  const { data, error } = await supabase
    .from('product_feed_items')
    .select('*')
    .eq('brand_slug', normalizedBrandSlug)
    .eq('product_slug', normalizedProductSlug)
    .eq('is_active', true)
    .order('imported_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingProductFeedTableError(error)) return null;
    throw error;
  }

  const product = data && data[0] ? data[0] : null;
  if (!product) return null;

  const destinationUrl = product.destination_url || product.aw_deep_link || null;
  if (!destinationUrl) return null;

  return {
    url: destinationUrl,
    product,
    source: product.source || null
  };
}

function isMissingProductFeedTableError(error) {
  return error && (
    error.code === '42P01'
    || /product_feed_items/i.test(error.message || '')
  );
}

module.exports = {
  appendAwinClickref,
  buildProductSlug,
  getProductFeedDestination
};
