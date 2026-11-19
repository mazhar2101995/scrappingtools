/**
 * Staging Store Provisioning & Seeding Script
 * Safely registers or updates staging connected stores with encrypted credentials
 */
const fs = require('fs');
const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));
const { CredentialSecurity } = require(path.resolve(__dirname, '../packages/connectors/dist'));

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev';
const sql = postgres(dbUrl);

// Safe, zero-dependency environment loader
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  } catch (_) {}
}

loadEnvFile(path.resolve('.env.staging'));
loadEnvFile(path.resolve('.env'));

async function seedStagingStores() {
  console.log('=== Staging Connected Stores Seeding Utility ===\n');

  // 1. Resolve test organization
  let orgs = await sql`SELECT id, name, slug FROM organizations WHERE slug = 'acme-corp' LIMIT 1`;
  if (!orgs || orgs.length === 0) {
    orgs = await sql`SELECT id, name, slug FROM organizations WHERE slug = 'tenant-a-org' LIMIT 1`;
  }
  if (!orgs || orgs.length === 0) {
    orgs = await sql`SELECT id, name, slug FROM organizations LIMIT 1`;
  }
  if (!orgs || orgs.length === 0) {
    console.error('[-] Error: No organizations found in database. Run database migrations first.');
    await sql.end();
    process.exit(1);
  }
  const org = orgs[0];
  console.log(`[+] Target Organization: ${org.name} (${org.id})`);

  let seededCount = 0;

  // 2. Provision Shopify Staging Store if credentials present
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const shopToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const shopWebhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || 'whsec_shopify_staging_secret_8841';

  if (shopDomain && shopToken) {
    console.log(`[+] Configuring Shopify Staging Store: ${shopDomain}`);
    const encryptedCreds = CredentialSecurity.encrypt({
      shopDomain,
      accessToken: shopToken,
      apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
    });

    const existingShopify = await sql`
      SELECT id FROM connected_stores 
      WHERE organization_id = ${org.id} AND platform_type = 'shopify' 
      LIMIT 1
    `;

    if (existingShopify.length > 0) {
      await sql`
        UPDATE connected_stores 
        SET store_name = ${'Shopify Staging (' + shopDomain + ')'},
            store_url = ${'https://' + shopDomain},
            encrypted_credentials = ${encryptedCreds},
            webhook_secret = ${shopWebhookSecret},
            status = 'connected',
            updated_at = NOW()
        WHERE id = ${existingShopify[0].id}
      `;
      console.log(`    Updated existing store record: ${existingShopify[0].id}`);
    } else {
      const inserted = await sql`
        INSERT INTO connected_stores (
          organization_id, platform_type, store_name, store_url,
          encrypted_credentials, webhook_secret, status, capabilities
        ) VALUES (
          ${org.id}, 'shopify', ${'Shopify Staging (' + shopDomain + ')'},
          ${'https://' + shopDomain}, ${encryptedCreds}, ${shopWebhookSecret},
          'connected', ${sql.array(['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'UPDATE_STOCK', 'WEBHOOK_CHANGES'])}
        ) RETURNING id
      `;
      console.log(`    Created new store record: ${inserted[0].id}`);
    }
    seededCount++;
  } else {
    console.log('[!] Shopify credentials not found in environment (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN). Skipping.');
  }

  // 3. Provision OpenCart Staging Store if credentials present
  const ocUrl = process.env.OPENCART_STORE_URL;
  const ocKey = process.env.OPENCART_API_KEY;

  if (ocUrl && ocKey) {
    console.log(`[+] Configuring OpenCart Staging Store: ${ocUrl}`);
    const encryptedCreds = CredentialSecurity.encrypt({
      storeUrl: ocUrl,
      apiUsername: process.env.OPENCART_API_USERNAME || 'saas_agent',
      apiKey: ocKey,
    });

    const existingOc = await sql`
      SELECT id FROM connected_stores 
      WHERE organization_id = ${org.id} AND platform_type = 'opencart' 
      LIMIT 1
    `;

    if (existingOc.length > 0) {
      await sql`
        UPDATE connected_stores 
        SET store_name = 'OpenCart Staging Shop',
            store_url = ${ocUrl},
            encrypted_credentials = ${encryptedCreds},
            webhook_secret = ${ocKey},
            status = 'connected',
            updated_at = NOW()
        WHERE id = ${existingOc[0].id}
      `;
      console.log(`    Updated existing store record: ${existingOc[0].id}`);
    } else {
      const inserted = await sql`
        INSERT INTO connected_stores (
          organization_id, platform_type, store_name, store_url,
          encrypted_credentials, webhook_secret, status, capabilities
        ) VALUES (
          ${org.id}, 'opencart', 'OpenCart Staging Shop',
          ${ocUrl}, ${encryptedCreds}, ${ocKey},
          'connected', ${sql.array(['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'UPDATE_STOCK', 'MULTILINGUAL'])}
        ) RETURNING id
      `;
      console.log(`    Created new store record: ${inserted[0].id}`);
    }
    seededCount++;
  } else {
    console.log('[!] OpenCart credentials not found in environment (OPENCART_STORE_URL, OPENCART_API_KEY). Skipping.');
  }

  console.log(`\n=== Seeding Completed: ${seededCount} store(s) configured ===`);
  if (seededCount === 0) {
    console.log('\n[INFO] To configure real staging stores, create a .env.staging file with:');
    console.log('  SHOPIFY_STORE_DOMAIN=your-store.myshopify.com');
    console.log('  SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxx');
    console.log('  OPENCART_STORE_URL=https://your-opencart-host.com');
    console.log('  OPENCART_API_KEY=your_32_char_signing_key');
  }

  await sql.end();
}

seedStagingStores().then(() => process.exit(0)).catch(async (err) => {
  console.error('Fatal error during seeding:', err);
  try { await sql.end(); } catch (_) {}
  process.exit(1);
});
