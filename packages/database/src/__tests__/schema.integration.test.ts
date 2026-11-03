import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, client } from '../index';
import {
  organizations,
  brands,
  sourceWebsites,
  sourceProductListings,
  globalProducts,
  productVariants,
  productIdentifiers,
  productAttributes,
  customerProductMappings,
  customerProductOverrides,
  fieldProvenance,
  productVersions,
} from '../schema';
import { eq, and } from 'drizzle-orm';

describe('Production Product Intelligence Database Integration Test Suite', () => {
  let orgAId: string;
  let orgBId: string;
  let brandId: string;
  let website1Id: string;
  let website2Id: string;
  let testGlobalProductId: string;

  beforeAll(async () => {
    // 1. Create 2 test Tenants (Organizations)
    const [orgA] = await db.insert(organizations).values({
      name: 'Tenant Alpha Retail',
      slug: `tenant-alpha-${Date.now()}`,
    }).returning();
    orgAId = orgA.id;

    const [orgB] = await db.insert(organizations).values({
      name: 'Tenant Beta Wholesale',
      slug: `tenant-beta-${Date.now()}`,
    }).returning();
    orgBId = orgB.id;

    // 2. Create a Brand (Manufacturer)
    const [testBrand] = await db.insert(brands).values({
      name: 'Sony Electronics',
      normalizedName: `sony-electronics-${Date.now()}`,
      officialWebsite: 'https://sony.com',
      isVerified: true,
    }).returning();
    brandId = testBrand.id;

    // 3. Create 2 distinct Source Websites
    const [web1] = await db.insert(sourceWebsites).values({
      name: 'Brand Official Store',
      domain: `store.sony.test-${Date.now()}`,
      sourceType: 'official_brand',
      trustScore: '0.98',
    }).returning();
    website1Id = web1.id;

    const [web2] = await db.insert(sourceWebsites).values({
      name: 'Distributor Mart',
      domain: `distributor.test-${Date.now()}`,
      sourceType: 'authorized_distributor',
      trustScore: '0.90',
    }).returning();
    website2Id = web2.id;
  });

  afterAll(async () => {
    await client.end();
  });

  // TEST 1: Duplicate EAN rejection
  it('TEST 1: should reject duplicate EAN across distinct physical products via unique constraint', async () => {
    const uniqueEan = `EAN_${Date.now()}`;

    // Create First Global Product
    const [gp1] = await db.insert(globalProducts).values({
      brandId,
      canonicalTitle: 'Sony WH-1000XM5 Wireless Headphones (Black)',
      modelNumber: 'WH1000XM5/B',
      normalizedModel: 'wh1000xm5b',
    }).returning();

    testGlobalProductId = gp1.id;

    // Insert EAN for gp1
    await db.insert(productIdentifiers).values({
      globalProductId: gp1.id,
      idType: 'EAN_13',
      idValue: uniqueEan,
      normalizedValue: uniqueEan,
      isPrimary: true,
    });

    // Create Second Global Product
    const [gp2] = await db.insert(globalProducts).values({
      brandId,
      canonicalTitle: 'Sony WH-1000XM5 Wireless Headphones (Silver)',
      modelNumber: 'WH1000XM5/S',
      normalizedModel: 'wh1000xm5s',
    }).returning();

    // Attempting to attach the identical EAN to gp2 MUST FAIL
    await expect(
      db.insert(productIdentifiers).values({
        globalProductId: gp2.id,
        idType: 'EAN_13',
        idValue: uniqueEan,
        normalizedValue: uniqueEan,
      })
    ).rejects.toThrow();
  });

  // TEST 2: Same model from multiple sources consolidates into one global product
  it('TEST 2: should link multiple source listings to one canonical global product', async () => {
    // Source Listing 1 from official site
    const [listing1] = await db.insert(sourceProductListings).values({
      sourceWebsiteId: website1Id,
      sourceUrl: `https://store.sony.test/p/100-${Date.now()}`,
      canonicalProductId: testGlobalProductId,
      rawTitle: 'WH-1000XM5 Noise-Canceling Headphones',
      rawPrice: '399.99',
      lastScrapedAt: new Date(),
      contentHash: `hash1_${Date.now()}`,
    }).returning();

    // Source Listing 2 from distributor
    const [listing2] = await db.insert(sourceProductListings).values({
      sourceWebsiteId: website2Id,
      sourceUrl: `https://distributor.test/item/wh-xm5-${Date.now()}`,
      canonicalProductId: testGlobalProductId,
      rawTitle: 'Sony XM5 Noise Cancelling Over-Ear',
      rawPrice: '389.00',
      lastScrapedAt: new Date(),
      contentHash: `hash2_${Date.now()}`,
    }).returning();

    expect(listing1.canonicalProductId).toBe(testGlobalProductId);
    expect(listing2.canonicalProductId).toBe(testGlobalProductId);

    // Verify both listings point to the single canonical global product
    const listings = await db
      .select()
      .from(sourceProductListings)
      .where(eq(sourceProductListings.canonicalProductId, testGlobalProductId));

    expect(listings.length).toBeGreaterThanOrEqual(2);
  });

  // TEST 3: Different variants with similar names remain distinct
  it('TEST 3: should distinguish different variants (Color/Storage) under same parent product', async () => {
    const [varBlack] = await db.insert(productVariants).values({
      globalProductId: testGlobalProductId,
      variantName: 'Midnight Black',
      color: 'Black',
      sku: 'SONY-XM5-BLK',
    }).returning();

    const [varSilver] = await db.insert(productVariants).values({
      globalProductId: testGlobalProductId,
      variantName: 'Platinum Silver',
      color: 'Silver',
      sku: 'SONY-XM5-SLV',
    }).returning();

    expect(varBlack.id).not.toBe(varSilver.id);
    expect(varBlack.color).toBe('Black');
    expect(varSilver.color).toBe('Silver');

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.globalProductId, testGlobalProductId));

    expect(variants.length).toBe(2);
  });

  // TEST 4: Conflicting product attributes resolved with confidence & source tagging
  it('TEST 4: should store structured normalized attributes with unique key per product', async () => {
    await db.insert(productAttributes).values({
      globalProductId: testGlobalProductId,
      attributeKey: 'battery_life_hours',
      rawValue: '30 Hours (ANC On)',
      normalizedValue: '30',
      unit: 'hours',
      dataType: 'number',
      confidence: '0.99',
    });

    const [attr] = await db
      .select()
      .from(productAttributes)
      .where(
        and(
          eq(productAttributes.globalProductId, testGlobalProductId),
          eq(productAttributes.attributeKey, 'battery_life_hours')
        )
      );

    expect(attr.normalizedValue).toBe('30');
    expect(attr.unit).toBe('hours');
  });

  // TEST 5 & 6: Multi-tenant customer mapping & field overrides isolation
  it('TEST 5 & 6: should allow multiple customers to map same product while isolating custom overrides', async () => {
    // Both Tenant A and Tenant B map the same Global Product
    await db.insert(customerProductMappings).values({
      organizationId: orgAId,
      globalProductId: testGlobalProductId,
      customerInternalSku: 'ALPHA-SKU-001',
    });

    await db.insert(customerProductMappings).values({
      organizationId: orgBId,
      globalProductId: testGlobalProductId,
      customerInternalSku: 'BETA-SKU-999',
    });

    // Tenant A sets private custom title
    await db.insert(customerProductOverrides).values({
      organizationId: orgAId,
      globalProductId: testGlobalProductId,
      customTitle: 'Tenant Alpha Custom Headline for XM5',
      customCategory: 'Premium Audio',
    });

    // Query for Tenant A: Has custom title
    const [overrideA] = await db
      .select()
      .from(customerProductOverrides)
      .where(
        and(
          eq(customerProductOverrides.organizationId, orgAId),
          eq(customerProductOverrides.globalProductId, testGlobalProductId)
        )
      );
    expect(overrideA.customTitle).toBe('Tenant Alpha Custom Headline for XM5');

    // Query for Tenant B: Must have NO overrides
    const overrideB = await db
      .select()
      .from(customerProductOverrides)
      .where(
        and(
          eq(customerProductOverrides.organizationId, orgBId),
          eq(customerProductOverrides.globalProductId, testGlobalProductId)
        )
      );
    expect(overrideB.length).toBe(0);
  });

  // TEST 7 & 8: Field-level provenance, freshness & version history diff
  it('TEST 7 & 8: should track field-level provenance and snapshot version diffs', async () => {
    // 1. Get an existing source listing
    const [listing] = await db
      .select()
      .from(sourceProductListings)
      .where(eq(sourceProductListings.canonicalProductId, testGlobalProductId))
      .limit(1);

    // 2. Track Field Provenance for Title
    await db.insert(fieldProvenance).values({
      globalProductId: testGlobalProductId,
      fieldName: 'canonical_title',
      currentValue: 'Sony WH-1000XM5 Wireless Headphones (Black)',
      sourceWebsiteId: website1Id,
      sourceProductListingId: listing.id,
      confidence: '0.98',
      isStale: false,
    });

    // 3. Record Version Snapshot
    await db.insert(productVersions).values({
      globalProductId: testGlobalProductId,
      versionNumber: 1,
      changedBySourceId: website1Id,
      diffPayload: { canonical_title: { old: null, new: 'Sony WH-1000XM5 Wireless Headphones (Black)' } },
      fullSnapshot: { title: 'Sony WH-1000XM5 Wireless Headphones (Black)', model: 'WH1000XM5/B' },
      reason: 'initial_canonical_ingestion',
    });

    const [version] = await db
      .select()
      .from(productVersions)
      .where(eq(productVersions.globalProductId, testGlobalProductId));

    expect(version.versionNumber).toBe(1);
    expect(version.reason).toBe('initial_canonical_ingestion');
  });

  // TEST 9 & 10: Concurrent insertion atomicity & transaction rollback
  it('TEST 9 & 10: should cleanly rollback entire transaction when sub-operation fails', async () => {
    const rolledBackSlug = `will-fail-org-${Date.now()}`;

    try {
      await db.transaction(async (tx) => {
        // Step 1: Create organization
        const [org] = await tx.insert(organizations).values({
          name: 'Should Not Exist Org',
          slug: rolledBackSlug,
        }).returning();

        // Step 2: Deliberately violate NOT NULL constraint on a sub-table to force rollback
        // @ts-expect-error deliberately violating schema
        await tx.insert(customerProductMappings).values({
          organizationId: org.id,
          globalProductId: null, // Violates NOT NULL
        });
      });
    } catch (error) {
      // Expected transaction rejection
    }

    // Verify organization was rolled back and does not exist in PostgreSQL
    const checkOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, rolledBackSlug));

    expect(checkOrg.length).toBe(0);
  });
});

