import { normalizeProductUrl, NormalizedUrlResult } from '../utils/url-normalizer';

export type AcquisitionMethod = 'DIRECT_HTTP' | 'CONTROLLED_BROWSER' | 'CACHED_INFLIGHT';

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
  | 'UNKNOWN_ERROR';

export interface AcquisitionOptions {
  timeoutMs?: number;
  useBrowser?: boolean;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
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

    // --- STEP 1: DUPLICATE IN-FLIGHT COALESCING ---
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

    // --- STEP 2: EXECUTE ACQUISITION UNDER MANAGED DOMAIN CONCURRENCY ---
    const acquisitionPromise = (async (): Promise<AcquisitionResult> => {
      const releaseSlot = await this.acquireDomainSlot(norm.normalizedDomain);
      try {
        if (options.useBrowser) {
          return await this.executeControlledBrowser(norm, options);
        } else {
          return await this.executeDirectHttp(norm, options);
        }
      } finally {
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
   * Controlled Browser Execution via Puppeteer (Used only when JS rendering is explicitly required)
   */
  private static async executeControlledBrowser(
    norm: NormalizedUrlResult,
    options: AcquisitionOptions
  ): Promise<AcquisitionResult> {
    const startTime = Date.now();
    let browser: any = null;

    try {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
        ],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1280, height: 800 });

      const response = await page.goto(norm.normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeoutMs || 25000,
      });

      const content = await page.content();
      const statusCode = response ? response.status() : 200;
      await browser.close();

      return {
        success: statusCode >= 200 && statusCode < 300,
        originalUrl: norm.originalUrl,
        normalizedUrl: norm.normalizedUrl,
        domain: norm.normalizedDomain,
        urlHash: norm.urlHash,
        method: 'CONTROLLED_BROWSER',
        statusCode,
        content,
        contentType: 'text/html',
        byteSize: Buffer.byteLength(content, 'utf8'),
        durationMs: Date.now() - startTime,
      };
    } catch (browserErr: any) {
      if (browser) await browser.close().catch(() => {});
      return {
        success: false,
        originalUrl: norm.originalUrl,
        normalizedUrl: norm.normalizedUrl,
        domain: norm.normalizedDomain,
        urlHash: norm.urlHash,
        method: 'CONTROLLED_BROWSER',
        statusCode: 0,
        content: '',
        contentType: '',
        byteSize: 0,
        durationMs: Date.now() - startTime,
        error: {
          category: 'UNKNOWN_ERROR',
          message: `Browser rendering failed: ${browserErr.message}`,
          isRetryable: true,
        },
      };
    }
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
