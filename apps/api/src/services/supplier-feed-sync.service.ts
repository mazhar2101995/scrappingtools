import axios from 'axios';
import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import * as ftp from 'basic-ftp';
import { db, supplierFeedSources, globalProducts, customerProductOverrides, storeProductMappings } from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { StoreExportExecutionService } from './store-export-execution.service';
import { NotificationAndWebhookService } from './notification-and-webhook.service';

export interface FeedConnectionConfig {
  // FTP / SFTP
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  remotePath?: string;
  secure?: boolean;
  // Direct HTTP / Google Sheet
  url?: string;
  authHeader?: string;
}

export interface FeedColumnMapping {
  sku: string;
  price: string;
  stock?: string;
  title?: string;
  upc?: string;
}

export class SupplierFeedSyncService {
  /**
   * Convert any Google Sheet URL to direct CSV export format
   */
  public static normalizeGoogleSheetUrl(url: string): string {
    if (url.includes('docs.google.com/spreadsheets')) {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        // Extract gid if available (specific tab)
        const gidMatch = url.match(/gid=([0-9]+)/);
        const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
        return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
      }
    }
    return url;
  }

  /**
   * Fetch raw buffer or string from FTP, HTTP URL, or Google Sheet
   */
  public static async fetchFeedData(
    type: string,
    config: FeedConnectionConfig
  ): Promise<{ buffer: Buffer; fileName: string }> {
    if (type === 'FTP' || type === 'SFTP') {
      const client = new ftp.Client();
      client.ftp.verbose = false;
      try {
        await client.access({
          host: config.host || '',
          port: config.port || 21,
          user: config.username || 'anonymous',
          password: config.password || '',
          secure: config.secure || false,
        });

        const remotePath = config.remotePath || '/';
        const chunks: Buffer[] = [];
        
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const stream = require('stream');
        const memoryStream = new stream.Writable({
          write(chunk: any, encoding: any, callback: any) {
            chunks.push(Buffer.from(chunk));
            callback();
          },
        });

        await client.downloadTo(memoryStream, remotePath);
        client.close();

        return {
          buffer: Buffer.concat(chunks),
          fileName: remotePath.split('/').pop() || 'feed.csv',
        };
      } catch (err: any) {
        client.close();
        throw new Error(`FTP connection failed: ${err.message}`);
      }
    } else {
      // HTTP_URL or GOOGLE_SHEETS
      const targetUrl = type === 'GOOGLE_SHEETS' 
        ? this.normalizeGoogleSheetUrl(config.url || '') 
        : (config.url || '');

      if (!targetUrl) throw new Error('Feed URL is required');

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ProductIntelligence/2.0',
      };
      if (config.authHeader) {
        headers['Authorization'] = config.authHeader;
      }

      const response = await axios.get(targetUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      return {
        buffer: Buffer.from(response.data),
        fileName: targetUrl.split('?')[0].split('/').pop() || 'feed_download.csv',
      };
    }
  }

  /**
   * Parse downloaded feed data (CSV or Excel) into array of records
   */
  public static parseFeedRecords(buffer: Buffer, fileName: string): Record<string, any>[] {
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      return xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      // Try CSV parsing
      const text = buffer.toString('utf-8');
      return parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    }
  }

  /**
   * Preview first 5 rows and detect available column headers for UI auto-mapping
   */
  public static async previewFeed(type: string, config: FeedConnectionConfig) {
    const { buffer, fileName } = await this.fetchFeedData(type, config);
    const records = this.parseFeedRecords(buffer, fileName);

    if (records.length === 0) {
      throw new Error('Feed file is empty or could not be parsed');
    }

    const availableColumns = Object.keys(records[0]);
    const sampleRows = records.slice(0, 5);

    // Smart Guessing for default mapping
    const lowerCols = availableColumns.map(c => ({ original: c, lower: c.toLowerCase().replace(/[^a-z0-9]/g, '') }));
    
    const suggestedMapping: FeedColumnMapping = {
      sku: lowerCols.find(c => ['sku', 'itemno', 'itemnumber', 'partnumber', 'model', 'code', 'productid'].includes(c.lower))?.original || availableColumns[0],
      price: lowerCols.find(c => ['price', 'wholesaleprice', 'cost', 'dealerprice', 'unitprice', 'netprice', 'rate'].includes(c.lower))?.original || availableColumns[1] || '',
      stock: lowerCols.find(c => ['stock', 'qty', 'quantity', 'onhand', 'available', 'inventory'].includes(c.lower))?.original || '',
      title: lowerCols.find(c => ['title', 'name', 'productname', 'description', 'itemname'].includes(c.lower))?.original || '',
    };

    return {
      fileName,
      totalRows: records.length,
      availableColumns,
      suggestedMapping,
      sampleRows,
    };
  }

  /**
   * Execute full ingestion & sync of a supplier feed source
   */
  public static async executeFeedSync(feedId: string, organizationId: string): Promise<{
    processed: number;
    updated: number;
    syncedStoresCount: number;
  }> {
    const [feed] = await db
      .select()
      .from(supplierFeedSources)
      .where(
        and(
          eq(supplierFeedSources.id, feedId),
          eq(supplierFeedSources.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!feed) throw new Error('Supplier feed source not found');

    // Mark as RUNNING
    await db
      .update(supplierFeedSources)
      .set({ lastSyncStatus: 'RUNNING', updatedAt: new Date() })
      .where(eq(supplierFeedSources.id, feed.id));

    try {
      const config = feed.connectionConfig as FeedConnectionConfig;
      const mapping = feed.columnMapping as FeedColumnMapping;

      const { buffer, fileName } = await this.fetchFeedData(feed.feedType, config);
      const records = this.parseFeedRecords(buffer, fileName);

      let processed = 0;
      let updated = 0;
      let syncedStoresCount = 0;

      for (const row of records) {
        processed++;
        const rawSku = String(row[mapping.sku] || '').trim();
        if (!rawSku) continue;

        const rawPrice = row[mapping.price];
        const rawStock = mapping.stock ? row[mapping.stock] : null;

        const cleanPrice = rawPrice ? parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) : null;
        const cleanStock = rawStock ? parseInt(String(rawStock).replace(/[^0-9]/g, ''), 10) : null;

        // Find product matching this SKU or modelNumber in globalProducts
        const [matchedProduct] = await db
          .select({
            id: globalProducts.id,
            canonicalTitle: globalProducts.canonicalTitle,
          })
          .from(globalProducts)
          .where(eq(globalProducts.modelNumber, rawSku))
          .limit(1);

        if (!matchedProduct) continue;

        // Fetch or create customerProductOverride for this product
        const [existingOverride] = await db
          .select()
          .from(customerProductOverrides)
          .where(
            and(
              eq(customerProductOverrides.organizationId, organizationId),
              eq(customerProductOverrides.globalProductId, matchedProduct.id)
            )
          )
          .limit(1);

        const customAttrs = (existingOverride?.customAttributes as any) || {};
        let changed = false;

        if (cleanPrice !== null && !isNaN(cleanPrice)) {
          if (customAttrs.price !== String(cleanPrice)) {
            customAttrs.price = String(cleanPrice);
            customAttrs.feed_price = String(cleanPrice);
            changed = true;
          }
        }

        if (cleanStock !== null && !isNaN(cleanStock)) {
          if (customAttrs.stock !== String(cleanStock)) {
            customAttrs.stock = String(cleanStock);
            customAttrs.feed_stock = String(cleanStock);
            changed = true;
          }
        }

        if (changed) {
          if (existingOverride) {
            await db
              .update(customerProductOverrides)
              .set({ customAttributes: customAttrs, updatedAt: new Date() })
              .where(eq(customerProductOverrides.id, existingOverride.id));
          } else {
            await db.insert(customerProductOverrides).values({
              organizationId,
              globalProductId: matchedProduct.id,
              customAttributes: customAttrs,
            });
          }
          updated++;

          // Auto-push changes to connected stores if enabled
          if (feed.autoPushToStores) {
            const mappings = await db
              .select({ storeId: storeProductMappings.connectedStoreId })
              .from(storeProductMappings)
              .where(eq(storeProductMappings.globalProductId, matchedProduct.id));

            for (const m of mappings) {
              try {
                const plan = await StoreExportExecutionService.generateChangePlan(
                  organizationId,
                  matchedProduct.id,
                  m.storeId
                );
                if (plan.planId) {
                  await StoreExportExecutionService.executeControlledPush(organizationId, plan.planId);
                  syncedStoresCount++;
                }
              } catch (_) {}
            }
          }
        }
      }

      // Mark as SUCCESS
      await db
        .update(supplierFeedSources)
        .set({
          lastSyncStatus: 'SUCCESS',
          lastSyncAt: new Date(),
          lastItemsProcessed: processed,
          lastItemsUpdated: updated,
          lastErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(supplierFeedSources.id, feed.id));

      // Dispatch alert
      await NotificationAndWebhookService.dispatch({
        organizationId,
        type: 'STORE_EXPORT',
        title: `Supplier Feed Sync Completed (${feed.feedName})`,
        message: `Processed ${processed} rows from ${fileName}. Updated ${updated} products and synced to ${syncedStoresCount} stores.`,
        severity: 'success',
        actionUrl: `/settings/suppliers`,
      });

      return { processed, updated, syncedStoresCount };
    } catch (err: any) {
      await db
        .update(supplierFeedSources)
        .set({
          lastSyncStatus: 'FAILED',
          lastErrorMessage: err.message || 'Sync failed',
          updatedAt: new Date(),
        })
        .where(eq(supplierFeedSources.id, feed.id));
      throw err;
    }
  }
}
