import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { openApiSpec } from './docs/openapi';
import { authRouter, keysRouter } from './routes/auth.routes';
import { productsRouter } from './routes/product.routes';
import { catalogRouter } from './routes/catalog.routes';
import { jobsRouter } from './routes/job.routes';
import { brandsRouter } from './routes/brand.routes';
import { storeRouter } from './routes/store.routes';
import { metricsRouter } from './routes/metrics.routes';
import { aiRouter } from './routes/ai.routes';
import { reviewRouter } from './routes/review.routes';
import { integrationsRouter } from './routes/integration.routes';
import { organizationRouter } from './routes/organization.routes';
import { billingRouter } from './routes/billing.routes';
import { feedbackRouter } from './routes/feedback.routes';
import { storageRouter } from './routes/storage.routes';
import { scheduleRouter } from './routes/schedule.routes';
import { notificationRouter } from './routes/notification.routes';
import { aiTrainingRouter } from './routes/ai-training.routes';
import { pricingRouter } from './routes/pricing.routes';
import { proxyRouter } from './routes/proxy.routes';
import { ServiceHealth } from '@saas/shared-types';

const app = express();

app.use(cors());
app.use(express.json());

// Static uploads directory for deduplicated product media
app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

// 1. Swagger UI OpenAPI Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/api/docs.json', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

// 2. Health & Root Endpoints
app.get('/health', (req: Request, res: Response) => {
  const healthData: ServiceHealth = {
    service: 'saas-api-backend',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(healthData);
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'AI Product Intelligence Core REST API',
    documentation: '/api/docs',
    health: '/health',
    version: '1.0.0',
  });
});

// 3. Mount API v1 Modular Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/keys', keysRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/brands', brandsRouter);
app.use('/api/v1/stores', storeRouter);
app.use('/api/v1/metrics', metricsRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/review', reviewRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/feedback', feedbackRouter);
app.use('/api/v1/storage', storageRouter);
app.use('/api/v1/schedules', scheduleRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/ai-training', aiTrainingRouter);
app.use('/api/v1/pricing', pricingRouter);
app.use('/api/v1/proxies', proxyRouter);

// 4. Start Server & Background Storage Garbage Collection Worker
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[Core REST API] Running on http://localhost:${config.port}`);
    console.log(`[OpenAPI Docs] Swagger UI at http://localhost:${config.port}/api/docs`);
  });

  // Automated Safe Garbage Collection cron (runs every 6 hours)
  const GC_INTERVAL_MS = 6 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const { GarbageCollectionService } = await import('./services/garbage-collection.service');
      const settings = await GarbageCollectionService.getSettings();
      if (settings.autoGcEnabled) {
        console.log('[Scheduled GC] Running background storage garbage collection...');
        const result = await GarbageCollectionService.executeGarbageCollection('automatic');
        console.log(`[Scheduled GC] Completed. Reclaimed ${result.bytesReclaimed} bytes, pruned ${result.dbRecordsPruned} records.`);
      }
    } catch (gcErr) {
      console.error('[Scheduled GC] Error during automated execution:', gcErr);
    }
  }, GC_INTERVAL_MS);

  // Background Schedule Engine Runner (checks every 60 seconds)
  const SCHEDULE_INTERVAL_MS = 60 * 1000;
  setInterval(async () => {
    try {
      const { BackgroundSyncSchedulerService } = await import('./services/background-sync-scheduler.service');
      await BackgroundSyncSchedulerService.processDueSchedules();
    } catch (schedErr) {
      console.error('[SyncScheduler Runner] Error checking due schedules:', schedErr);
    }
  }, SCHEDULE_INTERVAL_MS);
}

export default app;
