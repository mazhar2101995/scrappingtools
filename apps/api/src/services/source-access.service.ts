import { normalizeProductUrl, NormalizedUrlResult } from '../utils/url-normalizer';
import { db, sourceCache, sourceVersionHistory } from '@saas/database';
import { eq, sql, lt } from 'drizzle-orm';
import crypto from 'crypto';
import { SourceHealthService } from './source-health.service';
import { BrowserIsolationManager, BrowserFailureCategory } from './browser-isolation.service';
import { NetworkRouteManager, RouteDecision } from './network-route-manager.service';

export type AcquisitionMethod = 'DIRECT_HTTP' | 'CONTROLLED_BROWSER' | 'CACHED_INFLIGHT' | 'VERIFIED_CACHE';

export type AcquisitionErrorCategory =
  | 'INVALID_URL'
  | 'DNS_LOOKUP_FAILED'
  | 'CONNECTION_REFUSED'
  | 'TIMEOUT'
  | 'RATE_LIMITED_429'
  | 'ACCESS_FORBIDDEN_403'
  | 'NOT_FOUND_404'
  | 'SERVER_ERROR_5XX'
  | 'EMPTY_PAYLOAD'
  | 'BROWSER_LAUNCH_FAILED'
  | 'PAGE_NAVIGATION_TIMEOUT'
  | 'PAGE_CRASH'
  | 'JS_RENDERING_FAILED'
  | 'RESOURCE_EXHAUSTION'
  | 'EXTRACTION_FAILED_AFTER_RENDER'
  | 'UNKNOWN_ERROR';

export interface AcquisitionOptions {
  timeoutMs?: number;
  useBrowser?: boolean;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
  bypassCache?: boolean;
  cacheTtlHours?: number; // Configurable freshness window (defaults to 168h / 7 days)
  tenantId?: string; // Multi-tenant fairness quota identifier
  waitForSelector?: string;
  captureSnapshot?: boolean;
  bypassProxy?: boolean; // Force direct connection
  forceProxy?: boolean; // Force proxy route testing
}

export interface AcquisitionResult {
  success: boolean;
  originalUrl: string;
  normalizedUrl: string;
  domain: string;
  urlHash: string;
  method: AcquisitionMethod;
  statusCode: number;
  content: string; // Raw HTML / payload
  contentType: string;
  byteSize: number;
  durationMs: number;
  isCached?: boolean;
  contentHash?: string;
  versionNumber?: number;
  route?: {
    type: 'DIRECT' | 'PROXY' | 'DEFERRED';
    routeId: string;
    providerId: string;
    reason: string;
  };
  error?: {
    category: AcquisitionErrorCategory;
    message: string;
    isRetryable: boolean;
    suggestedDelaySec?: number;
    rawError?: string;
  };
}

/**
 * Domain Concurrency & Pacing Gate
 */
interface DomainThrottleState {
  activeCount: number;
  lastRequestTime: number;
  concurrencyLimit: number;
  minPacingMs: number;
}

export class SourceAccessService {
  private static domainStates = new Map<string, DomainThrottleState>();

  // In-flight request deduplication map (Normalized URL Hash -> Promise<AcquisitionResult>)
  private static inFlightRequests = new Map<string, Promise<AcquisitionResult>>();

  // Default per-domain limits: Max 2 concurrent requests, 1000ms delay between hits
  private static DEFAULT_CONCURRENCY = 2;
  private static DEFAULT_PACING_MS = 1000;

  /**
   * Configure domain-specific limits (e.g. for official high-capacity vs fragile distributor servers)
   */
  public static configureDomain(domain: string, concurrency: number, pacingMs: number): void {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    this.domainStates.set(cleanDomain, {
      activeCount: 0,
      lastRequestTime: 0,
      concurrencyLimit: concurrency,
      minPacingMs: pacingMs,
    });
  }

  /**
   * Acquire a domain lock token adhering to concurrency limits & pacing
   */
  private static async acquireDomainSlot(domain: string): Promise<() => void> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    if (!this.domainStates.has(cleanDomain)) {
      this.domainStates.set(cleanDomain, {
        activeCount: 0,
        lastRequestTime: 0,
        concurrencyLimit: this.DEFAULT_CONCURRENCY,
        minPacingMs: this.DEFAULT_PACING_MS,
      });
    }

