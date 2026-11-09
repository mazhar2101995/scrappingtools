import fs from 'fs';
import path from 'path';
import os from 'os';

export interface BrowserIsolationConfig {
  maxConcurrentBrowsers: number;
  navigationTimeoutMs: number;
  totalJobTimeoutMs: number;
  maxRetries: number;
  maxPerTenantConcurrent: number;
  tempDir: string;
}

export type BrowserFailureCategory =
  | 'BROWSER_LAUNCH_FAILED'
  | 'PAGE_NAVIGATION_TIMEOUT'
  | 'PAGE_CRASH'
  | 'JS_RENDERING_FAILED'
  | 'RESOURCE_EXHAUSTION'
  | 'EXTRACTION_FAILED_AFTER_RENDER';

export interface BrowserJobResult {
  success: boolean;
  content: string;
  statusCode: number;
  durationMs: number;
  byteSize: number;
  error?: {
    category: BrowserFailureCategory;
    message: string;
    isRetryable: boolean;
    rawError?: string;
  };
}

export interface BrowserOperationalMetrics {
  activeBrowserJobs: number;
  queuedBrowserJobs: number;
  maxConcurrency: number;
  totalBrowserJobsCompleted: number;
  totalBrowserTimeouts: number;
  totalBrowserFailures: number;
  totalCleanupsExecuted: number;
  avgJobDurationMs: number;
  activePerTenant: Record<string, number>;
  systemMemory: {
    freeMemoryMb: number;
    totalMemoryMb: number;
    processMemoryMb: number;
  };
}

export class BrowserIsolationManager {
  // Global Browser Isolation Configuration
  private static config: BrowserIsolationConfig = {
    maxConcurrentBrowsers: 3, // Strict bound: max 3 concurrent headless browsers across the server
    navigationTimeoutMs: 20000, // 20s navigation timeout
    totalJobTimeoutMs: 30000, // 30s hard total execution boundary per job
    maxRetries: 2,
    maxPerTenantConcurrent: 1, // Multi-tenant fairness: max 1 heavy browser job concurrently per tenant
    tempDir: path.join(os.tmpdir(), 'saas-browser-artifacts'),
  };

  private static activeJobs = 0;
  private static activePerTenant = new Map<string, number>();
  private static queueWaiters: Array<() => void> = [];

  // Observability Counters
  private static totalCompleted = 0;
  private static totalTimeouts = 0;
  private static totalFailures = 0;
  private static totalCleanups = 0;
  private static totalDurationMs = 0;

  static {
    // Ensure temp artifact directory exists
    try {
      if (!fs.existsSync(this.config.tempDir)) {
        fs.mkdirSync(this.config.tempDir, { recursive: true });
      }
    } catch (_) {}
  }

  /**
   * Update configurable browser resource limits dynamically
   */
  public static configure(newConfig: Partial<BrowserIsolationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (!fs.existsSync(this.config.tempDir)) {
      try {
        fs.mkdirSync(this.config.tempDir, { recursive: true });
      } catch (_) {}
    }
  }

  public static getConfig(): BrowserIsolationConfig {
    return { ...this.config };
  }

  /**
   * Acquire a browser concurrency slot with multi-tenant fairness protection
   */
  private static async acquireSlot(tenantId?: string): Promise<() => void> {
    const tid = tenantId || 'anonymous-default';

    while (true) {
      const tenantActive = this.activePerTenant.get(tid) || 0;

      // Check both global concurrency limit AND per-tenant concurrency cap
      if (this.activeJobs < this.config.maxConcurrentBrowsers && tenantActive < this.config.maxPerTenantConcurrent) {
        this.activeJobs++;
        this.activePerTenant.set(tid, tenantActive + 1);

        let released = false;
        return () => {
          if (!released) {
            released = true;
            this.activeJobs = Math.max(0, this.activeJobs - 1);
            const currentT = this.activePerTenant.get(tid) || 1;
            if (currentT <= 1) {
              this.activePerTenant.delete(tid);
            } else {
              this.activePerTenant.set(tid, currentT - 1);
            }

            // Wake up waiting queue jobs
            const nextWaiter = this.queueWaiters.shift();
            if (nextWaiter) nextWaiter();
          }
        };
      }

      // Slot not available or tenant quota saturated: suspend promise until capacity is released
      await new Promise<void>((resolve) => {
        this.queueWaiters.push(resolve);
      });
    }
  }

