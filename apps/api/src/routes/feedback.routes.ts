import { Router, Request, Response } from 'express';
import { db, communityFeedback } from '@saas/database';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const feedbackRouter = Router();
feedbackRouter.use(authMiddleware);

// 1. Submit community feedback (Tester scoped)
feedbackRouter.post('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const {
    type = 'bug_report',
    title,
    description,
    pageUrl,
    errorReferenceId,
    browserInfo,
    metadata = {},
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const [entry] = await db
      .insert(communityFeedback)
      .values({
        organizationId: user?.organizationId || null,
        userId: user?.userId || null,
        userEmail: user?.email || null,
        type,
        title: title.trim(),
        description: description.trim(),
        pageUrl: pageUrl || null,
        errorReferenceId: errorReferenceId || null,
        browserInfo: browserInfo || null,
        metadata,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. Thank you for helping harden the platform!',
      feedbackId: entry.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record feedback', details: err.message });
  }
});

// 2. List feedback (Platform Admin only or current tenant's submissions)
feedbackRouter.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(user?.role);

  try {
    const query = db
      .select()
      .from(communityFeedback);

    const list = isPlatformAdmin
      ? await query.orderBy(desc(communityFeedback.createdAt)).limit(100)
      : await query.where(eq(communityFeedback.organizationId, user?.organizationId)).orderBy(desc(communityFeedback.createdAt)).limit(50);

    return res.json({
      success: true,
      count: list.length,
      feedback: list,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list feedback', details: err.message });
  }
});
