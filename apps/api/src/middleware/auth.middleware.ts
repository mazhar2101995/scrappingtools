import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db, apiKeys, users, organizationMemberships } from '@saas/database';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
  authType: 'jwt' | 'api_key';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  // 1. JWT Authentication
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        organizationId: decoded.organizationId,
        role: decoded.role,
        authType: 'jwt',
      };
      return next();
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
      return;
    }
  }

  // 2. API Key Authentication
  if (apiKeyHeader) {
    const parts = apiKeyHeader.split('_');
    const keyPrefix = parts.length >= 3 ? `${parts[0]}_${parts[1]}` : parts[0];
    if (!keyPrefix) {
      res.status(401).json({ error: 'Unauthorized: Malformed API key' });
      return;
    }

    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');

    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    if (!keyRecord || keyRecord.keyHash !== keyHash) {
      res.status(401).json({ error: 'Unauthorized: Invalid API key' });
      return;
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: 'Unauthorized: Expired API key' });
      return;
    }

    req.user = {
      userId: 'api-key-system',
      email: 'api-key@system.local',
      organizationId: keyRecord.organizationId,
      role: 'admin',
      authType: 'api_key',
    };

    // Update lastUsedAt asynchronously
    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id)).execute();
    return next();
  }

  res.status(401).json({ error: 'Unauthorized: Missing Authorization Bearer token or X-API-Key' });
}

