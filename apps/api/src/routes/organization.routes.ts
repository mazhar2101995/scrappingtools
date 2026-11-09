import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  db,
  organizations,
  organizationMemberships,
  users,
  connectedStores,
  customerProductMappings,
  customerProductOverrides,
  globalProducts,
  tenantBrandProfiles,
} from '@saas/database';
import { eq, desc, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';
import { config } from '../config';

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

    // Augment with product, brand, and store counts
    const augmented = await Promise.all(
      orgs.map(async (org) => {
        const [prodCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(customerProductMappings)
          .where(eq(customerProductMappings.organizationId, org.id));

        const [brandCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tenantBrandProfiles)
          .where(eq(tenantBrandProfiles.organizationId, org.id));

        const [storeCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(connectedStores)
          .where(eq(connectedStores.organizationId, org.id));

        return {
          ...org,
          totalProducts: prodCount?.count || 0,
          totalBrands: brandCount?.count || 0,
          totalStores: storeCount?.count || 0,
        };
      })
    );

    return res.json({ success: true, count: augmented.length, data: augmented });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/organizations/:id/inspect - Deep inspection of a specific tenant
organizationRouter.get('/:id/inspect', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Platform admin permission required' });
    }

    const targetOrgId = req.params.id as string;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId)).limit(1);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Tenant brands
    const tenantBrands = await db
      .select()
      .from(tenantBrandProfiles)
      .where(eq(tenantBrandProfiles.organizationId, targetOrgId))
      .orderBy(desc(tenantBrandProfiles.createdAt));

    // Tenant products
    const tenantProducts = await db
      .select({
        mappingId: customerProductMappings.id,
        globalProductId: globalProducts.id,
        canonicalTitle: globalProducts.canonicalTitle,
        modelNumber: globalProducts.modelNumber,
        categoryPath: globalProducts.categoryPath,
        primaryImageUrl: globalProducts.primaryImageUrl,
        verificationStatus: globalProducts.verificationStatus,
        customerSku: customerProductMappings.customerInternalSku,
        customPrice: customerProductOverrides.customAttributes,
        importedAt: customerProductMappings.importedAt,
      })
      .from(customerProductMappings)
      .innerJoin(globalProducts, eq(customerProductMappings.globalProductId, globalProducts.id))
      .leftJoin(customerProductOverrides, and(
        eq(customerProductOverrides.globalProductId, globalProducts.id),
        eq(customerProductOverrides.organizationId, targetOrgId)
      ))
      .where(eq(customerProductMappings.organizationId, targetOrgId))
      .orderBy(desc(customerProductMappings.importedAt))
      .limit(50);

    // Tenant stores
    const tenantStores = await db
      .select()
      .from(connectedStores)
      .where(eq(connectedStores.organizationId, targetOrgId));

    // Tenant team members
    const teamMembers = await db
      .select({
        id: organizationMemberships.id,
        fullName: users.fullName,
        email: users.email,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, targetOrgId));

    return res.json({
      success: true,
      organization: org,
      brands: tenantBrands,
      products: tenantProducts,
      stores: tenantStores,
      teamMembers,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/organizations/:id/impersonate - Impersonate tenant (Get tenant JWT)
organizationRouter.post('/:id/impersonate', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Platform admin permission required' });
    }

    const targetOrgId = req.params.id as string;
    const [targetOrg] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId)).limit(1);
    if (!targetOrg) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get an admin or owner user from target organization
    const [membership] = await db
      .select({
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, targetOrgId))
      .limit(1);

    const userPayload = membership || {
      userId: (req as any).user.id,
      email: (req as any).user.email,
      fullName: `Admin as ${targetOrg.name}`,
    };

    const impersonatedToken = jwt.sign(
      {
        userId: userPayload.userId,
        email: userPayload.email,
        organizationId: targetOrg.id,
        role: 'tenant_admin',
        isImpersonated: true,
      },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    return res.json({
      success: true,
      token: impersonatedToken,
      organization: targetOrg,
      user: userPayload,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/organizations/:id/toggle-status - Suspend or Activate tenant
organizationRouter.patch('/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Platform admin permission required' });
    }

    const targetOrgId = req.params.id as string;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId)).limit(1);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [updated] = await db
      .update(organizations)
      .set({
        isActive: !org.isActive,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, targetOrgId))
      .returning();

    return res.json({
      success: true,
      message: `Tenant ${updated.name} ${updated.isActive ? 'activated' : 'suspended'} successfully`,
      organization: updated,
    });
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

    const defaultLanguagePrompts = {
      hi: {
        rules: 'एक आधिकारिक और तकनीकी ई-कॉमर्स विशेषज्ञ के रूप में कार्य करें। उत्पाद की गुणवत्ता, विश्वसनीयता, मूल विनिर्देशों (OEM specifications), और मॉडल संगतता पर जोर दें। भाषा स्वाभाविक, आधुनिक ई-कॉमर्स हिंदी (जैसे अमेज़न/फ्लिपकार्ट) होनी चाहिए। ब्रांड नाम और तकनीकी मॉडल नंबर (जैसे 10951-ORNG, 4WD, LiPo) को अंग्रेजी/मानक रूप में ही सुरक्षित रखें।',
        titlePrompt: '[ब्रांड नाम] + [उत्पाद का नाम / हिंदी विवरण] + [मुख्य रंग/वेरिएंट] + (आधिकारिक मॉडल या पार्ट नंबर)। शीर्षक संक्षिप्त, आकर्षक और सर्च इंजन (SEO) के अनुकूल होना चाहिए।',
        descriptionPrompt: 'पेशेवर ई-कॉमर्स कॉपीराइटर के रूप में कार्य करें। सत्यापित निर्माता डेटा का उपयोग करके 3 सुव्यवस्थित पैराग्राफ और बुलेट पॉइंट्स तैयार करें:\n1. उत्पाद परिचय: उत्पाद का मुख्य उद्देश्य, टिकाऊपन और प्रीमियम विशेषताएं।\n2. मुख्य विशेषताएं (Key Features): तकनीकी लाभों को स्पष्ट बुलेट पॉइंट्स में प्रस्तुत करें।\n3. अनुकूलता और विनिर्देश (Compatibility & Specs): संगत मॉडल और सामग्री (जैसे 6061-T6 एल्युमीनियम) को शुद्धता से लिखें।',
      },
      ar: {
        rules: 'تصرف كخبير تجارة إلكترونية تقني ومعتمد للأسواق العربية والخليجية. ركز على دقة المواصفات المصنعية الأصلية، الجودة والمتانة العالية، وملاءمة القطع للأجهزة الأصلية (OEM Compatibility). حافظ على أسماء الماركات التجارية وأرقام الموديلات والقطع الفنية (مثل 10951-ORNG, 4WD, LiPo, ESC) بلغتها الإنجليزية القياسية دون تعريب مشوه.',
        titlePrompt: '[اسم الماركة] + [اسم المنتج بالعربية الفصحى للتجارة الإلكترونية] + [اللون أو المواصفة الرئيسية] + (رقم الموديل / القطعة المصنعية). العنوان يجب أن يكون دقيقاً، جذاباً ومحسناً لمحركات البحث (SEO).',
        descriptionPrompt: 'اكتب وصفاً تسويقياً وتقنياً متكاملاً للمنتج بصيغة التجارة الإلكترونية الاحترافية، يتضمن:\n1. نظرة عامة: مقدمة تشرح مزايا المنتج، الأداء العالي والمواد المصنعة المتينة.\n2. الميزات والخصائص الرئيسية: قائمة نقطية تسلط الضوء على نقاط القوة العملية وتفاصيل التصنيع.\n3. التوافق والمواصفات الفنية: توضيح الموديلات المتوافقة والمقاسات الدقيقة لضمان ثقة المشتري.',
      },
      nl: {
        rules: 'Handel als een professionele technische e-commerce specialist. Focus op geverifieerde fabrieksspecificaties, duurzaamheid en gegarandeerde pasvorm (OEM-compatibiliteit). Behoud merknamen en onderdeelnummers exact.',
        titlePrompt: '[Merk] + [Productnaam] + [Kleur/Variant] + (Onderdeelnummer). Beknopt, informatief en geoptimaliseerd voor zoekmachines.',
        descriptionPrompt: 'Schrijf een professionele e-commerce productbeschrijving met duidelijke secties: productoverzicht, belangrijkste kenmerken in overzichtelijke opsommingstekens en compatibele modellen met technische specificaties.',
      },
    };

    const defaultAiSettings = {
      model: 'gemini-1.5-pro',
      provider: 'Google AI',
      temperature: 0.3,
      apiKey: '',
      globalRules: 'Act as an authoritative technical e-commerce specialist. Maintain strict factual precision. Clean bullet-point formatting. High SEO value.',
      titlePrompt: 'Format: [Brand] + [Model Name] + [Scale/Category] + [Key Specification/Color]. Maintain strict manufacturer part numbers.',
      descriptionPrompt: 'Act as an expert technical e-commerce copywriter. Using the provided manufacturer specifications and features, craft a compelling, SEO-optimized product title and 3-paragraph product description highlighting durability, scale specifications, and compatibility.',
      languagePrompts: defaultLanguagePrompts,
    };

    const existingAi = (org?.settings as any)?.ai || {};
    const mergedLanguagePrompts = {
      ...defaultLanguagePrompts,
      ...(existingAi.languagePrompts || {}),
    };
    const aiConfig = { ...defaultAiSettings, ...existingAi, languagePrompts: mergedLanguagePrompts };

    return res.json({ success: true, data: aiConfig });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/organizations/ai-settings - Save tenant global AI configuration (BYOK, Prompts, Models, Multi-Language Prompts)
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
      languagePrompts,
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
      ...(languagePrompts !== undefined ? { languagePrompts } : {}),
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

