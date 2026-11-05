import {
  db,
  globalProducts,
  productIdentifiers,
  productImages,
  productAttributes,
  sourceProductListings,
  sourceWebsites,
  brands,
  customerProductMappings,
  customerProductOverrides,
  fieldProvenance,
} from '@saas/database';
import { eq, and, sql, or, desc, inArray } from 'drizzle-orm';
import { normalizeProductUrl } from '../utils/url-normalizer';

export type LookupDecision = 'REUSE_EXISTING' | 'EXTRACT_NEW' | 'REVIEW_REQUIRED';
export type MatchConfidence = 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH';

export interface SmartLookupParams {
  productUrl?: string;
  brandId?: string;
  sku?: string;
  modelNumber?: string;
  ean?: string;
  title?: string;
  currentOrganizationId: string;
}

export interface ReusableProductData {
  canonicalProductId: string;
  canonicalTitle: string;
  modelNumber: string | null;
  categoryPath: string | null;
  standardizedDescription: string | null;
  primaryImageUrl: string | null;
  brandName: string | null;
  confidenceScore: number;
  sourcesCount: number;
  lastVerifiedAt: string | null;
  isFresh: boolean;
  freshnessDays: number | null;
  identifiers: Array<{ idType: string; idValue: string }>;
  images: string[];
  attributes: Record<string, any>;
  fieldProvenance: Record<string, any>;
}

export interface SmartLookupResult {
  decision: LookupDecision;
  confidence: MatchConfidence;
  confidenceScore: number;
  matchReason: string;
  isAlreadyMappedInTenant: boolean;
  tenantMappingId: string | null;
  reusableProduct: ReusableProductData | null;
  canonicalProductId: string | null;
  freshnessStatus: 'fresh' | 'stale' | 'unknown';
  recommendedAction: 'REUSE' | 'SCRAPE' | 'CONFIRM_MERGE';
}

// 30 days freshness threshold
const FRESHNESS_THRESHOLD_DAYS = 30;

