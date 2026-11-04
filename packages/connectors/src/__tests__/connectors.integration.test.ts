import { describe, it, expect, beforeAll } from 'vitest';
import {
  OpenCartConnector,
  ShopifyConnector,
  WooCommerceConnector,
  CredentialSecurity,
  SynchronizationEngine,
} from '../index';
import {
  db,
  organizations,
  connectedStores,
  globalProducts,
  brands,
} from '@saas/database';
import { eq } from 'drizzle-orm';

describe('Phase 7: Universal E-Commerce Integration Platform Test Suite', () => {
  let testOrgId: string;
  let testStoreId: string;
  let testGlobalProductId: string;

  beforeAll(async () => {
    // 1. Seed or retrieve organization
    const [existingOrg] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, 'acme-corp'))
      .limit(1);

    if (existingOrg) {
      testOrgId = existingOrg.id;
    } else {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: 'Acme Test Corp',
          slug: `acme-test-${Date.now()}`,
        })
        .returning({ id: organizations.id });
      testOrgId = newOrg.id;
    }

    // 2. Seed canonical product if not exists
    const [firstBrand] = await db.select({ id: brands.id }).from(brands).limit(1);
    const [firstProd] = await db
      .select({ id: globalProducts.id })
      .from(globalProducts)
      .limit(1);

    if (firstProd) {
      testGlobalProductId = firstProd.id;
    } else {
      const [newProd] = await db
        .insert(globalProducts)
        .values({
          brandId: firstBrand.id,
          canonicalTitle: 'Traxxas Test Model',
          modelNumber: 'TEST-101',
          normalizedModel: 'TEST101',
        })
        .returning({ id: globalProducts.id });
      testGlobalProductId = newProd.id;
    }

    // 3. Encrypt credentials and seed test connected store
    const encryptedCreds = CredentialSecurity.encrypt({
      apiUsername: 'test_admin',
      apiKey: 'sec_key_opencart_9918',
    });

    const [newStore] = await db
      .insert(connectedStores)
      .values({
        organizationId: testOrgId,
        platformType: 'opencart',
        storeName: 'Acme EU OpenCart Shop',
        storeUrl: `https://opencart-store-${Date.now()}.com`,
        encryptedCredentials: encryptedCreds,
        capabilities: ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'MULTILINGUAL'],
      })
      .returning({ id: connectedStores.id });
    testStoreId = newStore.id;
  });

  // TEST 1: Credential Encryption & Decryption (AES-256-GCM)
  it('TEST 1: should securely encrypt and decrypt store credentials using AES-256-GCM', () => {
    const rawCredentials = {
      consumerKey: 'ck_live_994821',
      consumerSecret: 'cs_live_381920',
      accessToken: 'shpat_8921049281',
    };

    const cipherText = CredentialSecurity.encrypt(rawCredentials);
    expect(cipherText).toContain(':'); // IV : AuthTag : CipherText format
    expect(cipherText).not.toContain('ck_live'); // Zero plaintext leakage

    const decrypted = CredentialSecurity.decrypt(cipherText);
    expect(decrypted.consumerKey).toBe(rawCredentials.consumerKey);
    expect(decrypted.consumerSecret).toBe(rawCredentials.consumerSecret);
  });

  // TEST 2: SSRF Guard for Store URLs
  it('TEST 2: should block SSRF attempts to private and loopback IP addresses', () => {
    expect(CredentialSecurity.validateStoreUrl('https://my-legit-shop.com')).toBe(true);
    expect(CredentialSecurity.validateStoreUrl('http://127.0.0.1:8080/opencart')).toBe(false);
    expect(CredentialSecurity.validateStoreUrl('http://localhost:3000')).toBe(false);
    expect(CredentialSecurity.validateStoreUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(CredentialSecurity.validateStoreUrl('ftp://insecure-proto.com')).toBe(false);
  });

  // TEST 3: Webhook HMAC-SHA256 Verification
  it('TEST 3: should accurately verify HMAC-SHA256 signatures for webhook payloads', () => {
    const payload = JSON.stringify({ event: 'product/updated', id: 49102 });
    const secret = 'webhook_secret_key_8841';

    const validSignature = require('crypto')
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    expect(CredentialSecurity.verifyHmacSha256(payload, secret, validSignature)).toBe(true);
    expect(CredentialSecurity.verifyHmacSha256(payload, secret, 'tampered_signature')).toBe(false);
  });

  // TEST 4: OpenCart Reference Connector Capabilities & Connection Test
  it('TEST 4: should test connection and declare OpenCart 3.x capabilities', async () => {
    const ocConnector = new OpenCartConnector({
      storeUrl: 'https://opencart-test.com',
      apiUsername: 'saas_user',
      apiKey: 'valid_api_key',
    });

    expect(ocConnector.platformType).toBe('opencart');
    expect(ocConnector.capabilities).toContain('MULTILINGUAL');
    expect(ocConnector.capabilities).toContain('PULL_PRODUCTS');

    const pingResult = await ocConnector.testConnection();
    expect(pingResult.success).toBe(true);
    expect(pingResult.version).toContain('3.0');
  });

  // TEST 5: OpenCart Product Pull & Multilingual Mapping
  it('TEST 5: should pull products from OpenCart into the Canonical Product Model', async () => {
    const ocConnector = new OpenCartConnector({
      storeUrl: 'https://opencart-test.com',
      apiUsername: 'saas_user',
      apiKey: 'valid_api_key',
    });

    const { products, total } = await ocConnector.pullProducts();
    expect(total).toBeGreaterThan(0);
    const prod = products[0];

    expect(prod.sku).toBe('TRA68086-4');
    expect(prod.name.en).toContain('Traxxas Slash');
    expect(prod.name.de).toBeDefined(); // Multilingual string preserved
    expect(prod.variants.length).toBe(2);
    expect(prod.variants[0].options.Color).toBe('Blue');
  });

  // TEST 6: Shopify Connector Capabilities & Product Mapping
  it('TEST 6: should declare Shopify capabilities and pull canonical products', async () => {
    const shopifyConnector = new ShopifyConnector({
      shopDomain: 'rc-hobby.myshopify.com',
      accessToken: 'shpat_test_token',
    });

    expect(shopifyConnector.platformType).toBe('shopify');
    expect(shopifyConnector.capabilities).toContain('WEBHOOK_CHANGES');

    const ping = await shopifyConnector.testConnection();
    expect(ping.success).toBe(true);

    const { products } = await shopifyConnector.pullProducts();
    expect(products[0].externalId).toContain('gid://shopify/Product');
    expect(products[0].variants[0].options.Chassis).toBe('Carbon');
  });

  // TEST 7: WooCommerce Connector Capabilities & Product Mapping
  it('TEST 7: should declare WooCommerce capabilities and pull canonical products', async () => {
    const wcConnector = new WooCommerceConnector({
      storeUrl: 'https://woocommerce-rc.com',
      consumerKey: 'ck_test_key',
      consumerSecret: 'cs_test_secret',
    });

    expect(wcConnector.platformType).toBe('woocommerce');
    expect(wcConnector.capabilities).toContain('PRODUCT_VARIANTS');

    const ping = await wcConnector.testConnection();
    expect(ping.success).toBe(true);

    const { products } = await wcConnector.pullProducts();
    expect(products[0].sku).toBe('BD-HYP-HR');
    expect(products[0].brand).toBe('Bittydesign');
  });

  // TEST 8: Synchronization Engine Execution & Traceability
  it('TEST 8: should execute store sync, create mappings and record sync history', async () => {
    const syncEngine = new SynchronizationEngine();
    const result = await syncEngine.executeSync(testStoreId, 'PULL');

    expect(result.itemsProcessed).toBeGreaterThan(0);
    expect(result.itemsSucceeded).toBeGreaterThan(0);
    expect(result.itemsFailed).toBe(0);
  });
});

