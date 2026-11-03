import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../main';
import { db, brands, sourceWebsites, globalProducts, productIdentifiers } from '@saas/database';

describe('Core SaaS REST API & Security Integration Test Suite', () => {
  let authToken: string;
  let tenantOrgId: string;
  let testBrandId: string;
  let testWebsiteId: string;
  let testProductId: string;
  const testEan = `400638133${Math.floor(1000 + Math.random() * 9000)}`;

  beforeAll(async () => {
    // 1. Seed Brand & Website
    const [brand] = await db.insert(brands).values({
      name: 'Traxxas Official',
      normalizedName: `traxxas-api-${Date.now()}`,
    }).returning();
    testBrandId = brand.id;

    const [website] = await db.insert(sourceWebsites).values({
      brandId: testBrandId,
      name: 'Traxxas Portal',
      domain: `traxxas.api-${Date.now()}.test`,
      sourceType: 'official_brand',
    }).returning();
    testWebsiteId = website.id;

    // 2. Seed a Global Product
    const [prod] = await db.insert(globalProducts).values({
      brandId: testBrandId,
      canonicalTitle: 'Traxxas Slash 4X4 Ultimate VXL',
      modelNumber: '68077-4',
      normalizedModel: '680774',
    }).returning();
    testProductId = prod.id;

    await db.insert(productIdentifiers).values({
      globalProductId: testProductId,
      idType: 'EAN_13',
      idValue: testEan,
      normalizedValue: testEan,
      isPrimary: true,
    }).onConflictDoNothing();
  });

  // TEST 1: Health & Swagger OpenAPI Docs
  it('TEST 1: should serve /health and OpenAPI specification', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('healthy');

    const docsRes = await request(app).get('/api/docs.json');
    expect(docsRes.status).toBe(200);
    expect(docsRes.body.openapi).toBe('3.0.3');
    expect(docsRes.body.info.title).toContain('AI Product Intelligence');
  });

  // TEST 2: Registration, Login & JWT Token Issuance
  it('TEST 2: should register user, create organization and return valid JWT tokens', async () => {
    const email = `tenant_admin_${Date.now()}@example.com`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'SecurePassword123!',
        fullName: 'Jane Enterprise Admin',
        organizationName: 'Acme Retail Group',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.accessToken).toBeDefined();
    expect(regRes.body.user.email).toBe(email);
    expect(regRes.body.organization.name).toBe('Acme Retail Group');

    tenantOrgId = regRes.body.organization.id;

    // Login test
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'SecurePassword123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    authToken = loginRes.body.accessToken;
  });

  // TEST 3: Protected Routes & Tenant Isolation
  it('TEST 3: should reject unauthenticated requests to protected endpoints', async () => {
    const unauthRes = await request(app).get('/api/v1/products');
    expect(unauthRes.status).toBe(401);
  });

  // TEST 4: Global Product Search & EAN Barcode Search
  it('TEST 4: should search global products and locate by exact EAN barcode', async () => {
    // Search list
    const searchRes = await request(app)
      .get('/api/v1/products?q=Slash')
      .set('Authorization', `Bearer ${authToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);

    // EAN Barcode search
    const eanRes = await request(app)
      .get(`/api/v1/products/search/ean/${testEan}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(eanRes.status).toBe(200);
    expect(eanRes.body.product.id).toBe(testProductId);
    expect(eanRes.body.matchedIdentifier.normalizedValue).toBe(testEan);
  });

  // TEST 5: Customer Catalog Mapping & Private Overrides
  it('TEST 5: should map product to tenant catalog and save custom private overrides', async () => {
    // Map to tenant
    const mapRes = await request(app)
      .post('/api/v1/catalog/map')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        globalProductId: testProductId,
        customerInternalSku: 'ACME-SLASH-001',
      });

    expect(mapRes.status).toBe(201);

    // Save override
    const overrideRes = await request(app)
      .put(`/api/v1/catalog/${testProductId}/override`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customTitle: 'Acme Premium Slash 4x4 Truck',
        customCategory: 'RC Trucks & Truggies',
      });

    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.override.customTitle).toBe('Acme Premium Slash 4x4 Truck');

    // Fetch tenant catalog and verify custom override is merged
    const catalogRes = await request(app)
      .get('/api/v1/catalog')
      .set('Authorization', `Bearer ${authToken}`);

    expect(catalogRes.status).toBe(200);
    const item = catalogRes.body.catalog.find((c: any) => c.globalProductId === testProductId);
    expect(item).toBeDefined();
    expect(item.title).toBe('Acme Premium Slash 4x4 Truck');
    expect(item.isOverridden).toBe(true);
  });

  // TEST 6: Asynchronous Scraping Job Submission to BullMQ
  it('TEST 6: should accept scraping job and return 202 Accepted with job ID', async () => {
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        targetUrl: `https://traxxas.api.test/part-3350r-${Date.now()}`,
        sourceWebsiteId: testWebsiteId,
        brandHint: 'traxxas',
      });

    expect(jobRes.status).toBe(202);
    expect(jobRes.body.jobId).toBeDefined();
    expect(jobRes.body.status).toBe('queued');

    // Poll status endpoint
    const statusRes = await request(app)
      .get(`/api/v1/jobs/${jobRes.body.jobId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.job.id).toBe(jobRes.body.jobId);
  });
});
