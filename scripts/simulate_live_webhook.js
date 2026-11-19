/**
 * Inbound Webhook Simulation Script
 * Dispatches simulated live webhooks with cryptographic HMAC signatures
 */
const http = require('http');
const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));
const { CredentialSecurity } = require(path.resolve(__dirname, '../packages/connectors/dist'));

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev';
const sql = postgres(dbUrl);

// Parse CLI args
const args = process.argv.slice(2);
let platform = 'shopify';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--platform' && args[i + 1]) platform = args[++i].toLowerCase();
}

async function simulateWebhook() {
  console.log(`=== Inbound Store Webhook Simulation [Platform: ${platform.toUpperCase()}] ===\n`);

  // 1. Fetch connected store
  const stores = await sql`
    SELECT id, platform_type, store_name, webhook_secret
    FROM connected_stores
    WHERE platform_type = ${platform}
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  if (!stores || stores.length === 0) {
    console.log(`[-] No connected store found for platform "${platform}". Seeding placeholder first.`);
    await sql.end();
    process.exit(0);
  }

  const store = stores[0];
  const webhookSecret = store.webhook_secret || 'simulated_webhook_secret_key_9941';

  console.log(`[+] Target Store: ${store.store_name} (${store.id})`);
  console.log(`[+] Shared Webhook Secret: ${webhookSecret.slice(0, 8)}...`);

  const mappings = await sql`
    SELECT external_product_id, global_product_id
    FROM store_product_mappings
    WHERE connected_store_id = ${store.id}
    LIMIT 1
  `;

  const rawExtId = mappings.length > 0 ? mappings[0].external_product_id : '9948210';
  const cleanExtId = String(rawExtId).replace(/^gid:\/\/shopify\/Product\//, '');

  console.log(`[+] External Product ID: ${cleanExtId} ${mappings.length > 0 ? '(MAPPED to ' + mappings[0].global_product_id + ')' : '(UNMAPPED)'}`);

  const payloadObj = {
    id: cleanExtId,
    title: 'X-Maxx Ultimate (Staging Price Update)',
    variants: [
      {
        id: 8819203,
        price: '1399.00',
        inventory_quantity: 25,
      },
    ],
  };

  const rawPayload = JSON.stringify(payloadObj);

  // Compute signature based on platform standard
  let signatureHeader = '';
  let signatureValue = '';

  if (platform === 'shopify') {
    signatureHeader = 'x-shopify-hmac-sha256';
    // Shopify uses Base64 encoding
    signatureValue = require('crypto').createHmac('sha256', webhookSecret).update(rawPayload).digest('base64');
  } else {
    signatureHeader = 'x-saas-signature';
    // OpenCart uses Hex encoding
    signatureValue = require('crypto').createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
  }

  console.log(`[+] Generated HMAC Signature (${signatureHeader}): ${signatureValue.slice(0, 16)}...`);

  // Dispatch HTTP request to local API
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/stores/${store.id}/inbound-webhook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(rawPayload),
      [signatureHeader]: signatureValue,
      'x-shopify-topic': 'products/update',
    },
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', async () => {
      console.log(`[+] Inbound Webhook Response Status: ${res.statusCode}`);
      console.log(`[+] Response Body: ${body}`);

      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch (_) {}

      if (res.statusCode === 200) {
        console.log('\n[HMAC AUTHENTICATION]: PASS (Cryptographic signature verified)');
        if (parsed.actionTaken === 'NO_MAPPING_FOUND') {
          console.log('[REVERSE SYNCHRONIZATION]: PENDING MAPPED PRODUCT (Action: NO_MAPPING_FOUND)');
          console.log('[!] NOTE: STG-SEC-01 remains BLOCKED until a real mapped product receives live updates.');
        } else if (parsed.actionTaken === 'REVERSE_SYNC_UPDATED') {
          console.log('[REVERSE SYNCHRONIZATION]: PASS (customerProductOverrides updated in database)');
        }
      } else {
        console.log(`\n>> FAILED/REJECTED: Status ${res.statusCode}`);
      }
      await sql.end();
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  });

  req.on('error', async (e) => {
    console.error(`[-] Network Error: ${e.message}`);
    await sql.end();
    process.exit(1);
  });

  req.write(rawPayload);
  req.end();
}

simulateWebhook().catch(async (err) => {
  console.error('Fatal error:', err);
  try { await sql.end(); } catch (_) {}
  process.exit(1);
});
