import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, users, organizations, organizationMemberships, apiKeys } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
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

// 3.1 Dev/Demo Session Bootstrap (Ensures browser clients and admins get valid authenticated JWT sessions)
authRouter.get('/session', async (req: Request, res: Response) => {
  const role = (req.query.role as string) || 'client'; // 'client' or 'admin'

  try {
    const isPlatformAdmin = role === 'admin';
    const assignedRole = isPlatformAdmin ? 'super_admin' : 'tenant_admin';

    // 1. Fetch user & org - prioritize the latest registered user/membership for realistic client experience
    const [latestMembership] = await db
      .select({
        userId: organizationMemberships.userId,
        organizationId: organizationMemberships.organizationId,
        role: organizationMemberships.role,
        userName: users.fullName,
        userEmail: users.email,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        orgPlanTier: organizations.planTier,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .orderBy(desc(organizationMemberships.createdAt))
      .limit(1);

    let activeUser = latestMembership ? {
      id: latestMembership.userId,
      email: latestMembership.userEmail,
      fullName: latestMembership.userName,
    } : null;

    let activeOrg = latestMembership ? {
      id: latestMembership.organizationId,
      name: latestMembership.orgName,
      slug: latestMembership.orgSlug,
      planTier: latestMembership.orgPlanTier,
    } : null;

    if (!activeOrg || !activeUser) {
      let [primaryOrg] = await db.select().from(organizations).limit(1);
      if (!primaryOrg) {
        [primaryOrg] = await db.insert(organizations).values({
          name: 'Mazhar Dev',
          slug: 'mazhar-dev',
          planTier: 'enterprise',
        }).returning();
      }
      activeOrg = {
        id: primaryOrg.id,
        name: primaryOrg.name,
        slug: primaryOrg.slug,
        planTier: primaryOrg.planTier,
      };

      let [primaryUser] = await db.select().from(users).limit(1);
      if (!primaryUser) {
        const passwordHash = await bcrypt.hash('password123', 10);
        [primaryUser] = await db.insert(users).values({
          email: 'mak@gmail.com',
          fullName: 'mazhar client',
          passwordHash,
        }).returning();

        await db.insert(organizationMemberships).values({
          organizationId: primaryOrg.id,
          userId: primaryUser.id,
          role: 'owner',
        });
      }
      activeUser = {
        id: primaryUser.id,
        email: primaryUser.email,
        fullName: primaryUser.fullName,
      };
    }

    // Sign a 24h JWT token
    const accessToken = jwt.sign(
      {
        userId: activeUser.id,
        email: activeUser.email,
        organizationId: activeOrg.id,
        role: assignedRole,
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      accessToken,
      user: {
        id: activeUser.id,
        email: activeUser.email,
        fullName: isPlatformAdmin ? 'Platform Super Admin' : activeUser.fullName,
        role: assignedRole,
        organizationId: activeOrg.id,
      },
      organization: activeOrg,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to initialize session', details: err.message });
  }
});

// 4. API Key Generation for Tenant
export const keysRouter = Router();

keysRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { name, scopes } = req.body;
  const organizationId = req.user!.organizationId;

  const rawSecret = crypto.randomBytes(24).toString('hex');
  const keyPrefix = `pk_${crypto.randomBytes(4).toString('hex')}`;
  const fullApiKey = `${keyPrefix}_${rawSecret}`;
  const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');

  const assignedPermissions = Array.isArray(scopes) && scopes.length > 0 
    ? scopes 
    : ['products:read', 'products:discover', 'products:quality:read', 'products:write'];

  const [apiKey] = await db.insert(apiKeys).values({
    organizationId,
    name: name || 'Integration Key',
    keyPrefix,
    keyHash,
    permissions: assignedPermissions,
  }).returning();

  return res.status(201).json({
    message: 'API Key generated successfully. Save this secret key now, as it cannot be shown again.',
    apiKey: fullApiKey,
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    permissions: apiKey.permissions,
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
      permissions: apiKeys.permissions,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, organizationId));

  return res.json({ keys: list });
});

keysRouter.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const keyId = req.params.id as string;

  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, organizationId)))
    .returning();

  if (result.length === 0) {
    return res.status(404).json({ error: 'API Key not found or does not belong to your organization' });
  }

  return res.json({ success: true, message: 'API Key revoked successfully' });
});

