import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { BackgroundSyncSchedulerService } from '../services/background-sync-scheduler.service';

export const scheduleRouter = Router();

// Require authenticated user for all schedule routes
scheduleRouter.use(authMiddleware);

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
scheduleRouter.post('/', async (req: Request, res: Response) => {
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
scheduleRouter.post('/:id/run-now', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await BackgroundSyncSchedulerService.executeScheduleNow(id, organizationId);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute schedule', details: err.message });
  }
});