export class ProductIntelligenceService {
  /**
   * Performs multi-tier product intelligence lookup before triggering extraction
   */
  public static async lookupProduct(params: SmartLookupParams): Promise<SmartLookupResult> {
    const { productUrl, brandId, sku, modelNumber, ean, title, currentOrganizationId } = params;

    let matchedGlobalProductId: string | null = null;
    let matchConfidence: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH' = 'NO_MATCH';
    let matchReason = 'No matching product intelligence found.';
    let matchScore = 0.0;

    // --- LEVEL 1: Exact Source URL Match via normalized URL ---
    if (productUrl && productUrl.trim()) {
      const norm = normalizeProductUrl(productUrl);
      if (norm.isValid) {
        // 1a. Check sourceProductListings for normalized URL or content hash
        const [urlMatch] = await db
          .select({
            canonicalProductId: sourceProductListings.canonicalProductId,
            rawTitle: sourceProductListings.rawTitle,
            lastScrapedAt: sourceProductListings.lastScrapedAt,
          })
          .from(sourceProductListings)
          .where(
            or(
              eq(sourceProductListings.sourceUrl, norm.normalizedUrl),
              eq(sourceProductListings.sourceUrl, norm.originalUrl),
              eq(sourceProductListings.contentHash, norm.urlHash)
            )
          )
          .limit(1);

        if (urlMatch && urlMatch.canonicalProductId) {
          matchedGlobalProductId = urlMatch.canonicalProductId;
          matchConfidence = 'EXACT';
          matchScore = 1.0;
          matchReason = `Exact Source URL match (${norm.normalizedDomain})`;
        }

        // 1b. Check if URL is stored in customer_product_overrides customAttributes -> productUrl
        if (!matchedGlobalProductId) {
          const [overrideMatch] = await db
            .select({ globalProductId: customerProductOverrides.globalProductId })
            .from(customerProductOverrides)
            .where(sql`${customerProductOverrides.customAttributes}->>'productUrl' = ${norm.originalUrl} OR ${customerProductOverrides.customAttributes}->>'productUrl' = ${norm.normalizedUrl}`)
            .limit(1);

          if (overrideMatch) {
            matchedGlobalProductId = overrideMatch.globalProductId;
            matchConfidence = 'EXACT';
            matchScore = 1.0;
            matchReason = `Source URL previously verified across platform intelligence`;
          }
        }
      }
    }

    // --- LEVEL 2: Exact Product Identifiers (EAN / GTIN / UPC / MPN / SKU) ---
    if (!matchedGlobalProductId) {
      const cleanEan = ean ? String(ean).replace(/[^0-9]/g, '') : null;
      const cleanSku = sku ? String(sku).trim().toUpperCase() : null;
      const cleanModel = modelNumber ? String(modelNumber).trim() : null;
      const normModel = cleanModel ? cleanModel.toLowerCase().replace(/[^a-z0-9]/g, '') : null;

      // 2a. EAN / GTIN Check (Deterministic Checksum Barcode)
      if (cleanEan && cleanEan.length >= 8) {
        const [eanMatch] = await db
          .select({ globalProductId: productIdentifiers.globalProductId })
          .from(productIdentifiers)
          .where(
            and(
              inArray(productIdentifiers.idType, ['EAN_13', 'UPC_A', 'GTIN_14']),
              eq(productIdentifiers.normalizedValue, cleanEan)
            )
          )
          .limit(1);

        if (eanMatch) {
          matchedGlobalProductId = eanMatch.globalProductId;
          matchConfidence = 'EXACT';
          matchScore = 1.0;
          matchReason = `Exact Barcode match (${cleanEan})`;
        }
      }

      // 2b. Exact MPN / Model Number
      if (!matchedGlobalProductId && normModel && normModel.length >= 2) {
        const [modelMatch] = await db
          .select({ id: globalProducts.id })
          .from(globalProducts)
          .where(eq(globalProducts.normalizedModel, normModel))
          .limit(1);

        if (modelMatch) {
          matchedGlobalProductId = modelMatch.id;
          matchConfidence = 'EXACT';
          matchScore = 0.98;
          matchReason = `Exact Model Number match (${cleanModel})`;
        } else {
          // Check productIdentifiers for MPN
          const [mpnMatch] = await db
            .select({ globalProductId: productIdentifiers.globalProductId })
            .from(productIdentifiers)
            .where(
              and(
                eq(productIdentifiers.idType, 'MPN'),
                eq(productIdentifiers.normalizedValue, cleanModel!)
              )
            )
            .limit(1);

          if (mpnMatch) {
            matchedGlobalProductId = mpnMatch.globalProductId;
            matchConfidence = 'EXACT';
            matchScore = 0.98;
            matchReason = `Exact MPN match (${cleanModel})`;
          }
        }
      }

      // 2c. Manufacturer SKU
      if (!matchedGlobalProductId && cleanSku && cleanSku.length >= 3) {
        const [skuMatch] = await db
          .select({ globalProductId: productIdentifiers.globalProductId })
          .from(productIdentifiers)
          .where(
            and(
              eq(productIdentifiers.idType, 'MANUFACTURER_SKU'),
              eq(productIdentifiers.normalizedValue, cleanSku)
            )
          )
          .limit(1);

        if (skuMatch) {
          matchedGlobalProductId = skuMatch.globalProductId;
          matchConfidence = 'HIGH_CONFIDENCE';
          matchScore = 0.92;
          matchReason = `Manufacturer SKU match (${cleanSku})`;
        }
      }
    }

    // --- LEVEL 3: Existing Identity Matching / Fuzzy Title ---
    if (!matchedGlobalProductId && title && title.trim().length > 10) {
      const cleanTitle = title.trim();
      const [titleMatch] = await db
        .select({ id: globalProducts.id, canonicalTitle: globalProducts.canonicalTitle })
        .from(globalProducts)
        .where(eq(globalProducts.canonicalTitle, cleanTitle))
        .limit(1);

      if (titleMatch) {
        matchedGlobalProductId = titleMatch.id;
        matchConfidence = 'HIGH_CONFIDENCE';
        matchScore = 0.90;
        matchReason = `Exact canonical title match`;
      }
    }

    // If NO_MATCH, return clean decision to extract new
    if (!matchedGlobalProductId) {
      return {
        decision: 'EXTRACT_NEW',
        confidence: 'NO_MATCH',
        confidenceScore: 0.0,
        matchReason: 'No existing verified product intelligence found for this URL or identifier.',
        isAlreadyMappedInTenant: false,
        tenantMappingId: null,
        reusableProduct: null,
        canonicalProductId: null,
        freshnessStatus: 'unknown',
        recommendedAction: 'SCRAPE',
      };
    }

    // --- Load Canonical Product & Reusable Intelligence ---
    const [globalProd] = await db
      .select({
        id: globalProducts.id,
        canonicalTitle: globalProducts.canonicalTitle,
        modelNumber: globalProducts.modelNumber,
        categoryPath: globalProducts.categoryPath,
        standardizedDescription: globalProducts.standardizedDescription,
        primaryImageUrl: globalProducts.primaryImageUrl,
        confidenceScore: globalProducts.confidenceScore,
        sourcesCount: globalProducts.sourcesCount,
        lastVerifiedAt: globalProducts.lastVerifiedAt,
        createdAt: globalProducts.createdAt,
        updatedAt: globalProducts.updatedAt,
        brandName: brands.name,
      })
      .from(globalProducts)
      .leftJoin(brands, eq(globalProducts.brandId, brands.id))
      .where(eq(globalProducts.id, matchedGlobalProductId))
      .limit(1);

    if (!globalProd) {
      return {
        decision: 'EXTRACT_NEW',
        confidence: 'NO_MATCH',
        confidenceScore: 0.0,
        matchReason: 'Canonical product reference not found.',
        isAlreadyMappedInTenant: false,
        tenantMappingId: null,
        reusableProduct: null,
        canonicalProductId: null,
        freshnessStatus: 'unknown',
        recommendedAction: 'SCRAPE',
      };
    }

    // Check if the current tenant already has this mapped
    const [tenantMapping] = await db
      .select({ id: customerProductMappings.id })
      .from(customerProductMappings)
      .where(
        and(
          eq(customerProductMappings.organizationId, currentOrganizationId),
          eq(customerProductMappings.globalProductId, matchedGlobalProductId)
        )
      )
      .limit(1);

    // Calculate Data Freshness
    const lastActive = globalProd.lastVerifiedAt || globalProd.updatedAt || globalProd.createdAt;
    const daysOld = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isFresh = daysOld <= FRESHNESS_THRESHOLD_DAYS;

    // Fetch identifiers & images for clean presentation
    const [idRows, imgRows, provRows] = await Promise.all([
      db.select({ idType: productIdentifiers.idType, idValue: productIdentifiers.idValue })
        .from(productIdentifiers)
        .where(eq(productIdentifiers.globalProductId, matchedGlobalProductId)),
      db.select({ originUrl: productImages.originUrl })
        .from(productImages)
        .where(eq(productImages.globalProductId, matchedGlobalProductId))
        .orderBy(desc(productImages.isPrimary)),
      db.select({
        fieldName: fieldProvenance.fieldName,
        currentValue: fieldProvenance.currentValue,
        confidence: fieldProvenance.confidence,
        lastCorroboratedAt: fieldProvenance.lastCorroboratedAt,
      })
        .from(fieldProvenance)
        .where(eq(fieldProvenance.globalProductId, matchedGlobalProductId)),
    ]);

    const provenanceMap: Record<string, any> = {};
    provRows.forEach((p) => {
      provenanceMap[p.fieldName] = {
        value: p.currentValue,
        confidence: p.confidence,
        lastCorroboratedAt: p.lastCorroboratedAt,
      };
    });

    const reusableData: ReusableProductData = {
      canonicalProductId: globalProd.id,
      canonicalTitle: globalProd.canonicalTitle,
      modelNumber: globalProd.modelNumber,
      categoryPath: globalProd.categoryPath,
      standardizedDescription: globalProd.standardizedDescription,
      primaryImageUrl: globalProd.primaryImageUrl,
      brandName: globalProd.brandName || null,
      confidenceScore: parseFloat(globalProd.confidenceScore) || matchScore,
      sourcesCount: globalProd.sourcesCount || 1,
      lastVerifiedAt: globalProd.lastVerifiedAt ? new Date(globalProd.lastVerifiedAt).toISOString() : null,
      isFresh,
      freshnessDays: daysOld,
      identifiers: idRows,
      images: imgRows.map((i) => i.originUrl),
      attributes: {},
      fieldProvenance: provenanceMap,
    };

    // Determine final Decision
    let decision: LookupDecision = 'REUSE_EXISTING';
    let recommendedAction: 'REUSE' | 'SCRAPE' | 'CONFIRM_MERGE' = 'REUSE';

    if (matchConfidence === 'EXACT') {
      if (isFresh) {
        decision = 'REUSE_EXISTING';
        recommendedAction = 'REUSE';
      } else {
        decision = 'REUSE_EXISTING';
        matchReason += ` (Data is ${daysOld} days old - freshness revalidation recommended)`;
        recommendedAction = 'REUSE';
      }
    } else if (matchConfidence === 'HIGH_CONFIDENCE') {
      decision = 'REUSE_EXISTING';
      recommendedAction = 'REUSE';
    } else {
      decision = 'REVIEW_REQUIRED';
      recommendedAction = 'CONFIRM_MERGE';
    }

    return {
      decision,
      confidence: matchConfidence,
      confidenceScore: matchScore,
      matchReason,
      isAlreadyMappedInTenant: Boolean(tenantMapping),
      tenantMappingId: tenantMapping?.id || null,
      reusableProduct: reusableData,
      canonicalProductId: globalProd.id,
      freshnessStatus: isFresh ? 'fresh' : 'stale',
      recommendedAction,
    };
  }

