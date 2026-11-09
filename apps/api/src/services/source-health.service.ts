import { db, sourceDomainHealth, sourceIncidentEvents } from '@saas/database';
import { eq, sql, desc, lt } from 'drizzle-orm';

export type SourceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'TEMPORARILY_UNAVAILABLE' | 'REQUIRES_REVIEW' | 'DISABLED';

export interface DomainHealthReport {
  domain: string;
  healthStatus: SourceHealthStatus;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  successRate: number;
  avgLatencyMs: number;
  isCooledDown: boolean;
  cooldownRemainingSec: number;
  lastStatusCode: number | null;
  lastErrorCategory: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  clientMessage: string;
}

export class SourceHealthService {
  // Configurable Thresholds
  private static DEGRADED_CONSECUTIVE_FAILURES = 3;
  private static COOLDOWN_CONSECUTIVE_FAILURES = 5;
  private static DEFAULT_COOLDOWN_SECONDS = 180; // 3 minutes cooldown
  private static MIN_SUCCESS_RATE_HEALTHY = 85.0; // < 85% success rate marks degraded

  /**
   * Check if a domain is currently under active cooldown
   */
  public static async isDomainCooledDown(domain: string): Promise<{ cooledDown: boolean; remainingSec: number; reason?: string }> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    const [health] = await db
      .select()
      .from(sourceDomainHealth)
      .where(eq(sourceDomainHealth.domain, cleanDomain))
      .limit(1);

    if (!health || !health.cooldownUntil) {
      return { cooledDown: false, remainingSec: 0 };
    }

    const now = Date.now();
    const cooldownTime = new Date(health.cooldownUntil).getTime();

    if (cooldownTime > now) {
      const remainingSec = Math.ceil((cooldownTime - now) / 1000);
      return {
        cooledDown: true,
        remainingSec,
        reason: health.lastErrorMessage || `Domain in cooldown due to ${health.consecutiveFailures} consecutive failures`,
      };
    }

    // Cooldown elapsed! Reset status back to DEGRADED for probe trial
    if (health.healthStatus === 'TEMPORARILY_UNAVAILABLE') {
      await db
        .update(sourceDomainHealth)
        .set({
          healthStatus: 'DEGRADED',
          cooldownUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(sourceDomainHealth.domain, cleanDomain));
    }

    return { cooledDown: false, remainingSec: 0 };
  }

  /**
   * Record Successful Source Acquisition Event
   */
  public static async recordSuccess(domain: string, latencyMs: number, statusCode: number = 200): Promise<void> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    const [existing] = await db
      .select()
      .from(sourceDomainHealth)
      .where(eq(sourceDomainHealth.domain, cleanDomain))
      .limit(1);

    if (!existing) {
      await db.insert(sourceDomainHealth).values({
        domain: cleanDomain,
        healthStatus: 'HEALTHY',
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        consecutiveFailures: 0,
        successRate: '100.00',
        avgLatencyMs: latencyMs,
        lastStatusCode: statusCode,
        lastSuccessAt: new Date(),
      });
      return;
    }

    const total = existing.totalRequests + 1;
    const successes = existing.successfulRequests + 1;
    const rate = ((successes / total) * 100).toFixed(2);
    const newAvgLatency = Math.round((existing.avgLatencyMs * existing.totalRequests + latencyMs) / total);

    // If previously degraded or cooled down, recover health on success
    const nextStatus: SourceHealthStatus = parseFloat(rate) >= this.MIN_SUCCESS_RATE_HEALTHY ? 'HEALTHY' : 'DEGRADED';

    await db
      .update(sourceDomainHealth)
      .set({
        healthStatus: nextStatus,
        totalRequests: total,
        successfulRequests: successes,
        consecutiveFailures: 0, // Reset consecutive failures immediately on success
        successRate: rate,
        avgLatencyMs: newAvgLatency,
        lastStatusCode: statusCode,
        lastSuccessAt: new Date(),
        cooldownUntil: null, // Clear cooldown on recovery
        updatedAt: new Date(),
      })
      .where(eq(sourceDomainHealth.domain, cleanDomain));