    const state = this.domainStates.get(cleanDomain)!;

    // Wait until an active concurrency slot is free
    while (state.activeCount >= state.concurrencyLimit) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Enforce request pacing (min time between hits to same domain)
    const now = Date.now();
    const elapsedSinceLast = now - state.lastRequestTime;
    if (elapsedSinceLast < state.minPacingMs) {
      const waitTime = state.minPacingMs - elapsedSinceLast;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    state.activeCount++;
    state.lastRequestTime = Date.now();

    // Return release slot callback
    return () => {
      state.activeCount = Math.max(0, state.activeCount - 1);
    };
  }

  /**
   * Primary Entry Point: Safely acquires source with URL Normalization,
   * In-Flight Deduplication, and Domain Concurrency Control.
   */
  public static async acquireSource(
    rawUrl: string,
    options: AcquisitionOptions = {}
  ): Promise<AcquisitionResult> {
    const startTime = Date.now();
    const norm: NormalizedUrlResult = normalizeProductUrl(rawUrl);

    if (!norm.isValid) {
      return {
        success: false,
        originalUrl: rawUrl,
        normalizedUrl: rawUrl,
        domain: '',
        urlHash: '',
        method: 'DIRECT_HTTP',
        statusCode: 400,
        content: '',
        contentType: '',
        byteSize: 0,
        durationMs: Date.now() - startTime,
        error: {
          category: 'INVALID_URL',
          message: 'Malformed or non-HTTP product URL provided',
          isRetryable: false,
        },
      };
    }

    // --- STEP 1: CACHE-FIRST CHECK (VERIFIED REUSABLE SOURCE DATA) ---
    const defaultTtlHours = options.cacheTtlHours || 168; // Default 7 days freshness window
    if (!options.bypassCache) {
      try {
        const [cached] = await db
          .select()
          .from(sourceCache)
          .where(eq(sourceCache.urlHash, norm.urlHash))
          .limit(1);

        if (cached && new Date(cached.expiresAt) > new Date() && cached.content) {
          // Cache Hit! Update access metrics asynchronously
          db.update(sourceCache)
            .set({
              lastAccessedAt: new Date(),
              accessCount: sql`${sourceCache.accessCount} + 1`,
            })
            .where(eq(sourceCache.id, cached.id))
            .execute()
            .catch(() => {});

          return {
            success: true,
            originalUrl: rawUrl, // Preserve client's original URL for provenance
            normalizedUrl: cached.normalizedUrl,
            domain: cached.domain,
            urlHash: cached.urlHash,
            method: 'VERIFIED_CACHE',
            statusCode: cached.statusCode,
            content: cached.content,
            contentType: cached.contentType,
            byteSize: cached.byteSize,
            durationMs: Date.now() - startTime,
            isCached: true,
            contentHash: cached.contentHash,
            versionNumber: cached.versionNumber,
          };
        }
      } catch (cacheLookupErr) {
        console.warn('[SourceAccess] Cache lookup error, proceeding to live fetch:', cacheLookupErr);
      }
    }

    // --- STEP 2: DUPLICATE IN-FLIGHT COALESCING ---
    // If another job/tenant is already actively acquiring this exact normalized URL, coalesce!
    if (this.inFlightRequests.has(norm.urlHash)) {
      console.log(`[SourceAccess] Coalescing concurrent in-flight acquisition for ${norm.normalizedUrl}`);
      try {
        const sharedResult = await this.inFlightRequests.get(norm.urlHash)!;
        return {
          ...sharedResult,
          originalUrl: rawUrl, // Preserve current tenant's original URL for provenance
          method: 'CACHED_INFLIGHT',
          durationMs: Date.now() - startTime,
        };
      } catch {
        // If coalesced request failed, fall through to retry independently
      }
    }

    // --- STEP 3: NETWORK ROUTE MANAGER & PRE-FLIGHT DECISION ---
    const routeDecision = await NetworkRouteManager.determineRoute(norm.normalizedDomain, {
      bypassProxy: options.bypassProxy,
      forceProxy: options.forceProxy,
    });

    if (routeDecision.type === 'DEFERRED') {
      console.warn(`[SourceAccess] Route deferred for ${norm.normalizedDomain}: ${routeDecision.reason}`);
      return {
        success: false,
        originalUrl: rawUrl,
        normalizedUrl: norm.normalizedUrl,
        domain: norm.normalizedDomain,
        urlHash: norm.urlHash,
        method: 'DIRECT_HTTP',
        statusCode: 429,
        content: '',
        contentType: '',
        byteSize: 0,
        durationMs: Date.now() - startTime,
        route: {
          type: 'DEFERRED',
          routeId: routeDecision.routeId,
          providerId: routeDecision.providerId,
          reason: routeDecision.reason,
        },
        error: {
          category: 'RATE_LIMITED_429',
          message: SourceHealthService.getClientFriendlyMessage('RATE_LIMITED_429', 429),
          isRetryable: true,
          suggestedDelaySec: routeDecision.deferralDelaySec || 60,
          rawError: routeDecision.reason,
        },
      };
    }

    // --- STEP 4: EXECUTE ACQUISITION UNDER MANAGED DOMAIN CONCURRENCY ---
    const acquisitionPromise = (async (): Promise<AcquisitionResult> => {
      const releaseSlot = await this.acquireDomainSlot(norm.normalizedDomain);
      const releaseRouteSlot = NetworkRouteManager.acquireRouteSlot(routeDecision.routeId);
      try {
        let result: AcquisitionResult;
        if (options.useBrowser) {
          result = await this.executeControlledBrowser(norm, options);
        } else {
          result = await this.executeDirectHttp(norm, options);
        }

        result.route = {
          type: routeDecision.type,
          routeId: routeDecision.routeId,
          providerId: routeDecision.providerId,
          reason: routeDecision.reason,
        };

        // --- STEP 5: RECORD ROUTE & DOMAIN HEALTH INTELLIGENCE ---
        if (result.success && result.content) {
          await SourceHealthService.recordSuccess(norm.normalizedDomain, result.durationMs, result.statusCode);
          await NetworkRouteManager.recordRouteSuccess(routeDecision.routeId, routeDecision.providerId, result.durationMs);
          await this.saveOrUpdateCache(norm, result, defaultTtlHours);
        } else if (!result.success && result.error) {
          await SourceHealthService.recordFailure(
            norm.normalizedDomain,
            result.error.category,
            result.error.message,
            result.statusCode,
            result.error.suggestedDelaySec
          );
          await NetworkRouteManager.recordRouteFailure(
            routeDecision.routeId,
            routeDecision.providerId,
            result.error.message,
            result.statusCode
          );
          // SAFE FAILURE HANDLING: Never overwrite valid cached data with failure!
          await this.recordCacheFailure(norm, result.error);
        }

        return result;
      } finally {
        releaseRouteSlot();
        releaseSlot();
      }
    })();

    // Register in-flight promise
    this.inFlightRequests.set(norm.urlHash, acquisitionPromise);

    try {
      const result = await acquisitionPromise;
      return result;
    } finally {
      // Remove from in-flight tracker once settled
      this.inFlightRequests.delete(norm.urlHash);
    }
  }

