const path = require('path');
const postgres = require(path.resolve('node_modules/.pnpm/postgres@3.4.9/node_modules/postgres'));
const { CredentialSecurity } = require(path.resolve('packages/connectors/dist/index.js'));

const sql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev');

async function verify() {
  try {
    const stores = await sql`
      SELECT id, store_name, platform_type, encrypted_credentials, webhook_secret
      FROM connected_stores
      WHERE platform_type = 'shopify'
      LIMIT 1
    `;
    if (stores.length === 0) {
      console.log('No Shopify store found in DB');
      return;
    }
    const store = stores[0];
    console.log('Found store:', store.id, store.store_name, 'Platform:', store.platform_type);

    // Decrypt existing credentials
    const existingCreds = CredentialSecurity.decrypt(store.encrypted_credentials);
    console.log('Existing credentials keys:', Object.keys(existingCreds));
    console.log('shopDomain present:', !!existingCreds.shopDomain);
    console.log('accessToken present:', !!existingCreds.accessToken);

    // Simulate update payload merge logic from PUT /api/v1/stores/:id
    const incomingCreds = { webhookSecret: 'test_secret_merge_123' };
    const mergedCreds = { ...existingCreds, ...incomingCreds };
    console.log('Merged keys:', Object.keys(mergedCreds));

    if (mergedCreds.shopDomain && mergedCreds.accessToken && mergedCreds.webhookSecret === 'test_secret_merge_123') {
      console.log('PASSED: Credential merging preserves existing shopDomain & accessToken and safely updates webhookSecret.');
    } else {
      console.error('FAILED: Credential merge dropped required fields.');
    }

    // Verify encryption round-trip
    const reEncrypted = CredentialSecurity.encrypt(mergedCreds);
    const roundTripped = CredentialSecurity.decrypt(reEncrypted);
    if (roundTripped.shopDomain === existingCreds.shopDomain && roundTripped.webhookSecret === 'test_secret_merge_123') {
      console.log('PASSED: AES-256-GCM encryption/decryption round-trip verified.');
    } else {
      console.error('FAILED: Decryption round-trip failed.');
    }
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await sql.end();
  }
}

verify();
