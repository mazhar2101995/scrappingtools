import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, users, organizations, organizationMemberships, apiKeys } from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth.middleware';

export const authRouter = Router();

// 1. User Registration & Initial Tenant Setup
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, fullName, organizationName } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  // Check existing user
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const orgSlug = (organizationName || `${fullName}-org`).toLowerCase().replace(/[^a-z0-9]/g, '-') + `-${Date.now().toString().slice(-4)}`;

  try {
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(users).values({
        email,
        passwordHash,
        fullName,
      }).returning();

      const [newOrg] = await tx.insert(organizations).values({
        name: organizationName || `${fullName}'s Organization`,
        slug: orgSlug,
      }).returning();

      await tx.insert(organizationMemberships).values({
        organizationId: newOrg.id,
        userId: newUser.id,
        role: 'owner',
      });

      return { user: newUser, organization: newOrg };
    });

    const accessToken = jwt.sign(
      { userId: result.user.id, email: result.user.email, organizationId: result.organization.id, role: 'owner' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: result.user.id },
      config.refreshSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account successfully registered',
      accessToken,
      refreshToken,
      user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName },
      organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error during registration', details: err.message });
  }
});

// 2. User Login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Fetch primary organization membership
  const [membership] = await db
    .select({
      organizationId: organizationMemberships.organizationId,
      role: organizationMemberships.role,
      orgName: organizations.name,
      orgSlug: organizations.slug,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(eq(organizationMemberships.userId, user.id))
    .limit(1);

  const organizationId = membership ? membership.organizationId : 'unassigned';
  const role = membership ? membership.role : 'member';

  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, organizationId, role },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.refreshSecret,
    { expiresIn: '7d' }
  );

  return res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, fullName: user.fullName },
    organization: membership ? { id: membership.organizationId, name: membership.orgName, slug: membership.orgSlug } : null,
  });
});

// 3. Current User Profile
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

// 4. API Key Generation for Tenant
export const keysRouter = Router();

keysRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { name } = req.body;
  const organizationId = req.user!.organizationId;

  const rawSecret = crypto.randomBytes(24).toString('hex');
  const keyPrefix = `pk_${crypto.randomBytes(4).toString('hex')}`;
  const fullApiKey = `${keyPrefix}_${rawSecret}`;
  const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');

  const [apiKey] = await db.insert(apiKeys).values({
    organizationId,
    name: name || 'Default API Key',
    keyPrefix,
    keyHash,
    permissions: ['read', 'write'],
  }).returning();

  return res.status(201).json({
    message: 'API Key generated successfully. Save this secret key now, as it cannot be shown again.',
    apiKey: fullApiKey,
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    createdAt: apiKey.createdAt,
  });
});

keysRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const list = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, organizationId));

  return res.json({ keys: list });
});

