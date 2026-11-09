import { db, networkRoutes, networkRouteIncidents, sourceDomainHealth } from '@saas/database';
import { eq, desc, and } from 'drizzle-orm';

export type RouteType = 'DIRECT' | 'PROXY' | 'DEFERRED';
export type RouteStatus = 'AVAILABLE' | 'DEGRADED' | 'TEMPORARILY_UNAVAILABLE' | 'DISABLED';

export interface RouteDecision {
  type: RouteType;
  routeId: string;
  providerId: string;
  reason: string;
  proxyUrl?: string; // Kept internal in service memory, never logged or exposed in API
  deferralDelaySec?: number;
}

export interface RouteProvider {
  providerId: string;
  routeType: 'PROXY';
  isEnabled(): boolean;
  getProxyUrl(domain: string): Promise<string | null>;
}

export class DirectRouteProvider {
  public static readonly PROVIDER_ID = 'direct-core';
  public static readonly ROUTE_ID = 'direct-default';
}

/**
 * Pluggable Standard Proxy Provider (Configured via secure server environment)
 */
export class StandardProxyProvider implements RouteProvider {
  public readonly providerId: string;
  public readonly routeType = 'PROXY' as const;
  private readonly proxyHost?: string;
  private readonly proxyPort?: number;
  private readonly proxyUser?: string;
  private readonly proxyPass?: string;
  private readonly enabled: boolean;

  constructor(config?: {
    providerId?: string;
    proxyHost?: string;
    proxyPort?: number;
    proxyUser?: string;
    proxyPass?: string;
    enabled?: boolean;
  }) {
    this.providerId = config?.providerId || process.env.PROXY_PROVIDER_ID || 'approved-proxy-core';
    this.proxyHost = config?.proxyHost || process.env.PROXY_HOST;
    this.proxyPort = config?.proxyPort || (process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT) : undefined);
    this.proxyUser = config?.proxyUser || process.env.PROXY_USERNAME;
    this.proxyPass = config?.proxyPass || process.env.PROXY_PASSWORD;
    this.enabled = config?.enabled ?? (process.env.PROXY_ENABLED === 'true' && Boolean(this.proxyHost));
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async getProxyUrl(domain: string): Promise<string | null> {
    if (!this.enabled || !this.proxyHost) return null;
    const authPart = this.proxyUser && this.proxyPass ? `${encodeURIComponent(this.proxyUser)}:${encodeURIComponent(this.proxyPass)}@` : '';
    const portPart = this.proxyPort ? `:${this.proxyPort}` : '';
    return `http://${authPart}${this.proxyHost}${portPart}`;
  }
}

/**
 * Centralized Network Route Manager
 */
export class NetworkRouteManager {
  private static providers = new Map<string, RouteProvider>();
  private static defaultProxyProviderId: string | null = null;

  // Active in-memory slot tracker for route concurrency
  private static routeActiveCounts = new Map<string, number>();

  static {
    // Automatically register standard environment proxy provider if configured
    const stdProvider = new StandardProxyProvider();
    if (stdProvider.isEnabled()) {
      this.registerProvider(stdProvider, true);
    }
  }

  /**
   * Register a route provider dynamically
   */
  public static registerProvider(provider: RouteProvider, asDefault: boolean = false): void {
    this.providers.set(provider.providerId, provider);
    if (asDefault || !this.defaultProxyProviderId) {
      this.defaultProxyProviderId = provider.providerId;
    }
  }

  /**
   * Clear registered providers (Used primarily in clean test setups)
   */
  public static clearProviders(): void {
    this.providers.clear();
    this.defaultProxyProviderId = null;
    this.routeActiveCounts.clear();
  }

  /**
   * Determine Centralized Route Decision for an outbound product acquisition
   * Evaluates Source Health + Failure History + Route Availability deterministically
   */
  public static async determineRoute(
    domain: string,
    options: {
      bypassProxy?: boolean;
      forceProxy?: boolean;
    } = {}
  ): Promise<RouteDecision> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    // Step 1: Query operational source health
    const [domainHealth] = await db
      .select()
      .from(sourceDomainHealth)
      .where(eq(sourceDomainHealth.domain, cleanDomain))
      .limit(1);

    const now = Date.now();
    const isCooledDown = Boolean(
      domainHealth?.cooldownUntil && new Date(domainHealth.cooldownUntil).getTime() > now
    );

    // Rule 1: If domain is strictly cooled down due to server overload/429, DEFER request
    if (isCooledDown && !options.forceProxy) {
      const remainingSec = Math.ceil((new Date(domainHealth!.cooldownUntil!).getTime() - now) / 1000);
      return {
        type: 'DEFERRED',
        routeId: DirectRouteProvider.ROUTE_ID,
        providerId: DirectRouteProvider.PROVIDER_ID,
        reason: `Target domain is under cooldown (${remainingSec}s remaining). Request deferred to prevent queue pressure.`,
        deferralDelaySec: remainingSec,
      };
    }

