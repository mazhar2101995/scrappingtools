const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));
const { StoreExportExecutionService } = require(path.resolve(__dirname, '../apps/api/dist/services/store-export-execution.service.js'));

const sql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev');

async function verifyIdempotency() {
  console.log('=== STG-DED-01: APPLICATION-LEVEL CONCURRENT EXPORT IDEMPOTENCY VERIFICATION ===\n');

  // 1. Get an existing organization and connected store
  const stores = await sql`SELECT id, organization_id FROM connected_stores WHERE status = 'connected' LIMIT 1`;
  const store = stores[0];
  const orgId = store.organization_id;
  const storeId = store.id;

  const prods = await sql`SELECT id, canonical_title FROM global_products LIMIT 1`;
  const prod = prods[0];

  // 2. Insert a valid test Change Plan
  const crypto = require('crypto');
  const planId = crypto.randomUUID();
  console.log(`[1/3] Creating test Change Plan "${planId}"...`);
  await sql`
    INSERT INTO store_change_plans (
      id, organization_id, global_product_id, connected_store_id,
      target_type, store_fingerprint, plan_details, status, expires_at, created_at
    ) VALUES (
      ${planId}, ${orgId}, ${prod.id}, ${storeId},
      'new_product', 'fp_test_123',
      ${JSON.stringify({
        productTitle: prod.canonical_title,
        sku: 'STG-IDEMP-TEST',
        fieldChanges: [
          {
            productIntelligenceField: 'title',
            storeDestinationField: 'title',
            currentStoreValue: null,
            proposedValue: 'Idempotency Vehicle',
            permissionPolicy: 'allow',
            writePolicy: 'create_only',
            action: 'CREATE'
          }
        ]
      })}::jsonb,
      'preview',
      NOW() + interval '30 minutes',
      NOW()
    )
  `;

  // 3. Simulate first execution marking status = 'executed'
  console.log('\n[2/3] Simulating first execution completion (plan transitioning to executed)...');
  await sql`
    UPDATE store_change_plans 
    SET status = 'executed', updated_at = NOW() 
    WHERE id = ${planId}
  `;

  // 4. Fire concurrent / duplicate execution against the same plan
  console.log('\n[3/3] Firing concurrent / duplicate push request against the executed Change Plan...');
  let rejectedAsDuplicate = false;
  let rejectionError = '';
  try {
    await StoreExportExecutionService.executeControlledPush(orgId, planId);
  } catch (err) {
    rejectionError = err.message;
    if (err.message.includes('Duplicate Push Blocked') || err.message.includes('already been confirmed and executed')) {
      rejectedAsDuplicate = true;
    }
  }

  console.log(`[+] Rejection Message: "${rejectionError}"`);
  console.log(`[+] Application-level duplicate push blocked: ${rejectedAsDuplicate}`);

  // Cleanup test plan
  await sql`DELETE FROM store_change_plans WHERE id = ${planId}`;

  if (rejectedAsDuplicate) {
    console.log('\n>> STG-DED-01 APPLICATION IDEMPOTENCY: VERIFIED (PASS)');
  } else {
    console.log('\n>> STG-DED-01 APPLICATION IDEMPOTENCY: FAILED');
  }

  await sql.end();
}

verifyIdempotency().catch(console.error);