  /**
   * Save or Update Source Cache with Cryptographic SHA-256 Fingerprint & Versioning
   */
  private static async saveOrUpdateCache(
    norm: NormalizedUrlResult,
    result: AcquisitionResult,
    ttlHours: number
  ): Promise<void> {
    try {
      const contentHash = crypto.createHash('sha256').update(result.content).digest('hex');
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      // Check existing cached version
      const [existing] = await db
        .select()
        .from(sourceCache)
        .where(eq(sourceCache.urlHash, norm.urlHash))
        .limit(1);

      if (!existing) {
        // Initial Version 1
        await db.insert(sourceCache).values({
          urlHash: norm.urlHash,
          normalizedUrl: norm.normalizedUrl,
          originalUrl: norm.originalUrl,
          domain: norm.normalizedDomain,
          contentHash,
          statusCode: result.statusCode,
          contentType: result.contentType,
          content: result.content,
          byteSize: result.byteSize,
          acquisitionMethod: result.method,
          versionNumber: 1,
          acquiredAt: new Date(),
          expiresAt,
          lastAccessedAt: new Date(),
          accessCount: 1,
        });

        // Record version 1 in history
        await db.insert(sourceVersionHistory).values({
          urlHash: norm.urlHash,
          normalizedUrl: norm.normalizedUrl,
          contentHash,
          versionNumber: 1,
          byteSize: result.byteSize,
          contentDiffSummary: 'Initial source acquisition',
        });
      } else {
        // Content Fingerprint Comparison
        const hasChanged = existing.contentHash !== contentHash;
        const nextVersion = hasChanged ? existing.versionNumber + 1 : existing.versionNumber;

        await db
          .update(sourceCache)
          .set({
            contentHash,
            statusCode: result.statusCode,
            contentType: result.contentType,
            content: result.content,
            byteSize: result.byteSize,
            acquisitionMethod: result.method,
            versionNumber: nextVersion,
            acquiredAt: new Date(),
            expiresAt,
            lastAccessedAt: new Date(),
            accessCount: sql`${sourceCache.accessCount} + 1`,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(sourceCache.id, existing.id));

        if (hasChanged) {
          console.log(`[SourceCache] Source content change detected for ${norm.normalizedUrl}! Upgrading to v${nextVersion}`);
          await db.insert(sourceVersionHistory).values({
            urlHash: norm.urlHash,
            normalizedUrl: norm.normalizedUrl,
            contentHash,
            versionNumber: nextVersion,
            byteSize: result.byteSize,
            contentDiffSummary: `Content hash changed from ${existing.contentHash.substring(0, 8)} to ${contentHash.substring(0, 8)}`,
          });
        }
      }
    } catch (saveErr) {
      console.warn('[SourceCache] Could not persist source cache:', saveErr);
    }
  }

  /**
   * Safe Failure Recording: Attaches error metadata without destroying existing content
   */
  private static async recordCacheFailure(norm: NormalizedUrlResult, error: any): Promise<void> {
    try {
      await db
        .update(sourceCache)
        .set({
          lastError: error,
          updatedAt: new Date(),
        })
        .where(eq(sourceCache.urlHash, norm.urlHash));
    } catch (_) {}
  }

  /**
   * Lightweight Direct HTTP Acquisition (Default Strategy)
   */
  private static async executeDirectHttp(
    norm: NormalizedUrlResult,
    options: AcquisitionOptions
  ): Promise<AcquisitionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(norm.normalizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.headers,
        },
      });

      clearTimeout(timer);
      const text = await res.text();
      const durationMs = Date.now() - startTime;
      const contentType = res.headers.get('content-type') || 'text/html';

      if (!res.ok) {
        return {
          success: false,
          originalUrl: norm.originalUrl,
          normalizedUrl: norm.normalizedUrl,
          domain: norm.normalizedDomain,
          urlHash: norm.urlHash,
          method: 'DIRECT_HTTP',
          statusCode: res.status,
          content: text,
          contentType,
          byteSize: Buffer.byteLength(text, 'utf8'),
          durationMs,
          error: this.classifyHttpError(res.status, text),
        };
      }

      if (!text || text.trim().length < 50) {
        return {
          success: false,
          originalUrl: norm.originalUrl,
          normalizedUrl: norm.normalizedUrl,
          domain: norm.normalizedDomain,
          urlHash: norm.urlHash,
          method: 'DIRECT_HTTP',
          statusCode: res.status,
          content: text,
          contentType,
          byteSize: 0,
          durationMs,
          error: {
            category: 'EMPTY_PAYLOAD',
            message: 'Source server returned an empty or insufficient HTML body',
            isRetryable: true,
          },
        };
      }

      return {
        success: true,
        originalUrl: norm.originalUrl,
        normalizedUrl: norm.normalizedUrl,
        domain: norm.normalizedDomain,
        urlHash: norm.urlHash,
        method: 'DIRECT_HTTP',
        statusCode: res.status,
        content: text,
        contentType,
        byteSize: Buffer.byteLength(text, 'utf8'),
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      let category: AcquisitionErrorCategory = 'UNKNOWN_ERROR';
      let isRetryable = true;

      if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        category = 'TIMEOUT';
        isRetryable = true;
      } else if (err.cause?.code === 'ENOTFOUND' || err.message?.includes('getaddrinfo')) {
        category = 'DNS_LOOKUP_FAILED';
        isRetryable = false;
      } else if (err.cause?.code === 'ECONNREFUSED') {
        category = 'CONNECTION_REFUSED';
        isRetryable = true;
      }

      return {
        success: false,
        originalUrl: norm.originalUrl,
        normalizedUrl: norm.normalizedUrl,
        domain: norm.normalizedDomain,
        urlHash: norm.urlHash,
        method: 'DIRECT_HTTP',
        statusCode: 0,
        content: '',
        contentType: '',
        byteSize: 0,
        durationMs,
        error: {
          category,
          message: `Network acquisition failed: ${err.message}`,
          isRetryable,
          rawError: String(err),
        },
      };
    }
  }

  /**
   * Controlled Browser Execution via Isolated BrowserIsolationManager
   * (Enforces concurrency bounds, timeouts, request abortion of media, and guaranteed process cleanup)
   */
  private static async executeControlledBrowser(
    norm: NormalizedUrlResult,
    options: AcquisitionOptions
  ): Promise<AcquisitionResult> {
    const browserResult = await BrowserIsolationManager.executeBrowserJob(norm.normalizedUrl, {
      tenantId: options.tenantId,
      timeoutMs: options.timeoutMs,
      waitForSelector: options.waitForSelector,
      captureSnapshot: options.captureSnapshot,
    });

    if (browserResult.success) {
      return {
        success: true,
        originalUrl: norm.originalUrl,
        normalizedUrl: norm.normalizedUrl,
        domain: norm.normalizedDomain,
        urlHash: norm.urlHash,
        method: 'CONTROLLED_BROWSER',
        statusCode: browserResult.statusCode,
        content: browserResult.content,
        contentType: 'text/html',
        byteSize: browserResult.byteSize,
        durationMs: browserResult.durationMs,
      };
    }

    return {
      success: false,
      originalUrl: norm.originalUrl,
      normalizedUrl: norm.normalizedUrl,
      domain: norm.normalizedDomain,
      urlHash: norm.urlHash,
      method: 'CONTROLLED_BROWSER',
      statusCode: browserResult.statusCode,
      content: '',
      contentType: '',
      byteSize: 0,
      durationMs: browserResult.durationMs,
      error: browserResult.error
        ? {
            category: browserResult.error.category as AcquisitionErrorCategory,
            message: browserResult.error.message,
            isRetryable: browserResult.error.isRetryable,
            rawError: browserResult.error.rawError,
          }
        : {
            category: 'UNKNOWN_ERROR',
            message: 'Browser execution encountered an unclassified error',
            isRetryable: true,
          },
    };
  }

  /**
   * Classify standard HTTP status codes into structured error categories
   */
  private static classifyHttpError(statusCode: number, body: string): {
    category: AcquisitionErrorCategory;
    message: string;
    isRetryable: boolean;
    suggestedDelaySec?: number;
  } {
    if (statusCode === 429) {
      return {
        category: 'RATE_LIMITED_429',
        message: 'Source domain rate limit reached (HTTP 429). Pacing delay required.',
        isRetryable: true,
        suggestedDelaySec: 300, // 5 minutes backoff
      };
    }

    if (statusCode === 403) {
      return {
        category: 'ACCESS_FORBIDDEN_403',
        message: 'Access forbidden by source firewall or Cloudflare anti-bot challenge (HTTP 403).',
        isRetryable: false,
      };
    }

    if (statusCode === 404) {
      return {
        category: 'NOT_FOUND_404',
        message: 'Product page does not exist on source website (HTTP 404).',
        isRetryable: false,
      };
    }

    if (statusCode >= 500) {
      return {
        category: 'SERVER_ERROR_5XX',
        message: `Source server encountered an internal error (HTTP ${statusCode}).`,
        isRetryable: true,
        suggestedDelaySec: 60,
      };
    }

    return {
      category: 'UNKNOWN_ERROR',
      message: `Unexpected HTTP status code: ${statusCode}`,
      isRetryable: false,
    };
  }
}

