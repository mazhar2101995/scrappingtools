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

// 3.1 Forgot Password - Requests secure reset token
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user) {
    // Return generic success to prevent email enumeration
    return res.json({
      success: true,
      message: 'If this email is registered in our platform, a password reset link has been generated.',
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

  await db
    .update(users)
    .set({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: expiresAt,
    })
    .where(eq(users.id, user.id));

  return res.json({
    success: true,
    message: 'If this email is registered in our platform, a password reset link has been generated.',
    // Provide resetToken directly in response for dev/testing environment convenience
    resetToken: rawToken,
    resetUrl: `/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`,
  });
});

// 3.2 Reset Password - Verifies token and updates password
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { token, email, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find user by token and verify expiration
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetPasswordToken, tokenHash))
    .limit(1);

  if (!user || !user.resetPasswordExpires || new Date(user.resetPasswordExpires) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired password reset token' });
  }

  // Hash new password and clear reset token
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    })
    .where(eq(users.id, user.id));

  return res.json({
    success: true,
    message: 'Password has been successfully updated. You may now log in with your new password.',
  });
});

// 3.3 Explicit Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  // Session is completely stateless JWT; client discards token
  return res.json({ success: true, message: 'Logged out successfully' });
});

// 3.4 Dev/Testing Session Inspection (Requires real authentication)
authRouter.get('/session', authMiddleware, async (req: Request, res: Response) => {
  return res.json({
    authenticated: true,
    user: req.user,
  });
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

