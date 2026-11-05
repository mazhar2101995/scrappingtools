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
  identityReviewQueue,
} from '@saas/database';
import { eq, and, sql, or, desc, inArray, not } from 'drizzle-orm';
import {
  normalizeBrandName,
  normalizeIdentifier,
  normalizeGtin,
  normalizeProductTitle,
  calculateTitleSimilarity,
  detectIdentityConflicts,
  NormalizedIdentityCandidate,
  extractVariantMarkers,
} from './identity-normalizer';

export type IdentityMatchType = 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NONE';
export type IdentityDecision = 'AUTO_MATCH' | 'REVIEW_REQUIRED' | 'KEEP_SEPARATE';

export interface IdentityAnalysisParams {
  title: string;
  brandName?: string | null;
  modelNumber?: string | null;
  mpn?: string | null;
  gtin?: string | null;
  sku?: string | null;
  sourceProductListingId?: string;
  sourceUrl?: string;
  currentOrganizationId?: string;
}

export interface MatchEvidenceItem {
  type: 'STRONG' | 'MEDIUM' | 'SUPPORTING' | 'CONFLICT';
  field: string;
  passed: boolean;
  message: string;
}

export interface IdentityResolutionResult {
  matchType: IdentityMatchType;
  decision: IdentityDecision;
  confidenceScore: number;
  matchReasons: string[];
  evidenceList: MatchEvidenceItem[];
  matchedGlobalProductId: string | null;
  matchedCanonicalTitle: string | null;
  reviewQueueId: string | null;
  variantFlag: {
    isVariant: boolean;
    variantType?: 'color' | 'spec';
    details?: string;
  };
}