    // Rule 2: If domain is HEALTHY or no proxy configured, choose DIRECT
    const hasProxyProvider = Boolean(this.defaultProxyProviderId && this.providers.has(this.defaultProxyProviderId));
    const isHealthy = !domainHealth || domainHealth.healthStatus === 'HEALTHY' || domainHealth.consecutiveFailures === 0;

    if (options.bypassProxy || !hasProxyProvider || (isHealthy && !options.forceProxy)) {
      return {
        type: 'DIRECT',
        routeId: DirectRouteProvider.ROUTE_ID,
        providerId: DirectRouteProvider.PROVIDER_ID,
        reason: isHealthy
          ? 'Direct server connection (target domain is healthy)'
          : 'Direct server connection (no approved proxy route configured)',
      };
    }

    // Rule 3: Domain is DEGRADED or blocked by anti-bot/firewall (403, repeated timeout)
    // Evaluate if an approved proxy route is available and healthy
    const proxyProvider = this.providers.get(this.defaultProxyProviderId!)!;
    const routeId = `route-${proxyProvider.providerId}`;

    const [routeHealth] = await db
      .select()
      .from(networkRoutes)
      .where(eq(networkRoutes.routeId, routeId))
      .limit(1);

    const isRouteCooledDown = Boolean(
      routeHealth?.cooldownUntil && new Date(routeHealth.cooldownUntil).getTime() > now
    );

    if (routeHealth?.status === 'DISABLED') {
      return {
        type: 'DIRECT',
        routeId: DirectRouteProvider.ROUTE_ID,
        providerId: DirectRouteProvider.PROVIDER_ID,
        reason: `Fallback to direct connection (approved proxy route ${proxyProvider.providerId} is disabled)`,
      };
    }

    if (isRouteCooledDown) {
      const remainingSec = Math.ceil((new Date(routeHealth!.cooldownUntil!).getTime() - now) / 1000);
      return {
        type: 'DEFERRED',
        routeId,
        providerId: proxyProvider.providerId,
        reason: `Approved proxy route is temporarily in cooldown (${remainingSec}s remaining).`,
        deferralDelaySec: remainingSec,
      };
    }

    // Rule 4: Route Capacity Check
    const activeRouteConns = this.routeActiveCounts.get(routeId) || 0;
    const concurrencyLimit = routeHealth?.concurrencyLimit || 5;

    if (activeRouteConns >= concurrencyLimit) {
      return {
        type: 'DEFERRED',
        routeId,
        providerId: proxyProvider.providerId,
        reason: `Approved proxy route is at full capacity (${activeRouteConns}/${concurrencyLimit} active).`,
        deferralDelaySec: 10,
      };
    }

    // Rule 5: Approved Proxy Selected
    const proxyUrl = await proxyProvider.getProxyUrl(cleanDomain);
    if (!proxyUrl) {
      return {
        type: 'DIRECT',
        routeId: DirectRouteProvider.ROUTE_ID,
        providerId: DirectRouteProvider.PROVIDER_ID,
        reason: 'Fallback to direct connection (proxy provider returned no url)',
      };
    }

