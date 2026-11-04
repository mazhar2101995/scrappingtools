import { Router, Request, Response } from 'express';
import {
  db,
  organizations,
  organizationMemberships,
  users,
  connectedStores,
} from '@saas/database';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const organizationRouter = Router();

organizationRouter.use(authMiddleware);

// GET /api/v1/organizations - List organizations with member and store counts (Platform Admin only)
organizationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Platform admin permission required' });
    }

    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        planTier: organizations.planTier,
        isActive: organizations.isActive,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt));

    return res.json({ success: true, count: orgs.length, data: orgs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/organizations/my-team - Get team members for the client workspace
organizationRouter.get('/my-team', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const members = await db
      .select({
        id: organizationMemberships.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, orgId));

    return res.json({ success: true, members });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/organizations/ai-settings - Fetch tenant global AI configuration
organizationRouter.get('/ai-settings', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const defaultAiSettings = {
      model: 'gemini-1.5-pro',
      provider: 'Google AI',
      temperature: 0.3,
      apiKey: '',
      globalRules: 'Act as an authoritative technical e-commerce specialist. Maintain strict factual precision. Clean bullet-point formatting. High SEO value.',
      titlePrompt: 'Format: [Brand] + [Model Name] + [Scale/Category] + [Key Specification/Color]. Maintain strict manufacturer part numbers.',
      descriptionPrompt: 'Act as an expert technical e-commerce copywriter. Using the provided manufacturer specifications and features, craft a compelling, SEO-optimized product title and 3-paragraph product description highlighting durability, scale specifications, and compatibility.',
    };

    const existingAi = (org?.settings as any)?.ai || {};
    const aiConfig = { ...defaultAiSettings, ...existingAi };

    return res.json({ success: true, data: aiConfig });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/organizations/ai-settings - Save tenant global AI configuration (BYOK, Prompts, Models)
organizationRouter.put('/ai-settings', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const {
      model,
      provider,
      temperature,
      apiKey,
      globalRules,
      titlePrompt,
      descriptionPrompt,
    } = req.body;

    const [currentOrg] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const currentSettings = (currentOrg?.settings as any) || {};
    const updatedAi = {
      ...(currentSettings.ai || {}),
      ...(model ? { model: String(model).trim() } : {}),
      ...(provider ? { provider: String(provider).trim() } : {}),
      ...(temperature !== undefined ? { temperature: Number(temperature) } : {}),
      ...(apiKey !== undefined ? { apiKey: String(apiKey).trim() } : {}),
      ...(globalRules !== undefined ? { globalRules: String(globalRules).trim() } : {}),
      ...(titlePrompt !== undefined ? { titlePrompt: String(titlePrompt).trim() } : {}),
      ...(descriptionPrompt !== undefined ? { descriptionPrompt: String(descriptionPrompt).trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    const updatedSettings = {
      ...currentSettings,
      ai: updatedAi,
    };

    await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId));

    return res.json({
      success: true,
      message: 'Workspace AI settings saved successfully',
      data: updatedAi,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
