import {
  db,
  globalProducts,
  productIdentifiers,
  productImages,
  productAttributes,
  sourceProductListings,
  sourceWebsites,
  fieldProvenance,
  identityReviewQueue,
  customerProductOverrides,
} from '@saas/database';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { validateGtinChecksum } from '../utils/validation';

export type QualityTier = 'VERIFIED' | 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'INCOMPLETE' | 'CONFLICT' | 'STALE';
export type FieldConfidence = 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MISSING' | 'CONFLICT';
export type ReviewPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface FieldQualityAssessment {
  fieldName: string;
  value: any;
  confidence: FieldConfidence;
  status: 'verified' | 'unverified' | 'conflict' | 'missing' | 'human_approved';
  sourceTrustScore: number;
  sourceType: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  issues: string[];
}

export interface ProductQualityReport {
  globalProductId: string;
  overallStatus: QualityTier;
  qualityScore: number; // 0 to 100
  completenessScore: number; // 0 to 100
  reviewPriority: ReviewPriority | null;
  requiresReview: boolean;
  reviewReasons: string[];
  fields: Record<string, FieldQualityAssessment>;
  freshnessDays: number;
  isStale: boolean;
  evaluatedAt: string;
}

export class ProductDataQualityService {
  /**
   * Evaluates comprehensive field-level quality and product-level status
   */
  public static async evaluateProductQuality(productId: string): Promise<ProductQualityReport> {
    // 1. Fetch Product and Brand Data
    const [product] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, productId))
      .limit(1);

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // 2. Fetch Associated Entities in Parallel
    const [identifiers, attributes, images, provenanceRows] = await Promise.all([
      db.select().from(productIdentifiers).where(eq(productIdentifiers.globalProductId, productId)),
      db.select().from(productAttributes).where(eq(productAttributes.globalProductId, productId)),
      db.select().from(productImages).where(eq(productImages.globalProductId, productId)),
      db.select().from(fieldProvenance).where(eq(fieldProvenance.globalProductId, productId)),
    ]);

    const fields: Record<string, FieldQualityAssessment> = {};
    const reviewReasons: string[] = [];
    let criticalIssuesCount = 0;
    let highIssuesCount = 0;

    // Provenance map
    const provMap: Record<string, any> = {};
    provenanceRows.forEach((p) => {
      provMap[p.fieldName] = p;
    });

    // -------------------------------------------------------------------------
    // FIELD 1: Product Title
    // -------------------------------------------------------------------------
    const titleVal = product.canonicalTitle;
    const titleProv = provMap['canonical_title'] || provMap['title'];
    const titleIssues: string[] = [];

    if (!titleVal || titleVal.trim().length === 0) {
      titleIssues.push('Product title is missing.');
      highIssuesCount++;
    } else if (titleVal.length < 5) {
      titleIssues.push('Product title is abnormally short.');
    }

    fields['title'] = {
      fieldName: 'title',
      value: titleVal,
      confidence: titleVal ? (titleIssues.length === 0 ? 'HIGH' : 'MEDIUM') : 'MISSING',
      status: titleIssues.length === 0 ? 'verified' : 'unverified',
      sourceTrustScore: titleProv?.confidence ? parseFloat(titleProv.confidence) : 0.95,
      sourceType: 'manufacturer_source',
      lastVerifiedAt: titleProv?.lastCorroboratedAt?.toISOString(),
      issues: titleIssues,
    };

    // -------------------------------------------------------------------------
    // FIELD 2: Model Number / MPN
    // -------------------------------------------------------------------------
    const modelVal = product.modelNumber;
    const modelIssues: string[] = [];

    if (!modelVal) {
      modelIssues.push('Model number / MPN is not recorded.');
    }

    fields['modelNumber'] = {
      fieldName: 'modelNumber',
      value: modelVal,
      confidence: modelVal ? 'EXACT' : 'MISSING',
      status: modelVal ? 'verified' : 'missing',
      sourceTrustScore: 0.98,
      sourceType: 'manufacturer_identifier',
      issues: modelIssues,
    };

    // -------------------------------------------------------------------------
    // FIELD 3: Barcodes (EAN / GTIN / UPC)
    // -------------------------------------------------------------------------
    const barcodeRow = identifiers.find((i) => ['EAN_13', 'UPC_A', 'GTIN_14'].includes(i.idType));
    const barcodeIssues: string[] = [];

    if (barcodeRow) {
      const isChecksumValid = validateGtinChecksum(barcodeRow.normalizedValue);
      if (!isChecksumValid) {
        barcodeIssues.push(`Barcode '${barcodeRow.idValue}' failed mathematical checksum validation.`);
        criticalIssuesCount++;
        reviewReasons.push(`Invalid barcode checksum: ${barcodeRow.idValue}`);
      }
    }

    fields['barcode'] = {
      fieldName: 'barcode',
      value: barcodeRow ? barcodeRow.idValue : null,
      confidence: barcodeRow ? (barcodeIssues.length === 0 ? 'EXACT' : 'CONFLICT') : 'MISSING',
      status: barcodeRow ? (barcodeIssues.length === 0 ? 'verified' : 'conflict') : 'missing',
      sourceTrustScore: barcodeRow ? parseFloat(String(barcodeRow.confidence || '1.0')) : 0.0,
      sourceType: barcodeRow?.idType || 'none',
      issues: barcodeIssues,
    };

    // -------------------------------------------------------------------------
    // FIELD 4: Description & Specifications
    // -------------------------------------------------------------------------
    const descVal = product.standardizedDescription;
    const descIssues: string[] = [];

    if (!descVal || descVal.length < 20) {
      descIssues.push('Product description is incomplete or missing.');
    }

    fields['description'] = {
      fieldName: 'description',
      value: descVal ? (descVal.length > 80 ? descVal.substring(0, 80) + '...' : descVal) : null,
      confidence: descVal && descVal.length > 50 ? 'HIGH' : descVal ? 'MEDIUM' : 'MISSING',
      status: descVal && descVal.length > 20 ? 'verified' : 'missing',
      sourceTrustScore: 0.85,
      sourceType: 'catalog_description',
      issues: descIssues,
    };

    // -------------------------------------------------------------------------
    // FIELD 5: Product Imagery
    // -------------------------------------------------------------------------
    const hasImages = images.length > 0 || Boolean(product.primaryImageUrl);
    fields['images'] = {
      fieldName: 'images',
      value: product.primaryImageUrl || (images[0]?.originUrl) || null,
      confidence: hasImages ? 'HIGH' : 'MISSING',
      status: hasImages ? 'verified' : 'missing',
      sourceTrustScore: 0.90,
      sourceType: 'media_gallery',
      issues: hasImages ? [] : ['No primary product image available.'],
    };

    // -------------------------------------------------------------------------
    // FRESHNESS EVALUATION
    // -------------------------------------------------------------------------
    const lastActive = product.lastVerifiedAt || product.updatedAt || product.createdAt;
    const daysOld = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isStale = daysOld > 30;

    if (isStale) {
      reviewReasons.push(`Product source data is stale (${daysOld} days since last verification).`);
    }

    // -------------------------------------------------------------------------
    // PRODUCT-LEVEL QUALITY TIER & REVIEW PRIORITY
    // -------------------------------------------------------------------------
    let completenessCount = 0;
    if (fields['title'].value) completenessCount++;
    if (fields['modelNumber'].value) completenessCount++;
    if (fields['barcode'].value) completenessCount++;
    if (fields['description'].value) completenessCount++;
    if (fields['images'].value) completenessCount++;

    const completenessScore = Math.round((completenessCount / 5) * 100);

    let overallStatus: QualityTier = 'HIGH_CONFIDENCE';
    let reviewPriority: ReviewPriority | null = null;
    let requiresReview = false;

    if (criticalIssuesCount > 0) {
      overallStatus = 'CONFLICT';
      reviewPriority = 'CRITICAL';
      requiresReview = true;
    } else if (isStale) {
      overallStatus = 'STALE';
      reviewPriority = 'MEDIUM';
      requiresReview = true;
    } else if (completenessScore < 60) {
      overallStatus = 'INCOMPLETE';
      reviewPriority = 'HIGH';
      requiresReview = true;
      reviewReasons.push('Essential catalog fields missing (Description or Identifiers).');
    } else if (product.verificationStatus === 'verified' && completenessScore >= 80) {
      overallStatus = 'VERIFIED';
      reviewPriority = null;
      requiresReview = false;
    }

    // Overall numerical score calculation
    let qualityScore = completenessScore;
    if (criticalIssuesCount > 0) qualityScore = Math.max(20, qualityScore - 50);
    if (isStale) qualityScore = Math.max(30, qualityScore - 20);

    return {
      globalProductId: product.id,
      overallStatus,
      qualityScore,
      completenessScore,
      reviewPriority,
      requiresReview,
      reviewReasons,
      fields,
      freshnessDays: daysOld,
      isStale,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Applies Human Review Correction with Immutable Audit Provenance
   */
  public static async applyHumanCorrection(params: {
    productId: string;
    userId?: string;
    orgId?: string;
    corrections: {
      canonicalTitle?: string;
      modelNumber?: string;
      standardizedDescription?: string;
    };
    correctionReason: string;
  }) {
    const { productId, userId, orgId, corrections, correctionReason } = params;

    const [existing] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, productId))
      .limit(1);

    if (!existing) {
      throw new Error(`Product ${productId} not found`);
    }

    // Update global canonical product
    const [updated] = await db
      .update(globalProducts)
      .set({
        canonicalTitle: corrections.canonicalTitle || existing.canonicalTitle,
        modelNumber: corrections.modelNumber || existing.modelNumber,
        normalizedModel: corrections.modelNumber ? corrections.modelNumber.toLowerCase().replace(/[^a-z0-9]/g, '') : existing.normalizedModel,
        standardizedDescription: corrections.standardizedDescription || existing.standardizedDescription,
        verificationStatus: 'verified',
        confidenceScore: '1.00',
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(globalProducts.id, productId))
      .returning();

    // If tenant context exists, also update tenant customerProductOverrides so client immediately sees edited value
    // and record fieldProvenance inside customAttributes for audit tracking
    if (orgId) {
      const [existingOverride] = await db
        .select()
        .from(customerProductOverrides)
        .where(
          and(
            eq(customerProductOverrides.organizationId, orgId),
            eq(customerProductOverrides.globalProductId, productId)
          )
        )
        .limit(1);

      const existingAttrs = (existingOverride?.customAttributes as any) || {};
      const provMap = existingAttrs.fieldProvenance || {};

      if (corrections.canonicalTitle) {
        provMap.title = {
          value: corrections.canonicalTitle,
          method: 'human_audit_review',
          confidence: 'Exact (Human Verified)',
          reason: correctionReason,
          reviewedBy: userId || 'reviewer_console',
          lastVerifiedAt: new Date().toISOString(),
        };
      }

      if (corrections.standardizedDescription) {
        provMap.description = {
          value: corrections.standardizedDescription.substring(0, 150) + '...',
          method: 'human_audit_review',
          confidence: 'Exact (Human Verified)',
          reason: correctionReason,
          reviewedBy: userId || 'reviewer_console',
          lastVerifiedAt: new Date().toISOString(),
        };
      }

      if (corrections.modelNumber) {
        provMap.modelNumber = {
          value: corrections.modelNumber,
          method: 'human_audit_review',
          confidence: 'Exact (Human Verified)',
          reason: correctionReason,
          reviewedBy: userId || 'reviewer_console',
          lastVerifiedAt: new Date().toISOString(),
        };
      }

      const updatedAttrs = {
        ...existingAttrs,
        fieldProvenance: provMap,
      };

      if (existingOverride) {
        await db
          .update(customerProductOverrides)
          .set({
            customTitle: corrections.canonicalTitle || existingOverride.customTitle,
            customDescription: corrections.standardizedDescription || existingOverride.customDescription,
            customAttributes: updatedAttrs,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customerProductOverrides.organizationId, orgId),
              eq(customerProductOverrides.globalProductId, productId)
            )
          );
      } else {
        await db
          .insert(customerProductOverrides)
          .values({
            organizationId: orgId,
            globalProductId: productId,
            customTitle: corrections.canonicalTitle || existing.canonicalTitle,
            customDescription: corrections.standardizedDescription || existing.standardizedDescription,
            customAttributes: updatedAttrs,
          });
      }
    }

    return {
      success: true,
      updatedProduct: updated,
      humanAudit: {
        appliedByUserId: userId || 'reviewer_console',
        reason: correctionReason,
        appliedAt: new Date().toISOString(),
      },
    };
  }
}

