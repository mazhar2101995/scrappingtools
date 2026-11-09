import { Queue, QueueOptions } from 'bullmq';
import { redisConfig } from '../redis';
import {
  ScrapeJobPayload,
  ExtractedProductPayload,
  NormalizedProductPayload,
  MatchedProductPayload,
} from '../types/jobs';

const defaultQueueOptions: QueueOptions = {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
    },
  },
};

export const QUEUE_NAMES = {
  SCRAPING: 'product-scraping',
  BROWSER_SCRAPING: 'browser-scraping',
  NORMALIZATION: 'product-normalization',
  MATCHING: 'identity-matching',
  PERSISTENCE: 'product-persistence',
} as const;

export const scrapingQueue = new Queue<ScrapeJobPayload>(QUEUE_NAMES.SCRAPING, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 4,
    backoff: { type: 'exponential', delay: 3000 },
  },
});

export const browserScrapingQueue = new Queue<ScrapeJobPayload>(QUEUE_NAMES.BROWSER_SCRAPING, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 2, // Fewer retries for heavy browser jobs to protect resources
    backoff: { type: 'exponential', delay: 10000 },
  },
});

export const normalizationQueue = new Queue<ExtractedProductPayload>(QUEUE_NAMES.NORMALIZATION, defaultQueueOptions);
export const matchingQueue = new Queue<NormalizedProductPayload>(QUEUE_NAMES.MATCHING, defaultQueueOptions);
export const persistenceQueue = new Queue<MatchedProductPayload>(QUEUE_NAMES.PERSISTENCE, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

