import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth.middleware';
import { GarbageCollectionService } from '../services/garbage-collection.service';
import { createRedisConnection } from '@saas/queue';

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
