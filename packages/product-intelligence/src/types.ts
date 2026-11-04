export interface IdentityCandidate {
  globalProductId: string;
  canonicalTitle: string;
  brand: string;
  brandId: string;
  modelNumber: string | null;
  eanGtin?: string | null;
  confidenceScore: number;
  matchTier: 'TIER_1_GTIN' | 'TIER_2_MPN' | 'TIER_3_MODEL' | 'TIER_4_IDENTIFIER' | 'TIER_5_ATTRIBUTES' | 'TIER_6_TITLE_FUZZY' | 'TIER_7_VECTOR' | 'NONE';
  matchReason: string;
  variantId?: string | null;
  requiresReview: boolean;
}

export interface ResolutionResult {
  matched: boolean;
  action: 'LINK_CANONICAL' | 'CREATE_VARIANT' | 'ROUTE_TO_REVIEW' | 'CREATE_CANONICAL';
  candidate: IdentityCandidate | null;
  allCandidates: IdentityCandidate[];
  reasons: string[];
}

export interface ExtractedProductInput {
  title: string;
  brand: string;
  eanGtin?: string | null;
  mpn?: string | null;
  modelNumber?: string | null;
  color?: string | null;
  size?: string | null;
  scale?: string | null;
  drivetrain?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  sourceUrl: string;
  sourceDomain: string;
  sourceWebsiteId: string;
  sourceType: 'official_brand' | 'authorized_distributor' | 'marketplace' | 'supplier';
  rawAttributes?: Record<string, any>;
  images?: string[];
}

