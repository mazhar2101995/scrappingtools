import { Router, Request, Response } from 'express';
import {
  db,
  identityReviewQueue,
  sourceProductListings,
  globalProducts,
  users,
} from '@saas/database';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const reviewRouter = Router();

reviewRouter.use(authMiddleware);

// GET /api/v1/review/queue - List ambiguous matches in the Human Review Queue
reviewRouter.get('/queue', async (req: Request, res: Response) => {
  try {
    const queue = await db
      .select({
        id: identityReviewQueue.id,
        sourceProductListingId: identityReviewQueue.sourceProductListingId,
        suggestedGlobalProductId: identityReviewQueue.suggestedGlobalProductId,
        matchConfidence: identityReviewQueue.matchConfidence,
        matchReasons: identityReviewQueue.matchReasons,
        resolutionStatus: identityReviewQueue.resolutionStatus,
        createdAt: identityReviewQueue.createdAt,
        listingTitle: sourceProductListings.rawTitle,
        listingUrl: sourceProductListings.sourceUrl,
        suggestedTitle: globalProducts.canonicalTitle,
      })
      .from(identityReviewQueue)
      .leftJoin(sourceProductListings, eq(sourceProductListings.id, identityReviewQueue.sourceProductListingId))
      .leftJoin(globalProducts, eq(globalProducts.id, identityReviewQueue.suggestedGlobalProductId))
      .orderBy(desc(identityReviewQueue.createdAt))
      .limit(50);

    return res.json({ success: true, count: queue.length, data: queue });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/review/queue/:id/resolve - Resolve human review decision
reviewRouter.post('/queue/:id/resolve', async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id as string;
    const { action } = req.body; // 'APPROVE_MERGE', 'REJECT_MERGE', 'CREATE_SEPARATE'

    if (!['APPROVE_MERGE', 'REJECT_MERGE', 'CREATE_SEPARATE'].includes(action)) {
      return res.status(400).json({ error: 'Valid action required (APPROVE_MERGE, REJECT_MERGE, CREATE_SEPARATE)' });
    }

    const userId = (req as any).user?.id || null;

    const [updated] = await db
      .update(identityReviewQueue)
      .set({
        resolutionStatus: action.toLowerCase(),
        resolvedByUserId: userId,
        resolvedAt: new Date(),
      })
      .where(eq(identityReviewQueue.id, reviewId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Review queue item not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