    return {
      type: 'PROXY',
      routeId,
      providerId: proxyProvider.providerId,
      proxyUrl, // Internal memory only
      reason: `Routed via approved proxy ${proxyProvider.providerId} due to domain status '${domainHealth?.healthStatus || 'UNKNOWN'}'`,
    };
  }

  /**
   * Acquire execution token for route concurrency accounting
   */
  public static acquireRouteSlot(routeId: string): () => void {
    const current = this.routeActiveCounts.get(routeId) || 0;
    this.routeActiveCounts.set(routeId, current + 1);

    let released = false;
    return () => {
      if (!released) {
        released = true;
        const cur = this.routeActiveCounts.get(routeId) || 1;
        if (cur <= 1) {
          this.routeActiveCounts.delete(routeId);
        } else {
          this.routeActiveCounts.set(routeId, cur - 1);
        }
      }
    };
  }

  /**
   * Record Route Success Telemetry
   */
  public static async recordRouteSuccess(routeId: string, providerId: string, latencyMs: number): Promise<void> {
    if (routeId === DirectRouteProvider.ROUTE_ID) return; // Direct route telemetry tracked in domain health

    const [existing] = await db
      .select()
      .from(networkRoutes)
      .where(eq(networkRoutes.routeId, routeId))
      .limit(1);

    if (!existing) {
      await db.insert(networkRoutes).values({
        routeId,
        providerId,
        routeType: 'PROXY',
        status: 'AVAILABLE',
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        consecutiveFailures: 0,
        avgLatencyMs: latencyMs,
        lastSuccessAt: new Date(),
      });
    } else {
      const total = existing.totalRequests + 1;
      const successes = existing.successfulRequests + 1;
      const avgLat = Math.round((existing.avgLatencyMs * existing.totalRequests + latencyMs) / total);

      await db
        .update(networkRoutes)
        .set({
          totalRequests: total,
          successfulRequests: successes,
          consecutiveFailures: 0,
          avgLatencyMs: avgLat,
          status: 'AVAILABLE',
          lastSuccessAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(networkRoutes.routeId, routeId));
    }
  }

  /**
   * Record Route Failure Telemetry & Cooldown Protection
   */
  public static async recordRouteFailure(
    routeId: string,
    providerId: string,
    errorMessage: string,
    statusCode?: number
  ): Promise<void> {
    if (routeId === DirectRouteProvider.ROUTE_ID) return;

    const [existing] = await db
      .select()
      .from(networkRoutes)
      .where(eq(networkRoutes.routeId, routeId))
      .limit(1);

    const consecutive = (existing?.consecutiveFailures || 0) + 1;
    const total = (existing?.totalRequests || 0) + 1;
    const failures = (existing?.failedRequests || 0) + 1;

    let status: RouteStatus = 'AVAILABLE';
    let cooldownUntil: Date | null = null;

    // Route threshold rules:
    // 3 consecutive failures -> DEGRADED
    // 5 consecutive failures -> TEMPORARILY_UNAVAILABLE (180s cooldown)
    if (consecutive >= 5) {
      status = 'TEMPORARILY_UNAVAILABLE';
      cooldownUntil = new Date(Date.now() + 180 * 1000);

      // Audit incident
      await db.insert(networkRouteIncidents).values({
        routeId,
        eventType: 'ROUTE_COOLDOWN',
        severity: 'WARNING',
        statusCode: statusCode || 502,
        message: `Route ${routeId} placed in cooldown for 180s after ${consecutive} failures: ${errorMessage}`,
      });
    } else if (consecutive >= 3) {
      status = 'DEGRADED';
    }

    if (!existing) {
      await db.insert(networkRoutes).values({
        routeId,
        providerId,
        routeType: 'PROXY',
        status,
        totalRequests: 1,
        successfulRequests: 0,
        failedRequests: 1,
        consecutiveFailures: 1,
        lastErrorMessage: errorMessage,
        cooldownUntil,
        lastFailureAt: new Date(),
      });
    } else {
      await db
        .update(networkRoutes)
        .set({
          status,
          totalRequests: total,
          failedRequests: failures,
          consecutiveFailures: consecutive,
          lastErrorMessage: errorMessage,
          cooldownUntil: cooldownUntil || existing.cooldownUntil,
          lastFailureAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(networkRoutes.routeId, routeId));
    }
  }

  /**
   * List Network Routes Telemetry for Platform Admin
   * Returns sanitized route data (NEVER exposes passwords, credentials or full proxy URIs)
   */
  public static async listRoutesTelemetry() {
    const records = await db.select().from(networkRoutes).orderBy(desc(networkRoutes.totalRequests));
    const now = Date.now();

    return records.map((r) => {
      const isCooledDown = Boolean(r.cooldownUntil && new Date(r.cooldownUntil).getTime() > now);
      const remainingSec = isCooledDown ? Math.ceil((new Date(r.cooldownUntil!).getTime() - now) / 1000) : 0;

      return {
        routeId: r.routeId,
        providerId: r.providerId,
        routeType: r.routeType,
        status: r.status,
        concurrencyLimit: r.concurrencyLimit,
        activeRequests: this.routeActiveCounts.get(r.routeId) || 0,
        totalRequests: r.totalRequests,
        successfulRequests: r.successfulRequests,
        failedRequests: r.failedRequests,
        consecutiveFailures: r.consecutiveFailures,
        avgLatencyMs: r.avgLatencyMs,
        isCooledDown,
        cooldownRemainingSec: remainingSec,
        lastSuccessAt: r.lastSuccessAt,
        lastFailureAt: r.lastFailureAt,
        lastErrorMessage: r.lastErrorMessage,
      };
    });
  }

  /**
   * Get Recent Route Incidents
   */
  public static async getRecentRouteIncidents(routeId: string, limit: number = 10) {
    return db
      .select()
      .from(networkRouteIncidents)
      .where(eq(networkRouteIncidents.routeId, routeId))
      .orderBy(desc(networkRouteIncidents.createdAt))
      .limit(limit);
  }
}

