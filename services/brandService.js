const supabase = require('../database/database/supabase');
const { DEFAULT_REF_TEMPLATE } = require('../config/config/env');

async function getBrandByGuildId(guildId) {
  console.log('getBrandByGuildId query:', BigInt(guildId));
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('guild_id', BigInt(guildId))
    .order('created_at', { ascending: false })
    .limit(1);
  console.log('getBrandByGuildId result:', data, 'error:', error);
  if (error) throw error;
  if (data && data.length > 1) {
    console.warn(`Multiple brands found for guild ${guildId}, returning latest`);
  }
  return data ? data[0] : null;
}

async function createBrand(guildId, name, refLinkTemplate = DEFAULT_REF_TEMPLATE) {
  console.log('createBrand checking existing for guild:', BigInt(guildId));
  const existing = await getBrandByGuildId(guildId);
  if (existing) {
    console.log('createBrand updating existing brand:', existing.id);
    const { data, error } = await supabase
      .from('brands')
      .update({
        name: name,
        ref_link_template: refLinkTemplate
      })
      .eq('id', existing.id)
      .select()
      .single();
    console.log('createBrand update result:', data, 'error:', error);
    if (error) throw error;
    return data;
  } else {
    console.log('createBrand inserting new brand');
    const { data, error } = await supabase
      .from('brands')
      .insert({
        guild_id: BigInt(guildId),
        name: name,
        ref_link_template: refLinkTemplate
      })
      .select()
      .single();
    console.log('createBrand insert result:', data, 'error:', error);
    if (error) throw error;
    return data;
  }
}

async function updateBrandRefTemplate(brandId, refLinkTemplate) {
  const { data, error } = await supabase
    .from('brands')
    .update({ ref_link_template: refLinkTemplate })
    .eq('id', brandId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  getBrandByGuildId,
  createBrand,
  updateBrandRefTemplate
};