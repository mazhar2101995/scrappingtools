import { Request, Response, NextFunction } from 'express';
import { db, organizations, customerProductMappings, connectedStores, subscriptions } from '@saas/database';
import { eq, sql } from 'drizzle-orm';
import { SAAS_PLANS } from '../routes/billing.routes';

export async function quotaMiddleware(feature: 'product' | 'store' | 'ai') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = (req as any).user?.organizationId || (req.headers['x-organization-id'] as string);
    const userRole = (req as any).user?.role || 'viewer';

    // Platform Super Admins bypass quotas
    if (['super_admin', 'platform_admin'].includes(userRole)) {
      return next();
    }

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context required for quota check' });
    }

    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const planTier = org?.planTier || 'starter';
      const planConfig = SAAS_PLANS[planTier] || SAAS_PLANS.starter;

      if (feature === 'product') {
        const [prodCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(customerProductMappings)
          .where(eq(customerProductMappings.organizationId, orgId));

        const currentCount = prodCount?.count || 0;
        if (currentCount >= planConfig.productLimit) {
          return res.status(403).json({
            error: 'Quota Exceeded: Product Catalog Limit Reached',
            message: `Your current ${planConfig.name} allows a maximum of ${planConfig.productLimit} products. Please upgrade to continue scraping or creating products.`,
            upgradeUrl: '/settings/billing',
            current: currentCount,
            limit: planConfig.productLimit,
          });
        }
      }

      if (feature === 'store') {
        const [storeCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(connectedStores)
          .where(eq(connectedStores.organizationId, orgId));

        const currentCount = storeCount?.count || 0;
        if (currentCount >= planConfig.storeLimit) {
          return res.status(403).json({
            error: 'Quota Exceeded: Store Limit Reached',
            message: `Your current ${planConfig.name} allows a maximum of ${planConfig.storeLimit} connected store(s). Please upgrade to connect additional stores.`,
            upgradeUrl: '/settings/billing',
            current: currentCount,
            limit: planConfig.storeLimit,
          });
        }
      }

      next();
    } catch (err: any) {
      console.error('Quota check failed:', err);
      next(); // Don't block requests if quota check has an internal error
    }
  };
}
