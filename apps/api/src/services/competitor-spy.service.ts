import {
  db,
  competitorMonitors,
  competitorPriceHistory,
  customerProductOverrides,
  storeProductMappings,
  connectedStores,
} from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { AntiBotDefenseService } from './anti-bot-defense.service';
import { NotificationAndWebhookService } from './notification-and-webhook.service';
import { StoreExportExecutionService } from './store-export-execution.service';

export interface CompetitorCheckResult {
  monitorId: string;
  competitorName: string;
  competitorUrl: string;
  previousPrice: number | null;
  currentCompetitorPrice: number | null;
  ourCalculatedPrice: number;
  isInStock: boolean;
  priceChanged: boolean;
  undercutApplied: boolean;
  floorTriggered: boolean;
  syncedStoresCount: number;
  error?: string;
}

export class CompetitorSpyService {
  /**
   * Scrape a competitor's live URL and extract price & availability
   */
  public static async scrapeCompetitorPrice(url: string, organizationId?: string): Promise<{
    price: number | null;
    inStock: boolean;
    title?: string;
  }> {
    try {
      const resp = await AntiBotDefenseService.safeGet(url, {
        organizationId,
        timeoutMs: 15000,
      });

      const $ = cheerio.load(resp.data);

      let detectedPrice: number | null = null;
      const selectors = [
        '[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '[data-price-type="finalPrice"]',
        '.price-item--regular',
        '.current-price',
        '.product-price',
        '.special-price',
        '.price',
      ];

      const parsePriceFromText = (str: string): number | null => {
        if (!str) return null;
        // Match standard currency pattern (e.g. $515, $643.00, 515.99, etc.)
        const match = str.match(/(?:[\$\€\£\₹]\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
        if (match && match[1]) {
          const num = parseFloat(match[1].replace(/,/g, ''));
          // Sanity check: e-commerce consumer prices won't realistically exceed $500,000 or be <= 0
          if (!isNaN(num) && num > 0 && num < 500000) {
            return num;
          }
        }
        return null;
      };

      for (const sel of selectors) {
        if (sel.startsWith('meta')) {
          const content = $(sel).attr('content');
          if (content) {
            const clean = parsePriceFromText(content);
            if (clean !== null) {
              detectedPrice = clean;
              break;
            }
          }
        } else {
          // If selector matches multiple elements (e.g. .price), check only direct price container text
          const elements = $(sel);
          for (let i = 0; i < Math.min(elements.length, 5); i++) {
            const el = elements.eq(i);
            // Get text, ignoring nested container text if this is a wrapper
            const directText = el.clone().children().remove().end().text().trim() || el.text().trim();
            const clean = parsePriceFromText(directText);
            if (clean !== null) {
              detectedPrice = clean;
              break;
            }
          }
          if (detectedPrice !== null) break;
        }
      }

      // Check stock status
      let inStock = true;
      const bodyText = $('body').text().toLowerCase();
      const availabilityMeta = $('[itemprop="availability"]').attr('href') || $('[itemprop="availability"]').attr('content') || '';
      if (
        availabilityMeta.toLowerCase().includes('outofstock') ||
        $('.out-of-stock, .sold-out, .badge--sold-out').length > 0 ||
        (bodyText.includes('out of stock') && !bodyText.includes('in stock'))
      ) {
        inStock = false;
      }

      const title = $('h1').first().text().trim() || $('title').first().text().trim();

      return { price: detectedPrice, inStock, title };
    } catch (err: any) {
      console.warn(`[CompetitorSpy] Failed to scrape competitor ${url}:`, err.message);
      return { price: null, inStock: true };
    }
  }

  /**
   * Calculate our retail price based on competitor's live price and chosen strategy
   */
  public static calculateUndercutPrice(params: {
    competitorPrice: number;
    strategy: string; // 'UNDERCUT_BY_AMOUNT', 'UNDERCUT_BY_PERCENT', 'MATCH_PRICE'
    strategyValue: number;
    floorPrice: number;
  }): { calculatedPrice: number; floorTriggered: boolean } {
    const { competitorPrice, strategy, strategyValue, floorPrice } = params;

    let targetPrice = competitorPrice;

    if (strategy === 'UNDERCUT_BY_AMOUNT') {
      targetPrice = competitorPrice - strategyValue;
    } else if (strategy === 'UNDERCUT_BY_PERCENT') {
      targetPrice = competitorPrice * (1 - strategyValue / 100);
    } else if (strategy === 'MATCH_PRICE') {
      targetPrice = competitorPrice;
    }

    // Apply psychological .99 rounding
    targetPrice = Math.floor(targetPrice) + 0.99;

    let floorTriggered = false;
    if (targetPrice < floorPrice) {
      targetPrice = floorPrice;
      floorTriggered = true;
    }

    return {
      calculatedPrice: parseFloat(targetPrice.toFixed(2)),
      floorTriggered,
    };
  }

  /**
   * Execute check for a specific competitor monitor and auto-reprice product if enabled
   */
  public static async executeMonitorCheck(monitorId: string): Promise<CompetitorCheckResult> {
    const [monitor] = await db
      .select()
      .from(competitorMonitors)
      .where(eq(competitorMonitors.id, monitorId))
      .limit(1);

    if (!monitor) {
      throw new Error(`Competitor monitor ${monitorId} not found`);
    }

    const prevCompPrice = monitor.latestCompetitorPrice ? parseFloat(monitor.latestCompetitorPrice) : null;
    const scraped = await this.scrapeCompetitorPrice(monitor.competitorUrl, monitor.organizationId);

    if (scraped.price === null) {
      await db
        .update(competitorMonitors)
        .set({
          status: 'ERROR',
          lastError: 'Could not extract competitor price from URL',
          lastCheckedAt: new Date(),
        })
        .where(eq(competitorMonitors.id, monitor.id));

      return {
        monitorId: monitor.id,
        competitorName: monitor.competitorName,
        competitorUrl: monitor.competitorUrl,
        previousPrice: prevCompPrice,
        currentCompetitorPrice: null,
        ourCalculatedPrice: monitor.latestCalculatedPrice ? parseFloat(monitor.latestCalculatedPrice) : 0,
        isInStock: monitor.isInStock,
        priceChanged: false,
        undercutApplied: false,
        floorTriggered: false,
        syncedStoresCount: 0,
        error: 'Price selector extraction failed',
      };
    }

    const currentPrice = scraped.price;
    const strategyVal = parseFloat(monitor.strategyValue || '1.00') || 1.00;
    const floor = parseFloat(monitor.floorPrice || '0') || 0;

    const { calculatedPrice, floorTriggered } = this.calculateUndercutPrice({
      competitorPrice: currentPrice,
      strategy: monitor.strategy,
      strategyValue: strategyVal,
      floorPrice: floor,
    });

    const priceChanged = prevCompPrice === null || Math.abs(prevCompPrice - currentPrice) > 0.05;

    // 1. Log to history
    await db.insert(competitorPriceHistory).values({
      monitorId: monitor.id,
      competitorPrice: String(currentPrice),
      ourCalculatedPrice: String(calculatedPrice),
      isInStock: scraped.inStock,
    });

    // 2. Update monitor record
    await db
      .update(competitorMonitors)
      .set({
        latestCompetitorPrice: String(currentPrice),
        latestCalculatedPrice: String(calculatedPrice),
        isInStock: scraped.inStock,
        status: 'ACTIVE',
        lastCheckedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(competitorMonitors.id, monitor.id));

    let syncedStoresCount = 0;

    // 3. Auto-Reprice in Customer Overrides & Connected Stores if price changed
    if (priceChanged || !monitor.latestCalculatedPrice) {
      // Update customerProductOverrides
      const [existingOverride] = await db
        .select()
        .from(customerProductOverrides)
        .where(
          and(
            eq(customerProductOverrides.organizationId, monitor.organizationId),
            eq(customerProductOverrides.globalProductId, monitor.globalProductId)
          )
        )
        .limit(1);

      const customAttrs = (existingOverride?.customAttributes as any) || {};
      customAttrs.price = String(calculatedPrice);
      customAttrs.competitor_price = String(currentPrice);
      customAttrs.competitor_undercut = true;

      if (existingOverride) {
        await db
          .update(customerProductOverrides)
          .set({
            customAttributes: customAttrs,
            updatedAt: new Date(),
          })
          .where(eq(customerProductOverrides.id, existingOverride.id));
      } else {
        await db.insert(customerProductOverrides).values({
          organizationId: monitor.organizationId,
          globalProductId: monitor.globalProductId,
          customAttributes: customAttrs,
        });
      }

      // If auto_push_to_stores enabled, push updated price to mapped OpenCart/Shopify stores
      if (monitor.autoPushToStores) {
        const mappings = await db
          .select({
            storeId: storeProductMappings.connectedStoreId,
          })
          .from(storeProductMappings)
          .where(eq(storeProductMappings.globalProductId, monitor.globalProductId));

        for (const m of mappings) {
          try {
            const plan = await StoreExportExecutionService.generateChangePlan(
              monitor.organizationId,
              monitor.globalProductId,
              m.storeId
            );
            if (plan.planId) {
              await StoreExportExecutionService.executeControlledPush(
                monitor.organizationId,
                plan.planId
              );
              syncedStoresCount++;
            }
          } catch (pushErr) {
            console.warn(`[CompetitorSpy] Auto-push to store ${m.storeId} failed:`, pushErr);
          }
        }
      }

      // Dispatch real-time alert
      await NotificationAndWebhookService.dispatch({
        organizationId: monitor.organizationId,
        type: 'STORE_EXPORT',
        title: `Competitor Price Spy Alert (${monitor.competitorName})`,
        message: `Competitor price changed to $${currentPrice}. Our price auto-adjusted to $${calculatedPrice} (Floor $${floor}${floorTriggered ? ' [FLOOR REACHED]' : ''}). Synced to ${syncedStoresCount} stores.`,
        severity: floorTriggered ? 'warning' : 'success',
        actionUrl: `/products/${monitor.globalProductId}`,
        metadata: {
          monitorId: monitor.id,
          competitorPrice: currentPrice,
          newOurPrice: calculatedPrice,
          floorTriggered,
        },
      });
    }

    return {
      monitorId: monitor.id,
      competitorName: monitor.competitorName,
      competitorUrl: monitor.competitorUrl,
      previousPrice: prevCompPrice,
      currentCompetitorPrice: currentPrice,
      ourCalculatedPrice: calculatedPrice,
      isInStock: scraped.inStock,
      priceChanged,
      undercutApplied: true,
      floorTriggered,
      syncedStoresCount,
    };
  }

  /**
   * Run audit scan for all active competitor monitors for tenant
   */
  public static async scanOrganizationCompetitors(organizationId: string) {
    const list = await db
      .select({ id: competitorMonitors.id })
      .from(competitorMonitors)
      .where(
        and(
          eq(competitorMonitors.organizationId, organizationId),
          eq(competitorMonitors.status, 'ACTIVE')
        )
      );

    const results: CompetitorCheckResult[] = [];
    for (const m of list) {
      try {
        const r = await this.executeMonitorCheck(m.id);
        results.push(r);
      } catch (err: any) {
        console.error(`[CompetitorSpy] Error checking monitor ${m.id}:`, err);
      }
    }

    return {
      scanned: list.length,
      priceChangesCount: results.filter((r) => r.priceChanged).length,
      syncedStoresTotal: results.reduce((acc, r) => acc + r.syncedStoresCount, 0),
      results,
    };
  }
}

