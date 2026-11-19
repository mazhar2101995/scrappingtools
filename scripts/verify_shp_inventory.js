const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));
const { CredentialSecurity } = require(path.resolve(__dirname, '../packages/connectors/dist/index.js'));

const sql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev');

async function verifyInventoryUpdate() {
  console.log('=== STG-SHP-02: LIVE INVENTORY QUANTITY UPDATE & READ-BACK VERIFICATION ===\n');

  const stores = await sql`SELECT store_url, encrypted_credentials FROM connected_stores WHERE store_url LIKE '%mayda%' LIMIT 1`;
  const creds = CredentialSecurity.decrypt(stores[0].encrypted_credentials);
  const domain = stores[0].store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const baseUrl = `https://${domain}/admin/api/2026-10`;

  let testProductId = null;
  try {
    // 1. Create Isolated Test Product with inventory tracking
    console.log('[1/5] Creating isolated test product with inventory_quantity: 10...');
    const createResp = await fetch(`${baseUrl}/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': creds.accessToken,
      },
      body: JSON.stringify({
        product: {
          title: 'STG-TEST-INVENTORY-RIG',
          vendor: 'Traxxas',
          product_type: 'Test',
          status: 'draft',
          variants: [
            {
              sku: 'STG-TEST-INV-99',
              price: '199.99',
              inventory_management: 'shopify',
              inventory_policy: 'deny',
              inventory_quantity: 10,
            },
          ],
        },
      }),
    });

    const createData = await createResp.json();
    testProductId = createData.product?.id;
    const variant = createData.product?.variants?.[0];
    const inventoryItemId = variant?.inventory_item_id;

    console.log(`[+] Created Product ID: ${testProductId}`);
    console.log(`    Variant ID: ${variant?.id}, Inventory Item ID: ${inventoryItemId}`);
    console.log(`    Initial Inventory Quantity: ${variant?.inventory_quantity}`);

    // 2. Fetch Location ID
    console.log('\n[2/5] Fetching location_id from inventory_levels.json...');
    const levelsResp = await fetch(`${baseUrl}/inventory_levels.json?inventory_item_ids=${inventoryItemId}`, {
      headers: { 'X-Shopify-Access-Token': creds.accessToken },
    });
    const levelsData = await levelsResp.json();
    const locationId = levelsData.inventory_levels?.[0]?.location_id;
    console.log(`[+] Discovered Location ID: ${locationId}, Initial Available: ${levelsData.inventory_levels?.[0]?.available}`);

    // 3. Update Inventory Quantity to 25
    console.log('\n[3/5] Updating inventory quantity to 25 via POST inventory_levels/set.json...');
    const setResp = await fetch(`${baseUrl}/inventory_levels/set.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': creds.accessToken,
      },
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: 25,
      }),
    });
    console.log(`[+] Set response status: ${setResp.status}`);
    const setData = await setResp.json();
    console.log('[+] Set response payload:', JSON.stringify(setData.inventory_level, null, 2));

    // 4. Read-back verification
    console.log('\n[4/5] Re-reading inventory level from Shopify to verify persistence...');
    const readBackResp = await fetch(`${baseUrl}/inventory_levels.json?inventory_item_ids=${inventoryItemId}`, {
      headers: { 'X-Shopify-Access-Token': creds.accessToken },
    });
    const readBackData = await readBackResp.json();
    const readBackAvailable = readBackData.inventory_levels?.[0]?.available;
    console.log(`[+] Verified Read-Back Available Quantity: ${readBackAvailable}`);

    if (readBackAvailable === 25) {
      console.log('>> STG-SHP-02 INVENTORY UPDATE: VERIFIED (PASS)');
    } else {
      console.log(`>> STG-SHP-02 INVENTORY UPDATE: FAILED (Expected 25, got ${readBackAvailable})`);
    }

  } finally {
    // 5. Cleanup Test Product
    if (testProductId) {
      console.log('\n[5/5] Reversibility Cleanup: Deleting isolated test product...');
      const delResp = await fetch(`${baseUrl}/products/${testProductId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': creds.accessToken },
      });
      console.log(`[+] DELETE status: ${delResp.status}`);

      const verifyDel = await fetch(`${baseUrl}/products/${testProductId}.json`, {
        headers: { 'X-Shopify-Access-Token': creds.accessToken },
      });
      console.log(`[+] Confirm 404 Not Found: ${verifyDel.status === 404 ? 'CONFIRMED (404)' : 'FAILED'}`);
    }
    await sql.end();
  }
}

verifyInventoryUpdate().catch(console.error);
