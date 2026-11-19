const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));
const { CredentialSecurity } = require(path.resolve(__dirname, '../packages/connectors/dist/index.js'));

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev';
const sql = postgres(dbUrl);

async function seed() {
  const encCreds = CredentialSecurity.encrypt({
    apiUsername: 'saas_staging_user',
    apiKey: '9f8b24a3c1e7456d908123456789abcd9f8b24a3c1e7456d908123456789abcd',
  });

  // Get or use existing org
  const orgs = await sql`SELECT id FROM organizations LIMIT 1`;
  const orgId = orgs[0]?.id || '0134937c-4fca-47e8-9495-538d8d9b2532';

  // Check if staging store exists
  const existing = await sql`SELECT id FROM connected_stores WHERE store_url = 'http://127.0.0.1:8080'`;
  
  const caps = JSON.stringify(['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'UPDATE_STOCK', 'MULTILINGUAL', 'IMAGE_SYNC']);

  if (existing.length > 0) {
    await sql`
      UPDATE connected_stores SET
        store_name = 'OpenCart 3.0 Local Staging Store',
        encrypted_credentials = ${encCreds},
        webhook_secret = 'whsec_opencart_staging_secret_key',
        status = 'connected',
        capabilities = ${caps}::jsonb,
        health_status = 'healthy',
        updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
    console.log('Updated existing staging store:', existing[0].id);
  } else {
    const res = await sql`
      INSERT INTO connected_stores (
        id, organization_id, platform_type, store_name, store_url,
        encrypted_credentials, webhook_secret, status, sync_schedule,
        capabilities, health_status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${orgId}, 'opencart', 'OpenCart 3.0 Local Staging Store', 'http://127.0.0.1:8080',
        ${encCreds}, 'whsec_opencart_staging_secret_key', 'connected', 'HOURLY',
        ${caps}::jsonb, 'healthy', NOW(), NOW()
      ) RETURNING id
    `;
    console.log('Inserted new staging store:', res[0].id);
  }

  await sql.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
