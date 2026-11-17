import { Router, Request, Response } from 'express';
import { authMiddleware, superAdminOnlyMiddleware } from '../middleware/auth.middleware';
import { quotaMiddleware } from '../middleware/quota.middleware';
import { EntitlementService } from '../services/entitlement.service';
import { BackgroundSyncSchedulerService } from '../services/background-sync-scheduler.service';
import { CronScheduler } from '../workers/cron-scheduler';
import { getQueueMetrics, storeSyncQueue } from '@saas/queue';

export const scheduleRouter = Router();

// Require authenticated user for all schedule routes
scheduleRouter.use(authMiddleware);

/**
 * GET /api/v1/schedules/system/status
 * Platform-wide background cron scheduler observability (Super Admin only)
 */
scheduleRouter.get('/system/status', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const scheduler = CronScheduler.getInstance();
    const runnerStatus = scheduler.getStatus();
    const dbMetrics = await BackgroundSyncSchedulerService.getSchedulerMetrics();

    let queueMetrics = null;
    try {
      queueMetrics = await getQueueMetrics(storeSyncQueue);
    } catch (_) {}

    return res.json({
      success: true,
      scheduler: runnerStatus,
      metrics: dbMetrics,
      queue: queueMetrics,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch scheduler status', details: err.message });
  }
});

/**
 * POST /api/v1/schedules/system/trigger-scan
 * Trigger an immediate on-demand scheduler scan cycle (Super Admin only)
 */
scheduleRouter.post('/system/trigger-scan', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const scheduler = CronScheduler.getInstance();
    const result = await scheduler.executeScanCycle();
    return res.json({
      success: true,
      message: result.executed ? 'Scheduler scan cycle completed' : `Scan cycle skipped: ${result.reason}`,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to trigger scheduler scan', details: err.message });
  }
});

/**
 * GET /api/v1/schedules
 * List all automated sync schedules for the user's organization
 */
scheduleRouter.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const schedules = await BackgroundSyncSchedulerService.listSchedules(organizationId);
    return res.json({ success: true, schedules });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch schedules', details: err.message });
  }
});

/**
 * POST /api/v1/schedules
 * Create a new automated sync schedule
 */
scheduleRouter.post('/', quotaMiddleware('automated_sync'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const { name, frequency, storeId, brandId, targetLanguage, autoTranslate, scheduleType } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Schedule name is required.' });
    }
    if (!frequency) {
      return res.status(400).json({ error: 'Frequency is required.' });
    }

    const created = await BackgroundSyncSchedulerService.createSchedule({
      organizationId,
      name: name.trim(),
      frequency,
      storeId: storeId || undefined,
      brandId: brandId || undefined,
      targetLanguage: targetLanguage || 'en',
      autoTranslate: autoTranslate ?? true,
      scheduleType: scheduleType || 'STORE_PUSH',
    });

    await EntitlementService.recordUsage(organizationId, 'automated_sync', 1).catch(() => {});

    return res.status(201).json({ success: true, schedule: created });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create schedule', details: err.message });
  }
});

/**
 * PATCH /api/v1/schedules/:id
 * Update schedule status, frequency, name, etc.
 */
scheduleRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, frequency, status, targetLanguage } = req.body;

    const updated = await BackgroundSyncSchedulerService.updateSchedule(id, organizationId, {
      name,
      frequency,
      status,
      targetLanguage,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    return res.json({ success: true, schedule: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update schedule', details: err.message });
  }
});

/**
 * DELETE /api/v1/schedules/:id
 * Remove an automated schedule
 */
scheduleRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const deleted = await BackgroundSyncSchedulerService.deleteSchedule(id, organizationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    return res.json({ success: true, message: 'Schedule deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete schedule', details: err.message });
  }
});

/**
 * POST /api/v1/schedules/:id/run-now
 * Manually trigger immediate execution of a schedule
 */
scheduleRouter.post('/:id/run-now', quotaMiddleware('automated_sync'), async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await BackgroundSyncSchedulerService.executeScheduleNow(id, organizationId);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute schedule', details: err.message });
  }
});

