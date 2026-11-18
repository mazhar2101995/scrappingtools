import crypto from 'crypto';
import { db, systemErrorLogs } from '@saas/database';
import { desc, eq, and, gte, lte, ilike, sql } from 'drizzle-orm';

export interface ErrorCaptureContext {
  source?: 'frontend' | 'backend' | 'worker';
  severity?: 'warning' | 'error' | 'fatal';
  httpMethod?: string;
  httpPath?: string;
  httpStatusCode?: number;
  organizationId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  browserInfo?: string | null;
  extra?: Record<string, any>;
}

export class ErrorTelemetryService {
  private static SENSITIVE_KEYS = new Set([
    'password',
    'pass',
    'secret',
    'token',
    'authorization',
    'cookie',
    'creditcard',
    'credit_card',
    'cardnumber',
    'cvv',
    'apikey',
    'api_key',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'clientsecret',
    'client_secret',
    'stripe_secret',
    'stripe_webhook_secret',
    'card_number',
    'pan',
    'securitycode',
    'security_code',
  ]);

  /**
   * Sanitizes string values to mask embedded query parameter credentials, Bearer tokens, and credit card numbers
   */
  public static sanitizeString(str: string): string {
    if (!str || typeof str !== 'string') return str;
    return str
      .replace(/(password|secret|token|apiKey|api_key|authorization|cookie|cvv)=[^&\s]+/gi, '$1=[REDACTED]')
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
      .replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, '[CARD_REDACTED]');
  }

  /**
   * Recursively redact sensitive keys from any arbitrary payload or object
   */
  public static redactSensitiveData(data: any, depth = 0): any {
    if (depth > 5) return '[MAX_DEPTH_REACHED]';
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitiveData(item, depth + 1));
    }

    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (this.SENSITIVE_KEYS.has(normalizedKey) || Array.from(this.SENSITIVE_KEYS).some(k => normalizedKey.includes(k))) {
        cleaned[key] = '[REDACTED]';
      } else if (val && typeof val === 'object') {
        cleaned[key] = this.redactSensitiveData(val, depth + 1);
      } else if (typeof val === 'string') {
        cleaned[key] = this.sanitizeString(val);
      } else {
        cleaned[key] = val;
      }
    }
    return cleaned;
  }

  /**
   * Generates a high-entropy, human-auditable error reference ID
   */
  public static generateErrorReferenceId(): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ERR-${timestamp}-${randomHex}`;
  }

  /**
   * Captures an exception and safely persists telemetry with tenant context
   */
  public static async captureException(
    err: Error | any,
    ctx: ErrorCaptureContext = {}
  ): Promise<{ errorReferenceId: string }> {
    const errorReferenceId = this.generateErrorReferenceId();
    const errorName = err?.name || (typeof err === 'object' && err?.constructor?.name) || 'UnknownError';
    const errorMessage = err?.message || String(err) || 'Internal system error';
    const stackTrace = err?.stack ? String(err.stack) : undefined;

    const sanitizedContext = this.redactSensitiveData(ctx.extra || {});

    try {
      await db.insert(systemErrorLogs).values({
        errorReferenceId,
        source: ctx.source || 'backend',
        severity: ctx.severity || 'error',
        errorName: String(errorName).slice(0, 255),
        errorMessage: this.sanitizeString(String(errorMessage)),
        stackTrace: stackTrace ? stackTrace.slice(0, 10000) : null,
        httpMethod: ctx.httpMethod ? String(ctx.httpMethod).slice(0, 10) : null,
        httpPath: ctx.httpPath ? this.sanitizeString(String(ctx.httpPath)).slice(0, 500) : null,
        httpStatusCode: ctx.httpStatusCode || 500,
        organizationId: ctx.organizationId || null,
        userId: ctx.userId || null,
        userEmail: ctx.userEmail ? String(ctx.userEmail).slice(0, 255) : null,
        browserInfo: ctx.browserInfo ? String(ctx.browserInfo).slice(0, 500) : null,
        context: sanitizedContext,
      });
    } catch (dbErr) {
      // Fallback logging in case database connection fails so telemetry is never lost
      console.error('[ErrorTelemetry Fallback]', {
        errorReferenceId,
        errorName,
        errorMessage,
        dbError: (dbErr as Error).message,
      });
    }

    return { errorReferenceId };
  }

  /**
   * Query centralized error logs with filtering and pagination (Super Admin)
   */
  public static async queryLogs(filters: {
    source?: string;
    severity?: string;
    organizationId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    const conditions = [];

    if (filters.source) {
      conditions.push(eq(systemErrorLogs.source, filters.source));
    }
    if (filters.severity) {
      conditions.push(eq(systemErrorLogs.severity, filters.severity));
    }
    if (filters.organizationId) {
      conditions.push(eq(systemErrorLogs.organizationId, filters.organizationId));
    }
    if (filters.search) {
      conditions.push(
        sql`(${systemErrorLogs.errorReferenceId} ILIKE ${'%' + filters.search + '%'} OR ${systemErrorLogs.errorMessage} ILIKE ${'%' + filters.search + '%'} OR ${systemErrorLogs.httpPath} ILIKE ${'%' + filters.search + '%'})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(systemErrorLogs)
        .where(whereClause)
        .orderBy(desc(systemErrorLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemErrorLogs)
        .where(whereClause),
    ]);

    return {
      logs,
      totalCount: countResult[0]?.count || 0,
      limit,
      offset,
    };
  }
}
