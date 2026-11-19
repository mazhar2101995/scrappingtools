import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenCartConnector,
  ShopifyConnector,
  CredentialSecurity,
} from '../index';

describe('Pre-Staging Unit Verification: Remediated Connector Defect Behaviors', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // DEF-CON-01 & DEF-CON-02: OpenCart Pull & Update Verification
  describe('OpenCart Adapter Remediations', () => {
    it('DEF-CON-01: should parse and map OpenCart products into canonical model correctly', async () => {
      const mockProducts = [
        {
          product_id: '101',
          sku: 'TRA68086-4',
          model: '68086-4',
          name: 'Traxxas Slash 4X4 VXL',
          description: '<p>Short course truck</p>',
          price: '429.9500',
          quantity: '14',
          image: 'catalog/slash.jpg',
          status: '1',
        },
      ];

      // Mock fetch returning module payload
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          total: 1,
          hasMore: false,
          products: mockProducts,
        }),
      } as any);

      const connector = new OpenCartConnector({
        storeUrl: 'https://staging-opencart.test',
        apiUsername: 'test_user',
        apiKey: 'secret_key_32_characters_12345678',
      });

      const result = await connector.pullProducts({ limit: 10, page: 1 });

      expect(result.total).toBe(1);
      expect(result.products.length).toBe(1);
      const prod = result.products[0];
      expect(prod.externalId).toBe('101');
      expect(prod.sku).toBe('TRA68086-4');
      expect(prod.price).toBe(429.95);
      expect(prod.stockQuantity).toBe(14);
      expect(prod.stockStatus).toBe('IN_STOCK');
      expect(prod.productStatus).toBe('ACTIVE');
      expect(prod.images[0].url).toContain('https://staging-opencart.test/image/catalog/slash.jpg');
    });

    it('DEF-CON-02: should format atomic payload and dispatch updateStockPrice', async () => {
      let capturedBody: any = null;
      let capturedUrl = '';

      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({ success: true, updated_id: 101 }),
        } as any;
      });

      const connector = new OpenCartConnector({
        storeUrl: 'https://staging-opencart.test',
        apiUsername: 'test_user',
        apiKey: 'secret_key_32_characters_12345678',
      });

      const success = await connector.updateProduct('101', {
        price: 399.99,
        stockQuantity: 25,
      });

      expect(success).toBe(true);
      expect(capturedUrl).toContain('route=extension/module/saas_connector&action=update_stock_price');
      expect(capturedBody.product_id).toBe('101');
      expect(capturedBody.price).toBe(399.99);
      expect(capturedBody.quantity).toBe(25);
    });
  });

  // DEF-CON-03 & DEF-CON-04: Shopify Pull & Update Verification
  describe('Shopify Adapter Remediations', () => {
    it('DEF-CON-03: should preserve GraphQL GID and map named variant options dynamically', async () => {
      const mockShopifyResponse = {
        products: [
          {
            id: 8912345678,
            admin_graphql_api_id: 'gid://shopify/Product/8912345678',
            title: 'Traxxas Carbon Edition',
            vendor: 'Traxxas',
            status: 'active',
            options: [
              { name: 'Chassis', values: ['Carbon', 'Aluminum'] },
              { name: 'Color', values: ['Red', 'Blue'] },
            ],
            variants: [
              {
                id: 456789123,
                admin_graphql_api_id: 'gid://shopify/ProductVariant/456789123',
                title: 'Carbon / Red',
                price: '549.99',
                sku: 'TRA-CRB-RED',
                inventory_quantity: 5,
                option1: 'Carbon',
                option2: 'Red',
              },
            ],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockShopifyResponse,
      } as any);

      const connector = new ShopifyConnector({
        shopDomain: 'test-staging.myshopify.com',
        accessToken: 'shpat_test_access_token_123',
        apiVersion: '2024-10',
      });

      const { products } = await connector.pullProducts();
      expect(products.length).toBe(1);
      const prod = products[0];

      expect(prod.externalId).toBe('gid://shopify/Product/8912345678');
      expect(prod.variants.length).toBe(1);
      expect(prod.variants[0].externalVariantId).toBe('gid://shopify/ProductVariant/456789123');
      expect(prod.variants[0].options['Chassis']).toBe('Carbon');
      expect(prod.variants[0].options['Color']).toBe('Red');
    });

    it('DEF-CON-04: should dispatch PUT to correct Shopify Admin REST endpoint with clean ID', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedUrl = url;
        capturedMethod = init.method;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({ product: { id: 8912345678 } }),
        } as any;
      });

      const connector = new ShopifyConnector({
        shopDomain: 'test-staging.myshopify.com',
        accessToken: 'shpat_test_access_token_123',
        apiVersion: '2024-10',
      });

      const result = await connector.updateProduct('gid://shopify/Product/8912345678', {
        name: 'Traxxas Carbon Edition V2',
        price: 579.99,
      });

      expect(result).toBe(true);
      expect(capturedMethod).toBe('PUT');
      expect(capturedUrl).toBe('https://test-staging.myshopify.com/admin/api/2024-10/products/8912345678.json');
      expect(capturedBody.product.title).toBe('Traxxas Carbon Edition V2');
      expect(capturedBody.product.variants[0].price).toBe('579.99');
    });
  });

  // Webhook Signature Integrity
  describe('Webhook Cryptographic Authentication', () => {
    it('DEF-CON-05: should verify both Base64 (Shopify) and Hex (OpenCart) HMAC signatures', () => {
      const payload = JSON.stringify({ id: 12345, event: 'products/update' });
      const secret = 'webhook_shared_secret_key_8841';

      const hexSignature = require('crypto').createHmac('sha256', secret).update(payload).digest('hex');
      const base64Signature = require('crypto').createHmac('sha256', secret).update(payload).digest('base64');

      expect(CredentialSecurity.verifyHmacSha256(payload, secret, hexSignature)).toBe(true);
      expect(CredentialSecurity.verifyHmacSha256(payload, secret, base64Signature)).toBe(true);
      expect(CredentialSecurity.verifyHmacSha256(payload, secret, 'invalid_signature_hash')).toBe(false);
    });
  });
});
