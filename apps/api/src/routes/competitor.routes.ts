import { Router, Request, Response } from 'express';
import { db, competitorMonitors, competitorPriceHistory, globalProducts } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, requireOrgRole } from '../middleware/auth.middleware';
import { CompetitorSpyService } from '../services/competitor-spy.service';

export const competitorRouter = Router();

competitorRouter.use(authMiddleware);

function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req as any).apiKey?.organizationId || null;
}

// GET /api/v1/competitors - List all competitor monitors for tenant
competitorRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const productId = req.query.productId as string | undefined;

    let condition = eq(competitorMonitors.organizationId, orgId);
    if (productId) {
      condition = and(condition, eq(competitorMonitors.globalProductId, productId)) as any;
    }

    const monitors = await db
      .select({
        id: competitorMonitors.id,
        globalProductId: competitorMonitors.globalProductId,
        productTitle: globalProducts.canonicalTitle,
        competitorName: competitorMonitors.competitorName,
        competitorUrl: competitorMonitors.competitorUrl,
        strategy: competitorMonitors.strategy,
        strategyValue: competitorMonitors.strategyValue,
        floorPrice: competitorMonitors.floorPrice,
        latestCompetitorPrice: competitorMonitors.latestCompetitorPrice,
        latestCalculatedPrice: competitorMonitors.latestCalculatedPrice,
        isInStock: competitorMonitors.isInStock,
        autoPushToStores: competitorMonitors.autoPushToStores,
        status: competitorMonitors.status,
        lastCheckedAt: competitorMonitors.lastCheckedAt,
        createdAt: competitorMonitors.createdAt,
      })
      .from(competitorMonitors)
      .innerJoin(globalProducts, eq(competitorMonitors.globalProductId, globalProducts.id))
      .where(condition)
      .orderBy(desc(competitorMonitors.createdAt));

    return res.json({ success: true, count: monitors.length, monitors });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list competitor monitors' });
  }
});

// POST /api/v1/competitors - Create a new competitor spy monitor
competitorRouter.post('/', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const {
      globalProductId,
      competitorName,
      competitorUrl,
      strategy,
      strategyValue,
      floorPrice,
      autoPushToStores,
    } = req.body;

    if (!globalProductId || !competitorUrl || !floorPrice) {
      return res.status(400).json({
        error: 'globalProductId, competitorUrl, and floorPrice (minimum selling boundary) are required',
      });
    }

    const [monitor] = await db
      .insert(competitorMonitors)
      .values({
        organizationId: orgId,
        globalProductId,
        competitorName: competitorName ? competitorName.trim() : 'Competitor Store',
        competitorUrl: competitorUrl.trim(),
        strategy: strategy || 'UNDERCUT_BY_AMOUNT',
        strategyValue: String(strategyValue || '1.00'),
        floorPrice: String(floorPrice),
        autoPushToStores: autoPushToStores !== undefined ? Boolean(autoPushToStores) : true,
        status: 'ACTIVE',
      })
      .returning();

    // Immediately trigger initial scrape & reprice in background
    CompetitorSpyService.executeMonitorCheck(monitor.id).catch((e) =>
      console.warn(`[CompetitorRoute] Background initial check failed for ${monitor.id}:`, e)
    );

    return res.status(201).json({ success: true, monitor });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create competitor monitor' });
  }
});

// POST /api/v1/competitors/:id/check-now - Trigger instant live scrape & undercut reprice
competitorRouter.post('/:id/check-now', async (req: Request, res: Response) => {
  try {
    const monitorId = String(req.params.id);
    const result = await CompetitorSpyService.executeMonitorCheck(monitorId);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Competitor check failed' });
  }
});

// GET /api/v1/competitors/:id/history - Get price history log
competitorRouter.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const monitorId = String(req.params.id);
    const history = await db
      .select()
      .from(competitorPriceHistory)
      .where(eq(competitorPriceHistory.monitorId, monitorId))
      .orderBy(desc(competitorPriceHistory.recordedAt))
      .limit(50);

    return res.json({ success: true, count: history.length, history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch competitor history' });
  }
});

// POST /api/v1/competitors/scan-all - Run full catalog competitor scan
competitorRouter.post('/scan-all', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const summary = await CompetitorSpyService.scanOrganizationCompetitors(orgId);
    return res.json({ success: true, ...summary });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Full scan failed' });
  }
});

// DELETE /api/v1/competitors/:id - Remove competitor monitor
competitorRouter.delete('/:id', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = String(getOrgId(req));
    const monitorId = String(req.params.id);

    const [deleted] = await db
      .delete(competitorMonitors)
      .where(and(eq(competitorMonitors.id, monitorId), eq(competitorMonitors.organizationId, orgId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Competitor monitor not found' });
    }

    return res.json({ success: true, message: 'Competitor monitor removed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete competitor monitor' });
  }
});
