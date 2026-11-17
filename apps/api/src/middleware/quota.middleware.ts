import { Request, Response, NextFunction } from 'express';
import { EntitlementService } from '../services/entitlement.service';

/**
 * Maps legacy shorthand identifiers to dynamic service codes
 */
const FEATURE_SERVICE_MAP: Record<string, string> = {
  product: 'product_scraping',
  store: 'store_integration',
  ai: 'ai_intelligence',
  image: 'image_processing',
  brand: 'brand_profiles',
  schedule: 'automated_sync',
  competitor: 'competitor_spy',
  supplier: 'supplier_feed_sync',
};

/**
 * Dynamic Quota & Entitlement Middleware:
 * Authoritatively verifies global service status, plan entitlement, and usage limits against PostgreSQL
 */
export function quotaMiddleware(serviceOrFeature: string, requestedUnits: number = 1) {
  const serviceCode = FEATURE_SERVICE_MAP[serviceOrFeature] || serviceOrFeature;

  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = (req as any).user?.organizationId || (req.headers['x-organization-id'] as string);
    const userRole = (req as any).user?.role || 'viewer';
    const isSuperadmin = Boolean((req as any).user?.isSuperadmin || userRole === 'super_admin');

    // Platform Super Admins bypass quotas
    if (isSuperadmin) {
      return next();
    }

    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context required for quota check' });
    }

    try {
      const check = await EntitlementService.checkServiceEntitlement(orgId, serviceCode, requestedUnits);

      if (!check.allowed) {
        return res.status(check.statusCode || 403).json({
          error: check.reason,
          code: 'PLAN_QUOTA_EXCEEDED',
          serviceCode,
          serviceName: check.serviceName,
          planId: check.planId,
          planName: check.planName,
          current: check.currentUsage,
          limit: check.usageLimit,
          remaining: check.remaining,
          isUnlimited: check.isUnlimited,
          upgradeUrl: '/settings/billing',
        });
      }

      // Attach entitlement check info to request for downstream handlers
      (req as any).entitlement = check;
      next();
    } catch (err: any) {
      console.error(`[QuotaMiddleware] Check failed for service '${serviceCode}':`, err);
      next(); // Don't crash requests on unexpected internal error
    }
  };
}

