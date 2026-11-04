import crypto from 'crypto';
import { db, sourceProductListings } from '@saas/database';
import { eq } from 'drizzle-orm';

export class DataFreshnessEngine {
  /**
   * Deterministic SHA-256 content hashing across core payload fields
   */
  public static computeContentHash(payload: {
    title: string;
    description?: string | null;
    price?: number | null;
    attributes?: Record<string, any>;
    images?: string[];
  }): string {
    const canonicalObject = {
      title: (payload.title || '').trim().toLowerCase(),
      description: (payload.description || '').trim(),
      price: payload.price !== undefined ? payload.price : null,
      attributes: payload.attributes ? Object.keys(payload.attributes).sort().reduce((acc, k) => {
        acc[k] = payload.attributes![k];
        return acc;
      }, {} as Record<string, any>) : {},
      images: (payload.images || []).slice().sort(),
    };

    return crypto.createHash('sha256').update(JSON.stringify(canonicalObject)).digest('hex');
  }

  /**
   * Checks whether incoming scraped content has changed since last ingestion
   */
  public async evaluateFreshness(
    sourceWebsiteId: string,
    sourceUrl: string,
    newHash: string
  ): Promise<{ isNew: boolean; isUnchanged: boolean; existingListingId?: string }> {
    const [existing] = await db
      .select({
        id: sourceProductListings.id,
        contentHash: sourceProductListings.contentHash,
        lastScrapedAt: sourceProductListings.lastScrapedAt,
      })
      .from(sourceProductListings)
      .where(
        eq(sourceProductListings.sourceUrl, sourceUrl)
      )
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(sourceProductListings)
        .values({
          sourceWebsiteId,
          sourceUrl,
          rawTitle: 'Auto-Initialized Listing',
          contentHash: newHash,
          lastScrapedAt: new Date(),
        })
        .returning({ id: sourceProductListings.id });

      return { isNew: true, isUnchanged: false, existingListingId: inserted?.id };
    }

    if (existing.contentHash === newHash) {
      // Content has not changed at all -> Update touch time only
      await db
        .update(sourceProductListings)
        .set({
          lastScrapedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sourceProductListings.id, existing.id));

      return { isNew: false, isUnchanged: true, existingListingId: existing.id };
    }

    return { isNew: false, isUnchanged: false, existingListingId: existing.id };
  }
}
