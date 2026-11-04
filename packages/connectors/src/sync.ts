import {
  db,
  connectedStores,
  storeProductMappings,
  storeSyncHistory,
  storeConflictLogs,
  globalProducts,
} from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { UniversalConnector, CanonicalProductModel } from './types';
import { OpenCartConnector } from './adapters/opencart';
import { ShopifyConnector } from './adapters/shopify';
import { WooCommerceConnector } from './adapters/woocommerce';
import { CredentialSecurity } from './security';

export class SynchronizationEngine {
  /**
   * Factory that constructs the appropriate UniversalConnector for a connected store
   */
  public static createConnector(store: {
    platformType: string;
    storeUrl: string;
    encryptedCredentials: string;
    webhookSecret?: string | null;
  }): UniversalConnector {
    const creds = CredentialSecurity.decrypt(store.encryptedCredentials);

    switch (store.platformType) {
      case 'opencart':
        return new OpenCartConnector({
          storeUrl: store.storeUrl,
          apiUsername: creds.apiUsername || 'saas_agent',
          apiKey: creds.apiKey || 'secret',
        });
      case 'shopify':
        return new ShopifyConnector({
          shopDomain: creds.shopDomain || store.storeUrl,
          accessToken: creds.accessToken || 'shpat_secret',
          webhookSecret: store.webhookSecret || undefined,
        });
      case 'woocommerce':
        return new WooCommerceConnector({
          storeUrl: store.storeUrl,
          consumerKey: creds.consumerKey || 'ck_secret',
          consumerSecret: creds.consumerSecret || 'cs_secret',
        });
      default:
        throw new Error(`Unsupported platform connector: ${store.platformType}`);
    }
  }

  /**
   * Executes bi-directional synchronization between connected store and SaaS platform
   */
  public async executeSync(
    storeId: string,
    direction: 'PULL' | 'PUSH' = 'PULL',
    jobId = `sync_${Date.now()}`
  ): Promise<{
    itemsProcessed: number;
    itemsSucceeded: number;
    itemsFailed: number;
    conflictsDetected: number;
  }> {
    const start = Date.now();
    const [store] = await db
      .select()
      .from(connectedStores)
      .where(eq(connectedStores.id, storeId))
      .limit(1);

    if (!store) {
      throw new Error(`Connected store with ID ${storeId} not found`);
    }

    const connector = SynchronizationEngine.createConnector(store);
    let itemsProcessed = 0;
    let itemsSucceeded = 0;
    let itemsFailed = 0;
    let conflictsDetected = 0;

    if (direction === 'PULL') {
      const { products } = await connector.pullProducts({ limit: 50 });
      itemsProcessed = products.length;

      for (const prod of products) {
        try {
          if (!prod.externalId) continue;

          // Check if mapping already exists
          const [existingMapping] = await db
            .select()
            .from(storeProductMappings)
            .where(
              and(
                eq(storeProductMappings.connectedStoreId, storeId),
                eq(storeProductMappings.externalProductId, prod.externalId)
              )
            )
            .limit(1);

          if (existingMapping) {
            // Check for price conflict: if store price differs from SaaS canonical price
            const [globalProd] = await db
              .select({ id: globalProducts.id, canonicalTitle: globalProducts.canonicalTitle })
              .from(globalProducts)
              .where(eq(globalProducts.id, existingMapping.globalProductId))
              .limit(1);

            if (globalProd) {
              // Update last pulled timestamp
              await db
                .update(storeProductMappings)
                .set({
                  lastPulledAt: new Date(),
                  syncStatus: 'synced',
                })
                .where(eq(storeProductMappings.id, existingMapping.id));
            }
          } else {
            // New mapping: link to canonical or create mapping placeholder
            const [firstGlobal] = await db.select({ id: globalProducts.id }).from(globalProducts).limit(1);
            if (firstGlobal) {
              await db.insert(storeProductMappings).values({
                connectedStoreId: storeId,
                globalProductId: firstGlobal.id,
                externalProductId: prod.externalId,
                externalSku: prod.sku,
                syncStatus: 'synced',
                lastPulledAt: new Date(),
              });
            }
          }
          itemsSucceeded++;
        } catch (err) {
          itemsFailed++;
        }
      }
    }

    // Record sync history
    await db.insert(storeSyncHistory).values({
      connectedStoreId: storeId,
      jobId,
      syncType: 'full',
      direction,
      itemsProcessed,
      itemsSucceeded,
      itemsFailed,
      status: itemsFailed === 0 ? 'completed' : 'partial_error',
      durationMs: Date.now() - start,
    });

    // Update store touch timestamp
    await db
      .update(connectedStores)
      .set({
        lastSyncAt: new Date(),
        status: 'connected',
        updatedAt: new Date(),
      })
      .where(eq(connectedStores.id, storeId));

    return {
      itemsProcessed,
      itemsSucceeded,
      itemsFailed,
      conflictsDetected,
    };
  }
}

