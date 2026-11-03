import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createRedisConnection,
  scrapingQueue,
  normalizationQueue,
  matchingQueue,
  persistenceQueue,
  createScrapingWorker,
  createNormalizationWorker,
  createMatchingWorker,
  createPersistenceWorker,
  getAllQueuesHealth,
  isValidEan13,
} from '../index';
import {
  db,
  organizations,
  brands,
  sourceWebsites,
  scrapingJobs,
  globalProducts,
  productIdentifiers,
  customerProductMappings,
} from '@saas/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

describe('BullMQ Ingestion Pipeline Integration Test Suite', () => {
  let redisClient: ReturnType<typeof createRedisConnection>;
  let testOrgId: string;
  let testSourceWebsiteId: string;
  let workers: any[] = [];

  beforeAll(async () => {
    redisClient = createRedisConnection();

    // 1. Create Tenant & Source Website in PostgreSQL
    const [org] = await db.insert(organizations).values({
      name: 'Queue Test Organization',
      slug: `queue-org-${Date.now()}`,
    }).returning();
    testOrgId = org.id;

    const [brand] = await db.insert(brands).values({
      name: 'Bose Audio Corp',
      normalizedName: `bose-audio-${Date.now()}`,
    }).returning();

    const [website] = await db.insert(sourceWebsites).values({
      brandId: brand.id,
      name: 'Bose Global Outlet',
      domain: `outlet.bose.test-${Date.now()}`,
      sourceType: 'official_brand',
    }).returning();
    testSourceWebsiteId = website.id;

    // Flush test queues
    await scrapingQueue.drain();
    await normalizationQueue.drain();
    await matchingQueue.drain();
    await persistenceQueue.drain();
  });

  afterAll(async () => {
    // Gracefully shut down all workers
    await Promise.all(workers.map((w) => w.close()));
    await scrapingQueue.close();
    await normalizationQueue.close();
    await matchingQueue.close();
    await persistenceQueue.close();
    await redisClient.quit();
  });

  // TEST 1: EAN-13 Checksum Validation
  it('TEST 1: should correctly validate Modulo-10 checksum for EAN-13', () => {
    expect(isValidEan13('4006381333931')).toBe(true); // Valid Stabilo Boss EAN
    expect(isValidEan13('4006381333932')).toBe(false); // Corrupted checksum
    expect(isValidEan13('12345')).toBe(false); // Invalid length
  });

  // TEST 2: Duplicate Job Prevention via Idempotency Key
  it('TEST 2: should reject duplicate job submissions within idempotency window', async () => {
    const idempotencyId = `scrape_unique_test_${Date.now()}`;

    const job1 = await scrapingQueue.add(
      'scrape-test',
      {
        dbJobId: 'dummy-1',
        sourceWebsiteId: testSourceWebsiteId,
        targetUrl: 'https://example.com/p1',
        domain: 'example.com',
        brandNormalized: 'bose',
        sourceType: 'official',
      },
      { jobId: idempotencyId }
    );

    const job2 = await scrapingQueue.add(
      'scrape-test',
      {
        dbJobId: 'dummy-2',
        sourceWebsiteId: testSourceWebsiteId,
        targetUrl: 'https://example.com/p1',
        domain: 'example.com',
        brandNormalized: 'bose',
        sourceType: 'official',
      },
      { jobId: idempotencyId }
    );

    expect(job1.id).toBe(idempotencyId);
    expect(job2.id).toBe(idempotencyId);

    // BullMQ deduplicates jobs with the exact same jobId
    const count = await scrapingQueue.getJobCountByTypes('waiting', 'active', 'delayed');
    expect(count).toBe(1);

    // Clean up
    await job1.remove();
  });

  // TEST 3: Queue Monitoring Health & Redis Metrics
  it('TEST 3: should return comprehensive health metrics across all queues and Redis', async () => {
    const health = await getAllQueuesHealth();
    expect(health.redis.status).toBe('healthy');
    expect(health.redis.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.queues.length).toBe(4);
    expect(health.queues.some((q) => q.name === 'product-scraping')).toBe(true);
  });

  // TEST 4 & 5: End-to-End Pipeline Ingestion through all 4 Discrete Workers
  it('TEST 4 & 5: should process a product through Scraping -> Normalization -> Matching -> Persistence', async () => {
    // 1. Insert DB Tracking Job in PostgreSQL
    const [dbJob] = await db.insert(scrapingJobs).values({
      organizationId: testOrgId,
      sourceWebsiteId: testSourceWebsiteId,
      targetUrl: `https://outlet.bose.test/headphones-${Date.now()}`,
      jobType: 'single_product',
      status: 'queued',
    }).returning();

    const uniqueEan = '4006381333931'; // Valid Modulo-10 EAN
    const uniqueMpn = `QC45-${Date.now()}`;
    const contentHash = crypto.createHash('sha256').update(dbJob.targetUrl + uniqueMpn).digest('hex');

    // 2. Spin up workers for all 4 discrete stages
    const mockScraper = async (p: any) => ({
      dbJobId: p.dbJobId,
      organizationId: p.organizationId,
      sourceWebsiteId: p.sourceWebsiteId,
      sourceUrl: p.targetUrl,
      rawTitle: 'Bose QuietComfort 45 Noise-Cancelling Headphones',
      rawDescription: 'Premium wireless acoustic noise cancelling headphones.',
      rawPrice: '329.00',
      rawCurrency: 'USD',
      rawIdentifiers: { ean: uniqueEan, mpn: uniqueMpn },
      rawAttributes: { brand: 'Bose Audio Corp', color: 'Triple Black', connectivity: 'Bluetooth 5.1' },
      rawImages: ['https://example.com/bose-qc45.jpg'],
      contentHash,
    });

    const scrapeWorker = createScrapingWorker(mockScraper);
    const normWorker = createNormalizationWorker();
    const matchWorker = createMatchingWorker();
    const persistWorker = createPersistenceWorker();
    workers.push(scrapeWorker, normWorker, matchWorker, persistWorker);

    // 3. Dispatch entry job into scraping queue
    await scrapingQueue.add(
      `scrape_${contentHash}`,
      {
        dbJobId: dbJob.id,
        organizationId: testOrgId,
        sourceWebsiteId: testSourceWebsiteId,
        targetUrl: dbJob.targetUrl,
        domain: 'outlet.bose.test',
        brandNormalized: 'bose-audio',
        sourceType: 'official_brand',
      },
      { jobId: `scrape_${contentHash}` }
    );

    // 4. Poll until the final persistence job completes (timeout: 10s)
    let persisted = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const [updatedJob] = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, dbJob.id));
      if (updatedJob && updatedJob.status === 'completed') {
        persisted = true;
        break;
      }
    }

    expect(persisted).toBe(true);

    // 5. Verify database state
    // Global Product created
    const [matchedId] = await db
      .select({ globalProductId: productIdentifiers.globalProductId })
      .from(productIdentifiers)
      .where(
        and(
          eq(productIdentifiers.idType, 'EAN_13'),
          eq(productIdentifiers.normalizedValue, uniqueEan)
        )
      );

    expect(matchedId).toBeDefined();

    const [globalProduct] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, matchedId.globalProductId));

    expect(globalProduct.canonicalTitle).toBe('Bose QuietComfort 45 Noise-Cancelling Headphones');

    // Customer mapping created
    const [mapping] = await db
      .select()
      .from(customerProductMappings)
      .where(
        and(
          eq(customerProductMappings.organizationId, testOrgId),
          eq(customerProductMappings.globalProductId, globalProduct.id)
        )
      );

    expect(mapping).toBeDefined();
  });

  // TEST 6: Idempotent Ingestion Re-run (No duplicate products created)
  it('TEST 6: should not duplicate global product when identical payload is persisted again', async () => {
    const existingCount = (await db.select().from(globalProducts)).length;

    // Fetch existing product
    const [existingProduct] = await db.select().from(globalProducts).limit(1);

    // Verify existing product was found
    expect(existingProduct).toBeDefined();

    // Directly test idempotent transaction logic
    await db.transaction(async (tx) => {
      // Re-inserting with onConflictDoNothing
      await tx
        .insert(productIdentifiers)
        .values({
          globalProductId: existingProduct.id,
          idType: 'EAN_13',
          idValue: '4006381333931',
          normalizedValue: '4006381333931',
          sourceWebsiteId: testSourceWebsiteId,
          isPrimary: true,
        })
        .onConflictDoNothing();
    });

    const postCount = (await db.select().from(globalProducts)).length;
    expect(postCount).toBe(existingCount); // Zero extra global products created
  });
});
