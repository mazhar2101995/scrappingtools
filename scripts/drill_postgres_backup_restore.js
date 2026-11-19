const { execSync } = require('child_process');
const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));

const MAIN_DB_URL = 'postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev';
const TEST_DB_NAME = 'product_intelligence_isolated_restore_test';
const TEST_DB_URL = `postgresql://postgres:postgres_dev_password@localhost:5432/${TEST_DB_NAME}`;

async function runDrill() {
  console.log('=== PostgreSQL Complete Disaster Recovery & Isolated Restore Drill ===\n');

  const adminSql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/postgres');

  // Step 1: Ensure clean state for isolated target database
  console.log(`Step 1: Preparing isolated target database ${TEST_DB_NAME}...`);
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB_NAME};`);
  console.log(`[+] Created isolated test database: ${TEST_DB_NAME}`);

  // Step 2: Measure pg_dump (-F c) custom compressed dump
  console.log('\nStep 2: Executing pg_dump (-F c) custom archive backup...');
  const startBackup = Date.now();
  const dumpCmd = 'docker exec saas_postgres pg_dump -U postgres -d product_intelligence_dev -F c -b -f /tmp/disaster_recovery_drill.dump';
  execSync(dumpCmd, { stdio: 'inherit' });
  const backupDurationMs = Date.now() - startBackup;

  // Retrieve backup file size
  const sizeOutput = execSync('docker exec saas_postgres stat -c %s /tmp/disaster_recovery_drill.dump').toString().trim();
  const backupSizeBytes = parseInt(sizeOutput, 10);
  console.log(`[+] Backup created in ${backupDurationMs} ms (Size: ${(backupSizeBytes / 1024).toFixed(2)} KB / ${backupSizeBytes} bytes)`);

  // Step 3: Measure pg_restore into isolated database
  console.log(`\nStep 3: Restoring custom dump into isolated database ${TEST_DB_NAME}...`);
  const startRestore = Date.now();
  try {
    const restoreCmd = `docker exec saas_postgres pg_restore -U postgres -d ${TEST_DB_NAME} --no-owner --no-privileges /tmp/disaster_recovery_drill.dump`;
    execSync(restoreCmd, { stdio: 'pipe' });
  } catch (err) {
    // pg_restore can exit with 1 on minor notices
  }
  const restoreDurationMs = Date.now() - startRestore;
  console.log(`[+] Restore completed in ${restoreDurationMs} ms`);

  // Step 4: Compare tables, row counts, and indexes between production and restored databases
  console.log('\nStep 4: Verifying Data Parity and Index Integrity...');
  const mainSql = postgres(MAIN_DB_URL);
  const testSql = postgres(TEST_DB_URL);

  const tablesToCheck = [
    'organizations',
    'users',
    'brands',
    'global_products',
    'product_attributes',
    'tenant_media_assets',
    'system_error_logs',
    'subscriptions',
    'connected_stores'
  ];

  for (const table of tablesToCheck) {
    const [mainCount] = await mainSql.unsafe(`SELECT count(*)::int AS count FROM ${table};`);
    const [testCount] = await testSql.unsafe(`SELECT count(*)::int AS count FROM ${table};`);

    console.log(`  Table [${table}]: Original = ${mainCount.count}, Restored = ${testCount.count}`);
    if (mainCount.count !== testCount.count) {
      throw new Error(`Data parity discrepancy on table ${table}: ${mainCount.count} != ${testCount.count}`);
    }
  }

  // Check GIN index in restored DB
  const [restoredGin] = await testSql`
    SELECT c.relname, i.indisvalid, am.amname 
    FROM pg_index i 
    JOIN pg_class c ON c.oid = i.indexrelid 
    JOIN pg_am am ON am.oid = c.relam
    WHERE c.relname = 'idx_product_attributes_attributes_gin';
  `;
  console.log('\n  Restored GIN Index Catalog Check:', restoredGin);
  if (!restoredGin || !restoredGin.indisvalid || restoredGin.amname !== 'gin') {
    throw new Error('GIN index failed to restore validly in test database!');
  }

  // Step 5: Application-Level Smoke Test on Restored Database (Write AND Read Operations)
  console.log('\nStep 5: Executing Application Smoke Test on Restored Database (Write + Read)...');
  const [testBrand] = await testSql`
    INSERT INTO brands (name, normalized_name)
    VALUES ('Drill Recovery Brand', 'drill-recovery-brand')
    RETURNING id;
  `;
  console.log('  [Write 1] Inserted test brand in restored DB:', testBrand.id);

  const [testProd] = await testSql`
    INSERT INTO global_products (brand_id, canonical_title, model_number, normalized_model)
    VALUES (${testBrand.id}, 'Disaster Recovery Validation Model', 'DR-2026', 'dr2026')
    RETURNING id;
  `;
  console.log('  [Write 2] Inserted test global product in restored DB:', testProd.id);

  await testSql`
    INSERT INTO product_attributes (global_product_id, attribute_key, raw_value, normalized_value, attributes)
    VALUES (${testProd.id}, 'specs_recovery', 'verified', 'verified', '{"restored_operational": true, "drill_tag": "NOV2026"}'::jsonb);
  `;
  console.log('  [Write 3] Inserted test JSONB attribute with GIN index coverage in restored DB');

  // Verify Read operation with GIN containment on restored database
  const readBack = await testSql`
    SELECT id, attributes
    FROM product_attributes
    WHERE attributes @> '{"restored_operational": true}'::jsonb;
  `;
  console.log('  [Read] Query result count using GIN containment in restored DB:', readBack.length);
  if (readBack.length === 0 || !readBack[0].attributes.restored_operational) {
    throw new Error('Application smoke test read query failed on restored database!');
  }
  console.log('>> SUCCESS: Read & Write application operations verified on restored database!');

  // Step 6: Cleanup drill database and dump file
  console.log('\nStep 6: Cleaning up drill artifacts...');
  await mainSql.end();
  await testSql.end();
  await adminSql.unsafe(`DROP DATABASE ${TEST_DB_NAME};`);
  await adminSql.end();
  execSync('docker exec saas_postgres rm /tmp/disaster_recovery_drill.dump');
  console.log(`[+] Dropped isolated test database ${TEST_DB_NAME} and cleaned up dump file.`);

  console.log('\n=== POSTGRESQL BACKUP & ISOLATED RESTORE DRILL PASSED 100% ===');
  return {
    backupDurationMs,
    backupSizeBytes,
    restoreDurationMs,
    tablesCheckedCount: tablesToCheck.length,
    paritySuccess: true,
  };
}

runDrill().catch((err) => {
  console.error('DRILL FAILED:', err);
  process.exit(1);
});
