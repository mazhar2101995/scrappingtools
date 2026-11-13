import {
  db,
  connectedStores,
  storeProductMappings,
  customerProductOverrides,
  globalProducts,
  storeInboundWebhooks,
} from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { NotificationAndWebhookService } from './notification-and-webhook.service';

export interface InboundWebhookResult {
  success: boolean;
  actionTaken: string;
  globalProductId?: string;
  error?: string;
}

export class InboundStoreWebhookService {
  /**
   * Process incoming webhook from a connected store (OpenCart, Shopify, WooCommerce)
   */
  static async processStoreWebhook(params: {
    storeId: string;
    authSecret?: string;
    topic?: string;
    payload: any;
  }): Promise<InboundWebhookResult> {
    const { storeId, authSecret, topic, payload } = params;

    // 1. Fetch store and verify credentials
    const [store] = await db
      .select()
      .from(connectedStores)
      .where(eq(connectedStores.id, storeId))
      .limit(1);

    if (!store) {
      return {
        success: false,
        actionTaken: 'STORE_NOT_FOUND',
        error: `Connected store ${storeId} not found`,
      };
    }

    // Webhook secret verification (if secret configured on store)
    if (store.webhookSecret && authSecret && store.webhookSecret !== authSecret) {
      await this.logInboundWebhook({
        organizationId: store.organizationId,
        storeId: store.id,
        platform: store.platformType,
        eventType: topic || 'unknown',
        externalId: null,
        payload,
        status: 'UNAUTHORIZED',
        errorMessage: 'Invalid webhook secret token',
      });
      return {
        success: false,
        actionTaken: 'REJECTED_UNAUTHORIZED',
        error: 'Invalid webhook secret',
      };
    }

    const platform = store.platformType.toLowerCase();
    let externalProductId: string | null = null;
    let eventType = topic || 'product.update';
    let actionTaken = 'IGNORED';
    let globalProductId: string | undefined = undefined;

    try {
      // 2. Normalize payload by platform
      let newPrice: string | null = null;
      let newStockQuantity: number | null = null;
      let newTitle: string | null = null;
      let isDeleted = false;

      if (platform === 'shopify') {
        externalProductId = String(payload.id || '');
        if (topic === 'products/delete') {
          isDeleted = true;
          actionTaken = 'STORE_PRODUCT_DELETED';
        } else {
          // products/update or inventory_levels/update
          if (payload.title) newTitle = payload.title;
          if (payload.variants && payload.variants.length > 0) {
            newPrice = payload.variants[0].price ? String(payload.variants[0].price) : null;
            newStockQuantity = typeof payload.variants[0].inventory_quantity === 'number'
              ? payload.variants[0].inventory_quantity
              : null;
          }
          actionTaken = 'REVERSE_SYNC_UPDATED';
        }
      } else if (platform === 'opencart') {
        // OpenCart bridge format
        externalProductId = String(payload.product_id || payload.id || '');
        if (payload.action === 'delete') {
          isDeleted = true;
          actionTaken = 'STORE_PRODUCT_DELETED';
        } else {
          if (payload.price !== undefined) newPrice = String(payload.price);
          if (payload.quantity !== undefined) newStockQuantity = Number(payload.quantity);
          if (payload.name) newTitle = payload.name;
          actionTaken = 'REVERSE_SYNC_UPDATED';
        }
      } else {
        // Generic / WooCommerce
        externalProductId = String(payload.id || '');
        if (payload.action === 'delete' || payload.status === 'trash') {
          isDeleted = true;
          actionTaken = 'STORE_PRODUCT_DELETED';
        } else {
          if (payload.regular_price || payload.price) newPrice = String(payload.regular_price || payload.price);
          if (payload.stock_quantity !== undefined) newStockQuantity = Number(payload.stock_quantity);
          if (payload.name) newTitle = payload.name;
          actionTaken = 'REVERSE_SYNC_UPDATED';
        }
      }

      // 3. Find corresponding storeProductMapping
      if (externalProductId) {
        const [mapping] = await db
          .select()
          .from(storeProductMappings)
          .where(
            and(
              eq(storeProductMappings.connectedStoreId, store.id),
              eq(storeProductMappings.externalProductId, externalProductId)
            )
          )
          .limit(1);

        if (mapping) {
          globalProductId = mapping.globalProductId;

          if (isDeleted) {
            // Update mapping status to 'unlinked' or delete mapping
            await db
              .update(storeProductMappings)
              .set({
                syncStatus: 'deleted_on_store',
                updatedAt: new Date(),
              })
              .where(eq(storeProductMappings.id, mapping.id));

            await NotificationAndWebhookService.dispatch({
              organizationId: store.organizationId,
              type: 'STORE_EXPORT',
              title: `Store Product Deleted (${store.storeName})`,
              message: `External product #${externalProductId} was removed directly on ${store.storeName}. Sync link disconnected.`,
              severity: 'warning',
              actionUrl: `/products/${mapping.globalProductId}`,
              metadata: { storeId: store.id, externalProductId, globalProductId: mapping.globalProductId },
            });
          } else {
            // Reverse sync: Update customerProductOverrides with live store price & stock
            const [existingOverride] = await db
              .select()
              .from(customerProductOverrides)
              .where(
                and(
                  eq(customerProductOverrides.organizationId, store.organizationId),
                  eq(customerProductOverrides.globalProductId, mapping.globalProductId)
                )
              )
              .limit(1);

            const customAttributes = (existingOverride?.customAttributes as any) || {};
            if (newPrice !== null) customAttributes.price = newPrice;
            if (newStockQuantity !== null) {
              customAttributes.stock_quantity = newStockQuantity;
              customAttributes.in_stock = newStockQuantity > 0;
            }

            if (existingOverride) {
              await db
                .update(customerProductOverrides)
                .set({
                  customAttributes,
                  customTitle: newTitle || existingOverride.customTitle,
                  updatedAt: new Date(),
                })
                .where(eq(customerProductOverrides.id, existingOverride.id));
            } else {
              await db
                .insert(customerProductOverrides)
                .values({
                  organizationId: store.organizationId,
                  globalProductId: mapping.globalProductId,
                  customTitle: newTitle,
                  customAttributes,
                });
            }

            // Update mapping last pulled timestamp
            await db
              .update(storeProductMappings)
              .set({
                lastPulledAt: new Date(),
                syncStatus: 'synced',
                updatedAt: new Date(),
              })
              .where(eq(storeProductMappings.id, mapping.id));

            await NotificationAndWebhookService.dispatch({
              organizationId: store.organizationId,
              type: 'STORE_EXPORT',
              title: `Reverse Sync (${store.storeName})`,
              message: `Live update received from ${store.storeName} for product #${externalProductId}: Price=${newPrice || 'unchanged'}, Stock=${newStockQuantity ?? 'unchanged'}.`,
              severity: 'info',
              actionUrl: `/products/${mapping.globalProductId}`,
              metadata: { storeId: store.id, externalProductId, newPrice, newStockQuantity },
            });
          }
        } else {
          actionTaken = 'NO_MAPPING_FOUND';
        }
      }

      // 4. Log the processed inbound webhook
      await this.logInboundWebhook({
        organizationId: store.organizationId,
        storeId: store.id,
        platform: store.platformType,
        eventType,
        externalId: externalProductId,
        payload,
        status: 'PROCESSED',
        actionTaken,
      });

      return {
        success: true,
        actionTaken,
        globalProductId,
      };
    } catch (err: any) {
      await this.logInboundWebhook({
        organizationId: store.organizationId,
        storeId: store.id,
        platform: store.platformType,
        eventType,
        externalId: externalProductId,
        payload,
        status: 'ERROR',
        actionTaken: 'FAILED',
        errorMessage: err.message,
      });

      return {
        success: false,
        actionTaken: 'FAILED',
        error: err.message,
      };
    }
  }

  private static async logInboundWebhook(data: {
    organizationId: string;
    storeId: string;
    platform: string;
    eventType: string;
    externalId: string | null;
    payload: any;
    status: string;
    actionTaken?: string;
    errorMessage?: string;
  }) {
    try {
      await db.insert(storeInboundWebhooks).values({
        organizationId: data.organizationId,
        storeId: data.storeId,
        platform: data.platform,
        eventType: data.eventType,
        externalId: data.externalId,
        payload: data.payload,
        status: data.status,
        actionTaken: data.actionTaken,
        errorMessage: data.errorMessage,
      });
    } catch (e) {
      console.error('[InboundStoreWebhookService] Failed to record inbound webhook log:', e);
    }
  }

  /**
   * Get recent inbound webhooks for a specific store
   */
  static async getStoreInboundLogs(storeId: string, limit = 25) {
    return await db
      .select()
      .from(storeInboundWebhooks)
      .where(eq(storeInboundWebhooks.storeId, storeId))
      .orderBy(eq(storeInboundWebhooks.storeId, storeId))
      .limit(limit);
  }
}
