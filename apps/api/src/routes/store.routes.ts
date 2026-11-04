import { Router, Request, Response } from 'express';
import { db, connectedStores, storeSyncHistory, storeProductMappings, storeConflictLogs } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { SynchronizationEngine, CredentialSecurity, OpenCartConnector, ShopifyConnector, WooCommerceConnector } from '@saas/connectors';

export const storeRouter = Router();

// GET /api/v1/stores - List all connected stores for tenant
storeRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || (req as any).apiKey?.organizationId || req.headers['x-organization-id'];
    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const stores = await db
      .select({
        id: connectedStores.id,
        platformType: connectedStores.platformType,
        storeName: connectedStores.storeName,
        storeUrl: connectedStores.storeUrl,
        status: connectedStores.status,
        capabilities: connectedStores.capabilities,
        lastSyncAt: connectedStores.lastSyncAt,
        createdAt: connectedStores.createdAt,
      })
      .from(connectedStores)
      .where(eq(connectedStores.organizationId, orgId))
      .orderBy(desc(connectedStores.createdAt));

    return res.json({ success: true, count: stores.length, stores });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/stores - Connect a new e-commerce store
storeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || (req as any).apiKey?.organizationId || req.headers['x-organization-id'];
    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { platformType, storeName, storeUrl, credentials, capabilities } = req.body;

    if (!platformType || !storeName || !storeUrl || !credentials) {
      return res.status(400).json({ error: 'platformType, storeName, storeUrl and credentials are required' });
    }

    // SSRF Check
    if (!CredentialSecurity.validateStoreUrl(storeUrl)) {
      return res.status(400).json({ error: 'Invalid or restricted store URL (private IP / SSRF detected)' });
    }

    const encryptedCredentials = CredentialSecurity.encrypt(credentials);

    const [newStore] = await db
      .insert(connectedStores)
      .values({
        organizationId: orgId,
        platformType,
        storeName,
        storeUrl,
        encryptedCredentials,
        capabilities: capabilities || ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING'],
      })
      .returning({
        id: connectedStores.id,
        platformType: connectedStores.platformType,
        storeName: connectedStores.storeName,
        storeUrl: connectedStores.storeUrl,
        status: connectedStores.status,
      });

    return res.status(201).json({ success: true, store: newStore });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/stores/:id/test - Ping and test store connection
storeRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const storeId = req.params.id as string;
    const [store] = await db
      .select()
      .from(connectedStores)
      .where(eq(connectedStores.id, storeId))
      .limit(1);

    if (!store) {
      return res.status(404).json({ error: 'Connected store not found' });
    }

    const connector = SynchronizationEngine.createConnector(store);
    const testResult = await connector.testConnection();

    return res.json({ success: testResult.success, testResult });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/stores/:id/sync - Trigger asynchronous store synchronization
storeRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const storeId = req.params.id as string;
    const { direction = 'PULL' } = req.body;

    const [store] = await db
      .select({ id: connectedStores.id, status: connectedStores.status })
      .from(connectedStores)
      .where(eq(connectedStores.id, storeId))
      .limit(1);

    if (!store) {
      return res.status(404).json({ error: 'Connected store not found' });
    }

    const jobId = `store_sync_${Date.now()}`;

    // Execute via SynchronizationEngine (or dispatch to BullMQ)
    const syncEngine = new SynchronizationEngine();
    const result = await syncEngine.executeSync(storeId, direction, jobId);

    return res.status(202).json({
      success: true,
      jobId,
      status: 'completed',
      summary: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/stores/:id/history - Get synchronization logs
storeRouter.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const storeId = req.params.id as string;
    const history = await db
      .select()
      .from(storeSyncHistory)
      .where(eq(storeSyncHistory.connectedStoreId, storeId))
      .orderBy(desc(storeSyncHistory.createdAt))
      .limit(50);

    return res.json({ success: true, count: history.length, history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
