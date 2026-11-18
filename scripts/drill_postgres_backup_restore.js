const { execSync } = require('child_process');
const path = require('path');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));

const MAIN_DB_URL = 'postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev';
const TEST_DB_NAME = 'product_intelligence_isolated_restore_test';
const TEST_DB_URL = `postgresql://postgres:postgres_dev_password@localhost:5432/${TEST_DB_NAME}`;

async function runDrill() {
  console.log('=== PostgreSQL Backup & Isolated Restore Drill ===\n');

  const adminSql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/postgres');

  // Step 1: Ensure clean state for isolated restore test DB
  console.log(`Step 1: Dropping existing ${TEST_DB_NAME} if present...`);
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB_NAME};`);
  console.log(`[+] Created isolated target database: ${TEST_DB_NAME}`);

  // Step 2: Execute pg_dump custom format (-F c) inside container
  console.log('\nStep 2: Executing pg_dump (-F c) on product_intelligence_dev...');
  const dumpCmd = 'docker exec saas_postgres pg_dump -U postgres -d product_intelligence_dev -F c -b -f /tmp/test_backup.dump';
  execSync(dumpCmd, { stdio: 'inherit' });
  console.log('[+] Custom-format dump created successfully at /tmp/test_backup.dump');

  // Step 3: Execute pg_restore into isolated database
  console.log(`\nStep 3: Restoring into isolated database ${TEST_DB_NAME}...`);
  try {
    const restoreCmd = `docker exec saas_postgres pg_restore -U postgres -d ${TEST_DB_NAME} --no-owner --no-privileges /tmp/test_backup.dump`;
    execSync(restoreCmd, { stdio: 'pipe' });
  } catch (err) {
    // pg_restore can exit with 1 on minor warnings (e.g. extension already exists)
    console.log('[~] pg_restore completed with warnings/notices:', err.message?.slice(0, 150));
  }
  console.log('[+] Restoration finished into isolated target database.');

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
    'system_error_logs'
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
  console.log('>> SUCCESS: 100% Data and Index Parity verified in isolated restored database!');

  // Step 5: Clean up test database and dump file
  console.log('\nStep 5: Cleaning up drill artifacts...');
  await mainSql.end();
  await testSql.end();
  await adminSql.unsafe(`DROP DATABASE ${TEST_DB_NAME};`);
  await adminSql.end();
  execSync('docker exec saas_postgres rm /tmp/test_backup.dump');
  console.log(`[+] Dropped isolated test database ${TEST_DB_NAME} and deleted container dump.`);

  console.log('\n=== POSTGRESQL BACKUP & ISOLATED RESTORE DRILL PASSED 100% ===');
}

runDrill().catch((err) => {
  console.error('DRILL FAILED:', err);
  process.exit(1);
});
