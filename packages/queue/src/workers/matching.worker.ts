import { Worker, Job } from 'bullmq';
import { redisConfig } from '../redis';
import { QUEUE_NAMES, persistenceQueue } from '../queues/definitions';
import { NormalizedProductPayload, MatchedProductPayload } from '../types/jobs';
import { db, brands, productIdentifiers, globalProducts } from '@saas/database';
import { eq, and } from 'drizzle-orm';

export function createMatchingWorker() {
  return new Worker<NormalizedProductPayload>(
    QUEUE_NAMES.MATCHING,
    async (job: Job<NormalizedProductPayload>) => {
      const data = job.data;
      let matchedGlobalProductId: string | null = null;
      let matchStrategy: MatchedProductPayload['matchStrategy'] = 'NEW_CANONICAL';
      let confidence = 1.0;

      // 1. Strict EAN Barcode lookup
      if (data.cleanEan) {
        const [idMatch] = await db
          .select({ globalProductId: productIdentifiers.globalProductId })
          .from(productIdentifiers)
          .where(
            and(
              eq(productIdentifiers.idType, 'EAN_13'),
              eq(productIdentifiers.normalizedValue, data.cleanEan)
            )
          )
          .limit(1);

        if (idMatch) {
          matchedGlobalProductId = idMatch.globalProductId;
          matchStrategy = 'STRICT_BARCODE';
          confidence = 1.0;
        }
      }

      // 2. Brand + MPN lookup (if EAN was not found)
      if (!matchedGlobalProductId && data.cleanMpn && data.cleanBrandNormalized) {
        const [brandMatch] = await db
          .select({ id: brands.id })
          .from(brands)
          .where(eq(brands.normalizedName, data.cleanBrandNormalized))
          .limit(1);

        if (brandMatch) {
          const [mpnMatch] = await db
            .select({ globalProductId: productIdentifiers.globalProductId })
            .from(productIdentifiers)
            .where(
              and(
                eq(productIdentifiers.idType, 'MPN'),
                eq(productIdentifiers.normalizedValue, data.cleanMpn)
              )
            )
            .limit(1);

          if (mpnMatch) {
            matchedGlobalProductId = mpnMatch.globalProductId;
            matchStrategy = 'BRAND_MPN';
            confidence = 0.95;
          }
        }
      }

      const matchedPayload: MatchedProductPayload = {
        ...data,
        globalProductId: matchedGlobalProductId,
        productVariantId: null,
        matchStrategy,
        confidence,
      };

      // 3. Dispatch to Persistence Queue
      await persistenceQueue.add(
        `persist_${data.contentHash}`,
        matchedPayload,
        {
          jobId: `persist_${data.contentHash}`,
        }
      );

      return { matched: Boolean(matchedGlobalProductId), strategy: matchStrategy, globalProductId: matchedGlobalProductId };
    },
    {
      connection: redisConfig,
      concurrency: 10,
    }
  );
}