export class ProductIdentityService {
  /**
   * Evaluates product identity against existing Global Product Intelligence
   * using multi-tier evidence and strict false-positive safeguards.
   */
  public static async resolveIdentity(params: IdentityAnalysisParams): Promise<IdentityResolutionResult> {
    const {
      title,
      brandName,
      modelNumber,
      mpn,
      gtin,
      sku,
      sourceProductListingId,
      sourceUrl,
      currentOrganizationId,
    } = params;

    const candidate: NormalizedIdentityCandidate = {
      rawTitle: title,
      normalizedTitle: normalizeProductTitle(title),
      brandName,
      normalizedBrand: normalizeBrandName(brandName),
      modelNumber,
      normalizedModel: normalizeIdentifier(modelNumber || mpn),
      mpn,
      normalizedMpn: normalizeIdentifier(mpn),
      gtin,
      normalizedGtin: normalizeGtin(gtin),
      sku,
      normalizedSku: normalizeIdentifier(sku),
    };

    const evidenceList: MatchEvidenceItem[] = [];
    const matchReasons: string[] = [];
    let matchedGlobalProductId: string | null = null;
    let matchedCanonicalTitle: string | null = null;
    let confidenceScore = 0.0;
    let matchType: IdentityMatchType = 'NONE';
    let decision: IdentityDecision = 'KEEP_SEPARATE';
    let reviewQueueId: string | null = null;
    let isVariant = false;
    let variantDetails = '';

    // =========================================================================
    // LEVEL 1 — EXACT IDENTITY (Strong Evidence: Barcode GTIN / EAN / MPN)
    // =========================================================================

    // 1a. Strict Barcode Check (EAN-13, UPC-A, GTIN-14)
    if (candidate.normalizedGtin && candidate.normalizedGtin.length >= 8) {
      const [gtinMatch] = await db
        .select({
          globalProductId: productIdentifiers.globalProductId,
          title: globalProducts.canonicalTitle,
          model: globalProducts.modelNumber,
        })
        .from(productIdentifiers)
        .innerJoin(globalProducts, eq(globalProducts.id, productIdentifiers.globalProductId))
        .where(
          and(
            inArray(productIdentifiers.idType, ['EAN_13', 'UPC_A', 'GTIN_14']),
            eq(productIdentifiers.normalizedValue, candidate.normalizedGtin)
          )
        )
        .limit(1);

      if (gtinMatch) {
        matchedGlobalProductId = gtinMatch.globalProductId;
        matchedCanonicalTitle = gtinMatch.title;
        matchType = 'EXACT';
        decision = 'AUTO_MATCH';
        confidenceScore = 1.0;
        matchReasons.push(`Exact verified barcode GTIN/EAN match: ${candidate.normalizedGtin}`);
        evidenceList.push({
          type: 'STRONG',
          field: 'gtin',
          passed: true,
          message: `Verified barcode matched existing canonical product`,
        });

        return {
          matchType,
          decision,
          confidenceScore,
          matchReasons,
          evidenceList,
          matchedGlobalProductId,
          matchedCanonicalTitle,
          reviewQueueId: null,
          variantFlag: { isVariant: false },
        };
      }
    }

    // 1b. Exact Manufacturer Part Number (MPN) or Model Number with matching brand
    if (candidate.normalizedModel && candidate.normalizedModel.length >= 2) {
      const query = db
        .select({
          id: globalProducts.id,
          title: globalProducts.canonicalTitle,
          modelNumber: globalProducts.modelNumber,
          normalizedModel: globalProducts.normalizedModel,
          brandId: globalProducts.brandId,
          brandNormalized: brands.normalizedName,
        })
        .from(globalProducts)
        .leftJoin(brands, eq(globalProducts.brandId, brands.id))
        .where(eq(globalProducts.normalizedModel, candidate.normalizedModel));

      const modelMatches = await query.limit(5);

      if (modelMatches.length > 0) {
        // If brand matches or only 1 global match exists
        const exactBrandMatch = modelMatches.find(
          (m) => candidate.normalizedBrand && m.brandNormalized === candidate.normalizedBrand
        ) || modelMatches[0];

        // Check if there are color or variant differences
        const varMarkersA = extractVariantMarkers(candidate.rawTitle);
        const varMarkersB = extractVariantMarkers(exactBrandMatch.title);

        if (varMarkersA.color && varMarkersB.color && varMarkersA.color !== varMarkersB.color) {
          isVariant = true;
          variantDetails = `Same model (${candidate.modelNumber}) but different color variant: '${varMarkersA.color}' vs '${varMarkersB.color}'`;
          evidenceList.push({
            type: 'SUPPORTING',
            field: 'color',
            passed: false,
            message: variantDetails,
          });
        }

        // Check for hard conflicts (like Ultimate vs VXL)
        const conflict = detectIdentityConflicts(candidate, {
          rawTitle: exactBrandMatch.title,
          normalizedTitle: normalizeProductTitle(exactBrandMatch.title),
          normalizedBrand: exactBrandMatch.brandNormalized,
          normalizedModel: exactBrandMatch.normalizedModel,
          modelNumber: exactBrandMatch.modelNumber,
        });

        if (conflict.hasConflict) {
          evidenceList.push({
            type: 'CONFLICT',
            field: 'productFamily',
            passed: false,
            message: conflict.conflictReason || 'Product family mismatch',
          });
          // Do not auto-match when family conflicts
          matchType = 'POSSIBLE_MATCH';
          decision = 'REVIEW_REQUIRED';
          confidenceScore = 0.65;
          matchReasons.push(`Model matched but conflict detected: ${conflict.conflictReason}`);
        } else if (isVariant) {
          matchType = 'POSSIBLE_MATCH';
          decision = 'REVIEW_REQUIRED';
          confidenceScore = 0.80;
          matchReasons.push(`Model matched as SKU variant (${variantDetails}). Kept separate for review.`);
        } else {
          matchedGlobalProductId = exactBrandMatch.id;
          matchedCanonicalTitle = exactBrandMatch.title;
          matchType = 'EXACT';
          decision = 'AUTO_MATCH';
          confidenceScore = 0.98;
          matchReasons.push(`Exact Model Number match: ${candidate.modelNumber}`);
          evidenceList.push({
            type: 'STRONG',
            field: 'modelNumber',
            passed: true,
            message: `Exact model match under brand '${exactBrandMatch.brandNormalized || 'generic'}'`,
          });

          return {
            matchType,
            decision,
            confidenceScore,
            matchReasons,
            evidenceList,
            matchedGlobalProductId,
            matchedCanonicalTitle,
            reviewQueueId: null,
            variantFlag: { isVariant: false },
          };
        }
      }
    }

    // =========================================================================
    // LEVEL 2 & 3 — MULTI-EVIDENCE SIMILARITY & POSSIBLE MATCH REVIEW
    // =========================================================================

    // Scan candidate global products by brand or title
    const potentialCandidates = await db
      .select({
        id: globalProducts.id,
        title: globalProducts.canonicalTitle,
        modelNumber: globalProducts.modelNumber,
        normalizedModel: globalProducts.normalizedModel,
        brandName: brands.name,
        brandNormalized: brands.normalizedName,
        confidenceScore: globalProducts.confidenceScore,
      })
      .from(globalProducts)
      .leftJoin(brands, eq(globalProducts.brandId, brands.id))
      .where(
        candidate.normalizedBrand
          ? eq(brands.normalizedName, candidate.normalizedBrand)
          : sql`true`
      )
      .limit(20);

    let bestMatch: (typeof potentialCandidates)[0] | null = null;
    let highestSim = 0.0;

    for (const cand of potentialCandidates) {
      const sim = calculateTitleSimilarity(candidate.rawTitle, cand.title);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = cand;
      }
    }