  /**
   * Safely maps a canonical global product to the tenant catalog without exposing another tenant's private data
   */
  public static async mapProductToTenant(
    organizationId: string,
    globalProductId: string,
    overrides?: {
      customSku?: string;
      customPrice?: string;
      customTitle?: string;
      customDescription?: string;
      productUrl?: string;
    }
  ) {
    // 1. Verify global product exists
    const [globalProd] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, globalProductId))
      .limit(1);

    if (!globalProd) {
      throw new Error('Canonical product does not exist');
    }

    // 2. Insert or update tenant mapping
    const [mapping] = await db
      .insert(customerProductMappings)
      .values({
        organizationId,
        globalProductId,
        customerInternalSku: overrides?.customSku || globalProd.modelNumber || null,
        syncStatus: 'active',
      })
      .onConflictDoUpdate({
        target: [customerProductMappings.organizationId, customerProductMappings.globalProductId],
        set: {
          customerInternalSku: overrides?.customSku || globalProd.modelNumber || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // 3. Save tenant-specific private overrides if specified
    if (overrides) {
      const fieldProv = {
        title: { value: overrides.customTitle || globalProd.canonicalTitle, method: 'smart_reuse', confidence: 'High', lastVerifiedAt: new Date().toISOString() },
        modelNumber: globalProd.modelNumber ? { value: globalProd.modelNumber, method: 'smart_reuse', confidence: 'High', lastVerifiedAt: new Date().toISOString() } : null,
        price: overrides.customPrice ? { value: overrides.customPrice, method: 'tenant_override', confidence: 'High', lastVerifiedAt: new Date().toISOString() } : null,
      };

      await db
        .insert(customerProductOverrides)
        .values({
          organizationId,
          globalProductId,
          customTitle: overrides.customTitle || globalProd.canonicalTitle,
          customDescription: overrides.customDescription || globalProd.standardizedDescription,
          customAttributes: {
            price: overrides.customPrice || null,
            productUrl: overrides.productUrl || null,
            fieldProvenance: fieldProv,
            reusedFromCanonical: true,
          },
        })
        .onConflictDoUpdate({
          target: [customerProductOverrides.organizationId, customerProductOverrides.globalProductId],
          set: {
            customTitle: overrides.customTitle || globalProd.canonicalTitle,
            customDescription: overrides.customDescription || globalProd.standardizedDescription,
            customAttributes: {
              price: overrides.customPrice || null,
              productUrl: overrides.productUrl || null,
              fieldProvenance: fieldProv,
              reusedFromCanonical: true,
            },
            updatedAt: new Date(),
          },
        });
    }

    return {
      mapping,
      globalProduct: globalProd,
    };
  }
}

