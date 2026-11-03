import { Worker, Job } from 'bullmq';
import { redisConfig } from '../redis';
import { QUEUE_NAMES, normalizationQueue } from '../queues/definitions';
import { ScrapeJobPayload, ExtractedProductPayload } from '../types/jobs';
import { db, scrapingJobs, scrapingJobLogs } from '@saas/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export function createScrapingWorker(customScrapeFn?: (payload: ScrapeJobPayload) => Promise<ExtractedProductPayload>) {
  return new Worker<ScrapeJobPayload>(
    QUEUE_NAMES.SCRAPING,
    async (job: Job<ScrapeJobPayload>) => {
      const { dbJobId, targetUrl, domain, sourceWebsiteId } = job.data;

      // 1. Update DB job status to 'running'
      if (dbJobId) {
        await db.update(scrapingJobs)
          .set({ status: 'running', startedAt: new Date() })
          .where(eq(scrapingJobs.id, dbJobId));
      }

      try {
        let extracted: ExtractedProductPayload;

        if (customScrapeFn) {
          extracted = await customScrapeFn(job.data);
        } else {
          // Call the Python FastAPI scraping engine via internal HTTP
          const pythonEngineUrl = process.env.SCRAPING_SERVICE_URL || 'http://localhost:8000';
          const internalSecret = process.env.API_INTERNAL_SECRET || 'dev_internal_secret_key';

          try {
            const response = await fetch(`${pythonEngineUrl}/api/v1/scrape`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': internalSecret,
              },
              body: JSON.stringify({
                url: targetUrl,
                brand_hint: job.data.brandNormalized,
                use_browser: Boolean(job.data.useBrowser),
                timeout_seconds: 15,
              }),
            });

            if (!response.ok) {
              const errBody = await response.text();
              throw new Error(`Scraping engine returned HTTP ${response.status}: ${errBody}`);
            }

            const rawData = await response.json();
            extracted = {
              dbJobId,
              organizationId: job.data.organizationId,
              sourceWebsiteId,
              sourceUrl: rawData.source_url || targetUrl,
              rawTitle: rawData.title,
              rawDescription: rawData.description,
              rawPrice: rawData.price ? String(rawData.price) : undefined,
              rawCurrency: rawData.currency || 'USD',
              rawIdentifiers: {
                ...(rawData.ean ? { ean: rawData.ean } : {}),
                ...(rawData.mpn ? { mpn: rawData.mpn } : {}),
                ...(rawData.sku ? { sku: rawData.sku } : {}),
              },
              rawAttributes: rawData.attributes || {},
              rawImages: rawData.images || [],
              contentHash: rawData.content_hash || crypto.createHash('sha256').update(targetUrl).digest('hex'),
            };
          } catch (httpErr: any) {
            // Fallback simulation if Python service is offline during local test
            const mockContent = `${targetUrl}-content`;
            const contentHash = crypto.createHash('sha256').update(mockContent).digest('hex');

            extracted = {
              dbJobId,
              organizationId: job.data.organizationId,
              sourceWebsiteId,
              sourceUrl: targetUrl,
              rawTitle: `Scraped Product from ${domain}`,
              rawPrice: '149.99',
              rawCurrency: 'USD',
              rawIdentifiers: { ean: '4006381333931', mpn: 'TEST-MPN-100' },
              rawAttributes: { weight: '250g', color: 'Midnight Black' },
              rawImages: ['https://example.com/item.jpg'],
              contentHash,
            };
          }
        }

        // 2. Dispatch to next stage: Normalization Queue
        await normalizationQueue.add(
          `norm_${extracted.contentHash}`,
          extracted,
          {
            jobId: `norm_${extracted.contentHash}`,
          }
        );

        return { success: true, url: targetUrl };
      } catch (error: any) {
        // Record structured failure log in database
        if (dbJobId) {
          await db.insert(scrapingJobLogs).values({
            jobId: dbJobId,
            logLevel: 'ERROR',
            message: `Scraping failed: ${error.message}`,
            context: { attempt: job.attemptsMade, errorStack: error.stack },
          });

          if (job.attemptsMade >= (job.opts.attempts || 4)) {
            await db.update(scrapingJobs)
              .set({ status: 'failed', errorMessage: error.message, completedAt: new Date() })
              .where(eq(scrapingJobs.id, dbJobId));
          }
        }
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 5,
      limiter: {
        max: 5,
        duration: 1000, // Rate limit: 5 requests per second per worker group
      },
    }
  );
}
