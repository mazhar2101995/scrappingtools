import { Router, Request, Response } from 'express';
import { db, customerSupplierCredentials, supplierFeedSources } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, requireOrgRole } from '../middleware/auth.middleware';
import { SupplierSessionManagerService } from '../services/supplier-session-manager.service';
import { SupplierFeedSyncService } from '../services/supplier-feed-sync.service';

export const supplierSessionRouter = Router();

supplierSessionRouter.use(authMiddleware);

function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req as any).apiKey?.organizationId || null;
}

/**
 * GET /api/v1/supplier-sessions
 * List all configured B2B supplier credentials & session health
 */
supplierSessionRouter.get('/', requireOrgRole('viewer'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const creds = await db
      .select({
        id: customerSupplierCredentials.id,
        supplierName: customerSupplierCredentials.supplierName,
        supplierDomain: customerSupplierCredentials.supplierDomain,
        loginUrl: customerSupplierCredentials.loginUrl,
        username: customerSupplierCredentials.username,
        lastLoginAt: customerSupplierCredentials.lastLoginAt,
        lastStatus: customerSupplierCredentials.lastStatus,
        lastErrorMessage: customerSupplierCredentials.lastErrorMessage,
        autoRefreshHours: customerSupplierCredentials.autoRefreshHours,
        createdAt: customerSupplierCredentials.createdAt,
        updatedAt: customerSupplierCredentials.updatedAt,
        cookiesCount: customerSupplierCredentials.sessionCookies,
      })
      .from(customerSupplierCredentials)
      .where(eq(customerSupplierCredentials.organizationId, orgId))
      .orderBy(desc(customerSupplierCredentials.updatedAt));

    const formatted = creds.map(c => ({
      ...c,
      activeCookiesCount: Array.isArray(c.cookiesCount) ? c.cookiesCount.length : 0,
    }));

    return res.json({ data: formatted });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list supplier credentials' });
  }
});

/**
 * POST /api/v1/supplier-sessions
 * Create or update supplier login credentials
 */
supplierSessionRouter.post('/', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const { supplierName, supplierDomain, loginUrl, username, password, autoRefreshHours } = req.body;

    if (!supplierName || !supplierDomain || !loginUrl || !username || !password) {
      return res.status(400).json({ error: 'supplierName, supplierDomain, loginUrl, username, and password are required' });
    }

    const saved = await SupplierSessionManagerService.saveCredentials({
      organizationId: orgId,
      supplierName,
      supplierDomain,
      loginUrl,
      username,
      password,
      autoRefreshHours: autoRefreshHours ? parseInt(autoRefreshHours, 10) : 12,
    });

    return res.status(201).json({
      message: 'Supplier credentials securely saved',
      data: {
        id: saved.id,
        supplierName: saved.supplierName,
        supplierDomain: saved.supplierDomain,
        lastStatus: saved.lastStatus,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save supplier credentials' });
  }
});

/**
 * POST /api/v1/supplier-sessions/:id/login-now
 * Force an immediate login attempt to refresh session cookies
 */
supplierSessionRouter.post('/:id/login-now', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const credentialId = String(req.params.id);
    const result = await SupplierSessionManagerService.authenticateSupplier(credentialId, orgId);

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Login failed',
        data: result,
      });
    }

    return res.json({
      message: 'Autonomous login succeeded. Session cookies locked in for wholesale scraping.',
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to execute supplier login' });
  }
});

/**
 * DELETE /api/v1/supplier-sessions/:id
 * Delete supplier credentials
 */
supplierSessionRouter.delete('/:id', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const credentialId = String(req.params.id);

    await db
      .delete(customerSupplierCredentials)
      .where(
        and(
          eq(customerSupplierCredentials.id, credentialId),
          eq(customerSupplierCredentials.organizationId, orgId)
        )
      );

    return res.json({ message: 'Supplier credentials deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete supplier credentials' });
  }
});

// ==========================================
// SUPPLIER FEEDS (FTP / SFTP / CSV / GOOGLE SHEETS)
// ==========================================

/**
 * GET /api/v1/supplier-sessions/feeds
 * List all configured feeds for organization
 */
supplierSessionRouter.get('/feeds/all', requireOrgRole('viewer'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const feeds = await db
      .select()
      .from(supplierFeedSources)
      .where(eq(supplierFeedSources.organizationId, orgId))
      .orderBy(desc(supplierFeedSources.updatedAt));

    return res.json({ data: feeds });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list supplier feeds' });
  }
});

/**
 * POST /api/v1/supplier-sessions/feeds/preview
 * Preview columns and sample data from FTP or Sheet before saving
 */
supplierSessionRouter.post('/feeds/preview', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const { feedType, connectionConfig } = req.body;
    if (!feedType || !connectionConfig) {
      return res.status(400).json({ error: 'feedType and connectionConfig are required' });
    }

    const preview = await SupplierFeedSyncService.previewFeed(feedType, connectionConfig);
    return res.json({ data: preview });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to preview feed data' });
  }
});

/**
 * POST /api/v1/supplier-sessions/feeds
 * Save a new supplier feed configuration
 */
supplierSessionRouter.post('/feeds', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const { feedName, feedType, connectionConfig, columnMapping, syncFrequencyHours, autoPushToStores } = req.body;

    if (!feedName || !feedType || !connectionConfig) {
      return res.status(400).json({ error: 'feedName, feedType, and connectionConfig are required' });
    }

    const [created] = await db
      .insert(supplierFeedSources)
      .values({
        organizationId: orgId,
        feedName,
        feedType,
        connectionConfig: connectionConfig || {},
        columnMapping: columnMapping || { sku: 'sku', price: 'price', stock: 'stock' },
        syncFrequencyHours: syncFrequencyHours ? parseInt(syncFrequencyHours, 10) : 6,
        autoPushToStores: autoPushToStores !== false,
      })
      .returning();

    return res.status(201).json({ data: created });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create supplier feed' });
  }
});

/**
 * POST /api/v1/supplier-sessions/feeds/:id/sync-now
 * Trigger immediate ingestion & sync of a feed
 */
supplierSessionRouter.post('/feeds/:id/sync-now', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const feedId = String(req.params.id);
    const result = await SupplierFeedSyncService.executeFeedSync(feedId, orgId);

    return res.json({
      message: 'Feed synchronization completed successfully.',
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to execute feed sync' });
  }
});

/**
 * DELETE /api/v1/supplier-sessions/feeds/:id
 * Delete a supplier feed
 */
supplierSessionRouter.delete('/feeds/:id', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const feedId = String(req.params.id);
    await db
      .delete(supplierFeedSources)
      .where(
        and(
          eq(supplierFeedSources.id, feedId),
          eq(supplierFeedSources.organizationId, orgId)
        )
      );

    return res.json({ message: 'Supplier feed deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete supplier feed' });
  }
});
