import { Worker, Job } from 'bullmq';
import { redisConfig } from '../redis';
import { QUEUE_NAMES } from '../queues/definitions';
import { MatchedProductPayload, PersistenceResult } from '../types/jobs';
import {
  db,
  globalProducts,
  productIdentifiers,
  productAttributes,
  sourceProductListings,
  fieldProvenance,
  productVersions,
  customerProductMappings,
  scrapingJobs,
  brands,
} from '@saas/database';
import { eq, and } from 'drizzle-orm';

export function createPersistenceWorker() {
  return new Worker<MatchedProductPayload>(
    QUEUE_NAMES.PERSISTENCE,
    async (job: Job<MatchedProductPayload>): Promise<PersistenceResult> => {
      const data = job.data;

      return await db.transaction(async (tx) => {
        let canonicalProductId = data.globalProductId;
        let isNew = false;

        // 1. If no existing canonical product, create Brand (if needed) & Global Product
        if (!canonicalProductId) {
          isNew = true;

          // Lookup or create brand
          let [brand] = await tx
            .select({ id: brands.id })
            .from(brands)
            .where(eq(brands.normalizedName, data.cleanBrandNormalized))
            .limit(1);

          if (!brand) {
            [brand] = await tx
              .insert(brands)
              .values({
                name: data.rawAttributes.brand || 'Generic Brand',
                normalizedName: data.cleanBrandNormalized,
              })
              .returning({ id: brands.id });
          }

          const [newProd] = await tx
            .insert(globalProducts)
            .values({
              brandId: brand.id,
              canonicalTitle: data.normalizedTitle,
              modelNumber: data.cleanModel || data.cleanMpn,
              normalizedModel: (data.cleanModel || data.cleanMpn || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
              standardizedDescription: data.rawDescription,
              primaryImageUrl: data.rawImages[0],
            })
            .returning({ id: globalProducts.id });

          canonicalProductId = newProd.id;
        }

        // 2. Persist Source Listing record
        const [sourceListing] = await tx
          .insert(sourceProductListings)
          .values({
            sourceWebsiteId: data.sourceWebsiteId,
            sourceUrl: data.sourceUrl,
            canonicalProductId,
            rawTitle: data.rawTitle,
            rawDescription: data.rawDescription,
            rawPrice: data.rawPrice,
            rawCurrency: data.rawCurrency || 'USD',
            rawAttributes: data.rawAttributes,
            rawIdentifiers: data.rawIdentifiers,
            rawImages: data.rawImages,
            lastScrapedAt: new Date(),
            contentHash: data.contentHash,
          })
          .onConflictDoUpdate({
            target: [sourceProductListings.sourceWebsiteId, sourceProductListings.sourceUrl],
            set: {
              canonicalProductId,
              rawTitle: data.rawTitle,
              rawPrice: data.rawPrice,
              lastScrapedAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning({ id: sourceProductListings.id });

        // 3. Persist Identifiers (EAN, MPN) if new or absent
        let persistedIdentifiersCount = 0;
        if (data.cleanEan) {
          await tx
            .insert(productIdentifiers)
            .values({
              globalProductId: canonicalProductId,
              idType: 'EAN_13',
              idValue: data.cleanEan,
              normalizedValue: data.cleanEan,
              sourceWebsiteId: data.sourceWebsiteId,
              isPrimary: true,
            })
            .onConflictDoNothing();
          persistedIdentifiersCount++;
        }

        if (data.cleanMpn) {
          await tx
            .insert(productIdentifiers)
            .values({
              globalProductId: canonicalProductId,
              idType: 'MPN',
              idValue: data.cleanMpn,
              normalizedValue: data.cleanMpn,
              sourceWebsiteId: data.sourceWebsiteId,
            })
            .onConflictDoNothing();
          persistedIdentifiersCount++;
        }

        // 4. Persist Attributes
        let persistedAttributesCount = 0;
        for (const [key, attr] of Object.entries(data.normalizedAttributes)) {
          await tx
            .insert(productAttributes)
            .values({
              globalProductId: canonicalProductId,
              attributeKey: key,
              rawValue: attr.value,
              normalizedValue: attr.value,
              unit: attr.unit,
              dataType: attr.dataType,
              sourceWebsiteId: data.sourceWebsiteId,
            })
            .onConflictDoNothing();
          persistedAttributesCount++;
        }

        // 5. Update Field Provenance
        await tx
          .insert(fieldProvenance)
          .values({
            globalProductId: canonicalProductId,
            fieldName: 'canonical_title',
            currentValue: data.normalizedTitle,
            sourceWebsiteId: data.sourceWebsiteId,
            sourceProductListingId: sourceListing.id,
            confidence: String(data.confidence),
            lastCorroboratedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [fieldProvenance.globalProductId, fieldProvenance.fieldName],
            set: {
              lastCorroboratedAt: new Date(),
            },
          });

        // 6. Record Initial Version if newly created
        if (isNew) {
          await tx.insert(productVersions).values({
            globalProductId: canonicalProductId,
            versionNumber: 1,
            changedBySourceId: data.sourceWebsiteId,
            diffPayload: { canonical_title: { old: null, new: data.normalizedTitle } },
            fullSnapshot: { title: data.normalizedTitle, ean: data.cleanEan, mpn: data.cleanMpn },
            reason: 'initial_pipeline_ingestion',
          });
        }

        // 7. If tenant requested, map to customer organization
        if (data.organizationId) {
          await tx
            .insert(customerProductMappings)
            .values({
              organizationId: data.organizationId,
              globalProductId: canonicalProductId,
            })
            .onConflictDoNothing();
        }

        // 8. Update DB scraping job status to completed
        if (data.dbJobId) {
          await tx
            .update(scrapingJobs)
            .set({
              status: 'completed',
              itemsExtracted: 1,
              completedAt: new Date(),
            })
            .where(eq(scrapingJobs.id, data.dbJobId));
        }

        return {
          success: true,
          globalProductId: canonicalProductId,
          isNew,
          persistedIdentifiersCount,
          persistedAttributesCount,
        };
      });
    },
    {
      connection: redisConfig,
      concurrency: 5,
    }
  );
}

