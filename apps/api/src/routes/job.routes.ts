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

// Helper: Map internal job state and logs to structured client-friendly processing stages
function mapClientProcessingState(job: any, logs: any[] = []) {
  const stageDefinitions = [
    { key: 'SUBMITTED', label: 'Product Request Accepted', internalStatus: ['queued', 'active', 'completed', 'failed'] },
    { key: 'SOURCE_PREPARATION', label: 'Preparing Source & Route Access', internalStatus: ['active', 'completed', 'failed'] },
    { key: 'COLLECTING_DATA', label: 'Collecting Product Data', internalStatus: ['active', 'completed', 'failed'] },
    { key: 'EXTRACTING', label: 'Extracting Specifications & Media', internalStatus: ['active', 'completed', 'failed'] },
    { key: 'AI_RULES', label: 'Processing Global & Brand Rules', internalStatus: ['completed', 'failed'] },
    { key: 'QUALITY_CHECK', label: 'Checking Data Quality & Completeness', internalStatus: ['completed', 'failed'] },
    { key: 'IDENTITY_MATCH', label: 'Checking Product Identity', internalStatus: ['completed', 'failed'] },
    { key: 'SAVED', label: 'Saved to Product Catalog', internalStatus: ['completed'] },
  ];

  let currentStage = 'SUBMITTED';
  let clientMessage = 'Your product request has been accepted and is waiting for processing.';
  let clientStatus: 'waiting' | 'in_progress' | 'completed' | 'failed' = 'waiting';

  if (job.status === 'queued') {
    currentStage = 'SUBMITTED';
    clientStatus = 'waiting';
    clientMessage = 'Your product request is queued and will begin processing shortly.';
  } else if (job.status === 'active' || job.status === 'running') {
    clientStatus = 'in_progress';
    currentStage = 'COLLECTING_DATA';
    clientMessage = 'Acquiring source HTML and extracting product attributes.';
  } else if (job.status === 'completed') {
    currentStage = 'SAVED';
    clientStatus = 'completed';
    clientMessage = `Product successfully extracted (${job.itemsExtracted || 1} attributes identified) and saved.`;
  } else if (job.status === 'failed') {
    clientStatus = 'failed';
    // Translate technical error into client-safe message
    const err = job.errorMessage || '';
    if (err.includes('404') || err.includes('NOT_FOUND')) {
      clientMessage = 'This product page could not be found on the target website. Please verify the URL.';
    } else if (err.includes('429') || err.includes('cooldown') || err.includes('traffic')) {
      clientMessage = 'The target website is receiving heavy traffic. Processing will be retried automatically.';
    } else if (err.includes('timeout') || err.includes('TIMEOUT')) {
      clientMessage = 'The target store took too long to respond. The request is eligible for retry.';
    } else if (err.includes('extraction') || err.includes('EXTRACTION')) {
      clientMessage = 'The product page was reached, but required product details could not be parsed.';
    } else {
      clientMessage = 'Product processing could not be completed. You can try again or check the URL.';
    }
  }

  // Calculate stage progress
  const stages = stageDefinitions.map((s, idx) => {
    let status: 'completed' | 'current' | 'pending' | 'failed' = 'pending';
    if (job.status === 'completed') {
      status = 'completed';
    } else if (job.status === 'failed') {
      if (s.key === currentStage) status = 'failed';
      else if (idx < 2) status = 'completed';
      else status = 'pending';
    } else if (job.status === 'active' || job.status === 'running') {
      if (idx <= 2) status = 'completed';
      else if (idx === 3) status = 'current';
      else status = 'pending';
    } else {
      // queued
      if (idx === 0) status = 'current';
      else status = 'pending';
    }

    return {
      key: s.key,
      label: s.label,
      status,
    };
  });

  return {
    jobId: job.id,
    targetUrl: job.targetUrl,
    clientStatus,
    currentStage,
    clientMessage,
    itemsExtracted: job.itemsExtracted,
    stages,
    timing: {
      submittedAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
    canRetry: job.status === 'failed',
  };
}

// 2. Get Job Status and Logs (with Client Transparency Enrichment)
jobsRouter.get('/:id', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(req.user?.role || '');
  const id = req.params.id as string;
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({ error: 'Invalid Job UUID format' });
  }

  const [job] = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, id)).limit(1);
  if (!job) {
    return res.status(404).json({ error: 'Scraping job not found' });
  }

  // Strict Multi-Tenant Isolation: Tenant users can ONLY view their own jobs
  if (!isPlatformAdmin && job.organizationId && organizationId && job.organizationId !== organizationId) {
    return res.status(403).json({ error: 'Access denied: You cannot view another organization’s job' });
  }

  const logs = await db
    .select()
    .from(scrapingJobLogs)
    .where(eq(scrapingJobLogs.jobId, id))
    .orderBy(desc(scrapingJobLogs.loggedAt))
    .limit(50);

  const clientTransparency = mapClientProcessingState(job, logs);

  return res.json({ job, logs, clientTransparency });
});

// 3. Retry a Failed Job
jobsRouter.post('/:id/retry', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(req.user?.role || '');
  const id = req.params.id as string;
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({ error: 'Invalid Job UUID format' });
  }

  const [job] = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, id)).limit(1);
  if (!job) {
    return res.status(404).json({ error: 'Scraping job not found' });
  }

  // Strict Multi-Tenant Isolation: Tenant users can ONLY retry their own jobs
  if (!isPlatformAdmin && job.organizationId && organizationId && job.organizationId !== organizationId) {
    return res.status(403).json({ error: 'Access denied: You cannot retry another organization’s job' });
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
