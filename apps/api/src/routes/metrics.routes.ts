import { Router, Request, Response } from 'express';
import {
  db,
  globalProducts,
  brands,
  organizations,
  connectedStores,
  scrapingJobs,
  sourceWebsites,
  users,
} from '@saas/database';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const metricsRouter = Router();

// Apply auth middleware
metricsRouter.use(authMiddleware);

// GET /api/v1/metrics/overview - Live aggregated metrics (Admin vs Client tenant-scoped)
metricsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    const orgId = (req as any).user?.organizationId || (req as any).apiKey?.organizationId;
    const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(userRole);

    // 1. Live count of global products
    const [prodCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalProducts);

    // 2. Live count of brands
    const [brandCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brands);

    // 3. Live count of source websites
    const [sourceCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sourceWebsites);

    // 4. Connected stores count (Org scoped if client)
    const storeQuery = db.select({ count: sql<number>`count(*)::int` }).from(connectedStores);
    if (!isPlatformAdmin && orgId) {
      storeQuery.where(eq(connectedStores.organizationId, orgId));
    }
    const [storeCount] = await storeQuery;

    // 5. Scraping jobs count (Org scoped if client)
    const jobQuery = db.select({ count: sql<number>`count(*)::int` }).from(scrapingJobs);
    if (!isPlatformAdmin && orgId) {
      jobQuery.where(eq(scrapingJobs.organizationId, orgId));
    }
    const [jobCount] = await jobQuery;

    // 6. Active jobs
    const activeConditions = [eq(scrapingJobs.status, 'active')];
    if (!isPlatformAdmin && orgId) {
      activeConditions.push(eq(scrapingJobs.organizationId, orgId));
    }
    const [activeJobCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scrapingJobs)
      .where(and(...activeConditions));

    // 7. Organizations and Users count (Admin only)
    let totalOrganizations = 1;
    let totalUsers = 1;
    if (isPlatformAdmin) {
      const [orgs] = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);
      const [usr] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      totalOrganizations = orgs.count;
      totalUsers = usr.count;
    }

    return res.json({
      success: true,
      data: {
        isPlatformAdmin,
        totalProducts: prodCount.count,
        totalBrands: brandCount.count,
        totalSources: sourceCount.count,
        connectedStores: storeCount.count,
        totalJobs: jobCount.count,
        activeJobs: activeJobCount.count,
        totalOrganizations,
        totalUsers,
        systemHealth: 'healthy',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
