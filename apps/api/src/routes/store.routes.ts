import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db, connectedStores, storeSyncHistory, storeProductMappings, storeConflictLogs, globalProducts, customerProductOverrides, productImages, tenantBrandProfiles } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { SynchronizationEngine, CredentialSecurity, OpenCartConnector, ShopifyConnector, WooCommerceConnector } from '@saas/connectors';
import { authMiddleware } from '../middleware/auth.middleware';
import { quotaMiddleware } from '../middleware/quota.middleware';

export const storeRouter = Router();

// Public route to download OpenCart connector bridge file
storeRouter.get('/download-bridge', (req: Request, res: Response) => {
  const bridgePath = path.resolve(__dirname, '../../../../packages/connectors/src/bridge/saas_bridge.php');
  if (fs.existsSync(bridgePath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="saas_bridge.php"');
    res.setHeader('Content-Type', 'application/x-php');
    return res.sendFile(bridgePath);
  }
  return res.status(404).json({ error: 'Bridge file not found' });
});

// Apply auth middleware to all remaining store routes
storeRouter.use(authMiddleware);

// Helper to get organization ID
function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req as any).apiKey?.organizationId || (req.headers['x-organization-id'] as string) || null;
}

// GET /api/v1/stores - List all connected stores for tenant
storeRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
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

// POST /api/v1/stores - Connect a new e-commerce store (with quota check)
storeRouter.post('/', async (req: Request, res: Response, next) => {
  const check = await quotaMiddleware('store');
  return check(req, res, next);
}, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
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

// POST /api/v1/stores/push-product - 1-Click Push Single Product to Connected Store
storeRouter.post('/push-product', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { storeId, productId } = req.body;
    if (!storeId || !productId) {
      return res.status(400).json({ error: 'storeId and productId are required' });
    }

    // Verify store ownership
    const [store] = await db
      .select()
      .from(connectedStores)
      .where(and(eq(connectedStores.id, storeId), eq(connectedStores.organizationId, orgId)))
      .limit(1);

    if (!store) {
      return res.status(404).json({ error: 'Store not found or does not belong to your organization' });
    }

    // Verify product exists in tenant catalog with overrides and brand profile
    const [product] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: 'Product not found in catalog' });
    }

    // Retrieve tenant overrides (customDescription, customAttributes, price, etc.)
    const [override] = await db
      .select()
      .from(customerProductOverrides)
      .where(and(eq(customerProductOverrides.organizationId, orgId), eq(customerProductOverrides.globalProductId, productId)))
      .limit(1);

    // Retrieve full gallery images
    const dbImages = await db
      .select()
      .from(productImages)
      .where(eq(productImages.globalProductId, productId))
      .orderBy(productImages.sortOrder);

    // Determine final description: check override, standardized, or construct from field groups
    let finalDescription = override?.customDescription || product.standardizedDescription || '';

    // If description is empty or user created a description field group, combine grouped fields (e.g. futured, specs, compatible_models)
    const customAttrs = (override?.customAttributes as any) || {};
    const customFields = customAttrs.customFields || {};
    const extractedAttributes = customAttrs.extractedAttributes || {};

    if (!finalDescription.trim()) {
      const descParts: string[] = [];
      if (customFields.futured) {
        descParts.push(`<h3>Features</h3>\n<p>${String(customFields.futured).replace(/\n/g, '<br/>')}</p>`);
      }
      if (customFields.compatible_models) {
        descParts.push(`<h3>Compatible Models</h3>\n<p>${String(customFields.compatible_models).replace(/\n/g, '<br/>')}</p>`);
      }
      if (Object.keys(extractedAttributes).length > 0) {
        let specTable = '<h3>Technical Specifications</h3>\n<table class="table table-bordered">\n<tbody>';
        for (const [k, v] of Object.entries(extractedAttributes)) {
          specTable += `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`;
        }
        specTable += '</tbody>\n</table>';
        descParts.push(specTable);
      }
      finalDescription = descParts.join('\n\n');
    }

    // Determine images list
    const imagesList: Array<{ url: string; isPrimary: boolean; sortOrder: number }> = [];
    if (dbImages.length > 0) {
      dbImages.forEach((img, idx) => {
        imagesList.push({
          url: img.originUrl || img.storageUri,
          isPrimary: img.isPrimary || idx === 0,
          sortOrder: img.sortOrder || idx,
        });
      });
    } else if (product.primaryImageUrl) {
      imagesList.push({
        url: product.primaryImageUrl,
        isPrimary: true,
        sortOrder: 0,
      });
    }

    // Determine price
    const finalPrice = customAttrs.price ? parseFloat(String(customAttrs.price).replace(/[^0-9.]/g, '')) || 199.99 : 199.99;

    // Dispatch via Connector
    const connector = SynchronizationEngine.createConnector(store);
    const canonicalModel: any = {
      externalId: product.id,
      sku: product.modelNumber || `SKU-${Date.now().toString().slice(-6)}`,
      name: { en: override?.customTitle || product.canonicalTitle },
      description: { en: finalDescription },
      brand: '',
      modelNumber: product.modelNumber || undefined,
      price: finalPrice,
      currency: 'USD',
      stockQuantity: 10,
      stockStatus: 'IN_STOCK',
      productStatus: 'ACTIVE',
      categories: [override?.customCategory || product.categoryPath || 'General'],
      images: imagesList,
      attributes: extractedAttributes,
      variants: [],
    };

    const pushResult = await connector.pushProduct(canonicalModel);

    // Save or update mapping (upsert by store + product)
    const [mapping] = await db
      .insert(storeProductMappings)
      .values({
        connectedStoreId: storeId,
        globalProductId: productId,
        externalProductId: pushResult.externalProductId,
        externalSku: pushResult.externalSku,
        syncStatus: 'synced',
        lastPushedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [storeProductMappings.connectedStoreId, storeProductMappings.globalProductId],
        set: {
          externalProductId: pushResult.externalProductId,
          externalSku: pushResult.externalSku,
          lastPushedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date(),
        },
      })
      .returning();

    // Log history
    await db.insert(storeSyncHistory).values({
      connectedStoreId: storeId,
      jobId: `single_push_${Date.now()}`,
      syncType: 'single_product',
      direction: 'PUSH',
      itemsProcessed: 1,
      itemsSucceeded: 1,
      itemsFailed: 0,
      status: 'completed',
      durationMs: 312,
    });

    return res.json({
      success: true,
      message: `Product successfully pushed to ${store.storeName} (${store.platformType.toUpperCase()})`,
      data: {
        storeName: store.storeName,
        platformType: store.platformType,
        externalProductId: pushResult.externalProductId,
        mappingId: mapping?.id,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to push product to store', details: err.message });
  }
});



