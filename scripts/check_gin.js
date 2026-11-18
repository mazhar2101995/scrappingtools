const path = require('path');
const fs = require('fs');
const postgres = require(path.resolve(__dirname, '../packages/database/node_modules/postgres'));
const sql = postgres('postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev');

async function applyAndVerifyGin() {
  console.log('========================================================================');
  console.log('APPLYING AND VERIFYING POSTGRESQL GIN INDEX ON product_attributes');
  console.log('========================================================================\n');

  // 1. Read and apply migration statement by statement outside transaction block
  // (CREATE INDEX CONCURRENTLY must not be executed inside a multi-statement transaction)
  await sql`
    ALTER TABLE product_attributes 
    ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
  `;

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'idx_product_attributes_attributes_gin' AND NOT i.indisvalid
      ) THEN
        DROP INDEX idx_product_attributes_attributes_gin;
      END IF;
    END $$;
  `;

  // Check if index already exists and is valid before running CREATE INDEX CONCURRENTLY
  const existing = await sql`
    SELECT i.indisvalid 
    FROM pg_index i 
    JOIN pg_class c ON c.oid = i.indexrelid 
    WHERE c.relname = 'idx_product_attributes_attributes_gin';
  `;

  if (existing.length === 0 || !existing[0].indisvalid) {
    await sql.unsafe(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_attributes_attributes_gin ON product_attributes USING gin (attributes);'
    );
  }
  console.log('[+] Migration 05_product_attributes_gin_index executed successfully with safe CONCURRENT execution.');

  // 2. Verify column and index in information_schema / pg_indexes
  const col = await sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'product_attributes' AND column_name = 'attributes';
  `;
  console.log('Verified Column:', col);

  const catalogIndex = await sql`
    SELECT 
      c.relname AS index_name,
      i.indisvalid AS is_valid,
      i.indisready AS is_ready,
      am.amname AS access_method
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_am am ON am.oid = c.relam
    WHERE c.relname = 'idx_product_attributes_attributes_gin';
  `;
  console.log('PostgreSQL Catalog Index Validity:', catalogIndex);
  if (!catalogIndex[0] || !catalogIndex[0].is_valid) {
    throw new Error('Index is invalid or missing in pg_index catalog!');
  }

  // Duplicate index check
  const allIndexes = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'product_attributes';
  `;
  console.log('All product_attributes indexes:', allIndexes.map(i => i.indexname).join(', '));
  const ginIndexes = allIndexes.filter(i => i.indexdef.includes('gin (attributes)'));
  if (ginIndexes.length > 1) {
    throw new Error(`Duplicate GIN indexes found: ${ginIndexes.map(i => i.indexname).join(', ')}`);
  }
  console.log('[+] Verified: Zero duplicate GIN indexes exist.');

  // 3. Test representative JSONB query with EXPLAIN ANALYZE
  // Get an existing globalProductId or create dummy
  const gp = await sql`SELECT id FROM global_products LIMIT 1;`;
  if (gp.length > 0) {
    const testGpId = gp[0].id;
    // Insert 5 test attribute rows with rich JSONB attributes
    const testAttrs = [
      { key: 'specs_electronics', raw: 'bluetooth', norm: 'bluetooth', json: { bluetooth: '5.3', waterproof: true, battery_life_hours: 24, colors: ['black', 'silver'] } },
      { key: 'specs_apparel', raw: 'cotton', norm: 'cotton', json: { material: '100% Cotton', care: 'Machine wash', origin: 'USA' } },
      { key: 'specs_industrial', raw: 'steel', norm: 'steel', json: { grade: '316L', tensile_strength_mpa: 580, certified: true } },
      { key: 'specs_sports', raw: 'carbon', norm: 'carbon', json: { weight_grams: 145, composite: true, warranty_years: 5 } },
      { key: 'specs_audio', raw: 'noise_cancelling', norm: 'anc', json: { anc_depth_db: 42, codecs: ['LDAC', 'aptX-HD', 'AAC'] } },
    ];

    for (const a of testAttrs) {
      await sql`
        INSERT INTO product_attributes (global_product_id, attribute_key, raw_value, normalized_value, attributes)
        VALUES (${testGpId}, ${a.key}, ${a.raw}, ${a.norm}, ${sql.json(a.json)})
        ON CONFLICT (global_product_id, product_variant_id, attribute_key) DO UPDATE
        SET attributes = EXCLUDED.attributes;
      `;
    }
    console.log(`[+] Seeded ${testAttrs.length} test records with JSONB payloads.`);

    // Run EXPLAIN ANALYZE with GIN containment (@>)
    // Force index scan enable to inspect query planner cost
    await sql`SET enable_seqscan = off;`;
    const explainResult = await sql`
      EXPLAIN ANALYZE
      SELECT id, attribute_key, attributes
      FROM product_attributes
      WHERE attributes @> '{"waterproof": true}'::jsonb;
    `;
    console.log('\nEXPLAIN ANALYZE Output (Containment @>):');
    explainResult.forEach(r => console.log('  ' + r['QUERY PLAN']));
    await sql`SET enable_seqscan = on;`;

    // Query actual result
    const queryResult = await sql`
      SELECT id, attribute_key, attributes
      FROM product_attributes
      WHERE attributes @> '{"waterproof": true}'::jsonb;
    `;
    console.log('\nQuery Result for @> {"waterproof": true}:', queryResult);

    // Clean up test records
    await sql`
      DELETE FROM product_attributes 
      WHERE global_product_id = ${testGpId} AND attribute_key LIKE 'specs_%';
    `;
    console.log('[+] Cleaned up test records.');
  }

  await sql.end();
}

applyAndVerifyGin().catch(err => {
  console.error(err);
  process.exit(1);
});
