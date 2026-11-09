import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth.middleware';
import { GarbageCollectionService } from '../services/garbage-collection.service';
import { SourceHealthService } from '../services/source-health.service';
import { BrowserIsolationManager } from '../services/browser-isolation.service';
import { NetworkRouteManager } from '../services/network-route-manager.service';
import { createRedisConnection, getQueueMetrics, scrapingQueue, browserScrapingQueue } from '@saas/queue';

export const storageRouter = Router();

// Protect all storage management endpoints for Super Admin / Admin
storageRouter.use(authMiddleware);
storageRouter.use(adminOnlyMiddleware);

/**
 * GET /api/v1/storage/telemetry
 * Real-time storage telemetry, live disk usage, deduplication stats, and table sizes
 */
storageRouter.get('/telemetry', async (req: Request, res: Response) => {
  try {
    const telemetry = await GarbageCollectionService.getStorageTelemetry();

    // Query live Redis info
    let redisInfo: any = {
      status: 'connected',
      usedMemoryBytes: 0,
      usedMemoryHuman: '1.05M',
      connectedClients: 1,
      totalKeys: 4,
    };

    try {
      const redis = createRedisConnection();
      const rawInfo = await redis.info('memory');
      const memoryMatch = rawInfo.match(/used_memory:(\d+)/);
      const memoryHumanMatch = rawInfo.match(/used_memory_human:(.+)/);
      if (memoryMatch) redisInfo.usedMemoryBytes = parseInt(memoryMatch[1]);
      if (memoryHumanMatch) redisInfo.usedMemoryHuman = memoryHumanMatch[1].trim();
      const keys = await redis.keys('*');
      redisInfo.totalKeys = keys.length;
      await redis.quit();
    } catch (rErr: any) {
      redisInfo.status = 'error';
      redisInfo.error = rErr.message;
    }

    return res.json({
      success: true,
      data: {
        ...telemetry,
        redis: redisInfo,
      },
    });
  } catch (err: any) {
    console.error('[StorageRouter] Telemetry Error:', err);
    return res.status(500).json({ error: 'Failed to fetch storage telemetry', details: err.message });
  }
});

/**
 * GET /api/v1/storage/settings
 * Fetch configurable retention & GC settings
 */
storageRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await GarbageCollectionService.getSettings();
    return res.json({ success: true, data: settings });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
  }
});

/**
 * PUT /api/v1/storage/settings
 * Update platform storage retention rules
 */
storageRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const updated = await GarbageCollectionService.updateSettings(req.body);
    return res.json({ success: true, data: updated, message: 'Storage retention rules updated' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update settings', details: err.message });
  }
});

/**
 * POST /api/v1/storage/gc/trigger
 * Manually trigger garbage collection and orphan cleanup
 */
storageRouter.post('/gc/trigger', async (req: Request, res: Response) => {
  try {
    const report = await GarbageCollectionService.executeGarbageCollection('manual');
    return res.json({
      success: true,
      data: report,
      message: `Garbage collection completed. Reclaimed ${report.bytesReclaimed} bytes across ${report.filesDeleted} files and pruned ${report.dbRecordsPruned} stale records.`,
    });
  } catch (err: any) {
    console.error('[StorageRouter] Trigger GC Error:', err);
    return res.status(500).json({ error: 'Garbage collection failed', details: err.message });
  }
});

/**
 * GET /api/v1/storage/source-health
 * List source domain health intelligence and operational status for platform admins
 */
storageRouter.get('/source-health', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const domains = await SourceHealthService.listMonitoredDomains(limit);
    return res.json({ success: true, data: domains });
  } catch (err: any) {
    console.error('[StorageRouter] Source Health Error:', err);
    return res.status(500).json({ error: 'Failed to fetch source health', details: err.message });
  }
});

/**
 * GET /api/v1/storage/source-health/:domain
 * Detailed health report and recent incident history for a specific domain
 */
