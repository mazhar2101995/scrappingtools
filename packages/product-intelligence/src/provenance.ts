import {
  db,
  fieldProvenance,
  productVersions,
  productSourceHistory,
  sourceWebsites,
  sourceProductListings,
} from '@saas/database';
import { eq, and, sql } from 'drizzle-orm';

export interface ProvenanceUpdateInput {
  globalProductId: string;
  sourceWebsiteId: string;
  sourceProductListingId: string;
  sourceType: 'official_brand' | 'authorized_distributor' | 'marketplace' | 'supplier' | 'ai_generated' | 'customer';
  extractedFields: Record<string, any>;
  observedPrice?: number | null;
  observedCurrency?: string | null;
  availabilityStatus?: string;
}

export class FieldProvenanceEngine {
  /**
   * Source reliability trust mapping
   */
  public static getSourceTrustScore(sourceType: string): number {
    switch (sourceType) {
      case 'official_brand':
        return 1.0;
      case 'authorized_distributor':
        return 0.85;
      case 'marketplace':
        return 0.70;
      case 'supplier':
        return 0.75;
      case 'ai_generated':
        return 0.65;
      case 'customer':
      default:
        return 0.50;
    }
  }

  /**
   * Applies field updates using strict trust weighting and records lineage
   */
  public async reconcileFields(input: ProvenanceUpdateInput): Promise<{
    updatedFields: string[];
    retainedFields: string[];
    versionIncremented: boolean;
  }> {
    const incomingTrust = FieldProvenanceEngine.getSourceTrustScore(input.sourceType);
    const updatedFields: string[] = [];
    const retainedFields: string[] = [];
    const diffPayload: Record<string, { old: any; new: any; trust: number }> = {};

    // 1. Fetch current field provenance for this product
    const existingProvenance = await db
      .select({
        id: fieldProvenance.id,
        fieldName: fieldProvenance.fieldName,
        currentValue: fieldProvenance.currentValue,
        confidence: fieldProvenance.confidence,
        sourceWebsiteId: fieldProvenance.sourceWebsiteId,
      })
      .from(fieldProvenance)
      .where(eq(fieldProvenance.globalProductId, input.globalProductId));

    const existingMap = new Map<string, (typeof existingProvenance)[0]>();
    existingProvenance.forEach((fp) => existingMap.set(fp.fieldName, fp));

    // 2. Evaluate incoming fields against trust rules
    for (const [key, rawVal] of Object.entries(input.extractedFields)) {
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;
      const strVal = typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal);
      const existing = existingMap.get(key);

      if (!existing) {
        // Field does not exist yet -> Insert directly
        await db.insert(fieldProvenance).values({
          globalProductId: input.globalProductId,
          fieldName: key,
          currentValue: strVal,
          sourceWebsiteId: input.sourceWebsiteId,
          sourceProductListingId: input.sourceProductListingId,
          confidence: incomingTrust.toFixed(2),
          changeCount: 1,
        });
        updatedFields.push(key);
        diffPayload[key] = { old: null, new: strVal, trust: incomingTrust };
      } else {
        const existingTrust = Number(existing.confidence);

        if (existing.currentValue === strVal) {
          // Unchanged value -> Corroborate existing value
          await db
            .update(fieldProvenance)
            .set({
              lastCorroboratedAt: new Date(),
              isStale: false,
            })
            .where(eq(fieldProvenance.id, existing.id));
          retainedFields.push(key);
        } else if (incomingTrust >= existingTrust) {
          // Higher or equal trust source brings new value -> Overwrite & record lineage
          await db
            .update(fieldProvenance)
            .set({
              currentValue: strVal,
              sourceWebsiteId: input.sourceWebsiteId,
              sourceProductListingId: input.sourceProductListingId,
              confidence: incomingTrust.toFixed(2),
              lastCorroboratedAt: new Date(),
              lastChangedAt: new Date(),
              changeCount: sql`${fieldProvenance.changeCount} + 1`,
              isStale: false,
            })
            .where(eq(fieldProvenance.id, existing.id));

          updatedFields.push(key);
          diffPayload[key] = { old: existing.currentValue, new: strVal, trust: incomingTrust };
        } else {
          // Lower trust source cannot overwrite higher trust manufacturer data
          retainedFields.push(key);
        }
      }
    }

    // 3. Record price/availability in product_source_history
    if (input.observedPrice !== undefined) {
      await db.insert(productSourceHistory).values({
        globalProductId: input.globalProductId,
        sourceProductListingId: input.sourceProductListingId,
        observedPrice: input.observedPrice ? String(input.observedPrice) : null,
        observedCurrency: input.observedCurrency || 'USD',
        availabilityStatus: input.availabilityStatus || 'IN_STOCK',
      });
    }

    // 4. If changes occurred, snapshot version
    let versionIncremented = false;
    if (Object.keys(diffPayload).length > 0) {
      const [lastVer] = await db
        .select({ versionNumber: productVersions.versionNumber })
        .from(productVersions)
        .where(eq(productVersions.globalProductId, input.globalProductId))
        .orderBy(sql`${productVersions.versionNumber} DESC`)
        .limit(1);

      const nextVersion = (lastVer?.versionNumber || 0) + 1;

      await db.insert(productVersions).values({
        globalProductId: input.globalProductId,
        versionNumber: nextVersion,
        changedBySourceId: input.sourceWebsiteId,
        diffPayload,
        fullSnapshot: input.extractedFields,
        reason: `Reconciled from ${input.sourceType} (${input.sourceWebsiteId})`,
      });
      versionIncremented = true;
    }

    return {
      updatedFields,
      retainedFields,
      versionIncremented,
    };
  }
}

