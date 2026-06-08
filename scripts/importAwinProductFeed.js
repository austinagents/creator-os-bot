#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const supabase = require('../database/database/supabase');
const { buildProductSlug } = require('../services/productFeedService');
const { generateCanonicalSlug, normalizeCode } = require('../utils/slug');

const FIELD_ALIASES = {
  product_name: ['product_name', 'product name', 'productname', 'name', 'product'],
  description: ['description', 'product description', 'desc'],
  image_url: ['image_url', 'image url', 'image', 'imageurl', 'merchant image url'],
  price: ['price', 'search price', 'display price', 'amount'],
  currency: ['currency', 'currency code'],
  merchant_name: ['merchant_name', 'merchant name', 'advertiser', 'advertiser name'],
  merchant_category: ['merchant_category', 'merchant category', 'category', 'merchant sector'],
  aw_deep_link: ['aw_deep_link', 'aw deep link', 'deeplink', 'deep link', 'aw deeplink', 'url', 'product url'],
  external_product_id: ['external_product_id', 'product id', 'product_id', 'aw_product_id', 'merchant product id', 'sku']
};

function parseArgs(argv) {
  const args = {
    file: null,
    brandSlug: null,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') {
      args.file = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--brand-slug') {
      args.brandSlug = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (!args.file) throw new Error('Missing required --file path/to/awin-feed.csv');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(args.file);
  const records = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const rows = records.map((record) => mapAwinRecord(record, args.brandSlug)).filter(Boolean);

  console.log(JSON.stringify({
    mode: args.dryRun ? 'dry_run' : 'import',
    file: csvPath,
    parsed_rows: records.length,
    importable_rows: rows.length,
    aw_deep_link_as_destination_url: true
  }, null, 2));

  if (args.dryRun || rows.length === 0) return;

  const { data, error } = await supabase
    .from('product_feed_items')
    .upsert(rows, { onConflict: 'source,brand_slug,product_slug' })
    .select('id, brand_slug, product_slug, product_name');

  if (error) throw error;

  console.log(JSON.stringify({
    imported_rows: data ? data.length : 0,
    product_links_remain_partnerlinks_routes: true
  }, null, 2));
}

function mapAwinRecord(record, fallbackBrandSlug) {
  const productName = valueFor(record, 'product_name');
  const awDeepLink = valueFor(record, 'aw_deep_link');
  if (!productName || !awDeepLink) return null;

  const merchantName = valueFor(record, 'merchant_name');
  const externalProductId = valueFor(record, 'external_product_id');
  const brandSlug = normalizeCode(fallbackBrandSlug) || generateCanonicalSlug(merchantName || 'awin', 80);

  return {
    source: 'awin',
    brand_slug: brandSlug,
    product_slug: buildProductSlug(productName, externalProductId),
    product_name: productName,
    description: valueFor(record, 'description') || null,
    image_url: valueFor(record, 'image_url') || null,
    price: parsePrice(valueFor(record, 'price')),
    currency: normalizeCurrency(valueFor(record, 'currency')),
    merchant_name: merchantName || null,
    merchant_category: valueFor(record, 'merchant_category') || null,
    aw_deep_link: awDeepLink,
    destination_url: awDeepLink,
    external_product_id: externalProductId || null,
    is_active: true,
    updated_at: new Date().toISOString(),
    imported_at: new Date().toISOString()
  };
}

function valueFor(record, fieldName) {
  const aliases = FIELD_ALIASES[fieldName] || [fieldName];
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function parsePrice(value) {
  const normalized = String(value || '').replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  return currency || null;
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((item) => item.some((value) => String(value || '').trim() !== ''));
  const normalizedHeaders = headers.map(normalizeHeader);
  return dataRows.map((values) => {
    return normalizedHeaders.reduce((record, header, index) => {
      record[header] = values[index] || '';
      return record;
    }, {});
  });
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
