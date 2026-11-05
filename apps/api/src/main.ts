import express, { Request, Response } from 'express';
import cors from 'cors';
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
import { organizationRouter } from './routes/organization.routes';
import { billingRouter } from './routes/billing.routes';
import { feedbackRouter } from './routes/feedback.routes';
import { ServiceHealth } from '@saas/shared-types';

const app = express();

app.use(cors());
app.use(express.json());

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
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/feedback', feedbackRouter);

// 4. Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[Core REST API] Running on http://localhost:${config.port}`);
    console.log(`[OpenAPI Docs] Swagger UI at http://localhost:${config.port}/api/docs`);
  });
}

export default app;
