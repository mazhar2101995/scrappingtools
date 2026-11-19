const path = require('path');
const postgres = require(path.resolve('node_modules/.pnpm/postgres@3.4.9/node_modules/postgres'));
const { CredentialSecurity } = require(path.resolve('packages/connectors/dist/index.js'));

const sql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev');

async function main() {
  console.log('=== GATE D.1: LIVE SHOPIFY CLOUD WEBHOOK & REVERSE SYNC VERIFICATION (STG-SEC-01) ===\n');

  const stores = await sql`
    SELECT id, organization_id, store_url, encrypted_credentials, webhook_secret
    FROM connected_stores
    WHERE id = 'ac8455f6-872a-4f07-9198-09c583797458'
  `;
  const store = stores[0];
  const creds = CredentialSecurity.decrypt(store.encrypted_credentials);
  const domain = store.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const baseUrl = `https://${domain}/admin/api/2026-10`;

  console.log(`[1/7] Target Store: ${domain} (ID: ${store.id})`);
  console.log(`[1/7] Configured Webhook Secret Prefix: ${store.webhook_secret.slice(0, 10)}... (Length: ${store.webhook_secret.length})`);

  // 1. Check or register webhook
  const tunnelUrl = 'https://spec-numerous-approaches-lisa.trycloudflare.com';
  const webhookCallback = `${tunnelUrl}/api/v1/stores/${store.id}/inbound-webhook`;
  
  const whRes = await fetch(`${baseUrl}/webhooks.json`, {
    headers: { 'X-Shopify-Access-Token': creds.accessToken },
  });
  const whData = await whRes.json();
  let existingWh = (whData.webhooks || []).find(w => w.address === webhookCallback && w.topic === 'products/update');

  if (!existingWh) {
    console.log(`[2/7] Registering webhook for products/update -> ${webhookCallback}...`);
    const regRes = await fetch(`${baseUrl}/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': creds.accessToken,
      },
      body: JSON.stringify({
        webhook: {
          topic: 'products/update',
          address: webhookCallback,
          format: 'json',
        },
      }),
    });
    const regData = await regRes.json();
    existingWh = regData.webhook;
    console.log(`[+] Registered Webhook Subscription ID: ${existingWh?.id}`);
  } else {
    console.log(`[2/7] Webhook Subscription already active on Shopify: ID ${existingWh.id}`);
  }

  // 2. Create isolated test product on Shopify
  console.log('[3/7] Creating isolated test product on Shopify...');
  const createResp = await fetch(`${baseUrl}/products.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': creds.accessToken,
    },
    body: JSON.stringify({
      product: {
        title: 'STG-TEST-WEBHOOK-TRIGGER-882',
        vendor: 'Traxxas',
        product_type: 'Staging-Test',
        status: 'draft',
        variants: [
          {
            sku: 'STG-TEST-WH-882',
            price: '89.99',
            inventory_management: null,
          },
        ],
      },
    }),
  });

  const createData = await createResp.json();
  const testProductId = createData.product?.id;
  const variantId = createData.product?.variants?.[0]?.id;
  console.log(`[+] Created test product: ID=${testProductId}, VariantID=${variantId}`);

  if (!testProductId) {
    console.error('Failed to create product:', createData);
    await sql.end();
    return;
  }

  // 3. Map product in store_product_mappings
  const globalProductId = '6940910a-2055-420f-8e46-a25056914660';
  console.log(`[4/7] Mapping external product ${testProductId} to global product ${globalProductId}...`);

  await sql`
    INSERT INTO store_product_mappings (
      connected_store_id, global_product_id, external_product_id, sync_status, created_at, updated_at
    ) VALUES (
      ${store.id}, ${globalProductId}, ${String(testProductId)}, 'synced', NOW(), NOW()
    )
    ON CONFLICT (connected_store_id, external_product_id) DO UPDATE 
    SET global_product_id = ${globalProductId}, updated_at = NOW()
  `;

  // 4. Update the test product on Shopify to fire products/update webhook
  const newPrice = '129.99';
  console.log(`[5/7] Updating product on Shopify (setting price to ${newPrice}) to fire webhook...`);
  const updateResp = await fetch(`${baseUrl}/products/${testProductId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': creds.accessToken,
    },
    body: JSON.stringify({
      product: {
        id: testProductId,
        title: 'STG-TEST-WEBHOOK-TRIGGER-882 (Live Verified)',
        variants: [
          {
            id: variantId,
            price: newPrice,
          },
        ],
      },
    }),
  });

  const updateData = await updateResp.json();
  console.log(`[+] Shopify update HTTP ${updateResp.status}: Updated price to ${updateData.product?.variants?.[0]?.price}`);

  // 5. Wait for Shopify cloud servers to deliver webhook
  console.log('[6/7] Waiting 12 seconds for Shopify cloud delivery, HMAC validation & DB write...');
  await new Promise(r => setTimeout(r, 12000));

  // Check database for webhook receipt
  const receipts = await sql`
    SELECT id, store_id, platform, event_type, external_id, status, action_taken, error_message, created_at
    FROM store_inbound_webhooks
    WHERE store_id = ${store.id}
    ORDER BY created_at DESC
    LIMIT 3
  `;
  console.log('\n=== Inbound Webhook Receipts in PostgreSQL ===');
  console.log(receipts);

  // Check customer_product_overrides
  const overrides = await sql`
    SELECT id, organization_id, global_product_id, custom_attributes, updated_at
    FROM customer_product_overrides
    WHERE organization_id = ${store.organization_id} AND global_product_id = ${globalProductId}
  `;
  console.log('\n=== Customer Product Overrides ===');
  console.log(overrides);

  // 6. Clean up
  console.log('\n[7/7] [Cleanup] Deleting test product on Shopify...');
  const delResp = await fetch(`${baseUrl}/products/${testProductId}.json`, {
    method: 'DELETE',
    headers: { 'X-Shopify-Access-Token': creds.accessToken },
  });
  console.log(`[Cleanup] Delete test product HTTP: ${delResp.status}`);

  // Clean mapping
  await sql`
    DELETE FROM store_product_mappings
    WHERE connected_store_id = ${store.id} AND external_product_id = ${String(testProductId)}
  `;
  console.log(`[Cleanup] Removed test mapping from DB.`);

  // Clean registered webhook if needed
  if (existingWh?.id) {
    console.log(`[Cleanup] Deleting temporary webhook subscription ${existingWh.id}...`);
    const delWhResp = await fetch(`${baseUrl}/webhooks/${existingWh.id}.json`, {
      method: 'DELETE',
      headers: { 'X-Shopify-Access-Token': creds.accessToken },
    });
    console.log(`[Cleanup] Delete webhook subscription HTTP: ${delWhResp.status}`);
  }

  await sql.end();
}

main().catch(console.error);