    // Log Recovery Incident Event if previous status was degraded/cooled down
    if (existing.healthStatus === 'TEMPORARILY_UNAVAILABLE' || existing.healthStatus === 'DEGRADED') {
      await db.insert(sourceIncidentEvents).values({
        domain: cleanDomain,
        eventType: 'RECOVERY',
        severity: 'INFO',
        errorCategory: 'NONE',
        message: `Domain ${cleanDomain} recovered to ${nextStatus}. Latency: ${latencyMs}ms.`,
      });
    }
  }

  /**
   * Record Source Acquisition Failure Event & Evaluate Circuit Breaker Cooldown
   */
  public static async recordFailure(
    domain: string,
    errorCategory: string,
    errorMessage: string,
    statusCode?: number,
    suggestedDelaySec?: number
  ): Promise<{ status: SourceHealthStatus; cooldownUntil: Date | null }> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    const [existing] = await db
      .select()
      .from(sourceDomainHealth)
      .where(eq(sourceDomainHealth.domain, cleanDomain))
      .limit(1);

    const consecutive = (existing?.consecutiveFailures || 0) + 1;
    const total = (existing?.totalRequests || 0) + 1;
    const failures = (existing?.failedRequests || 0) + 1;
    const successes = existing?.successfulRequests || 0;
    const rate = total > 0 ? ((successes / total) * 100).toFixed(2) : '0.00';

    let healthStatus: SourceHealthStatus = (existing?.healthStatus as SourceHealthStatus) || 'HEALTHY';
    let cooldownUntil: Date | null = null;

    // Failure Threshold Rules:
    // 1. HTTP 429 Rate Limit → Immediate Cooldown
    // 2. >= 5 Consecutive Failures → Cooldown
    // 3. >= 3 Consecutive Failures → Degraded
    if (errorCategory === 'RATE_LIMITED_429' || consecutive >= this.COOLDOWN_CONSECUTIVE_FAILURES) {
      healthStatus = 'TEMPORARILY_UNAVAILABLE';
      const cooldownSec = suggestedDelaySec || this.DEFAULT_COOLDOWN_SECONDS;
      cooldownUntil = new Date(Date.now() + cooldownSec * 1000);

      // Log Incident Event
      await db.insert(sourceIncidentEvents).values({
        domain: cleanDomain,
        eventType: 'COOLDOWN_ACTIVATED',
        severity: 'WARNING',
        errorCategory,
        message: `Domain ${cleanDomain} placed under cooldown for ${cooldownSec}s. Reason: ${errorMessage}`,
        context: { consecutiveFailures: consecutive, statusCode },
      });
    } else if (consecutive >= this.DEGRADED_CONSECUTIVE_FAILURES || parseFloat(rate) < this.MIN_SUCCESS_RATE_HEALTHY) {
      healthStatus = 'DEGRADED';
    }

    if (!existing) {
      await db.insert(sourceDomainHealth).values({
        domain: cleanDomain,
        healthStatus,
        totalRequests: 1,
        successfulRequests: 0,
        failedRequests: 1,
        consecutiveFailures: 1,
        successRate: '0.00',
        avgLatencyMs: 0,
        lastStatusCode: statusCode || 0,
        lastErrorCategory: errorCategory,
        lastErrorMessage: errorMessage,
        cooldownUntil,
        lastFailureAt: new Date(),
      });
    } else {
      await db
        .update(sourceDomainHealth)
        .set({
          healthStatus,
          totalRequests: total,
          failedRequests: failures,
          consecutiveFailures: consecutive,
          successRate: rate,
          lastStatusCode: statusCode || existing.lastStatusCode,
          lastErrorCategory: errorCategory,
          lastErrorMessage: errorMessage,
          cooldownUntil: cooldownUntil || existing.cooldownUntil,
          lastFailureAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sourceDomainHealth.domain, cleanDomain));
    }

    return { status: healthStatus, cooldownUntil };
  }

  /**
   * Translate Technical Error Category into Client-Friendly Message
   */
  public static getClientFriendlyMessage(category: string, statusCode?: number): string {
    switch (category) {
      case 'RATE_LIMITED_429':
        return 'The target website is receiving heavy traffic. Acquisition will be safely retried shortly.';
      case 'ACCESS_FORBIDDEN_403':
        return 'Access to this product page was restricted by the store firewall or security verification.';
      case 'NOT_FOUND_404':
        return 'This product page could not be found on the target website. Please verify the URL.';
      case 'TIMEOUT':
        return 'The target store took too long to respond. The request has been scheduled for retry.';
      case 'DNS_LOOKUP_FAILED':
        return 'Unable to locate target store domain. Please ensure the store address is active.';
      case 'EXTRACTION_FAILED':
        return 'The store page was accessed successfully, but product specifications could not be mapped.';
      case 'SERVER_ERROR_5XX':
        return 'The target store encountered an internal server error. Retrying with backoff.';
      case 'PAGE_NAVIGATION_TIMEOUT':
        return 'The store page took too long to render dynamic components. Retrying with extended timeout.';
      case 'BROWSER_LAUNCH_FAILED':
      case 'PAGE_CRASH':
        return 'The web page engine encountered an unexpected rendering problem. Retrying with backoff.';
      case 'JS_RENDERING_FAILED':
        return 'The store script structure could not be rendered completely. Retrying automatically.';
      case 'RESOURCE_EXHAUSTION':
        return 'The platform rendering worker is currently at capacity. The task is queued and will proceed shortly.';
      default:
        return 'The product source could not be acquired at this time. Our system is investigating.';
    }
  }

  /**
   * Get Live Source Health for Admin Telemetry
   */
  public static async getDomainHealth(domain: string): Promise<DomainHealthReport | null> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    const [health] = await db
      .select()
      .from(sourceDomainHealth)
      .where(eq(sourceDomainHealth.domain, cleanDomain))
      .limit(1);

    if (!health) return null;

    const cooldownCheck = await this.isDomainCooledDown(cleanDomain);

    return {
      domain: health.domain,
      healthStatus: health.healthStatus as SourceHealthStatus,
      totalRequests: health.totalRequests,
      successfulRequests: health.successfulRequests,
      failedRequests: health.failedRequests,
      consecutiveFailures: health.consecutiveFailures,
      successRate: parseFloat(health.successRate || '100'),
      avgLatencyMs: health.avgLatencyMs,
      isCooledDown: cooldownCheck.cooledDown,
      cooldownRemainingSec: cooldownCheck.remainingSec,
      lastStatusCode: health.lastStatusCode,
      lastErrorCategory: health.lastErrorCategory,
      lastSuccessAt: health.lastSuccessAt ? health.lastSuccessAt.toISOString() : null,
      lastFailureAt: health.lastFailureAt ? health.lastFailureAt.toISOString() : null,
      clientMessage: this.getClientFriendlyMessage(health.lastErrorCategory || '', health.lastStatusCode || undefined),
    };
  }

  /**
   * List Top Monitored Domains for Platform Admin
   */
  public static async listMonitoredDomains(limit: number = 20) {
    const records = await db
      .select()
      .from(sourceDomainHealth)
      .orderBy(desc(sourceDomainHealth.totalRequests))
      .limit(limit);

    const now = Date.now();

    return records.map((r) => {
      const cooldownRemaining = r.cooldownUntil && new Date(r.cooldownUntil).getTime() > now
        ? Math.ceil((new Date(r.cooldownUntil).getTime() - now) / 1000)
        : 0;

      return {
        domain: r.domain,
        healthStatus: r.healthStatus,
        totalRequests: r.totalRequests,
        successRate: parseFloat(r.successRate || '100'),
        avgLatencyMs: r.avgLatencyMs,
        consecutiveFailures: r.consecutiveFailures,
        isCooledDown: cooldownRemaining > 0,
        cooldownRemainingSec: cooldownRemaining,
        lastErrorCategory: r.lastErrorCategory,
        lastSuccessAt: r.lastSuccessAt,
        lastFailureAt: r.lastFailureAt,
      };
    });
  }

  /**
   * Get Recent Incidents for a domain
   */
  public static async getRecentIncidents(domain: string, limit: number = 10) {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    return db
      .select()
      .from(sourceIncidentEvents)
      .where(eq(sourceIncidentEvents.domain, cleanDomain))
      .orderBy(desc(sourceIncidentEvents.createdAt))
      .limit(limit);
  }
}
