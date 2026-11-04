import {
  db,
  brands,
  globalProducts,
  productIdentifiers,
  productVariants,
  identityReviewQueue,
} from '@saas/database';
import { eq, and, or, sql } from 'drizzle-orm';
import { ExtractedProductInput, ResolutionResult, IdentityCandidate } from './types';

export class ProductIdentityEngine {
  /**
   * Modulo-10 Checksum validator for EAN-13, EAN-8, GTIN-14, and UPC-A
   */
  public static validateGtinChecksum(gtin: string): boolean {
    const clean = gtin.replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(clean.length)) return false;

    const digits = clean.split('').map(Number);
    const checksum = digits.pop()!;
    let sum = 0;

    for (let i = digits.length - 1; i >= 0; i--) {
      const weight = (digits.length - i) % 2 === 1 ? 3 : 1;
      sum += digits[i] * weight;
    }

    const calculated = (10 - (sum % 10)) % 10;
    return calculated === checksum;
  }

  /**
   * Normalizes an alphanumeric identifier (strips delimiters, uppercase, trims)
   */
  public static normalizeIdentifier(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Core 7-signal entity resolution pipeline
   */
  public async resolveProduct(input: ExtractedProductInput): Promise<ResolutionResult> {
    const candidates: IdentityCandidate[] = [];
    const reasons: string[] = [];

    // Normalize Brand
    const normalizedBrand = input.brand.toLowerCase().trim();
    const [matchedBrand] = await db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(eq(brands.normalizedName, normalizedBrand))
      .limit(1);

    const brandId = matchedBrand?.id;

    // ==========================================
    // SIGNAL 1: Exact Verified GTIN / EAN / UPC
    // ==========================================
    if (input.eanGtin) {
      const isValid = ProductIdentityEngine.validateGtinChecksum(input.eanGtin);
      if (isValid) {
        const cleanGtin = input.eanGtin.replace(/\D/g, '');
        const idMatches = await db
          .select({
            globalProductId: productIdentifiers.globalProductId,
            variantId: productIdentifiers.productVariantId,
            canonicalTitle: globalProducts.canonicalTitle,
            modelNumber: globalProducts.modelNumber,
            brandId: globalProducts.brandId,
          })
          .from(productIdentifiers)
          .innerJoin(globalProducts, eq(globalProducts.id, productIdentifiers.globalProductId))
          .where(
            and(
              or(
                eq(productIdentifiers.idType, 'EAN_13'),
                eq(productIdentifiers.idType, 'GTIN_14'),
                eq(productIdentifiers.idType, 'UPC_A')
              ),
              eq(productIdentifiers.normalizedValue, cleanGtin)
            )
          )
          .limit(1);

        if (idMatches.length > 0) {
          const match = idMatches[0];
          const candidate: IdentityCandidate = {
            globalProductId: match.globalProductId,
            variantId: match.variantId,
            canonicalTitle: match.canonicalTitle,
            brand: input.brand,
            brandId: match.brandId,
            modelNumber: match.modelNumber,
            eanGtin: cleanGtin,
            confidenceScore: 1.0,
            matchTier: 'TIER_1_GTIN',
            matchReason: `Exact Modulo-10 verified GTIN/EAN match (${cleanGtin})`,
            requiresReview: false,
          };
          candidates.push(candidate);
          reasons.push(candidate.matchReason);

          return {
            matched: true,
            action: match.variantId ? 'LINK_CANONICAL' : 'LINK_CANONICAL',
            candidate,
            allCandidates: candidates,
            reasons,
          };
        }
      } else {
        reasons.push(`Warning: Identifier ${input.eanGtin} failed Modulo-10 checksum validation.`);
      }
    }

    // ==========================================
    // SIGNAL 2: Exact Brand + Manufacturer Part Number (MPN)
    // ==========================================
    if (input.mpn && brandId) {
      const normMpn = ProductIdentityEngine.normalizeIdentifier(input.mpn);
      const mpnMatches = await db
        .select({
          globalProductId: productIdentifiers.globalProductId,
          variantId: productIdentifiers.productVariantId,
          canonicalTitle: globalProducts.canonicalTitle,
          modelNumber: globalProducts.modelNumber,
          brandId: globalProducts.brandId,
        })
        .from(productIdentifiers)
        .innerJoin(globalProducts, eq(globalProducts.id, productIdentifiers.globalProductId))
        .where(
          and(
            eq(globalProducts.brandId, brandId),
            eq(productIdentifiers.idType, 'MPN'),
            eq(productIdentifiers.normalizedValue, normMpn)
          )
        )
        .limit(1);

      if (mpnMatches.length > 0) {
        const match = mpnMatches[0];

        // Check if incoming product is a specific variant (e.g. different color)
        const isDistinctVariant = Boolean(input.color || input.size);
        const action = isDistinctVariant ? 'CREATE_VARIANT' : 'LINK_CANONICAL';

        const candidate: IdentityCandidate = {
          globalProductId: match.globalProductId,
          variantId: match.variantId,
          canonicalTitle: match.canonicalTitle,
          brand: input.brand,
          brandId: match.brandId,
          modelNumber: match.modelNumber,
          confidenceScore: 0.95,
          matchTier: 'TIER_2_MPN',
          matchReason: `Exact Brand + MPN match (${normMpn})`,
          requiresReview: false,
        };
        candidates.push(candidate);
        reasons.push(candidate.matchReason);

        return {
          matched: true,
          action,
          candidate,
          allCandidates: candidates,
          reasons,
        };
      }
    }

    // ==========================================
    // SIGNAL 3: Brand + Manufacturer Model / Platform
    // ==========================================
    if (input.modelNumber && brandId) {
      const normModel = ProductIdentityEngine.normalizeIdentifier(input.modelNumber);
      const modelMatches = await db
        .select({
          id: globalProducts.id,
          canonicalTitle: globalProducts.canonicalTitle,
          modelNumber: globalProducts.modelNumber,
          brandId: globalProducts.brandId,
        })
        .from(globalProducts)
        .where(
          and(
            eq(globalProducts.brandId, brandId),
            eq(globalProducts.normalizedModel, normModel)
          )
        )
        .limit(1);

      if (modelMatches.length > 0) {
        const match = modelMatches[0];
        const isDistinctVariant = Boolean(input.color || input.size);

        const candidate: IdentityCandidate = {
          globalProductId: match.id,
          canonicalTitle: match.canonicalTitle,
          brand: input.brand,
          brandId: match.brandId,
          modelNumber: match.modelNumber,
          confidenceScore: 0.90,
          matchTier: 'TIER_3_MODEL',
          matchReason: `Brand + Model platform match (${normModel})`,
          requiresReview: false,
        };
        candidates.push(candidate);
        reasons.push(candidate.matchReason);

        return {
          matched: true,
          action: isDistinctVariant ? 'CREATE_VARIANT' : 'LINK_CANONICAL',
          candidate,
          allCandidates: candidates,
          reasons,
        };
      }
    }

    // ==========================================
    // SIGNAL 4 & 5: Fuzzy Attribute Corroboration
    // ==========================================
    if (brandId && input.title) {
      const normTitle = input.title.toLowerCase().trim();
      const existingBrandProducts = await db
        .select({
          id: globalProducts.id,
          canonicalTitle: globalProducts.canonicalTitle,
          modelNumber: globalProducts.modelNumber,
          brandId: globalProducts.brandId,
        })
        .from(globalProducts)
        .where(eq(globalProducts.brandId, brandId))
        .limit(10);

      for (const prod of existingBrandProducts) {
        const similarity = ProductIdentityEngine.calculateTextSimilarity(normTitle, prod.canonicalTitle.toLowerCase());
        if (similarity >= 0.60) {
          // If similarity is within ambiguous range (0.60 to 0.94), queue for human review
          const candidate: IdentityCandidate = {
            globalProductId: prod.id,
            canonicalTitle: prod.canonicalTitle,
            brand: input.brand,
            brandId: prod.brandId,
            modelNumber: prod.modelNumber,
            confidenceScore: Number(similarity.toFixed(2)),
            matchTier: 'TIER_6_TITLE_FUZZY',
            matchReason: `Fuzzy title match with similarity score ${(similarity * 100).toFixed(1)}%`,
            requiresReview: true,
          };
          candidates.push(candidate);
          reasons.push(candidate.matchReason);
        }
      }

      if (candidates.length > 0) {
        // Sort highest confidence first
        candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
        const topCandidate = candidates[0];

        if (topCandidate.confidenceScore >= 0.95) {
          return {
            matched: true,
            action: 'LINK_CANONICAL',
            candidate: topCandidate,
            allCandidates: candidates,
            reasons,
          };
        }

        // Ambiguous match routes to review queue
        return {
          matched: false,
          action: 'ROUTE_TO_REVIEW',
          candidate: topCandidate,
          allCandidates: candidates,
          reasons: [...reasons, 'Match confidence below automatic threshold (0.95); routing to Human Review Queue.'],
        };
      }
    }

    // ==========================================
    // DEFAULT: No confident candidate -> Create New
    // ==========================================
    return {
      matched: false,
      action: 'CREATE_CANONICAL',
      candidate: null,
      allCandidates: [],
      reasons: ['No matching GTIN, MPN, Model, or high-similarity attributes found.'],
    };
  }

  /**
   * Jaccard word-level similarity algorithm
   */
  public static calculateTextSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const tokens2 = new Set(str2.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersection = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersection++;
    }

    const union = new Set([...tokens1, ...tokens2]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
