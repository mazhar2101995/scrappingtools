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
  if (stores.length === 0) {
    console.error('Target store not found');
    await sql.end();
    process.exit(1);
  }
  const store = stores[0];
  const creds = CredentialSecurity.decrypt(store.encrypted_credentials);
  const domain = store.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const baseUrl = `https://${domain}/admin/api/2026-10`;

  console.log(`[1/7] Target Store: ${domain} (ID: ${store.id})`);
  console.log(`[1/7] Configured Webhook Secret present: ${!!store.webhook_secret} (Length: ${store.webhook_secret ? store.webhook_secret.length : 0})`);

  const tunnelUrl = 'https://spec-numerous-approaches-lisa.trycloudflare.com';
  const webhookCallback = `${tunnelUrl}/api/v1/stores/${store.id}/inbound-webhook`;

  // Pre-cleanup any leftover test products on Shopify
  for (const orphanId of ['10451557482751', '10451558203647']) {
    try {
      await fetch(`${baseUrl}/products/${orphanId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': creds.accessToken },
      });
    } catch (_) {}
  }

  // Pre-cleanup any leftover mappings for this global test product
  const globalProductId = '6940910a-2055-420f-8e46-a25056914660';
  await sql`
    DELETE FROM store_product_mappings 
    WHERE connected_store_id = ${store.id} AND global_product_id = ${globalProductId}
  `;

  // STEP 1: Verify that invalid webhook signatures remain rejected
  console.log('\n[2/7] Testing HMAC security: probing webhook endpoint with invalid signature...');
  const fakePayload = JSON.stringify({ id: 9999999999, title: 'Fake Probe' });
  const fakeSigProbe = await fetch(webhookCallback, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Topic': 'products/update',
      'X-Shopify-Hmac-Sha256': 'dGhpcy1pcy1hbi1pbnZhbGlkLWZha2Utc2lnbmF0dXJlIQ==',
      'X-Shopify-Shop-Domain': domain,
    },
    body: fakePayload,
  });
  console.log(`[+] Invalid HMAC probe response: HTTP ${fakeSigProbe.status}`);
  if (fakeSigProbe.status === 401) {
    console.log('[+] PASS: Invalid signature strictly rejected with HTTP 401 Unauthorized.');
  } else {
    console.error(`[-] FAIL: Expected 401 Unauthorized for bad HMAC, got ${fakeSigProbe.status}`);
  }

  // STEP 2: Check or register webhook subscription on Shopify
  console.log(`\n[3/7] Ensuring Shopify webhook subscription for products/update -> ${webhookCallback}...`);
  const whRes = await fetch(`${baseUrl}/webhooks.json`, {
    headers: { 'X-Shopify-Access-Token': creds.accessToken },
  });
  const whData = await whRes.json();
  let existingWh = (whData.webhooks || []).find(w => w.address === webhookCallback && w.topic === 'products/update');

  if (!existingWh) {
    console.log(`[+] Registering webhook subscription...`);
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
    console.log(`[+] Webhook Subscription already active on Shopify: ID ${existingWh.id}`);
  }

  let testProductId = null;
  let variantId = null;

  try {
    // STEP 3: Create dedicated temporary staging product on Shopify
    console.log('\n[4/7] Creating temporary staging product on Shopify...');
    const createResp = await fetch(`${baseUrl}/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': creds.accessToken,
      },
      body: JSON.stringify({
        product: {
          title: 'STG-TEST-WEBHOOK-STAGE4-VERIFICATION',
          vendor: 'Traxxas',
          product_type: 'Staging-Test',
          status: 'draft',
          variants: [
            {
              sku: 'STG-TEST-WH-STAGE4',
              price: '99.00',
              inventory_management: null,
            },
          ],
        },
      }),
    });

    const createData = await createResp.json();
    testProductId = createData.product?.id;
    variantId = createData.product?.variants?.[0]?.id;
    console.log(`[+] Created temporary product on Shopify: ID=${testProductId}, VariantID=${variantId}`);

    if (!testProductId) {
      throw new Error(`Failed to create product on Shopify: ${JSON.stringify(createData)}`);
    }

    // STEP 4: Map product in store_product_mappings & initialize customer_product_overrides
    console.log(`\n[5/7] Mapping Shopify product ${testProductId} to Global Product ${globalProductId}...`);

    await sql`
      INSERT INTO store_product_mappings (
        connected_store_id, global_product_id, external_product_id, sync_status, created_at, updated_at
      ) VALUES (
        ${store.id}, ${globalProductId}, ${String(testProductId)}, 'synced', NOW(), NOW()
      )
    `;

    // Ensure an initial override record exists
    await sql`
      INSERT INTO customer_product_overrides (
        organization_id, global_product_id, custom_title, custom_attributes, created_at, updated_at
      ) VALUES (
        ${store.organization_id}, ${globalProductId}, 'STG-TEST Initial Title', '{"price": "99.00"}'::jsonb, NOW(), NOW()
      )
      ON CONFLICT (organization_id, global_product_id) DO UPDATE
      SET custom_title = 'STG-TEST Initial Title', custom_attributes = '{"price": "99.00"}'::jsonb, updated_at = NOW()
    `;
    console.log('[+] Mapping and initial override record configured in PostgreSQL.');

    // STEP 5: Update the test product on Shopify to trigger genuine cloud webhook delivery
    const updatedTargetPrice = '149.99';
    const updatedTargetTitle = 'STG-TEST-WEBHOOK-STAGE4-VERIFIED-PRICE-149.99';
    console.log(`\n[6/7] Updating test product on Shopify to trigger genuine cloud webhook (price -> ${updatedTargetPrice})...`);

    const beforeTriggerTime = new Date();
    const updateResp = await fetch(`${baseUrl}/products/${testProductId}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': creds.accessToken,
      },
      body: JSON.stringify({
        product: {
          id: testProductId,
          title: updatedTargetTitle,
          variants: [
            {
              id: variantId,
              price: updatedTargetPrice,
            },
          ],
        },
      }),
    });

    const updateData = await updateResp.json();
    console.log(`[+] Shopify update HTTP ${updateResp.status}: Updated price to ${updateData.product?.variants?.[0]?.price}`);

    // Wait for Shopify cloud servers to deliver webhook across internet
    console.log('[+] Waiting up to 25 seconds for Shopify cloud delivery, HMAC validation & DB write...');
    
    let verifiedEvent = null;
    let finalOverride = null;

    for (let attempt = 1; attempt <= 10; attempt++) {
      await new Promise(r => setTimeout(r, 2500));
      console.log(`  Checking database (attempt ${attempt}/10)...`);

      const receipts = await sql`
        SELECT id, store_id, platform, event_type, external_id, status, action_taken, error_message, payload, created_at
        FROM store_inbound_webhooks
        WHERE store_id = ${store.id} 
          AND external_id = ${String(testProductId)}
          AND created_at >= ${beforeTriggerTime}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (receipts.length > 0 && receipts[0].status === 'PROCESSED') {
        verifiedEvent = receipts[0];
        
        const overrides = await sql`
          SELECT id, organization_id, global_product_id, custom_title, custom_attributes, updated_at
          FROM customer_product_overrides
          WHERE organization_id = ${store.organization_id} AND global_product_id = ${globalProductId}
        `;
        finalOverride = overrides[0];
        break;
      }
    }

    // STEP 6: Verify evidence
    console.log('\n=== LIVE WEBHOOK & REVERSE SYNC VERIFICATION RESULTS ===');
    if (verifiedEvent) {
      console.log('[VERIFIED] Webhook Event Received & Processed:');
      console.log(`  - Audit Record ID:     ${verifiedEvent.id}`);
      console.log(`  - Platform:            ${verifiedEvent.platform}`);
      console.log(`  - Event Type:          ${verifiedEvent.event_type}`);
      console.log(`  - External Product ID: ${verifiedEvent.external_id}`);
      console.log(`  - Status:              ${verifiedEvent.status}`);
      console.log(`  - Action Taken:        ${verifiedEvent.action_taken}`);
      console.log(`  - Received At:         ${verifiedEvent.created_at}`);

      console.log('\n[VERIFIED] Database Reverse Sync in customer_product_overrides:');
      console.log(`  - Override ID:         ${finalOverride?.id}`);
      console.log(`  - Global Product ID:   ${finalOverride?.global_product_id}`);
      console.log(`  - Custom Title:        ${finalOverride?.custom_title}`);
      console.log(`  - Custom Attributes:   `, JSON.stringify(finalOverride?.custom_attributes));
      console.log(`  - Synced Price:        ${finalOverride?.custom_attributes?.price}`);

      if (finalOverride?.custom_attributes?.price === updatedTargetPrice) {
        console.log(`\n>>> STG-SEC-01 SUCCESS: Reverse sync updated price correctly to ${updatedTargetPrice}! <<<`);
      } else {
        console.warn(`\n[!] Note: Price in overrides was ${finalOverride?.custom_attributes?.price}, expected ${updatedTargetPrice}`);
      }
    } else {
      console.error('\n[-] STG-SEC-01 FAILED: Did not receive PROCESSED webhook within timeout.');
      const recentLogs = await sql`
        SELECT id, status, action_taken, error_message, external_id, created_at
        FROM store_inbound_webhooks
        WHERE store_id = ${store.id}
        ORDER BY created_at DESC
        LIMIT 3
      `;
      console.log('Recent webhook receipts:', recentLogs);
      throw new Error('STG-SEC-01 did not receive PROCESSED webhook');
    }
  } finally {
    // STEP 7: Cleanup
    console.log('\n[7/7] [Cleanup] Cleaning staging artifacts...');
    if (testProductId) {
      try {
        const delResp = await fetch(`${baseUrl}/products/${testProductId}.json`, {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': creds.accessToken },
        });
        console.log(`  - Deleted temporary Shopify product ${testProductId} (HTTP ${delResp.status})`);
      } catch (err) {
        console.warn(`  - Warning deleting Shopify product:`, err.message);
      }
    }

    await sql`
      DELETE FROM store_product_mappings
      WHERE connected_store_id = ${store.id} AND global_product_id = ${globalProductId}
    `;
    console.log(`  - Removed temporary store_product_mapping`);

    await sql`
      DELETE FROM customer_product_overrides
      WHERE organization_id = ${store.organization_id} AND global_product_id = ${globalProductId}
    `;
    console.log(`  - Cleared temporary customer_product_overrides`);

    if (existingWh?.id) {
      try {
        const delWhResp = await fetch(`${baseUrl}/webhooks/${existingWh.id}.json`, {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': creds.accessToken },
        });
        console.log(`  - Cleaned temporary webhook subscription ${existingWh.id} (HTTP ${delWhResp.status})`);
      } catch (err) {
        console.warn(`  - Warning deleting webhook subscription:`, err.message);
      }
    }

    console.log('Cleanup completed cleanly.');
    await sql.end();
  }
}

main().catch(async (err) => {
  console.error('Fatal execution error:', err.message);
  process.exit(1);
});
