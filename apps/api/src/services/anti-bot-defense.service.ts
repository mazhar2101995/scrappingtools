import { db, proxyConfigurations } from '@saas/database';
import { eq, and, or, isNull } from 'drizzle-orm';
import axios, { AxiosRequestConfig } from 'axios';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HttpsProxyAgent } = require('https-proxy-agent');

export interface AntiBotRequestOptions {
  organizationId?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  enforceProxy?: boolean;
}

export class AntiBotDefenseService {
  private static readonly ROTATING_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/128.0.0.0 Safari/537.36',
  ];

  /**
   * Get a randomized browser User-Agent
   */
  public static getRandomUserAgent(): string {
    const idx = Math.floor(Math.random() * this.ROTATING_USER_AGENTS.length);
    return this.ROTATING_USER_AGENTS[idx];
  }

  /**
   * Pick an active healthy proxy for the tenant (or fall back to system pool)
   */
  public static async getRotatingProxy(organizationId?: string): Promise<typeof proxyConfigurations.$inferSelect | null> {
    try {
      const condition = organizationId
        ? and(
            eq(proxyConfigurations.isActive, true),
            eq(proxyConfigurations.healthStatus, 'HEALTHY'),
            or(eq(proxyConfigurations.organizationId, organizationId), isNull(proxyConfigurations.organizationId))
          )
        : and(eq(proxyConfigurations.isActive, true), eq(proxyConfigurations.healthStatus, 'HEALTHY'));

      const candidates = await db
        .select()
        .from(proxyConfigurations)
        .where(condition)
        .limit(20);

      if (candidates.length === 0) return null;

      // Pick random proxy to distribute load
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      return chosen;
    } catch (e) {
      console.warn('[AntiBotDefenseService] Error fetching rotating proxy:', e);
      return null;
    }
  }

  /**
   * Safe HTTP GET with automatic User-Agent spoofing, Sec-CH headers, and proxy rotation
   */
  public static async safeGet(url: string, options?: AntiBotRequestOptions): Promise<any> {
    const userAgent = this.getRandomUserAgent();
    const proxy = await this.getRotatingProxy(options?.organizationId);

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...(options?.headers || {}),
    };

    // If tenant has authenticated session cookies for this domain, inject them automatically
    if (options?.organizationId && !headers['Cookie'] && !headers['cookie']) {
      try {
        const { SupplierSessionManagerService } = await import('./supplier-session-manager.service');
        const cookieHeader = await SupplierSessionManagerService.getCookieHeaderForDomain(options.organizationId, url);
        if (cookieHeader) {
          headers['Cookie'] = cookieHeader;
        }
      } catch (cookieErr) {
        // Continue without session cookies
      }
    }

    const config: AxiosRequestConfig = {
      headers,
      timeout: options?.timeoutMs || 15000,
      validateStatus: (status) => status < 500, // Handle 404/403 gracefully
    };

    if (proxy) {
      const authPart = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : '';
      const proxyUrl = `${proxy.protocol.toLowerCase()}://${authPart}${proxy.host}:${proxy.port}`;
      try {
        const agent = new HttpsProxyAgent(proxyUrl);
        config.httpsAgent = agent;
        config.httpAgent = agent;
      } catch (err) {
        console.warn(`[AntiBotDefenseService] Could not initialize proxy ${proxy.host}:${proxy.port}`, err);
      }
    }

    try {
      const resp = await axios.get(url, config);

      if (proxy) {
        // Record success
        await db
          .update(proxyConfigurations)
          .set({
            successCount: proxy.successCount + 1,
            lastTestedAt: new Date(),
          })
          .where(eq(proxyConfigurations.id, proxy.id));
      }

      return resp;
    } catch (err: any) {
      if (proxy) {
        // Record failure
        await db
          .update(proxyConfigurations)
          .set({
            failCount: proxy.failCount + 1,
            healthStatus: proxy.failCount >= 5 ? 'DEGRADED' : proxy.healthStatus,
            lastTestedAt: new Date(),
          })
          .where(eq(proxyConfigurations.id, proxy.id));
      }
      throw err;
    }
  }

  /**
   * Health-check a specific proxy
   */
  public static async testProxy(proxyId: string): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    const [proxy] = await db
      .select()
      .from(proxyConfigurations)
      .where(eq(proxyConfigurations.id, proxyId))
      .limit(1);

    if (!proxy) {
      return { success: false, error: 'Proxy not found' };
    }

    const authPart = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : '';
    const proxyUrl = `${proxy.protocol.toLowerCase()}://${authPart}${proxy.host}:${proxy.port}`;
    const startTime = Date.now();

    try {
      const agent = new HttpsProxyAgent(proxyUrl);
      const testTarget = 'https://httpbin.org/ip';
      const resp = await axios.get(testTarget, {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 10000,
      });

      const latencyMs = Date.now() - startTime;
      await db
        .update(proxyConfigurations)
        .set({
          healthStatus: 'HEALTHY',
          lastTestedAt: new Date(),
          latencyMs,
          successCount: proxy.successCount + 1,
        })
        .where(eq(proxyConfigurations.id, proxy.id));

      return { success: true, latencyMs };
    } catch (err: any) {
      await db
        .update(proxyConfigurations)
        .set({
          healthStatus: 'OFFLINE',
          lastTestedAt: new Date(),
          failCount: proxy.failCount + 1,
        })
        .where(eq(proxyConfigurations.id, proxy.id));

      return { success: false, error: err.message };
    }
  }
}
