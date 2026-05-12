const { writeCsv } = require('../utils/csv');
const { EXPORTS_DIR } = require('../config/config/env');
const path = require('path');
const fs = require('fs');

async function exportCreators(creators) {
  const fileName = `creators_${Date.now()}.csv`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  const header = [
    { id: 'id', title: 'ID' },
    { id: 'created_at', title: 'Created At' },
    { id: 'discord_user_id', title: 'Discord User ID' },
    { id: 'discord_username', title: 'Discord Username' },
    { id: 'creator_code', title: 'Creator Code' },
    { id: 'referral_link', title: 'Referral Link' },
    { id: 'approved', title: 'Approved' }
  ];
  await writeCsv(filePath, header, creators);
  return filePath;
}

async function exportSubmissions(submissions) {
  const fileName = `submissions_${Date.now()}.csv`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  const header = [
    { id: 'id', title: 'ID' },
    { id: 'created_at', title: 'Created At' },
    { id: 'creator_id', title: 'Creator ID' },
    { id: 'campaign_id', title: 'Campaign ID' },
    { id: 'submission_url', title: 'Submission URL' },
    { id: 'status', title: 'Status' },
    { id: 'notes', title: 'Notes' }
  ];
  await writeCsv(filePath, header, submissions);
  return filePath;
}

module.exports = {
  exportCreators,
  exportSubmissions
};