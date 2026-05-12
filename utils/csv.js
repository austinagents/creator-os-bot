const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

async function writeCsv(filePath, header, records) {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: header
  });
  await csvWriter.writeRecords(records);
}

module.exports = {
  writeCsv
};