  /**
   * Execute an isolated, resource-guaranteed browser job
   */
  public static async executeBrowserJob(
    targetUrl: string,
    options: {
      tenantId?: string;
      timeoutMs?: number;
      waitForSelector?: string;
      captureSnapshot?: boolean;
    } = {}
  ): Promise<BrowserJobResult> {
    const startTime = Date.now();
    const releaseSlot = await this.acquireSlot(options.tenantId);

    let browser: any = null;
    let page: any = null;
    let jobTempFiles: string[] = [];

    // Overall job timeout timer
    const jobTimeoutMs = options.timeoutMs || this.config.totalJobTimeoutMs;
    let isJobTimedOut = false;

    try {
      // Guaranteed execution boundary
      const executionPromise = (async (): Promise<BrowserJobResult> => {
        const puppeteer = await import('puppeteer');

        // Step 1: Launch isolated lightweight headless shell instance
        try {
          browser = await puppeteer.default.launch({
            headless: 'shell',
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--no-first-run',
              '--no-zygote',
              '--single-process',
              '--disable-extensions',
            ],
          });
        } catch (launchErr: any) {
          return {
            success: false,
            content: '',
            statusCode: 500,
            durationMs: Date.now() - startTime,
            byteSize: 0,
            error: {
              category: 'BROWSER_LAUNCH_FAILED',
              message: `Chromium launch failed: ${launchErr.message}`,
              isRetryable: true,
              rawError: String(launchErr),
            },
          };
        }

        // Step 2: Open single isolated context & page
        page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 800 });

        // Step 3: Block heavy unnecessary media downloads (images, fonts, stylesheets) to save RAM/CPU
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          const resourceType = req.resourceType();
          if (['image', 'media', 'font'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });

        // Step 4: Navigate with strict timeout
        const navTimeout = Math.min(options.timeoutMs || this.config.navigationTimeoutMs, jobTimeoutMs - 5000);
        let response: any = null;
        try {
          response = await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: navTimeout,
          });
        } catch (navErr: any) {
          const isTimeout = navErr.name === 'TimeoutError' || navErr.message?.includes('timeout');
          return {
            success: false,
            content: '',
            statusCode: isTimeout ? 504 : 502,
            durationMs: Date.now() - startTime,
            byteSize: 0,
            error: {
              category: isTimeout ? 'PAGE_NAVIGATION_TIMEOUT' : 'PAGE_CRASH',
              message: `Page navigation failed: ${navErr.message}`,
              isRetryable: true,
              rawError: String(navErr),
            },
          };
        }

        // Optional selector wait
        if (options.waitForSelector) {
          try {
            await page.waitForSelector(options.waitForSelector, { timeout: 5000 });
          } catch (_) {
            // Optional wait non-fatal, proceed with available content
          }
        }

        // Step 5: Extract rendered DOM content
        const content = await page.content();
        const statusCode = response ? response.status() : 200;
        const byteSize = Buffer.byteLength(content, 'utf8');

        // Optional temporary artifact file for provenance (with lifecycle tracking)
        if (options.captureSnapshot) {
          const snapshotPath = path.join(this.config.tempDir, `snap_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
          await fs.promises.writeFile(snapshotPath, content, 'utf8');
          jobTempFiles.push(snapshotPath);
        }

        return {
          success: statusCode >= 200 && statusCode < 300,
          content,
          statusCode,
          durationMs: Date.now() - startTime,
          byteSize,
        };
      })();

      // Enforce hard timeout boundary
      const timeoutPromise = new Promise<BrowserJobResult>((_, reject) => {
        setTimeout(() => {
          isJobTimedOut = true;
          reject(new Error(`Browser total job execution exceeded ${jobTimeoutMs}ms`));
        }, jobTimeoutMs);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      this.totalCompleted++;
      this.totalDurationMs += result.durationMs;
      return result;
    } catch (err: any) {
      if (isJobTimedOut) {
        this.totalTimeouts++;
      }
      this.totalFailures++;

      return {
        success: false,
        content: '',
        statusCode: 504,
        durationMs: Date.now() - startTime,
        byteSize: 0,
        error: {
          category: isJobTimedOut ? 'PAGE_NAVIGATION_TIMEOUT' : 'JS_RENDERING_FAILED',
          message: err.message,
          isRetryable: true,
          rawError: String(err),
        },
      };
    } finally {
      // ---------------------------------------------------------
      // MANDATORY RESOURCE CLEANUP (Runs on success, error, timeout)
      // ---------------------------------------------------------
      if (page) {
        await page.close().catch(() => {});
        page = null;
      }
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }

      // Cleanup job-level temporary files
      for (const tempFile of jobTempFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            await fs.promises.unlink(tempFile);
          }
        } catch (_) {}
      }

      this.totalCleanups++;
      releaseSlot();
    }
  }

  /**
   * Return real-time operational metrics for platform admin & monitoring
   */
  public static getOperationalMetrics(): BrowserOperationalMetrics {
    const memoryUsage = process.memoryUsage();
    const activeTenantObj: Record<string, number> = {};
    for (const [t, count] of this.activePerTenant.entries()) {
      activeTenantObj[t] = count;
    }

    return {
      activeBrowserJobs: this.activeJobs,
      queuedBrowserJobs: this.queueWaiters.length,
      maxConcurrency: this.config.maxConcurrentBrowsers,
      totalBrowserJobsCompleted: this.totalCompleted,
      totalBrowserTimeouts: this.totalTimeouts,
      totalBrowserFailures: this.totalFailures,
      totalCleanupsExecuted: this.totalCleanups,
      avgJobDurationMs: this.totalCompleted > 0 ? Math.round(this.totalDurationMs / this.totalCompleted) : 0,
      activePerTenant: activeTenantObj,
      systemMemory: {
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        processMemoryMb: Math.round(memoryUsage.rss / (1024 * 1024)),
      },
    };
  }

  /**
   * Safe sweep of any stale temporary browser artifact files older than maxAgeMs
   */
  public static async pruneStaleArtifacts(maxAgeMs: number = 300000): Promise<number> {
    let deleted = 0;
    try {
      if (!fs.existsSync(this.config.tempDir)) return 0;
      const files = await fs.promises.readdir(this.config.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.config.tempDir, file);
        const stats = await fs.promises.stat(filePath).catch(() => null);
        if (stats && now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath).catch(() => {});
          deleted++;
        }
      }
    } catch (_) {}
    return deleted;
  }
}