// GET /api/v1/organizations/languages - Fetch tenant store languages configuration
organizationRouter.get('/languages', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const defaultLanguages = {
      primary: 'en',
      supported: ['en'],
    };

    const orgSettings = (org?.settings as any) || {};
    const languages = { ...defaultLanguages, ...(orgSettings.languages || {}) };

    // Ensure primary is inside supported
    if (!languages.supported.includes(languages.primary)) {
      languages.supported = [languages.primary, ...languages.supported];
    }

    return res.json({ success: true, languages });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/organizations/languages - Update tenant store languages configuration
organizationRouter.put('/languages', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const { primary, supported } = req.body;

    const [currentOrg] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const currentSettings = (currentOrg?.settings as any) || {};
    const validPrimary = (primary && typeof primary === 'string' && primary.trim()) ? primary.trim().toLowerCase() : (currentSettings.languages?.primary || 'en');
    
    let supportedList: string[] = [validPrimary];
    if (Array.isArray(supported) && supported.length > 0) {
      supportedList = Array.from(new Set([validPrimary, ...supported.map((l: any) => String(l).trim().toLowerCase()).filter(Boolean)]));
    } else if (currentSettings.languages?.supported) {
      supportedList = Array.from(new Set([validPrimary, ...(currentSettings.languages.supported || [])]));
    }

    const updatedLanguages = {
      primary: validPrimary,
      supported: supportedList,
      updatedAt: new Date().toISOString(),
    };

    const updatedSettings = {
      ...currentSettings,
      languages: updatedLanguages,
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
      message: 'Store languages updated successfully',
      languages: updatedLanguages,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