storageRouter.get('/source-health/:domain', async (req: Request, res: Response) => {
  try {
    const domain = Array.isArray(req.params.domain) ? req.params.domain[0] : req.params.domain;
    const health = await SourceHealthService.getDomainHealth(domain);
    if (!health) {
      return res.status(404).json({ error: `No operational health records found for domain '${domain}'` });
    }
    const incidents = await SourceHealthService.getRecentIncidents(domain);
    return res.json({ success: true, data: { ...health, incidents } });
  } catch (err: any) {
    console.error('[StorageRouter] Domain Health Error:', err);
    return res.status(500).json({ error: 'Failed to fetch domain health', details: err.message });
  }
});

/**
 * GET /api/v1/storage/browser-metrics
 * Real-time browser isolation, active slots, queue backlog, and memory observability for Platform Admin
 */
storageRouter.get('/browser-metrics', async (req: Request, res: Response) => {
  try {
    const operational = BrowserIsolationManager.getOperationalMetrics();
    const config = BrowserIsolationManager.getConfig();

    // Query BullMQ queue depths
    let lightweightQueueMetrics = null;
    let browserQueueMetrics = null;

    try {
      lightweightQueueMetrics = await getQueueMetrics(scrapingQueue);
      browserQueueMetrics = await getQueueMetrics(browserScrapingQueue);
    } catch (_) {}

    return res.json({
      success: true,
      data: {
        config,
        operational,
        queues: {
          lightweight: lightweightQueueMetrics,
          browser: browserQueueMetrics,
        },
      },
    });
  } catch (err: any) {
    console.error('[StorageRouter] Browser Metrics Error:', err);
    return res.status(500).json({ error: 'Failed to fetch browser metrics', details: err.message });
  }
});

/**
 * POST /api/v1/storage/browser-config
 * Update browser isolation limits dynamically (admin only)
 */
storageRouter.post('/browser-config', async (req: Request, res: Response) => {
  try {
    const { maxConcurrentBrowsers, navigationTimeoutMs, totalJobTimeoutMs, maxPerTenantConcurrent } = req.body;
    BrowserIsolationManager.configure({
      ...(maxConcurrentBrowsers ? { maxConcurrentBrowsers: parseInt(maxConcurrentBrowsers) } : {}),
      ...(navigationTimeoutMs ? { navigationTimeoutMs: parseInt(navigationTimeoutMs) } : {}),
      ...(totalJobTimeoutMs ? { totalJobTimeoutMs: parseInt(totalJobTimeoutMs) } : {}),
      ...(maxPerTenantConcurrent ? { maxPerTenantConcurrent: parseInt(maxPerTenantConcurrent) } : {}),
    });

    return res.json({
      success: true,
      data: BrowserIsolationManager.getConfig(),
      message: 'Browser isolation configuration updated successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update browser configuration', details: err.message });
  }
});

/**
 * GET /api/v1/storage/network-routes
 * List all network routes, real operational health metrics, and active concurrency for Platform Admin
 */
storageRouter.get('/network-routes', async (req: Request, res: Response) => {
  try {
    const routes = await NetworkRouteManager.listRoutesTelemetry();
    return res.json({ success: true, data: routes });
  } catch (err: any) {
    console.error('[StorageRouter] Network Routes Error:', err);
    return res.status(500).json({ error: 'Failed to fetch network routes', details: err.message });
  }
});

/**
 * GET /api/v1/storage/network-routes/:routeId/incidents
 * Get recent operational incidents for a specific route
 */
storageRouter.get('/network-routes/:routeId/incidents', async (req: Request, res: Response) => {
  try {
    const routeId = Array.isArray(req.params.routeId) ? req.params.routeId[0] : req.params.routeId;
    const incidents = await NetworkRouteManager.getRecentRouteIncidents(routeId);
    return res.json({ success: true, data: incidents });
  } catch (err: any) {
    console.error('[StorageRouter] Route Incidents Error:', err);
    return res.status(500).json({ error: 'Failed to fetch route incidents', details: err.message });
  }
});
