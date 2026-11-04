import { Router, Request, Response } from 'express';
import {
  db,
  organizations,
  organizationMemberships,
  users,
  connectedStores,
} from '@saas/database';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const organizationRouter = Router();

organizationRouter.use(authMiddleware);

// GET /api/v1/organizations - List organizations with member and store counts (Platform Admin only)
organizationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Platform admin permission required' });
    }

    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        planTier: organizations.planTier,
        isActive: organizations.isActive,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt));

    return res.json({ success: true, count: orgs.length, data: orgs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
