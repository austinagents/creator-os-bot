const supabase = require('../database/database/supabase');

async function createSubmission(creatorId, campaignId, submissionUrl, notes) {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      creator_id: creatorId,
      campaign_id: campaignId || null,
      submission_url: submissionUrl,
      status: 'submitted',
      notes: notes || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getSubmissionsByBrand(brandId) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      creators!inner(creator_code, discord_username, brand_id)
    `)
    .eq('creators.brand_id', brandId);
  if (error) throw error;
  return data;
}

module.exports = {
  createSubmission,
  getSubmissionsByBrand
};