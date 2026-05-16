#!/usr/bin/env node

const crypto = require('crypto');
const env = require('../config/config/env');
const { SHOPIFY_WEBHOOK_SECRET } = env;

const SHOP_DOMAIN = 'partnerlinks-test.myshopify.com';
const SHOPIFY_ORDER_ID = '6548718420142';
const ENDPOINT = 'https://partnerlinks.app/webhooks/shopify/orders-paid';

const payload = {
  id: Number(SHOPIFY_ORDER_ID),
  admin_graphql_api_id: `gid://shopify/Order/${SHOPIFY_ORDER_ID}`,
  order_number: 999001,
  name: '#DUPLICATE-REPLAY-6548718420142',
  email: 'duplicate-webhook-replay@example.com',
  currency: 'USD',
  total_price: '18.00',
  subtotal_price: '18.00',
  financial_status: 'paid',
  confirmed: true,
  processed_at: new Date().toISOString(),
  landing_site: '/cart',
  note_attributes: [
    { name: 'brand_slug', value: 'aria-wellness' },
    { name: 'creator_code', value: 'test-creator-06' },
    { name: 'partnerlinks_ref', value: '1905a295-aa91-4ddc-b2f2-73a86953dff5' },
    { name: 'product_slug', value: 'test-product' }
  ],
  line_items: [
    {
      title: 'Test Product',
      quantity: 1,
      price: '18.00',
      product_exists: true
    }
  ],
  test: true
};

function main() {
  const args = process.argv.slice(2);
  const send = args.includes('--send-approved');
  const validateEnv = args.includes('--validate-env');
  const rawBody = JSON.stringify(payload);
  const hmac = SHOPIFY_WEBHOOK_SECRET
    ? createShopifyHmac(rawBody)
    : 'computed_from_SHOPIFY_WEBHOOK_SECRET_at_runtime';
  const webhookId = `duplicate-replay-${SHOPIFY_ORDER_ID}`;

  if (validateEnv) {
    printEnvValidation();
    return;
  }

  printReplayPlan({ rawBody, hmac, webhookId });

  if (!send) {
    console.log('\nDRY RUN: request not sent. Re-run with --send-approved only after explicit approval.');
    return;
  }

  sendReplay({ rawBody, hmac, webhookId }).catch((error) => {
    console.error('Duplicate webhook replay failed:');
    console.error(error);
    process.exit(1);
  });
}

function printEnvValidation() {
  const rawBody = JSON.stringify(payload);
  const hasSecret = Boolean(SHOPIFY_WEBHOOK_SECRET);
  console.log('Duplicate webhook replay env validation');
  console.log(JSON.stringify({
    configModule: '../config/config/env',
    dotenvPattern: 'same as production webhook service: require("../config/config/env")',
    hasShopifyWebhookSecret: hasSecret,
    canGenerateHmac: hasSecret,
    hmacPreview: hasSecret ? `${createShopifyHmac(rawBody).slice(0, 8)}...redacted` : null,
    endpoint: ENDPOINT,
    shopDomain: SHOP_DOMAIN,
    shopifyOrderId: SHOPIFY_ORDER_ID,
    requestWillBeSent: false
  }, null, 2));
}

function createShopifyHmac(rawBody) {
  if (!SHOPIFY_WEBHOOK_SECRET) {
    throw new Error('SHOPIFY_WEBHOOK_SECRET is required to prepare the signed replay request.');
  }
  return crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64');
}

function printReplayPlan({ rawBody, hmac, webhookId }) {
  console.log('Duplicate Shopify orders/paid webhook replay plan');
  console.log('');
  console.log('Endpoint:');
  console.log(ENDPOINT);
  console.log('');
  console.log('Headers:');
  console.log(JSON.stringify({
    'Content-Type': 'application/json',
    'X-Shopify-Topic': 'orders/paid',
    'X-Shopify-Shop-Domain': SHOP_DOMAIN,
    'X-Shopify-Webhook-Id': webhookId,
    'X-Shopify-Hmac-Sha256': hmac
  }, null, 2));
  console.log('');
  console.log('Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  console.log('Exact command to execute after approval:');
  console.log('node scripts/prepareDuplicateWebhookReplay.js --send-approved');
  console.log('');
  console.log('Expected verification command:');
  console.log('node scripts/productionSafetyTest.js --report --matrix-report --order-id shopify:partnerlinks-test.myshopify.com:6548718420142');
}

async function sendReplay({ rawBody, hmac, webhookId }) {
  if (!SHOPIFY_WEBHOOK_SECRET) {
    throw new Error('SHOPIFY_WEBHOOK_SECRET is required to send the signed replay request.');
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Topic': 'orders/paid',
      'X-Shopify-Shop-Domain': SHOP_DOMAIN,
      'X-Shopify-Webhook-Id': webhookId,
      'X-Shopify-Hmac-Sha256': hmac
    },
    body: rawBody
  });

  const responseText = await response.text();
  console.log('\nReplay response:');
  console.log(JSON.stringify({
    status: response.status,
    statusText: response.statusText,
    body: responseText
  }, null, 2));
}

main();
