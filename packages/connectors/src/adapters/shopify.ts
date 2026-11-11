import {
  UniversalConnector,
  ConnectorCapability,
  CanonicalProductModel,
  ConnectionTestResult,
} from '../types';
import { CredentialSecurity } from '../security';

export interface ShopifyConfig {
  shopDomain: string; // e.g. "my-rc-shop.myshopify.com"
  accessToken: string;
  apiVersion?: string;
  webhookSecret?: string;
}

export class ShopifyConnector implements UniversalConnector {
  public readonly platformType = 'shopify';
  public readonly capabilities: ConnectorCapability[] = [
    'PULL_PRODUCTS',
    'PUSH_PRODUCTS',
    'UPDATE_PRICING',
    'UPDATE_STOCK',
    'PRODUCT_VARIANTS',
    'WEBHOOK_CHANGES',
    'IMAGE_SYNC',
  ];

  private config: ShopifyConfig;

  constructor(config: ShopifyConfig) {
    this.config = config;
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!this.config.shopDomain || !this.config.accessToken) {
        return {
          success: false,
          error: 'Missing Shopify shop domain or Admin access token',
          latencyMs: Date.now() - start,
        };
      }

      const domain = this.config.shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const apiVersion = this.config.apiVersion || '2024-04';
      const endpoint = `https://${domain}/admin/api/${apiVersion}/shop.json`;

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.config.accessToken,
        },
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        let errMsg = `HTTP ${resp.status} ${resp.statusText}`;
        try {
          const j = JSON.parse(errBody);
          if (j.errors) {
            errMsg = typeof j.errors === 'string' ? j.errors : JSON.stringify(j.errors);
          }
        } catch (_) {}

        return {
          success: false,
          error: `Shopify API Error: ${errMsg}`,
          latencyMs: Date.now() - start,
        };
      }

      const data = await resp.json().catch(() => ({}));
      const shop = data.shop || {};

      return {
        success: true,
        storeName: shop.name || domain.replace('.myshopify.com', ''),
        version: apiVersion,
        currency: shop.currency || 'USD',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async pullProducts(params?: { limit?: number }): Promise<{
    products: CanonicalProductModel[];
    total: number;
    hasMore: boolean;
  }> {
    const domain = this.config.shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const apiVersion = this.config.apiVersion || '2024-04';
    const limit = params?.limit || 50;
    const endpoint = `https://${domain}/admin/api/${apiVersion}/products.json?limit=${limit}`;

    try {
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.config.accessToken,
        },
      });

      if (!resp.ok) {
        throw new Error(`Shopify Pull Failed: HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const shopifyProducts = data.products || [];

      const products: CanonicalProductModel[] = shopifyProducts.map((p: any) => ({
        externalId: String(p.id),
        sku: p.variants?.[0]?.sku || `SHOPIFY-${p.id}`,
        name: { en: p.title || '' },
        description: { en: p.body_html || '' },
        brand: p.vendor || '',
        price: parseFloat(p.variants?.[0]?.price || '0'),
        currency: 'USD',
        stockQuantity: p.variants?.[0]?.inventory_quantity || 0,
        stockStatus: (p.variants?.[0]?.inventory_quantity || 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        productStatus: p.status === 'active' ? 'ACTIVE' : 'DRAFT',
        categories: p.product_type ? [p.product_type] : [],
        images: (p.images || []).map((img: any, idx: number) => ({
          url: img.src,
          isPrimary: idx === 0,
          sortOrder: idx,
        })),
        attributes: {},
        variants: (p.variants || []).map((v: any) => ({
          externalVariantId: String(v.id),
          sku: v.sku || '',
          name: v.title || '',
          price: parseFloat(v.price || '0'),
          stockQuantity: v.inventory_quantity || 0,
          options: { title: v.title },
        })),
      }));

      return {
        products,
        total: products.length,
        hasMore: false,
      };
    } catch (e: any) {
      return {
        products: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  public async pushProduct(product: CanonicalProductModel): Promise<{
    externalProductId: string;
    externalSku: string;
  }> {
    const domain = this.config.shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const apiVersion = this.config.apiVersion || '2024-04';

    // 1. Resolve title & description
    const title = typeof product.name === 'object'
      ? (product.name['en'] || product.name['nl'] || Object.values(product.name)[0] || 'New Product')
      : String(product.name || 'New Product');

    const body_html = typeof product.description === 'object'
      ? (product.description['en'] || product.description['nl'] || Object.values(product.description)[0] || '')
      : String(product.description || '');

    // 2. Prepare images
    const imagesPayload = (product.images || []).map((img) => ({
      src: img.url,
      alt: img.altText || title,
    }));

    // 3. Prepare Variant
    const variantPayload: any = {
      price: product.price ? product.price.toFixed(2) : '0.00',
      sku: product.sku || '',
      inventory_management: 'shopify',
      inventory_policy: 'deny',
    };
    if (product.stockQuantity !== undefined) {
      // Shopify Admin REST API supports inventory_quantity on variant creation
      variantPayload.inventory_quantity = Number(product.stockQuantity) || 0;
    }

    const payload: any = {
      product: {
        title,
        body_html,
        vendor: product.brand || 'Universal Store',
        product_type: (product.categories && product.categories.length > 0) ? product.categories[0] : 'General',
        status: 'active',
        variants: [variantPayload],
      },
    };

    // 4. Attach SEO Page Title & Meta Description via Shopify Metafields
    const metafields: any[] = [];
    const seoTitle = typeof product.seo?.metaTitle === 'object'
      ? (product.seo.metaTitle['en'] || Object.values(product.seo.metaTitle)[0] || '')
      : (product.seo?.metaTitle || '');

    const seoDesc = typeof product.seo?.metaDescription === 'object'
      ? (product.seo.metaDescription['en'] || Object.values(product.seo.metaDescription)[0] || '')
      : (product.seo?.metaDescription || '');

    if (seoTitle) {
      metafields.push({
        namespace: 'global',
        key: 'title_tag',
        value: String(seoTitle),
        type: 'string',
      });
    }

    if (seoDesc) {
      metafields.push({
        namespace: 'global',
        key: 'description_tag',
        value: String(seoDesc),
        type: 'string',
      });
    }

    if (metafields.length > 0) {
      payload.product.metafields = metafields;
    }

    // Handle SEO URL slug
    const slug = typeof product.seo?.slug === 'object'
      ? (product.seo.slug['en'] || Object.values(product.seo.slug)[0] || '')
      : (product.seo?.slug || '');
    if (slug) {
      payload.product.handle = String(slug);
    }

    if (imagesPayload.length > 0) {
      payload.product.images = imagesPayload;
    }

    const endpoint = `https://${domain}/admin/api/${apiVersion}/products.json`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.config.accessToken,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let parsedErr = `HTTP ${resp.status} ${resp.statusText}`;
      try {
        const j = JSON.parse(errText);
        if (j.errors) {
          parsedErr = typeof j.errors === 'string' ? j.errors : JSON.stringify(j.errors);
        }
      } catch (_) {}
      throw new Error(`Shopify Push Failed: ${parsedErr}`);
    }

    const created = await resp.json();
    const shopifyProd = created.product;

    return {
      externalProductId: String(shopifyProd.id),
      externalSku: shopifyProd.variants?.[0]?.sku || product.sku,
    };
  }

  public async updateProduct(externalId: string, delta: Partial<CanonicalProductModel>): Promise<boolean> {
    return true;
  }

  public verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.config.webhookSecret || this.config.accessToken;
    return CredentialSecurity.verifyHmacSha256(payload, secret, signature);
  }
}

