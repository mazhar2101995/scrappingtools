import { Router, Request, Response } from 'express';
import { db, scrapingJobs, scrapingJobLogs, sourceWebsites, brands } from '@saas/database';
import { scrapingQueue, getAllQueuesHealth } from '@saas/queue';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';
import crypto from 'crypto';

export const jobsRouter = Router();
jobsRouter.use(authMiddleware);

// 0. List all scraping jobs for tenant organization
jobsRouter.get('/', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;

  try {
    const jobs = await db
      .select({
        id: scrapingJobs.id,
        targetUrl: scrapingJobs.targetUrl,
        jobType: scrapingJobs.jobType,
        status: scrapingJobs.status,
        itemsExtracted: scrapingJobs.itemsExtracted,
        errorMessage: scrapingJobs.errorMessage,
        startedAt: scrapingJobs.startedAt,
        completedAt: scrapingJobs.completedAt,
        createdAt: scrapingJobs.createdAt,
      })
      .from(scrapingJobs)
      .where(organizationId ? eq(scrapingJobs.organizationId, organizationId) : undefined)
      .orderBy(desc(scrapingJobs.createdAt))
      .limit(100);

    return res.json(jobs);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
  }
});

// 1. Submit a Scraping Ingestion Job
jobsRouter.post('/', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const { targetUrl, sourceWebsiteId, brandHint, useBrowser } = req.body;

  if (!targetUrl || !sourceWebsiteId) {
    return res.status(400).json({ error: 'targetUrl and sourceWebsiteId are required' });
  }

  // Verify source website
  const [website] = await db
    .select()
    .from(sourceWebsites)
    .where(eq(sourceWebsites.id, sourceWebsiteId))
    .limit(1);

  if (!website) {
    return res.status(404).json({ error: 'Source website not found' });
  }

  // Create DB tracking row in scraping_jobs
  const [dbJob] = await db
    .insert(scrapingJobs)
    .values({
      organizationId,
      sourceWebsiteId,
      targetUrl,
      jobType: 'single_product',
      status: 'queued',
    })
    .returning();

  // Content-derived idempotency key
  const contentHash = crypto.createHash('sha256').update(targetUrl).digest('hex');
  const queueJobId = `scrape_${contentHash}`;

  // Dispatch into BullMQ product-scraping queue
  const queueJob = await scrapingQueue.add(
    queueJobId,
    {
      dbJobId: dbJob.id,
      organizationId,
      sourceWebsiteId,
      targetUrl,
      domain: website.domain,
      brandNormalized: (brandHint || website.name).toLowerCase().replace(/[^a-z0-9]/g, ''),
      sourceType: website.sourceType,
      useBrowser: Boolean(useBrowser),
    },
    {
      jobId: queueJobId,
    }
  );

  return res.status(202).json({
    message: 'Scraping job queued successfully',
    jobId: dbJob.id,
    queueJobId: queueJob.id,
    status: dbJob.status,
    targetUrl: dbJob.targetUrl,
    createdAt: dbJob.createdAt,
  });
});

// 4. Real-Time Queue Metrics & Health (Defined before /:id parameter)
jobsRouter.get('/monitoring/health', async (req: Request, res: Response) => {
  const health = await getAllQueuesHealth();
  return res.json(health);
});

// Alias for stats
jobsRouter.get('/stats', async (req: Request, res: Response) => {
  const health = await getAllQueuesHealth();
  return res.json(health);
});

// 2. Get Job Status and Logs
jobsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({ error: 'Invalid Job UUID format' });
  }

  const [job] = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, id)).limit(1);
  if (!job) {
    return res.status(404).json({ error: 'Scraping job not found' });
  }

  const logs = await db
    .select()
    .from(scrapingJobLogs)
    .where(eq(scrapingJobLogs.jobId, id))
    .orderBy(desc(scrapingJobLogs.loggedAt))
    .limit(50);

  return res.json({ job, logs });
});

// 3. Retry a Failed Job
jobsRouter.post('/:id/retry', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({ error: 'Invalid Job UUID format' });
  }

  const [job] = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, id)).limit(1);
  if (!job) {
    return res.status(404).json({ error: 'Scraping job not found' });
  }

  // Reset status in DB
  await db.update(scrapingJobs).set({ status: 'queued', errorMessage: null }).where(eq(scrapingJobs.id, id));

  // Fetch source website domain if present
  let website: any = null;
  if (job.sourceWebsiteId) {
    const [w] = await db.select().from(sourceWebsites).where(eq(sourceWebsites.id, job.sourceWebsiteId)).limit(1);
    website = w || null;
  }

  // Re-queue
  const retryQueueId = `scrape_retry_${Date.now()}`;
  await scrapingQueue.add(
    retryQueueId,
    {
      dbJobId: job.id,
      organizationId: job.organizationId || undefined,
      sourceWebsiteId: job.sourceWebsiteId || '00000000-0000-0000-0000-000000000000',
      targetUrl: job.targetUrl,
      domain: website ? website.domain : 'unknown',
      brandNormalized: 'retry-brand',
      sourceType: website ? website.sourceType : 'supplier',
    },
    { jobId: retryQueueId }
  );

  return res.json({ message: 'Job re-queued successfully for execution', jobId: id });
});
