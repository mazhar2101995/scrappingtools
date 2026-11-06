import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, apiKeys } from '@saas/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface IntegrationClient {
  keyId: string;
  name: string;
  organizationId: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      integration?: IntegrationClient;
    }
  }
}

// In-memory rate limiting map: keyId -> { count: number, resetAt: number }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests/minute default

/**
 * Middleware for external integration authentication using API Keys.
 * Enforces key validation, hash verification, expiration check, and rate limiting.
 */
export async function integrationAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer pk_') ? authHeader.substring(7) : undefined);

  // If request already has standard user JWT session from dashboard, support it transparently!
  if (!apiKeyHeader && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      if (decoded && decoded.organizationId) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          organizationId: decoded.organizationId,
          role: decoded.role,
          authType: 'jwt',
        };
        req.integration = {
          keyId: `session:${decoded.userId}`,
          name: 'Dashboard Client Session',
          organizationId: decoded.organizationId,
          permissions: ['*'], // Full tenant permissions for logged-in UI
        };
        return next();
      }
    } catch (_) {}
  }

  if (!apiKeyHeader) {
    res.status(401).json({
      error: 'Unauthorized: Missing API Key',
      message: 'Please provide a valid integration key via X-API-Key header or Authorization: Bearer <key>',
      code: 'INTEGRATION_KEY_REQUIRED',
    });
    return;
  }

  const parts = apiKeyHeader.split('_');
  if (parts.length < 2 || !parts[0].startsWith('pk')) {
    res.status(401).json({
      error: 'Unauthorized: Malformed API Key',
      message: 'API Key must follow the standard format: pk_<prefix>_<secret>',
      code: 'INTEGRATION_KEY_MALFORMED',
    });
    return;
  }

  const keyPrefix = `${parts[0]}_${parts[1]}`;
  const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');

  try {
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    if (!keyRecord || keyRecord.keyHash !== keyHash) {
      res.status(401).json({
        error: 'Unauthorized: Invalid API Key',
        message: 'The provided API key does not exist or has an invalid secret.',
        code: 'INTEGRATION_KEY_INVALID',
      });
      return;
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      res.status(401).json({
        error: 'Unauthorized: Expired API Key',
        message: 'This integration API key has expired. Please regenerate your credentials.',
        code: 'INTEGRATION_KEY_EXPIRED',
      });
      return;
    }

    // Rate Limiting Check
    const now = Date.now();
    const rateData = rateLimitMap.get(keyRecord.id) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > rateData.resetAt) {
      rateData.count = 0;
      rateData.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }

    rateData.count += 1;
    rateLimitMap.set(keyRecord.id, rateData);

    const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - rateData.count);
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateData.resetAt / 1000).toString());

    if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `API rate limit of ${MAX_REQUESTS_PER_WINDOW} requests/minute exceeded. Please retry after ${Math.ceil((rateData.resetAt - now) / 1000)} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    // Parse permissions (scopes)
    let permissions: string[] = [];
    if (Array.isArray(keyRecord.permissions)) {
      permissions = keyRecord.permissions;
    } else if (typeof keyRecord.permissions === 'string') {
      try {
        permissions = JSON.parse(keyRecord.permissions);
      } catch (_) {
        permissions = ['read'];
      }
    }

    // Normalized scopes fallback
    if (permissions.includes('read') && !permissions.includes('products:read')) {
      permissions.push('products:read');
    }
    if (permissions.includes('write') && !permissions.includes('products:write')) {
      permissions.push('products:write');
    }
    if (!permissions.includes('products:discover') && (permissions.includes('write') || permissions.includes('products:write'))) {
      permissions.push('products:discover');
    }
    if (!permissions.includes('products:quality:read') && (permissions.includes('read') || permissions.includes('products:read'))) {
      permissions.push('products:quality:read');
    }

    req.integration = {
      keyId: keyRecord.id,
      name: keyRecord.name,
      organizationId: keyRecord.organizationId,
      permissions,
    };

    // Also populate req.user for tenant context compatibility
    req.user = {
      userId: `integration-client:${keyRecord.id}`,
      email: `integration@${keyRecord.organizationId}.tenant`,
      organizationId: keyRecord.organizationId,
      role: 'integration_client',
      authType: 'api_key',
    };

    // Update lastUsedAt asynchronously
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id))
      .execute()
      .catch(() => {});

    return next();
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Authentication Error', details: err.message });
  }
}

/**
 * Scope enforcement middleware generator.
 */
export function requireScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.integration) {
      res.status(401).json({ error: 'Unauthorized: No integration context found' });
      return;
    }

    const hasWildcard = req.integration.permissions.includes('*') || req.integration.permissions.includes('admin');
    const hasScope = hasWildcard || req.integration.permissions.includes(requiredScope);

    if (!hasScope) {
      res.status(403).json({
        error: 'Forbidden: Insufficient Permissions',
        message: `Your API key lacks the required scope: '${requiredScope}'`,
        code: 'INSUFFICIENT_SCOPE',
        authorizedScopes: req.integration.permissions,
        requiredScope,
      });
      return;
    }

    next();
  };
}

