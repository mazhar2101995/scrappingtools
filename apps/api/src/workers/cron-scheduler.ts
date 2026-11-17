import { BackgroundSyncSchedulerService } from '../services/background-sync-scheduler.service';
import { createRedisConnection, createStoreSyncWorker, storeSyncQueue } from '@saas/queue';
import { StoreExportExecutionService } from '../services/store-export-execution.service';
import { db, globalProducts, brands } from '@saas/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export class CronScheduler {
  private static instance: CronScheduler | null = null;
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private scanIntervalMs: number = 60000; // 60 seconds
  private lastHeartbeatAt: Date | null = null;
  private lastScanAt: Date | null = null;
  private lastError: string | null = null;
  private totalScansCount: number = 0;
  private dispatchedJobsCount: number = 0;
  private failedScansCount: number = 0;
  private instanceId: string = `scheduler_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  private isScanInProgress: boolean = false;
  private syncWorker: any = null;

  private constructor() {
    this.setupGracefulShutdown();
  }

  public static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  public start(intervalMs = 60000): void {
    if (this.isRunning) {
      console.log(`[CronScheduler] Instance already running (PID: ${process.pid}). Skipping duplicate start.`);
      return;
    }

    this.scanIntervalMs = intervalMs;
    this.isRunning = true;
    this.lastHeartbeatAt = new Date();
    console.log(`[CronScheduler] Started persistent background cron runner (Interval: ${this.scanIntervalMs / 1000}s, Instance ID: ${this.instanceId})`);

    // Start BullMQ Store Sync Worker with live push synchronization handler
    try {
      this.syncWorker = createStoreSyncWorker(async (payload) => {
        const { organizationId, storeId, brandId, targetLanguage } = payload;
        let targetProducts: { id: string }[] = [];
        if (brandId) {
          targetProducts = await db
            .select({ id: globalProducts.id })
            .from(globalProducts)
            .innerJoin(brands, eq(globalProducts.brandId, brands.id))
            .where(and(eq(brands.organizationId, organizationId), eq(globalProducts.brandId, brandId)));
        } else {
          targetProducts = await db
            .select({ id: globalProducts.id })
            .from(globalProducts)
            .innerJoin(brands, eq(globalProducts.brandId, brands.id))
            .where(eq(brands.organizationId, organizationId));
        }

        if (targetProducts.length === 0) {
          return {
            success: true,
            succeededCount: 0,
            failedCount: 0,
            totalRequested: 0,
            summary: 'No eligible products found matching schedule brand filters.',
          };
        }

        const productIds = targetProducts.map((p) => p.id);
        const pushResult = await StoreExportExecutionService.executeBulkControlledPush(
          organizationId,
          productIds,
          storeId,
          targetLanguage || 'en'
        );

        return {
          success: pushResult.failedCount === 0,
          succeededCount: pushResult.succeededCount,
          failedCount: pushResult.failedCount,
          totalRequested: pushResult.totalRequested,
          summary: pushResult.failedCount === 0
            ? `Successfully exported ${pushResult.succeededCount}/${pushResult.totalRequested} products to store.`
            : `Partially exported: ${pushResult.succeededCount} succeeded, ${pushResult.failedCount} failed out of ${pushResult.totalRequested}.`,
        };
      });
    } catch (workerErr) {
      console.error('[CronScheduler] Error starting store sync worker:', workerErr);
    }

    // Run initial scan immediately
    this.executeScanCycle().catch((err) => {
      console.error('[CronScheduler] Error during initial scan:', err);
    });

    // Schedule persistent recurring interval
    this.intervalTimer = setInterval(() => {
      this.executeScanCycle().catch((err) => {
        console.error('[CronScheduler] Error during recurring scan:', err);
      });
    }, this.scanIntervalMs);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(`[CronScheduler] Stopping background scheduler runner...`);
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.syncWorker) {
      await this.syncWorker.close().catch(() => {});
      this.syncWorker = null;
    }

    this.isRunning = false;
    console.log(`[CronScheduler] Scheduler stopped cleanly.`);
  }

  public async executeScanCycle(): Promise<{
    executed: boolean;
    reason?: string;
    result?: any;
  }> {
    this.lastHeartbeatAt = new Date();

    // Prevent overlapping scans within this process
    if (this.isScanInProgress) {
      console.log(`[CronScheduler] Previous scan still in progress. Skipping overlapping tick.`);
      return { executed: false, reason: 'OVERLAPPING_SCAN_PREVENTED' };
    }

    this.isScanInProgress = true;
    const redis = createRedisConnection();
    const lockKey = 'lock:scheduler:global_scan';

    try {
      // Distributed Lock across multi-pod/instance clusters
      // 55-second TTL ensures lock auto-releases before the next 60s cycle
      const acquired = await redis.set(lockKey, this.instanceId, 'PX', 55000, 'NX');

      if (!acquired) {
        console.log(`[CronScheduler] Global scan lock held by another instance. Skipping scan cycle.`);
        return { executed: false, reason: 'LOCKED_BY_ANOTHER_INSTANCE' };
      }

      this.lastScanAt = new Date();
      this.totalScansCount++;

      // Delegate due schedule processing to BackgroundSyncSchedulerService
      const scanResult = await BackgroundSyncSchedulerService.runDueSchedules();
      this.dispatchedJobsCount += scanResult.dispatched;
      this.lastError = null;

      return {
        executed: true,
        result: scanResult,
      };
    } catch (err: any) {
      this.failedScansCount++;
      this.lastError = err.message || 'Unknown scan error';
      console.error(`[CronScheduler] Scan execution error:`, err);
      // Release lock on failure so subsequent cycle can recover immediately
      try {
        const currentHolder = await redis.get(lockKey);
        if (currentHolder === this.instanceId) {
          await redis.del(lockKey);
        }
      } catch (_) {}
      return { executed: false, reason: 'ERROR', result: { error: err.message } };
    } finally {
      this.isScanInProgress = false;
      await redis.quit().catch(() => {});
    }
  }

  public getStatus() {
    return {
      status: this.isRunning ? 'RUNNING' : 'STOPPED',
      instanceId: this.instanceId,
      lastHeartbeatAt: this.lastHeartbeatAt ? this.lastHeartbeatAt.toISOString() : null,
      lastScanAt: this.lastScanAt ? this.lastScanAt.toISOString() : null,
      scanIntervalSeconds: this.scanIntervalMs / 1000,
      totalScansCount: this.totalScansCount,
      dispatchedJobsCount: this.dispatchedJobsCount,
      failedScansCount: this.failedScansCount,
      lastError: this.lastError,
    };
  }

  private setupGracefulShutdown(): void {
    const handleShutdown = async (signal: string) => {
      console.log(`[CronScheduler] Received ${signal}. Initiating graceful shutdown...`);
      await this.stop();
    };

    process.once('SIGINT', () => handleShutdown('SIGINT'));
    process.once('SIGTERM', () => handleShutdown('SIGTERM'));
  }
}
