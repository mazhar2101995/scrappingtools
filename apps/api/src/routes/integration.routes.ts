import { Router, Request, Response } from 'express';
import { integrationAuthMiddleware, requireScope } from '../middleware/integration-auth.middleware';
import { IntegrationService } from '../services/integration.service';
import { db, webhookSubscriptions, webhookEvents, apiKeys } from '@saas/database';
import { eq, desc, and } from 'drizzle-orm';

export const integrationsRouter = Router();

// Apply Integration Authentication & Rate Limiting to all routes
integrationsRouter.use(integrationAuthMiddleware);

/**
 * GET /api/v1/integrations/products/lookup
 * Scope: products:read
 * Real-time canonical product lookup by ID, GTIN, EAN, UPC, MPN, SKU, or Model Number.
 */
integrationsRouter.get('/products/lookup', requireScope('products:read'), async (req: Request, res: Response) => {
  const identifier = (req.query.identifier as string) || (req.query.id as string);
  const type = req.query.type as string | undefined;
  const organizationId = req.integration!.organizationId;

  if (!identifier) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "identifier" is required for product lookup.',
      code: 'MISSING_LOOKUP_IDENTIFIER',
    });
  }

  try {
    const result = await IntegrationService.lookupProduct({
      identifier,
      type,
      organizationId,
    });

    const httpCode = result.status === 'NOT_FOUND' ? 404 : 200;
    return res.status(httpCode).json(result);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Product lookup failed',
      details: err.message,
    });
  }
});

/**
 * POST /api/v1/integrations/products/discover
 * Scope: products:discover
 * Asynchronously discover product information across sources and queue extraction.
 */
integrationsRouter.post('/products/discover', requireScope('products:discover'), async (req: Request, res: Response) => {
  const { identifier, url, brandHint, webhookUrl } = req.body;
  const target = identifier || url;
  const organizationId = req.integration!.organizationId;

  if (!target) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Either "identifier" or "url" must be provided in request body.',
      code: 'MISSING_DISCOVERY_TARGET',
    });
  }

  try {
    const response = await IntegrationService.requestDiscovery({
      identifierOrUrl: target,
      brandHint,
      organizationId,
      webhookUrl,
    });

    return res.status(202).json(response);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Discovery request failed',
      details: err.message,
    });
  }
});

/**
 * GET /api/v1/integrations/jobs/:jobId
 * Scope: products:discover
 * Get status of an asynchronous discovery job (BullMQ queue abstraction).
 */
integrationsRouter.get('/jobs/:jobId', requireScope('products:discover'), async (req: Request, res: Response) => {
  const jobId = req.params.jobId as string;
  const organizationId = req.integration!.organizationId;

  try {
    const jobStatus = await IntegrationService.getJobStatus(jobId, organizationId);

    if (!jobStatus) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Job '${jobId}' not found or does not belong to your organization.`,
        code: 'JOB_NOT_FOUND',
      });
    }

    return res.json(jobStatus);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to retrieve job status',
      details: err.message,
    });
  }
});

/**
 * POST /api/v1/integrations/webhooks/subscriptions
 * Scope: products:write
 * Register a webhook endpoint for asynchronous product lifecycle events.
 */
integrationsRouter.post('/webhooks/subscriptions', requireScope('products:write'), async (req: Request, res: Response) => {
  const { targetUrl, events } = req.body;
  const organizationId = req.integration!.organizationId;

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Valid "targetUrl" (http/https) is required.',
      code: 'INVALID_WEBHOOK_URL',
    });
  }

  try {
    const subscription = await IntegrationService.registerWebhook({
      organizationId,
      targetUrl,
      events: Array.isArray(events) ? events : ['*'],
    });

    return res.status(201).json({
      success: true,
      message: 'Webhook subscription created successfully. Keep your secret secure.',
      subscription,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to register webhook subscription',
      details: err.message,
    });
  }
});

/**
 * GET /api/v1/integrations/webhooks/subscriptions
 * Scope: products:read
 * List registered webhook subscriptions for the calling tenant.
 */
integrationsRouter.get('/webhooks/subscriptions', requireScope('products:read'), async (req: Request, res: Response) => {
  const organizationId = req.integration!.organizationId;

  try {
    const subs = await db
      .select({
        id: webhookSubscriptions.id,
        targetUrl: webhookSubscriptions.targetUrl,
        events: webhookSubscriptions.events,
        isActive: webhookSubscriptions.isActive,
        createdAt: webhookSubscriptions.createdAt,
      })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.organizationId, organizationId))
      .orderBy(desc(webhookSubscriptions.createdAt));

    return res.json({ subscriptions: subs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list webhook subscriptions', details: err.message });
  }
});

/**
 * POST /api/v1/integrations/webhooks/test-dispatch
 * Scope: products:write
 * Send a mock/test event through the real webhook pipeline.
 */
integrationsRouter.post('/webhooks/test-dispatch', requireScope('products:write'), async (req: Request, res: Response) => {
  const { eventType, payload } = req.body;
  const organizationId = req.integration!.organizationId;

  try {
    const dispatchResult = await IntegrationService.dispatchWebhookEvent({
      organizationId,
      eventType: eventType || 'product.test',
      payload: payload || { test: true, timestamp: new Date().toISOString() },
    });

    return res.json({
      success: true,
      result: dispatchResult,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to dispatch webhook event', details: err.message });
  }
});
