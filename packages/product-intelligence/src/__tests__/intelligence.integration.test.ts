import { describe, it, expect, beforeAll } from 'vitest';
import {
  ProductIdentityEngine,
  FieldProvenanceEngine,
  DataFreshnessEngine,
  AttributeNormalizerEngine,
  ImageIntelligenceEngine,
  AiEnrichmentEngine,
  MultilingualTranslationEngine,
} from '../index';
import {
  db,
  brands,
  globalProducts,
  productIdentifiers,
  sourceWebsites,
  sourceProductListings,
} from '@saas/database';
import { eq } from 'drizzle-orm';

describe('Phase 6: AI Product Intelligence Engine Test Suite', () => {
  let testBrandId: string;
  let testWebsiteId: string;
  let testListingId: string;
  let testGlobalProductId: string;

  beforeAll(async () => {
    // 1. Seed or retrieve test brand
    const [existingBrand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.normalizedName, 'traxxas'))
      .limit(1);

    if (existingBrand) {
      testBrandId = existingBrand.id;
    } else {
      const [newBrand] = await db
        .insert(brands)
        .values({
          name: 'Traxxas',
          normalizedName: 'traxxas',
          officialWebsite: 'https://traxxas.com',
        })
        .returning({ id: brands.id });
      testBrandId = newBrand.id;
    }

    // 2. Seed source website
    const [newSite] = await db
      .insert(sourceWebsites)
      .values({
        brandId: testBrandId,
        name: 'Traxxas Official',
        domain: `traxxas-test-${Date.now()}.com`,
        sourceType: 'official_brand',
        trustScore: '1.00',
      })
      .returning({ id: sourceWebsites.id });
    testWebsiteId = newSite.id;

    // 3. Seed canonical global product
    const [newProd] = await db
      .insert(globalProducts)
      .values({
        brandId: testBrandId,
        canonicalTitle: 'Traxxas Slash 4X4 VXL 1/10 Short Course Truck',
        modelNumber: '68086-4',
        normalizedModel: '680864',
      })
      .returning({ id: globalProducts.id });
    testGlobalProductId = newProd.id;

    // Seed EAN and MPN using onConflictDoNothing
    await db.insert(productIdentifiers).values([
      {
        globalProductId: testGlobalProductId,
        idType: 'EAN_13',
        idValue: '0020334680860',
        normalizedValue: '0020334680860',
        confidence: '1.00',
      },
      {
        globalProductId: testGlobalProductId,
        idType: 'MPN',
        idValue: '68086-4',
        normalizedValue: '680864',
        confidence: '1.00',
      },
    ]).onConflictDoNothing();

    // Seed source product listing
    const [listing] = await db
      .insert(sourceProductListings)
      .values({
        sourceWebsiteId: testWebsiteId,
        sourceUrl: `https://traxxas.com/products/slash-${Date.now()}`,
        rawTitle: 'Slash 4X4 VXL',
        contentHash: 'initial-hash-abc123',
        lastScrapedAt: new Date(),
      })
      .returning({ id: sourceProductListings.id });
    testListingId = listing.id;
  });

  // TEST 1: Modulo-10 Checksum Validation
  it('TEST 1: should correctly validate valid vs corrupted GTIN/EAN barcodes', () => {
    // Valid Traxxas EAN-13 (0020334680860)
    expect(ProductIdentityEngine.validateGtinChecksum('0020334680860')).toBe(true);
    // Valid Bittydesign EAN-13 (0714833215509)
    expect(ProductIdentityEngine.validateGtinChecksum('0714833215509')).toBe(true);
    // Corrupted checksum digit
    expect(ProductIdentityEngine.validateGtinChecksum('0020334680869')).toBe(false);
    // Invalid length
    expect(ProductIdentityEngine.validateGtinChecksum('12345')).toBe(false);
  });

  // TEST 2: Identity Resolution - Tier 1 Exact GTIN Match
  it('TEST 2: should resolve product via Tier 1 exact verified GTIN', async () => {
    const identityEngine = new ProductIdentityEngine();
    const result = await identityEngine.resolveProduct({
      title: 'Traxxas Slash Truck RTR',
      brand: 'Traxxas',
      eanGtin: '0020334680860',
      sourceUrl: 'https://amainhobbies.com/slash',
      sourceDomain: 'amainhobbies.com',
      sourceWebsiteId: testWebsiteId,
      sourceType: 'authorized_distributor',
    });

    expect(result.matched).toBe(true);
    expect(result.action).toBe('LINK_CANONICAL');
    expect(result.candidate?.globalProductId).toBeDefined();
    expect(result.candidate?.matchTier).toBe('TIER_1_GTIN');
    expect(result.candidate?.confidenceScore).toBe(1.0);
  });

  // TEST 3: Identity Resolution - Tier 2 Exact MPN & Variant Isolation
  it('TEST 3: should isolate distinct color variant when MPN matches', async () => {
    const identityEngine = new ProductIdentityEngine();
    const result = await identityEngine.resolveProduct({
      title: 'Traxxas Slash 4X4 VXL - Orange Edition',
      brand: 'Traxxas',
      mpn: '68086-4',
      color: 'Orange',
      sourceUrl: 'https://retailer.com/slash-orange',
      sourceDomain: 'retailer.com',
      sourceWebsiteId: testWebsiteId,
      sourceType: 'marketplace',
    });

    expect(result.matched).toBe(true);
    expect(result.action).toBe('CREATE_VARIANT'); // Never merge distinct color into original SKU
    expect(result.candidate?.globalProductId).toBeDefined();
    expect(result.candidate?.matchTier).toBe('TIER_2_MPN');
  });

  // TEST 4: Identity Resolution - Ambiguous Fuzzy Match Routes to Review Queue
  it('TEST 4: should route ambiguous similarity matches to Human Review Queue', async () => {
    const identityEngine = new ProductIdentityEngine();
    const result = await identityEngine.resolveProduct({
      title: 'Traxxas Slash 4X4 VXL Short Course Truck Special', // High similarity to 'Traxxas Slash 4X4 VXL 1/10 Short Course Truck' (0.875)
      brand: 'Traxxas',
      sourceUrl: 'https://somestore.com/slash-special',
      sourceDomain: 'somestore.com',
      sourceWebsiteId: testWebsiteId,
      sourceType: 'marketplace',
    });

    expect(result.action).toBe('ROUTE_TO_REVIEW');
    expect(result.candidate?.requiresReview).toBe(true);
    expect(result.reasons.some((r) => r.includes('Human Review Queue'))).toBe(true);
  });

  // TEST 5: Field-Level Provenance & Source Trust Hierarchy
  it('TEST 5: should obey source trust hierarchy and snapshot version diffs', async () => {
    const provenanceEngine = new FieldProvenanceEngine();

    // 1. Official Manufacturer writes baseline
    const r1 = await provenanceEngine.reconcileFields({
      globalProductId: testGlobalProductId,
      sourceWebsiteId: testWebsiteId,
      sourceProductListingId: testListingId,
      sourceType: 'official_brand', // Trust 1.00
      extractedFields: {
        motor: 'Velineon 3500 Brushless',
        topSpeed: '60+ mph',
      },
    });

    expect(r1.updatedFields).toContain('motor');
    expect(r1.updatedFields).toContain('topSpeed');

    // 2. Retailer attempts to overwrite official motor specification
    const r2 = await provenanceEngine.reconcileFields({
      globalProductId: testGlobalProductId,
      sourceWebsiteId: testWebsiteId,
      sourceProductListingId: testListingId,
      sourceType: 'marketplace', // Trust 0.70 < 1.00
      extractedFields: {
        motor: 'Generic 540 Brushed Motor', // Lower trust cannot overwrite
        scale: '1/10', // New field can still be added
      },
    });

    expect(r2.retainedFields).toContain('motor'); // Preserved official spec
    expect(r2.updatedFields).toContain('scale'); // New spec accepted
  });

  // TEST 6: Intelligent Data Freshness & Change Detection
  it('TEST 6: should bypass reprocessing when content hash is unchanged', async () => {
    const freshnessEngine = new DataFreshnessEngine();
    const uniqueUrl = `https://test.com/prod-${Date.now()}`;
    const payload = {
      title: 'Traxxas Slash 4X4 VXL',
      price: 429.95,
      attributes: { Scale: '1/10' },
      images: ['https://traxxas.com/img1.jpg'],
    };

    const hash1 = DataFreshnessEngine.computeContentHash(payload);
    const hash2 = DataFreshnessEngine.computeContentHash({ ...payload });
    expect(hash1).toBe(hash2);

    // Initial evaluation
    const res1 = await freshnessEngine.evaluateFreshness(testWebsiteId, uniqueUrl, hash1);
    expect(res1.isNew).toBe(true);

    // Re-evaluating unchanged content
    const res2 = await freshnessEngine.evaluateFreshness(testWebsiteId, uniqueUrl, hash1);
    expect(res2.isUnchanged).toBe(true);
  });

  // TEST 7: Attribute Normalization & Unit Conversion
  it('TEST 7: should normalize raw attribute labels and convert units', () => {
    const normalizer = new AttributeNormalizerEngine();

    // Weight conversion: 2.16 kg -> grams
    const weightRes = normalizer.normalizeAttribute('Item Weight', '2.16 kg');
    expect(weightRes.canonicalKey).toBe('weight');
    expect(weightRes.normalizedValue).toBe('2160.00');
    expect(weightRes.unit).toBe('g');

    // Speed conversion: 60 mph -> km/h
    const speedRes = normalizer.normalizeAttribute('Top Speed', '60 mph');
    expect(speedRes.canonicalKey).toBe('top_speed');
    expect(speedRes.normalizedValue).toBe('96.56');
    expect(speedRes.unit).toBe('km/h');
  });

  // TEST 8: Image Intelligence & Deduplication
  it('TEST 8: should deduplicate images and prioritize primary studio candidate', () => {
    const images = [
      { url: 'https://traxxas.com/products/thumb.jpg', width: 400, height: 400 },
      { url: 'https://traxxas.com/products/thumb.jpg?cache=123', width: 400, height: 400 }, // Duplicate
      { url: 'https://traxxas.com/products/main-hero-chassis.jpg', width: 1600, height: 1200 }, // Main
    ];

    const result = ImageIntelligenceEngine.processImages(images);
    expect(result.dedupedImages.length).toBe(2);
    expect(result.primaryImage).toContain('main-hero-chassis.jpg');
  });

  // TEST 9: AI Enrichment & Grounded Execution
  it('TEST 9: should clean titles without inventing hallucinated specifications', async () => {
    const aiEngine = new AiEnrichmentEngine();
    const result = await aiEngine.enrichProduct({
      globalProductId: testGlobalProductId,
      taskType: 'TITLE_CLEANING',
      verifiedSourceData: {
        title: 'Traxxas Slash 4X4 VXL FREE SHIPPING IN STOCK HOT DEAL',
      },
    });

    expect(result.success).toBe(true);
    expect(result.structuredOutput.canonicalTitle).toBe('Traxxas Slash 4X4 VXL');
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  // TEST 10: Multilingual Translation Engine with Cache Hit
  it('TEST 10: should translate text while preserving technical terminology and caching', async () => {
    const translationEngine = new MultilingualTranslationEngine();
    const uniqueText = `Traxxas 4WD elektrischer fahrtenregler VXL-3s ${Date.now()}`;

    // First translation: dictionary/engine translation
    const t1 = await translationEngine.translateText(uniqueText, 'de', 'en');
    expect(t1.fromCache).toBe(false);
    expect(t1.translatedText).toContain('4WD'); // Terminology preserved
    expect(t1.translatedText).toContain('VXL-3s'); // Terminology preserved

    // Second translation: must be a 0-token cache hit
    const t2 = await translationEngine.translateText(uniqueText, 'de', 'en');
    expect(t2.fromCache).toBe(true);
    expect(t2.translatedText).toBe(t1.translatedText);
  });
});
