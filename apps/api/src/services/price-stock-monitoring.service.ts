import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, customerProductOverrides, globalProducts, storeProductMappings, connectedStores } from '@saas/database';
import { eq, and, sql } from 'drizzle-orm';
import { NotificationAndWebhookService } from './notification-and-webhook.service';
import { StoreExportExecutionService } from './store-export-execution.service';

export interface PriceStockCheckResult {
  productId: string;
  productTitle: string;
  sourceUrl: string;
  oldPrice: string | null;
  newPrice: string | null;
  priceChanged: boolean;
  priceDelta: number;
  oldStockStatus: boolean;
  newStockStatus: boolean;
  stockChanged: boolean;
  syncedStoresUpdated: number;
  error?: string;
}

export class PriceStockMonitoringService {
  private static readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  /**
   * Fast Light-Weight Scrape: Checks price & stock without re-parsing entire images/options
   */
  public static async checkLiveSource(sourceUrl: string): Promise<{
    currentPrice: string | null;
    inStock: boolean;
    extractedTitle?: string;
  }> {
    try {
      const resp = await axios.get(sourceUrl, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 12000,
      });

      const $ = cheerio.load(resp.data);

      // 1. Extract Price from common microdata / selectors
      let detectedPrice: string | null = null;
      const priceSelectors = [
        '[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '[data-price-type="finalPrice"]',
        '.price-item--regular',
        '.current-price',
        '.product-price',
        '.price',
      ];

      for (const sel of priceSelectors) {
        const el = $(sel).first();
        if (el.length > 0) {
          const content = el.attr('content') || el.text().trim();
          const match = content.match(/[\d,.]+/);
          if (match && match[0]) {
            detectedPrice = match[0].replace(/,/g, '');
            break;
          }
        }
      }

      // 2. Extract Stock Availability
      let inStock = true;
      const htmlText = $('body').text().toLowerCase();
      const availabilityMeta = $('meta[property="product:availability"], [itemprop="availability"]').attr('content') || '';

      if (
        availabilityMeta.toLowerCase().includes('outofstock') ||
        availabilityMeta.toLowerCase().includes('discontinued') ||
        $('.out-of-stock').length > 0 ||
        $('.sold-out').length > 0 ||
        $('button[disabled]:contains("Out of Stock")').length > 0 ||
        $('button[disabled]:contains("Sold Out")').length > 0 ||
        htmlText.includes('currently unavailable') ||
        htmlText.includes('out of stock')
      ) {
        inStock = false;
      }

      const title = $('h1').first().text().trim() || $('title').text().trim();

      return {
        currentPrice: detectedPrice,
        inStock,
        extractedTitle: title,
      };
    } catch (err: any) {
      throw new Error(`Failed to check live source URL: ${err.message}`);
    }
  }

  /**
   * Run Price & Stock Check for a single product and optionally auto-push delta to connected stores
   */
  public static async executeProductCheck(
    organizationId: string,
    globalProductId: string,
    autoPushStores = true
  ): Promise<PriceStockCheckResult> {
    const [override] = await db
      .select()
      .from(customerProductOverrides)
      .where(
        and(
          eq(customerProductOverrides.organizationId, organizationId),
          eq(customerProductOverrides.globalProductId, globalProductId)
        )
      )
      .limit(1);

    const [product] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, globalProductId))
      .limit(1);

    if (!product) {
      throw new Error(`Product ${globalProductId} not found`);
    }

    const attrs = (override?.customAttributes as any) || {};
    const monitoring = attrs.priceMonitoring || {};
    const sourceUrl = monitoring.targetUrl || attrs.productUrl;

    if (!sourceUrl || !sourceUrl.startsWith('http')) {
      throw new Error(`No source URL available for price tracking`);
    }

    const oldPriceStr = String(monitoring.currentPrice || attrs.price || '0.00');
    const oldPriceNum = parseFloat(oldPriceStr.replace(/[^0-9.]/g, '')) || 0;
    const oldStock = monitoring.inStock !== undefined ? Boolean(monitoring.inStock) : true;

    // Check live source
    const liveData = await this.checkLiveSource(sourceUrl);

    const newPriceStr = liveData.currentPrice || oldPriceStr;
    const newPriceNum = parseFloat(newPriceStr.replace(/[^0-9.]/g, '')) || oldPriceNum;
    const newStock = liveData.inStock;

    const priceChanged = Math.abs(newPriceNum - oldPriceNum) > 0.01;
    const stockChanged = oldStock !== newStock;
    const priceDelta = Math.round((newPriceNum - oldPriceNum) * 100) / 100;

    let storesUpdated = 0;

    // Record update in product overrides
    const updatedMonitoring = {
      ...monitoring,
      enabled: true,
      targetUrl: sourceUrl,
      baselinePrice: monitoring.baselinePrice || oldPriceStr,
      currentPrice: newPriceStr,
      inStock: newStock,
      lastCheckedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [
        ...(monitoring.history || []).slice(-15), // keep last 15 checks
        {
          timestamp: new Date().toISOString(),
          price: newPriceStr,
          inStock: newStock,
          priceDelta,
        },
      ],
    };

    const updatedAttrs = {
      ...attrs,
      price: newPriceStr,
      priceMonitoring: updatedMonitoring,
    };

    await db
      .insert(customerProductOverrides)
      .values({
        organizationId,
        globalProductId,
        customTitle: override?.customTitle || product.canonicalTitle,
        customDescription: override?.customDescription || product.standardizedDescription,
        customAttributes: updatedAttrs,
      })
      .onConflictDoUpdate({
        target: [customerProductOverrides.organizationId, customerProductOverrides.globalProductId],
        set: {
          customAttributes: updatedAttrs,
          updatedAt: new Date(),
        },
      });

    // If changes detected, alert the merchant and optionally auto-push to stores
    if (priceChanged || stockChanged) {
      const changeDesc = [];
      if (priceChanged) changeDesc.push(`Price changed from $${oldPriceNum.toFixed(2)} to $${newPriceNum.toFixed(2)} (${priceDelta > 0 ? `+$${priceDelta}` : `-$${Math.abs(priceDelta)}`})`);
      if (stockChanged) changeDesc.push(`Stock status is now ${newStock ? 'IN STOCK' : 'OUT OF STOCK'}`);

      // Dispatch tenant notification
      await NotificationAndWebhookService.dispatch({
        organizationId,
        type: 'STORE_EXPORT',
        title: `Supplier Change: ${product.canonicalTitle}`,
        message: changeDesc.join(' | '),
        severity: !newStock ? 'warning' : 'info',
        actionUrl: `/products/${globalProductId}`,
        metadata: {
          productId: globalProductId,
          oldPrice: oldPriceNum,
          newPrice: newPriceNum,
          priceDelta,
          inStock: newStock,
        },
      });

      // Auto-Push to synced stores if enabled
      if (autoPushStores) {
        const mappings = await db
          .select()
          .from(storeProductMappings)
          .where(eq(storeProductMappings.globalProductId, globalProductId));

        for (const map of mappings) {
          try {
            await StoreExportExecutionService.executeControlledPush(
              organizationId,
              map.connectedStoreId,
              globalProductId
            );
            storesUpdated++;
          } catch (pushErr) {
            console.warn(`[PriceMonitor] Failed auto-syncing to store ${map.connectedStoreId}:`, pushErr);
          }
        }
      }
    }

    return {
      productId: globalProductId,
      productTitle: override?.customTitle || product.canonicalTitle,
      sourceUrl,
      oldPrice: oldPriceStr,
      newPrice: newPriceStr,
      priceChanged,
      priceDelta,
      oldStockStatus: oldStock,
      newStockStatus: newStock,
      stockChanged,
      syncedStoresUpdated: storesUpdated,
    };
  }

  /**
   * Batch check all monitored products in an organization
   */
  public static async executeOrganizationScan(organizationId: string): Promise<{
    scanned: number;
    priceChangesCount: number;
    stockChangesCount: number;
    results: PriceStockCheckResult[];
  }> {
    const list = await db
      .select({ globalProductId: customerProductOverrides.globalProductId })
      .from(customerProductOverrides)
      .where(eq(customerProductOverrides.organizationId, organizationId));

    const results: PriceStockCheckResult[] = [];
    let priceChanges = 0;
    let stockChanges = 0;

    for (const item of list) {
      try {
        const res = await this.executeProductCheck(organizationId, item.globalProductId);
        results.push(res);
        if (res.priceChanged) priceChanges++;
        if (res.stockChanged) stockChanges++;
      } catch (err: any) {
        results.push({
          productId: item.globalProductId,
          productTitle: 'Unknown',
          sourceUrl: '',
          oldPrice: null,
          newPrice: null,
          priceChanged: false,
          priceDelta: 0,
          oldStockStatus: true,
          newStockStatus: true,
          stockChanged: false,
          syncedStoresUpdated: 0,
          error: err.message,
        });
      }
    }

    return {
      scanned: list.length,
      priceChangesCount: priceChanges,
      stockChangesCount: stockChanges,
      results,
    };
  }
}

