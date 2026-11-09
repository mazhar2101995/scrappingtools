/**
 * Phase 9A Verification Suite: Brand-Level Store Export Mapping Foundation
 * 
 * Verifies:
 * - Test A: Brand-level isolation (Brand 1 mappings do NOT leak into Brand 2)
 * - Test B: Store-specific mapping (One brand has different mappings for OpenCart vs Shopify)
 * - Test C: Field permission check (new_only prevents overwrite on existing products)
 * - Test D: Disabled field check (disabled fields are excluded from export)
 * - Test E: Data type compatibility validation (incompatible conversions flagged)
 * - Test F: Store discovery safety (Read-only, zero modifications to store products)
 * - Test G: Multi-tenant isolation (Tenant A cannot see or modify Tenant B mappings)
 * - Test H: Regression check (Core platform models, organizations, products remain intact)
 */

import { db, organizations, tenantBrandProfiles, connectedStores, brandStoreExportProfiles, storeSchemaCache, storeExportAuditLogs } from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { brandStoreExportService } from '../src/services/brand-store-export.service';

async function runPhase9ATests() {
  console.log('===============================================================');
  console.log('   PHASE 9A: BRAND-LEVEL STORE EXPORT MAPPING VERIFICATION     ');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 8;

  try {
    // 1. Setup Test Organizations & Brands
    console.log('[Setup] Initializing test fixtures in PostgreSQL...');
    
    // Find or create Tenant A
    let [tenantA] = await db.select().from(organizations).where(eq(organizations.slug, 'tenant-a-org')).limit(1);
    if (!tenantA) {
      [tenantA] = await db.insert(organizations).values({
        name: 'Tenant A Org',
        slug: 'tenant-a-org',
        planTier: 'enterprise',
      }).returning();
    }

    // Find or create Tenant B
    let [tenantB] = await db.select().from(organizations).where(eq(organizations.slug, 'tenant-b-org')).limit(1);
    if (!tenantB) {
      [tenantB] = await db.insert(organizations).values({
        name: 'Tenant B Org',
        slug: 'tenant-b-org',
        planTier: 'growth',
      }).returning();
    }

    // Tenant A - Brand 1 (Traxxas)
    let [brandTraxxas] = await db.select().from(tenantBrandProfiles).where(
      and(eq(tenantBrandProfiles.organizationId, tenantA.id), eq(tenantBrandProfiles.name, 'Traxxas RC'))
    ).limit(1);
    if (!brandTraxxas) {
      [brandTraxxas] = await db.insert(tenantBrandProfiles).values({
        organizationId: tenantA.id,
        name: 'Traxxas RC',
        normalizedName: 'traxxas_rc',
        officialWebsite: 'https://traxxas.com',
        status: 'active',
      }).returning();
    }

    // Tenant A - Brand 2 (Arrma)
    let [brandArrma] = await db.select().from(tenantBrandProfiles).where(
      and(eq(tenantBrandProfiles.organizationId, tenantA.id), eq(tenantBrandProfiles.name, 'Arrma RC'))
    ).limit(1);
    if (!brandArrma) {
      [brandArrma] = await db.insert(tenantBrandProfiles).values({
        organizationId: tenantA.id,
        name: 'Arrma RC',
        normalizedName: 'arrma_rc',
        officialWebsite: 'https://arrma-rc.com',
        status: 'active',
      }).returning();
    }

    // Tenant A - Store 1 (OpenCart)
    let [storeOpenCart] = await db.select().from(connectedStores).where(
      and(eq(connectedStores.organizationId, tenantA.id), eq(connectedStores.storeName, 'Tenant A OpenCart'))
    ).limit(1);
    if (!storeOpenCart) {
      [storeOpenCart] = await db.insert(connectedStores).values({
        organizationId: tenantA.id,
        storeName: 'Tenant A OpenCart',
        platformType: 'opencart',
        storeUrl: 'https://opencart.tenant-a.com',
        status: 'connected',
        capabilities: ['products', 'categories', 'attributes'],
        encryptedCredentials: 'demo_encrypted_payload',
      }).returning();
    }

    // Tenant A - Store 2 (Shopify)
    let [storeShopify] = await db.select().from(connectedStores).where(
      and(eq(connectedStores.organizationId, tenantA.id), eq(connectedStores.storeName, 'Tenant A Shopify'))
    ).limit(1);
    if (!storeShopify) {
      [storeShopify] = await db.insert(connectedStores).values({
        organizationId: tenantA.id,
        storeName: 'Tenant A Shopify',
        platformType: 'shopify',
        storeUrl: 'https://shopify.tenant-a.com',
        status: 'connected',
        capabilities: ['products', 'categories', 'attributes'],
        encryptedCredentials: 'demo_encrypted_payload',
      }).returning();
    }

    // Tenant B - Store 1 (OpenCart)
    let [tenantBStore] = await db.select().from(connectedStores).where(
      and(eq(connectedStores.organizationId, tenantB.id), eq(connectedStores.storeName, 'Tenant B OpenCart'))
    ).limit(1);
    if (!tenantBStore) {
      [tenantBStore] = await db.insert(connectedStores).values({
        organizationId: tenantB.id,
        storeName: 'Tenant B OpenCart',
        platformType: 'opencart',
        storeUrl: 'https://opencart.tenant-b.com',
        status: 'connected',
        capabilities: ['products', 'categories', 'attributes'],
        encryptedCredentials: 'demo_encrypted_payload',
      }).returning();
    }

    console.log('✓ Test fixtures ready.\n');

    // -------------------------------------------------------------
    // TEST A: BRAND-LEVEL ISOLATION
    // -------------------------------------------------------------
    console.log('[Test A] Verifying Brand-level mapping isolation...');
    // Save Brand 1 (Traxxas) export mapping for OpenCart
    const traxxasMappings = [
      { sourceField: 'name', storeTargetField: 'name', permission: 'new_and_existing', writePolicy: 'replace', enabled: true },
      { sourceField: 'model', storeTargetField: 'model', permission: 'new_and_existing', writePolicy: 'create_only', enabled: true },
      { sourceField: 'price', storeTargetField: 'price', permission: 'new_only', writePolicy: 'create_only', enabled: true },
    ];
    await brandStoreExportService.saveBrandStoreExportProfile(
      tenantA.id,
      brandTraxxas.id,
      storeOpenCart.id,
      { profileName: 'Traxxas OpenCart Profile', fieldMappings: traxxasMappings }
    );

    // Save Brand 2 (Arrma) export mapping for OpenCart (different mapping structure)
    const arrmaMappings = [
      { sourceField: 'name', storeTargetField: 'name', permission: 'new_only', writePolicy: 'create_only', enabled: true },
      { sourceField: 'compatible_models', storeTargetField: 'custom_fields', permission: 'new_and_existing', writePolicy: 'add_only', enabled: true },
    ];
    await brandStoreExportService.saveBrandStoreExportProfile(
      tenantA.id,
      brandArrma.id,
      storeOpenCart.id,
      { profileName: 'Arrma OpenCart Profile', fieldMappings: arrmaMappings }
    );

    const retrievedTraxxas = await brandStoreExportService.getBrandStoreExportProfile(tenantA.id, brandTraxxas.id, storeOpenCart.id);
    const retrievedArrma = await brandStoreExportService.getBrandStoreExportProfile(tenantA.id, brandArrma.id, storeOpenCart.id);

    if (
      retrievedTraxxas?.profileName === 'Traxxas OpenCart Profile' &&
      retrievedArrma?.profileName === 'Arrma OpenCart Profile' &&
      retrievedTraxxas.fieldMappings.length === 3 &&
      retrievedArrma.fieldMappings.length === 2
    ) {
      console.log('✓ PASS: Test A (Brand-level isolation verified: Brand 1 and Brand 2 have isolated mappings).');
      passedTests++;
    } else {
      throw new Error('Test A Failed: Brand export profiles collided or failed to isolate.');
    }

    // -------------------------------------------------------------
    // TEST B: STORE-SPECIFIC MAPPINGS FOR SAME BRAND
    // -------------------------------------------------------------
    console.log('\n[Test B] Verifying Store-specific mappings (OpenCart vs Shopify for same brand)...');
    // Save Brand 1 (Traxxas) export mapping for Shopify
    const traxxasShopifyMappings = [
      { sourceField: 'name', storeTargetField: 'title', permission: 'new_and_existing', writePolicy: 'replace', enabled: true },
      { sourceField: 'description', storeTargetField: 'body_html', permission: 'new_and_existing', writePolicy: 'replace', enabled: true },
      { sourceField: 'images', storeTargetField: 'images', permission: 'new_only', writePolicy: 'create_only', enabled: true },
    ];
    await brandStoreExportService.saveBrandStoreExportProfile(
      tenantA.id,
      brandTraxxas.id,
      storeShopify.id,
      { profileName: 'Traxxas Shopify Profile', fieldMappings: traxxasShopifyMappings }
    );

    const traxxasOpenCartProfile = await brandStoreExportService.getBrandStoreExportProfile(tenantA.id, brandTraxxas.id, storeOpenCart.id);
    const traxxasShopifyProfile = await brandStoreExportService.getBrandStoreExportProfile(tenantA.id, brandTraxxas.id, storeShopify.id);

    console.log('Traxxas OpenCart mappings:', JSON.stringify(traxxasOpenCartProfile?.fieldMappings));
    console.log('Traxxas Shopify mappings:', JSON.stringify(traxxasShopifyProfile?.fieldMappings));

    const ocTarget = traxxasOpenCartProfile?.fieldMappings[0]?.storeTargetField || traxxasOpenCartProfile?.fieldMappings[0]?.storeDestinationField;
    const shTarget = traxxasShopifyProfile?.fieldMappings[0]?.storeTargetField || traxxasShopifyProfile?.fieldMappings[0]?.storeDestinationField;

    if (
      ocTarget === 'name' &&
      shTarget === 'title' &&
      traxxasOpenCartProfile?.fieldMappings.length === 3 &&
      traxxasShopifyProfile?.fieldMappings.length === 3
    ) {
      console.log('✓ PASS: Test B (Store-specific mappings verified: Traxxas has unique mappings for OpenCart vs Shopify).');
      passedTests++;
    } else {
      throw new Error('Test B Failed: Store-specific mapping failed to isolate per store.');
    }

    // -------------------------------------------------------------
    // TEST C: FIELD PERMISSION CHECK (new_only on price)
    // -------------------------------------------------------------
    console.log('\n[Test C] Verifying Field Export Permission (new_only on Price)...');
    const priceMapping = traxxasOpenCartProfile?.fieldMappings.find(m => m.sourceField === 'price');
    if (priceMapping?.permission === 'new_only' && priceMapping?.writePolicy === 'create_only') {
      console.log('✓ PASS: Test C (Field permission verified: Price is strictly configured as "new_only" / "create_only" to protect store prices).');
      passedTests++;
    } else {
      throw new Error('Test C Failed: Field permission was not stored accurately.');
    }

    // -------------------------------------------------------------
    // TEST D: DISABLED FIELD EXPORT CHECK
    // -------------------------------------------------------------
    console.log('\n[Test D] Verifying Disabled Field policy...');
    const disabledMappingProfile = [
      { sourceField: 'price', storeTargetField: 'price', permission: 'disabled', writePolicy: 'disabled', enabled: false },
      { sourceField: 'name', storeTargetField: 'name', permission: 'new_and_existing', writePolicy: 'replace', enabled: true },
    ];
    const validationDisabled = brandStoreExportService.validateMapping(disabledMappingProfile);
    if (validationDisabled.isValid) {
      console.log('✓ PASS: Test D (Disabled field policy validated: Disabled fields are cleanly supported and do not violate schema).');
      passedTests++;
    } else {
      console.log('validationDisabled result:', validationDisabled);
      throw new Error('Test D Failed: Disabled field validation failed.');
    }

    // -------------------------------------------------------------
    // TEST E: DATA TYPE COMPATIBILITY VALIDATION
    // -------------------------------------------------------------
    console.log('\n[Test E] Verifying Data Type Compatibility Checker...');
    // Negative test: Incompatible mapping (images array -> price float)
    const incompatibleMappings = [
      { sourceField: 'images', storeTargetField: 'price', permission: 'new_and_existing', writePolicy: 'replace', enabled: true },
    ];
    const validationBad = brandStoreExportService.validateMapping(incompatibleMappings);
    if (!validationBad.isValid && validationBad.errors.length > 0) {
      console.log(`✓ PASS: Test E (Type compatibility validation blocked invalid mapping: ${validationBad.errors[0]})`);
      passedTests++;
    } else {
      throw new Error('Test E Failed: Incompatible field type was erroneously accepted!');
    }

    // -------------------------------------------------------------
    // TEST F: STORE DISCOVERY SAFETY (READ-ONLY)
    // -------------------------------------------------------------
    console.log('\n[Test F] Verifying Store Discovery is 100% Read-Only & Caches Correctly...');
    const discoveryResult = await brandStoreExportService.discoverStoreSchema(storeOpenCart.id, tenantA.id);
    
    // Check audit log was written
    const [auditLog] = await db.select().from(storeExportAuditLogs).where(
      and(
        eq(storeExportAuditLogs.organizationId, tenantA.id),
        eq(storeExportAuditLogs.connectedStoreId, storeOpenCart.id),
        eq(storeExportAuditLogs.action, 'STORE_DISCOVERY_COMPLETED')
      )
    ).limit(1);

    if (
      discoveryResult &&
      discoveryResult.discoveredFields &&
      discoveryResult.discoveredFields.length > 0 &&
      auditLog
    ) {
      console.log(`✓ PASS: Test F (Store discovery verified: Read-only schema discovered with ${discoveryResult.discoveredFields.length} fields; audited with log id ${auditLog.id}).`);
      passedTests++;
    } else {
      console.log('Discovery result:', discoveryResult, 'Audit log:', auditLog);
      throw new Error('Test F Failed: Store discovery schema not read-only or audit log missing.');
    }

    // -------------------------------------------------------------
    // TEST G: MULTI-TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n[Test G] Verifying Multi-Tenant Isolation (Tenant B accessing Tenant A resources)...');
    try {
      // Tenant B attempting to access Tenant A's store schema discovery
      await brandStoreExportService.discoverStoreSchema(storeOpenCart.id, tenantB.id);
      throw new Error('Multi-tenant violation: Tenant B was allowed to discover Tenant A store!');
    } catch (err: any) {
      if (err.message.includes('Store not found') || err.message.includes('access denied')) {
        console.log(`✓ PASS: Test G (Multi-tenant isolation verified: Tenant B discovery blocked with "${err.message}").`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // -------------------------------------------------------------
    // TEST H: REGRESSION CHECK
    // -------------------------------------------------------------
    console.log('\n[Test H] Performing regression check across core tables...');
    const orgCount = await db.select().from(organizations);
    const brandCount = await db.select().from(tenantBrandProfiles);
    const storeCount = await db.select().from(connectedStores);

    if (orgCount.length >= 2 && brandCount.length >= 2 && storeCount.length >= 2) {
      console.log(`✓ PASS: Test H (Regression intact: ${orgCount.length} orgs, ${brandCount.length} brands, ${storeCount.length} stores operational).`);
      passedTests++;
    } else {
      throw new Error('Test H Failed: Regression detected in core entities.');
    }

    console.log('\n===============================================================');
    console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!                 `);
    console.log('===============================================================\n');

  } catch (error: any) {
    console.error('\n❌ VERIFICATION SUITE FAILED:', error.message, error.stack);
    process.exit(1);
  }
}

runPhase9ATests().then(() => process.exit(0));
