export type ConnectorCapability =
  | 'PULL_PRODUCTS'
  | 'PUSH_PRODUCTS'
  | 'UPDATE_PRICING'
  | 'UPDATE_STOCK'
  | 'PRODUCT_VARIANTS'
  | 'MULTILINGUAL'
  | 'WEBHOOK_CHANGES'
  | 'IMAGE_SYNC';

export interface CanonicalProductModel {
  id?: string; // SaaS Global Product ID
  externalId?: string; // Store's local product ID
  sku: string;
  name: Record<string, string>; // e.g. { en: "Slash 4X4 VXL", de: "Slash 4X4 VXL" }
  description: Record<string, string>;
  shortDescription?: Record<string, string>;
  brand: string;
  modelNumber?: string;
  eanGtinUpc?: string;
  price: number;
  costPrice?: number;
  currency: string;
  stockQuantity: number;
  stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK' | 'BACKORDER';
  productStatus: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  categories: string[];
  images: Array<{
    url: string;
    altText?: string;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  attributes: Record<string, { rawValue: any; normalizedValue: string; unit?: string }>;
  variants: Array<{
    externalVariantId?: string;
    sku: string;
    name: string;
    price: number;
    stockQuantity: number;
    options: Record<string, string>;
  }>;
  seo?: {
    metaTitle?: string | Record<string, string>;
    metaDescription?: string | Record<string, string>;
    metaKeywords?: string | Record<string, string>;
    slug?: string | Record<string, string>;
  };
  platformMetadata?: Record<string, any>;
}

export interface ConnectionTestResult {
  success: boolean;
  storeName?: string;
  version?: string;
  currency?: string;
  error?: string;
  latencyMs: number;
}

export interface UniversalConnector {
  readonly platformType: 'opencart' | 'shopify' | 'woocommerce';
  readonly capabilities: ConnectorCapability[];

  testConnection(): Promise<ConnectionTestResult>;
  pullProducts(params?: { limit?: number; page?: number; since?: Date }): Promise<{
    products: CanonicalProductModel[];
    total: number;
    hasMore: boolean;
  }>;
  pushProduct(product: CanonicalProductModel): Promise<{
    externalProductId: string;
    externalSku: string;
  }>;
  updateProduct(externalId: string, delta: Partial<CanonicalProductModel>): Promise<boolean>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

