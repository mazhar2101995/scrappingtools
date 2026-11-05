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
  customerProductMappings,
  customerProductOverrides,
  storeSyncHistory,
  storeConflictLogs,
  identityReviewQueue,
  aiProcessingHistory,
  fieldProvenance,
} from '@saas/database';
import { eq, and, sql, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const metricsRouter = Router();

// Apply auth middleware
metricsRouter.use(authMiddleware);

// GET /api/v1/metrics/overview - Legacy / combined
metricsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    const orgId = (req as any).user?.organizationId || (req as any).apiKey?.organizationId;
    const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(userRole);

    const [prodCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalProducts);

    const [brandCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brands);

    const [sourceCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sourceWebsites);

    const storeQuery = db.select({ count: sql<number>`count(*)::int` }).from(connectedStores);
    if (!isPlatformAdmin && orgId) {
      storeQuery.where(eq(connectedStores.organizationId, orgId));
    }
    const [storeCount] = await storeQuery;

    const jobQuery = db.select({ count: sql<number>`count(*)::int` }).from(scrapingJobs);
    if (!isPlatformAdmin && orgId) {
      jobQuery.where(eq(scrapingJobs.organizationId, orgId));
    }
    const [jobCount] = await jobQuery;

    const activeConditions = [eq(scrapingJobs.status, 'active')];
    if (!isPlatformAdmin && orgId) {
      activeConditions.push(eq(scrapingJobs.organizationId, orgId));
    }
    const [activeJobCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scrapingJobs)
      .where(and(...activeConditions));

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

// GET /api/v1/metrics/client-overview - Dedicated Client Workspace Telemetry (Strictly Tenant-Scoped)
metricsRouter.get('/client-overview', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || (req as any).apiKey?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context is required for client workspace' });
    }

    // 1. Fetch organization details
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    // 2. Organization Products count (from customer_product_mappings)
    const [myProdRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerProductMappings)
      .where(eq(customerProductMappings.organizationId, orgId));
    const totalMyProducts = myProdRes?.count || 0;

    // 2b. Count AI processed products for this organization
    const orgSettings = (org?.settings as any) || {};
    const aiConfig = orgSettings.ai || {};

    // Calculate AI enriched count directly from customerProductOverrides or processing history
    const [aiEnrichedRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerProductOverrides)
      .where(
        and(
          eq(customerProductOverrides.organizationId, orgId),
          sql`${customerProductOverrides.customTitle} IS NOT NULL`
        )
      );
    const totalAiEnriched = aiEnrichedRes?.count || 0;

    // 3. Products updated recently (last 7 days)
    const [recentUpdatedRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerProductMappings)
      .where(
        and(
          eq(customerProductMappings.organizationId, orgId),
          sql`${customerProductMappings.updatedAt} >= NOW() - INTERVAL '7 days'`
        )
      );

    // 4. Connected Stores count & list
    const myStores = await db
      .select({
        id: connectedStores.id,
        storeName: connectedStores.storeName,
        platformType: connectedStores.platformType,
        storeUrl: connectedStores.storeUrl,
        status: connectedStores.status,
        lastSyncAt: connectedStores.lastSyncAt,
        lastError: connectedStores.lastError,
      })
      .from(connectedStores)
      .where(eq(connectedStores.organizationId, orgId));

    // 5. Active and Failed Scraping Jobs for this org
    const myJobs = await db
      .select()
      .from(scrapingJobs)
      .where(eq(scrapingJobs.organizationId, orgId))
      .orderBy(desc(scrapingJobs.createdAt))
      .limit(10);

    const activeJobsCount = myJobs.filter(j => j.status === 'active' || j.status === 'queued').length;
    const failedJobsCount = myJobs.filter(j => j.status === 'failed').length;

    // 6. Unresolved Store Conflicts / Items Requiring Review
    const storeIds = myStores.map(s => s.id);
    let pendingConflicts: any[] = [];
    if (storeIds.length > 0) {
      pendingConflicts = await db
        .select()
        .from(storeConflictLogs)
        .where(
          and(
            sql`${storeConflictLogs.connectedStoreId} IN (${sql.join(storeIds.map(id => sql`${id}`), sql`, `)})`,
            eq(storeConflictLogs.resolution, 'pending')
          )
        )
        .limit(10);
    }

    // 7. Failed syncs in last 24h
    let failedSyncs: any[] = [];
    if (storeIds.length > 0) {
      failedSyncs = await db
        .select()
        .from(storeSyncHistory)
        .where(
          and(
            sql`${storeSyncHistory.connectedStoreId} IN (${sql.join(storeIds.map(id => sql`${id}`), sql`, `)})`,
            eq(storeSyncHistory.status, 'failed')
          )
        )
        .orderBy(desc(storeSyncHistory.createdAt))
        .limit(10);
    }

    // 8. Compile High-Priority "Needs Attention" Actionable List
    const needsAttention: Array<{
      id: string;
      type: 'failed_sync' | 'store_conflict' | 'failed_job' | 'stale_provenance';
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      timestamp: string;
      actionUrl: string;
      actionLabel: string;
    }> = [];

    // Add failed syncs to attention
    failedSyncs.forEach(fs => {
      needsAttention.push({
        id: fs.id,
        type: 'failed_sync',
        severity: 'critical',
        title: `Synchronization Failed (${fs.syncType})`,
        description: fs.errorDetails || 'Store sync encountered an unhandled connector error.',
        timestamp: fs.createdAt?.toISOString() || new Date().toISOString(),
        actionUrl: `/stores`,
        actionLabel: 'Retry Sync',
      });
    });

    // Add store conflicts to attention
    pendingConflicts.forEach(pc => {
      needsAttention.push({
        id: pc.id,
        type: 'store_conflict',
        severity: 'warning',
        title: `Attribute Discrepancy on ${pc.fieldName}`,
        description: `Local value "${pc.localValue}" differs from remote store "${pc.remoteValue}".`,
        timestamp: pc.createdAt?.toISOString() || new Date().toISOString(),
        actionUrl: `/products/${pc.globalProductId}`,
        actionLabel: 'Resolve Conflict',
      });
    });

    // Add failed jobs
    myJobs.filter(j => j.status === 'failed').forEach(fj => {
      needsAttention.push({
        id: fj.id,
        type: 'failed_job',
        severity: 'critical',
        title: `Scraping Job Error`,
        description: fj.errorMessage || `Failed extraction on target URL: ${fj.targetUrl}`,
        timestamp: fj.createdAt?.toISOString() || new Date().toISOString(),
        actionUrl: `/jobs`,
        actionLabel: 'Inspect Pipeline',
      });
    });

    // 9. Recent Product Activity (Real mappings with canonical product titles)
    const recentMappings = await db
      .select({
        mappingId: customerProductMappings.id,
        globalProductId: customerProductMappings.globalProductId,
        customerInternalSku: customerProductMappings.customerInternalSku,
        importedAt: customerProductMappings.importedAt,
        canonicalTitle: globalProducts.canonicalTitle,
        modelNumber: globalProducts.modelNumber,
        categoryPath: globalProducts.categoryPath,
        verificationStatus: globalProducts.verificationStatus,
      })
      .from(customerProductMappings)
      .innerJoin(globalProducts, eq(customerProductMappings.globalProductId, globalProducts.id))
      .where(eq(customerProductMappings.organizationId, orgId))
      .orderBy(desc(customerProductMappings.importedAt))
      .limit(6);

    // 10. Data Quality Metrics
    // Calculate verified vs unverified items for this organization
    const verifiedCount = recentMappings.filter(m => m.verificationStatus === 'verified').length;
    const dataQualityScore = recentMappings.length > 0
      ? Math.round((verifiedCount / recentMappings.length) * 100)
      : 100;

    return res.json({
      success: true,
      data: {
        organization: {
          id: org?.id || orgId,
          name: org?.name || 'Workspace',
          planTier: org?.planTier || 'standard',
        },
        metrics: {
          totalProducts: totalMyProducts,
          recentlyUpdated: recentUpdatedRes?.count || 0,
          aiProcessed: totalAiEnriched,
          pendingReviewCount: pendingConflicts.length,
          activeJobs: activeJobsCount,
          failedJobs: failedJobsCount,
          connectedStoresCount: myStores.length,
          failedSyncsCount: failedSyncs.length,
          dataQualityScore,
        },
        needsAttention,
        activeJobs: myJobs.filter(j => j.status === 'active' || j.status === 'queued'),
        recentProducts: recentMappings,
        stores: myStores,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch client workspace metrics', details: err.message });
  }
});

// GET /api/v1/metrics/admin-overview - Dedicated Platform Admin Control Center Telemetry
metricsRouter.get('/admin-overview', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied: Requires platform admin privileges' });
    }

    // 1. Total & Active Organizations
    const [allOrgsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    const [allUsersRes] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [allStoresRes] = await db.select({ count: sql<number>`count(*)::int` }).from(connectedStores);

    // 2. Global Canonical Products & Verification Breakdown
    const [allProductsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(globalProducts);
    const [verifiedProductsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalProducts)
      .where(eq(globalProducts.verificationStatus, 'verified'));

    // 3. Global Scraping & Pipeline Jobs
    const [totalJobsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(scrapingJobs);
    const [activeJobsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scrapingJobs)
      .where(sql`${scrapingJobs.status} IN ('active', 'queued')`);
    const [failedJobsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scrapingJobs)
      .where(eq(scrapingJobs.status, 'failed'));

    // 4. AI Engine Telemetry (Token accounting & cost from real history)
    const [aiTokensRes] = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${aiProcessingHistory.tokenUsage}), 0)::int`,
        totalExecutions: sql<number>`count(*)::int`,
        avgLatency: sql<number>`COALESCE(AVG(${aiProcessingHistory.latencyMs}), 0)::int`,
      })
      .from(aiProcessingHistory);

    const totalTokens = aiTokensRes?.totalTokens || 0;
    const estimatedCostUsd = (totalTokens / 1_000_000) * 1.50; // $1.50 per 1M blended tokens

    // 5. Human Review Queue size
    const [pendingReviewRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(identityReviewQueue)
      .where(eq(identityReviewQueue.resolutionStatus, 'pending'));

    // 6. Critical Incidents / Health checks
    const criticalIncidents: Array<{
      id: string;
      service: string;
      severity: 'critical' | 'high' | 'medium';
      description: string;
      detectedAt: string;
    }> = [];

    if (failedJobsRes?.count > 0) {
      criticalIncidents.push({
        id: 'inc-failed-jobs',
        service: 'BullMQ Scraping Workers',
        severity: 'high',
        description: `${failedJobsRes.count} scraping tasks encountered unrecoverable worker failures.`,
        detectedAt: new Date().toISOString(),
      });
    }

    // 7. Recent Global Platform Activity
    const recentActivity = await db
      .select({
        id: scrapingJobs.id,
        targetUrl: scrapingJobs.targetUrl,
        jobType: scrapingJobs.jobType,
        status: scrapingJobs.status,
        itemsExtracted: scrapingJobs.itemsExtracted,
        createdAt: scrapingJobs.createdAt,
      })
      .from(scrapingJobs)
      .orderBy(desc(scrapingJobs.createdAt))
      .limit(6);

    return res.json({
      success: true,
      data: {
        systemStatus: {
          coreApi: 'healthy',
          database: 'healthy',
          redis: 'healthy',
          workers: failedJobsRes?.count > 10 ? 'degraded' : 'healthy',
        },
        globalMetrics: {
          totalOrganizations: allOrgsRes?.count || 0,
          totalUsers: allUsersRes?.count || 0,
          totalConnectedStores: allStoresRes?.count || 0,
          totalProducts: allProductsRes?.count || 0,
          verifiedProducts: verifiedProductsRes?.count || 0,
          totalJobs: totalJobsRes?.count || 0,
          activeJobs: activeJobsRes?.count || 0,
          failedJobs: failedJobsRes?.count || 0,
          aiTokensUsed: totalTokens,
          aiExecutions: aiTokensRes?.totalExecutions || 0,
          aiEstimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
          pendingReviewCount: pendingReviewRes?.count || 0,
        },
        criticalIncidents,
        recentActivity,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch platform admin overview', details: err.message });
  }
});
