import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { NotificationAndWebhookService } from '../services/notification-and-webhook.service';

export const notificationRouter = Router();

notificationRouter.use(authMiddleware);

/**
 * GET /api/v1/notifications
 * List tenant notifications
 */
notificationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const notifications = await NotificationAndWebhookService.listNotifications(organizationId);
    return res.json({ success: true, notifications });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a notification as read
 */
notificationRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const updated = await NotificationAndWebhookService.markAsRead(id, organizationId);
    return res.json({ success: true, notification: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
  }
});

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
notificationRouter.post('/read-all', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    await NotificationAndWebhookService.markAllAsRead(organizationId);
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark all notifications as read', details: err.message });
  }
});
