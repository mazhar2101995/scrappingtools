import { Worker, Job } from 'bullmq';
import { redisConfig } from '../redis';
import { QUEUE_NAMES, matchingQueue } from '../queues/definitions';
import { ExtractedProductPayload, NormalizedProductPayload } from '../types/jobs';

/**
 * Validates EAN-13 Modulo-10 checksum
 */
export function isValidEan13(ean: string): boolean {
  const clean = ean.replace(/[^0-9]/g, '');
  if (clean.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === parseInt(clean[12], 10);
}

export function createNormalizationWorker() {
  return new Worker<ExtractedProductPayload>(
    QUEUE_NAMES.NORMALIZATION,
    async (job: Job<ExtractedProductPayload>) => {
      const data = job.data;

      // 1. Clean & validate EAN
      let cleanEan: string | undefined;
      if (data.rawIdentifiers.ean) {
        const rawEan = data.rawIdentifiers.ean.trim();
        if (isValidEan13(rawEan)) {
          cleanEan = rawEan;
        }
      }

      // 2. Clean & normalize MPN
      const cleanMpn = data.rawIdentifiers.mpn
        ? data.rawIdentifiers.mpn.trim().toUpperCase()
        : undefined;

      // 3. Clean title & attributes
      const normalizedTitle = data.rawTitle.replace(/\s+/g, ' ').trim();
      const normalizedAttributes: Record<string, { value: string; unit?: string; dataType: string }> = {};

      for (const [key, val] of Object.entries(data.rawAttributes || {})) {
        normalizedAttributes[key] = {
          value: String(val).trim(),
          dataType: typeof val === 'number' ? 'number' : 'string',
        };
      }

      const normalizedPayload: NormalizedProductPayload = {
        ...data,
        normalizedTitle,
        cleanEan,
        cleanMpn,
        cleanBrandNormalized: (data.rawAttributes.brand || 'generic').toLowerCase().replace(/[^a-z0-9]/g, ''),
        normalizedAttributes,
      };

      // 4. Dispatch to Identity Matching Queue
      await matchingQueue.add(
        `match_${data.contentHash}`,
        normalizedPayload,
        {
          jobId: `match_${data.contentHash}`,
        }
      );

      return { success: true, cleanEan, cleanMpn };
    },
    {
      connection: redisConfig,
      concurrency: 10,
    }
  );
}
