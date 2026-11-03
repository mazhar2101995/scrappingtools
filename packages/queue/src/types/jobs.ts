export interface ScrapeJobPayload {
  dbJobId: string;
  organizationId?: string;
  sourceWebsiteId: string;
  targetUrl: string;
  domain: string;
  brandNormalized: string;
  sourceType: string;
  useBrowser?: boolean;
}

export interface ExtractedProductPayload {
  dbJobId: string;
  organizationId?: string;
  sourceWebsiteId: string;
  sourceUrl: string;
  rawTitle: string;
  rawDescription?: string;
  rawPrice?: string;
  rawCurrency?: string;
  rawIdentifiers: Record<string, string>;
  rawAttributes: Record<string, any>;
  rawImages: string[];
  htmlSnapshotUri?: string;
  contentHash: string;
}

export interface NormalizedProductPayload extends ExtractedProductPayload {
  normalizedTitle: string;
  cleanEan?: string;
  cleanMpn?: string;
  cleanModel?: string;
  cleanBrandNormalized: string;
  normalizedAttributes: Record<string, { value: string; unit?: string; dataType: string }>;
}

export interface MatchedProductPayload extends NormalizedProductPayload {
  globalProductId: string | null;
  productVariantId: string | null;
  matchStrategy: 'STRICT_BARCODE' | 'BRAND_MPN' | 'BRAND_NORMALIZED_MODEL' | 'NEW_CANONICAL' | 'AMBIGUOUS';
  confidence: number;
}

export interface PersistenceResult {
  success: boolean;
  globalProductId: string;
  isNew: boolean;
  persistedIdentifiersCount: number;
  persistedAttributesCount: number;
}