    if (bestMatch && highestSim >= 0.85) {
      // Check for conflicts
      const conflict = detectIdentityConflicts(candidate, {
        rawTitle: bestMatch.title,
        normalizedTitle: normalizeProductTitle(bestMatch.title),
        normalizedBrand: bestMatch.brandNormalized,
        normalizedModel: bestMatch.normalizedModel,
        modelNumber: bestMatch.modelNumber,
      });

      if (conflict.hasConflict) {
        matchType = 'POSSIBLE_MATCH';
        decision = 'REVIEW_REQUIRED';
        confidenceScore = Number((highestSim * 0.7).toFixed(2));
        matchReasons.push(`High title similarity (${Math.round(highestSim * 100)}%), but conflict flagged: ${conflict.conflictReason}`);
        evidenceList.push({
          type: 'CONFLICT',
          field: 'identityConflict',
          passed: false,
          message: conflict.conflictReason || 'Conflict',
        });
      } else if (highestSim >= 0.95 && candidate.normalizedBrand === bestMatch.brandNormalized) {
        // High confidence match
        matchedGlobalProductId = bestMatch.id;
        matchedCanonicalTitle = bestMatch.title;
        matchType = 'HIGH_CONFIDENCE';
        decision = 'AUTO_MATCH';
        confidenceScore = Number(highestSim.toFixed(2));
        matchReasons.push(`High confidence title similarity (${Math.round(highestSim * 100)}%) with identical brand.`);
        evidenceList.push({
          type: 'MEDIUM',
          field: 'titleSimilarity',
          passed: true,
          message: `Title similarity ${Math.round(highestSim * 100)}% under brand '${bestMatch.brandName}'`,
        });
      } else {
        // Between 85% and 94% similarity: REQUIRE HUMAN REVIEW (Do NOT blindly merge)
        matchedGlobalProductId = bestMatch.id;
        matchedCanonicalTitle = bestMatch.title;
        matchType = 'POSSIBLE_MATCH';
        decision = 'REVIEW_REQUIRED';
        confidenceScore = Number(highestSim.toFixed(2));
        matchReasons.push(`Strong similarity (${Math.round(highestSim * 100)}%) but requires human verification to prevent false positives.`);
        evidenceList.push({
          type: 'MEDIUM',
          field: 'titleSimilarity',
          passed: true,
          message: `Title similarity ${Math.round(highestSim * 100)}%`,
        });
      }
    } else {
      matchType = 'NONE';
      decision = 'KEEP_SEPARATE';
      confidenceScore = 0.0;
      matchReasons.push('No matching product identity found within confidence thresholds.');
    }

    // =========================================================================
    // PART 7: REVIEW WORKFLOW INTEGRATION (identity_review_queue)
    // =========================================================================
    if (decision === 'REVIEW_REQUIRED' && sourceProductListingId) {
      try {
        const [existingQueue] = await db
          .select({ id: identityReviewQueue.id })
          .from(identityReviewQueue)
          .where(
            and(
              eq(identityReviewQueue.sourceProductListingId, sourceProductListingId),
              eq(identityReviewQueue.resolutionStatus, 'pending')
            )
          )
          .limit(1);

        if (existingQueue) {
          reviewQueueId = existingQueue.id;
        } else {
          const [newQueue] = await db
            .insert(identityReviewQueue)
            .values({
              sourceProductListingId,
              suggestedGlobalProductId: matchedGlobalProductId,
              matchConfidence: String(confidenceScore),
              matchReasons: matchReasons,
              resolutionStatus: 'pending',
            })
            .returning({ id: identityReviewQueue.id });

          reviewQueueId = newQueue.id;
        }
      } catch (queueErr) {
        console.warn('[ProductIdentityService] Failed to push to identity_review_queue:', queueErr);
      }
    }

    return {
      matchType,
      decision,
      confidenceScore,
      matchReasons,
      evidenceList,
      matchedGlobalProductId,
      matchedCanonicalTitle,
      reviewQueueId,
      variantFlag: {
        isVariant,
        variantType: isVariant ? 'color' : undefined,
        details: variantDetails || undefined,
      },
    };
  }
}

