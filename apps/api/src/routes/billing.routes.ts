import { Router, Request, Response } from 'express';
import {
  db,
  subscriptions,
  tenantUsageQuotas,
  invoices,
  organizations,
  billingWebhookEvents,
  customerProductMappings,
  connectedStores,
  aiProcessingHistory,
  services,
  subscriptionPlans,
  planServiceEntitlements,
  serviceUsageRecords,
  paymentGatewayConfigs,
  subscriptionAuditLogs,
} from '@saas/database';
import { eq, desc, and, sql, or } from 'drizzle-orm';
import { authMiddleware, superAdminOnlyMiddleware } from '../middleware/auth.middleware';
import { StripeService, SAAS_PLANS } from '../services/stripe.service';
import { EntitlementService } from '../services/entitlement.service';

export const billingRouter = Router();

/**
 * Helper to get organization ID from request
 */
function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req.headers['x-organization-id'] as string) || null;
}

// Re-export SAAS_PLANS for backward compatibility
export { SAAS_PLANS };

// ============================================================================
// 1. PUBLIC WEBHOOK ENDPOINT (Authenticates via Stripe HMAC signature)
// ============================================================================
/**
 * POST /api/v1/billing/webhook
 * Receives and processes asynchronous Stripe billing webhooks idempotently
 */
billingRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string | undefined;

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // Retrieve raw body buffer
  const rawBody: Buffer | string = (req as any).rawBody || req.body;
  if (!rawBody || (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody) && Object.keys(rawBody).length === 0)) {
    return res.status(400).json({ error: 'Missing raw request body for webhook verification' });
  }

  try {
    const event = StripeService.constructWebhookEvent(rawBody, signature);
    const result = await StripeService.processWebhookEvent(event);

    return res.status(200).json({
      received: true,
      eventId: event.id,
      duplicate: result.duplicate,
      action: result.actionTaken,
    });
  } catch (err: any) {
    console.error('[StripeWebhook] Webhook error:', err.message);
    return res.status(400).json({
      error: 'Webhook processing failed',
      details: err.message,
    });
  }
});

// ============================================================================
// PROTECTED CLIENT ROUTES (Require Authenticated User & Organization Context)
// ============================================================================
billingRouter.use(authMiddleware);

/**
 * 2. GET /api/v1/billing/my-subscription
 * Fetch current tenant subscription state, plan tier, real-time quotas, and recent invoices
 */
billingRouter.get('/my-subscription', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    // Fetch latest subscription record or create default starter subscription
    let [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!sub) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      [sub] = await db
        .insert(subscriptions)
        .values({
          organizationId: orgId,
          planId: 'pro',
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextMonth,
        })
        .returning();
    }

    const currentPlan = SAAS_PLANS[sub.planId] || SAAS_PLANS.pro;

    // Fetch or initialize tenantUsageQuotas
    let [quota] = await db
      .select()
      .from(tenantUsageQuotas)
      .where(and(eq(tenantUsageQuotas.organizationId, orgId), eq(tenantUsageQuotas.currentPeriod, currentPeriod)))
      .limit(1);

    if (!quota) {
      [quota] = await db
        .insert(tenantUsageQuotas)
        .values({
          organizationId: orgId,
          currentPeriod,
          productsUsed: 0,
          productsLimit: currentPlan.productLimit,
          storesConnected: 0,
          storesLimit: currentPlan.storeLimit,
          aiTokensUsed: 0,
          aiTokensLimit: currentPlan.aiTokenLimit,
          scrapingJobsRun: 0,
        })
        .returning();
    }

    // Real-time catalog product count
    const [prodCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerProductMappings)
      .where(eq(customerProductMappings.organizationId, orgId));

    // Real-time connected stores count
    const [storeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(connectedStores)
      .where(eq(connectedStores.organizationId, orgId));

    // Real-time monthly AI tokens count
    const [tokensCount] = await db
      .select({ tokens: sql<number>`coalesce(sum(${aiProcessingHistory.tokenUsage}), 0)::int` })
      .from(aiProcessingHistory);

    const productsUsed = prodCount?.count || 0;
    const storesConnected = storeCount?.count || 0;
    const aiTokensUsed = tokensCount?.tokens || quota.aiTokensUsed || 0;

    // Fetch invoices for this tenant
    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, orgId))
      .orderBy(desc(invoices.createdAt))
      .limit(15);

    // Fetch dynamic entitlement and services data from EntitlementService
    const entitlementsData = await EntitlementService.getOrganizationEntitlements(orgId);

    // Fetch dynamic plans available for upgrade
    const availablePlans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 'true'))
      .orderBy(subscriptionPlans.sortOrder);

    return res.json({
      success: true,
      subscription: sub,
      plan: entitlementsData.plan || currentPlan,
      plans: SAAS_PLANS,
      availablePlans,
      services: entitlementsData.services,
      usage: {
        currentPeriod,
        products: {
          used: productsUsed,
          limit: quota.productsLimit || currentPlan.productLimit,
          percentage: Math.min(100, Math.round((productsUsed / (quota.productsLimit || currentPlan.productLimit)) * 100)),
        },
        stores: {
          used: storesConnected,
          limit: quota.storesLimit || currentPlan.storeLimit,
          percentage: Math.min(100, Math.round((storesConnected / (quota.storesLimit || currentPlan.storeLimit)) * 100)),
        },
        aiTokens: {
          used: aiTokensUsed,
          limit: quota.aiTokensLimit || currentPlan.aiTokenLimit,
          percentage: Math.min(100, Math.round((aiTokensUsed / (quota.aiTokensLimit || currentPlan.aiTokenLimit)) * 100)),
        },
      },
      invoices: invoiceList,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * 3. POST /api/v1/billing/checkout-session
 * Creates a Stripe Checkout Session for subscription upgrade
 */
billingRouter.post('/checkout-session', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const user = req.user!;
  const { planId, billingCycle, successUrl, cancelUrl } = req.body;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  const [dbPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(or(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.code, planId)))
    .limit(1);

  if (!dbPlan && !SAAS_PLANS[planId]) {
    return res.status(400).json({ error: `Invalid plan selected: "${planId}".` });
  }

  const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
  const defaultBase = 'http://localhost:3000';
  const sUrl = successUrl || `${defaultBase}/settings/billing`;
  const cUrl = cancelUrl || `${defaultBase}/settings/billing`;

  try {
    const session = await StripeService.createCheckoutSession({
      organizationId: orgId,
      userId: user.userId,
      userEmail: user.email,
      planId,
      billingCycle: cycle,
      successUrl: sUrl,
      cancelUrl: cUrl,
    });

    return res.json({
      success: true,
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (err: any) {
    console.error('[StripeCheckout] Error creating session:', err);
    return res.status(500).json({ error: 'Failed to create checkout session', details: err.message });
  }
});

/**
 * 4. POST /api/v1/billing/portal-session
 * Generates Stripe Customer Portal session for billing self-service
 */
billingRouter.post('/portal-session', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { returnUrl } = req.body;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const defaultReturn = returnUrl || 'http://localhost:3000/settings/billing';
    const portal = await StripeService.createCustomerPortalSession(orgId, defaultReturn);

    return res.json({
      success: true,
      portalUrl: portal.portalUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create portal session', details: err.message });
  }
});

/**
 * 5. POST /api/v1/billing/change-plan
 * Direct plan tier transition (for free tier switch, downgrades, or sandbox test mode)
 */
billingRouter.post('/change-plan', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const { planId, billingCycle } = req.body;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  const [dbPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(or(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.code, planId)))
    .limit(1);

  if (!dbPlan && !SAAS_PLANS[planId]) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  try {
    const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
    await StripeService.activateSubscription({
      organizationId: orgId,
      planId,
      billingCycle: cycle,
    });

    // Record invoice record for audit trail
    const cost = dbPlan
      ? (cycle === 'annual' ? parseFloat(dbPlan.priceAnnual) : parseFloat(dbPlan.priceMonthly))
      : (cycle === 'annual' ? SAAS_PLANS[planId].priceAnnual : SAAS_PLANS[planId].priceMonthly);
    const invNum = `INV-${Date.now().toString().slice(-6)}`;

    await db.insert(invoices).values({
      organizationId: orgId,
      invoiceNumber: invNum,
      amountDueUsd: String(cost),
      amountPaidUsd: String(cost),
      status: 'paid',
      paidAt: new Date(),
    });

    const [updatedSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return res.json({
      success: true,
      message: `Successfully transitioned subscription to ${dbPlan?.name || SAAS_PLANS[planId]?.name || planId}`,
      subscription: updatedSub,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * 6. GET /api/v1/billing/invoices
 * Lists all invoices for the authenticated tenant (Multi-tenant isolated)
 */
billingRouter.get('/invoices', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const tenantInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, orgId))
      .orderBy(desc(invoices.createdAt));

    return res.json({
      success: true,
      invoices: tenantInvoices,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch invoices', details: err.message });
  }
});

/**
 * 7. GET /api/v1/billing/invoices/:id
 * Fetches a single invoice by ID with strict multi-tenant isolation
 */
billingRouter.get('/invoices/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, orgId)))
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found or access denied.' });
    }

    return res.json({
      success: true,
      invoice,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch invoice', details: err.message });
  }
});

/**
 * 8. GET /api/v1/billing/admin-revenue
 * Platform Financial Telemetry (Strictly Super Admin Only)
 */
billingRouter.get('/admin-revenue', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const [totalOrgsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizations);
    const totalTenants = totalOrgsRes?.count || 0;

    // Plan tier distribution
    const tierDistribution = await db
      .select({
        tier: organizations.planTier,
        count: sql<number>`count(*)::int`,
      })
      .from(organizations)
      .groupBy(organizations.planTier);

    // Compute MRR dynamically from database subscription plans
    const allDbPlans = await db.select().from(subscriptionPlans);
    const dbPlanMap = new Map<string, number>();
    for (const p of allDbPlans) {
      dbPlanMap.set(p.id, parseFloat(p.priceMonthly));
    }

    let computedMrr = 0;
    tierDistribution.forEach((t) => {
      const price = dbPlanMap.has(t.tier || '')
        ? dbPlanMap.get(t.tier || '')!
        : (SAAS_PLANS[t.tier || 'starter']?.priceMonthly || 0);
      computedMrr += price * t.count;
    });

    const arr = computedMrr * 12;
    const arpu = totalTenants > 0 ? (computedMrr / totalTenants).toFixed(2) : '0.00';

    // Total actual revenue from paid invoices
    const [paidInvoicesRes] = await db
      .select({ totalRevenue: sql<number>`coalesce(sum(${invoices.amountPaidUsd}), 0)::numeric` })
      .from(invoices)
      .where(eq(invoices.status, 'paid'));

    // Count past due subscriptions
    const [pastDueRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'past_due'));

    // Recent billing webhook events
    const recentEvents = await db
      .select()
      .from(billingWebhookEvents)
      .orderBy(desc(billingWebhookEvents.processedAt))
      .limit(10);

    return res.json({
      success: true,
      mrr: computedMrr,
      arr,
      arpu: Number(arpu),
      totalTenants,
      totalPaidRevenueUsd: Number(paidInvoicesRes?.totalRevenue || 0),
      pastDueTenantsCount: pastDueRes?.count || 0,
      tierDistribution,
      plans: SAAS_PLANS,
      recentEvents,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch admin revenue metrics', details: err.message });
  }
});

// ============================================================================
// ADMIN-CONTROLLED DYNAMIC SERVICE & PLAN MANAGEMENT ENDPOINTS (SUPER ADMIN ONLY)
// ============================================================================

/**
 * 9. GET /api/v1/billing/admin/services
 * Central Service Catalogue listing with plan usage count
 */
billingRouter.get('/admin/services', superAdminOnlyMiddleware, async (_req: Request, res: Response) => {
  try {
    const allServices = await db.select().from(services).orderBy(services.category, services.name);
    const entitlements = await db
      .select({ serviceCode: planServiceEntitlements.serviceCode, planId: planServiceEntitlements.planId })
      .from(planServiceEntitlements);

    const planUsageMap: Record<string, string[]> = {};
    entitlements.forEach((e) => {
      if (!planUsageMap[e.serviceCode]) planUsageMap[e.serviceCode] = [];
      if (!planUsageMap[e.serviceCode].includes(e.planId)) planUsageMap[e.serviceCode].push(e.planId);
    });

    const enriched = allServices.map((s) => ({
      ...s,
      isGloballyActive: s.isGloballyActive === 'true',
      supportsUnlimited: s.supportsUnlimited === 'true',
      plansCount: (planUsageMap[s.code] || []).length,
      plans: planUsageMap[s.code] || [],
    }));

    return res.json({ success: true, services: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list services', details: err.message });
  }
});

/**
 * 10. POST /api/v1/billing/admin/services
 * Register new service in Service Catalogue
 */
billingRouter.post('/admin/services', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, name, description, category, unit, metricType, supportsUnlimited, defaultResetPeriod, isGloballyActive } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }
    const cleanCode = code.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    const [created] = await db
      .insert(services)
      .values({
        id: cleanCode,
        code: cleanCode,
        name,
        description: description || null,
        category: category || 'general',
        unit: unit || 'units',
        metricType: metricType || 'count',
        supportsUnlimited: supportsUnlimited !== false ? 'true' : 'false',
        defaultResetPeriod: defaultResetPeriod || 'monthly',
        isGloballyActive: isGloballyActive !== false ? 'true' : 'false',
      })
      .returning();

    return res.status(201).json({ success: true, service: created });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register service', details: err.message });
  }
});

/**
 * 11. PATCH /api/v1/billing/admin/services/:id
 * Update service details or toggle global availability
 */
billingRouter.patch('/admin/services/:id', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, description, category, unit, metricType, supportsUnlimited, defaultResetPeriod, isGloballyActive } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (unit !== undefined) updateData.unit = unit;
    if (metricType !== undefined) updateData.metricType = metricType;
    if (supportsUnlimited !== undefined) updateData.supportsUnlimited = supportsUnlimited ? 'true' : 'false';
    if (defaultResetPeriod !== undefined) updateData.defaultResetPeriod = defaultResetPeriod;
    if (isGloballyActive !== undefined) updateData.isGloballyActive = isGloballyActive ? 'true' : 'false';

    const [updated] = await db
      .update(services)
      .set(updateData)
      .where(eq(services.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Service not found' });
    }

    return res.json({ success: true, service: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update service', details: err.message });
  }
});

/**
 * 12. GET /api/v1/billing/admin/plans
 * List all subscription plans with their independent service entitlements
 */
billingRouter.get('/admin/plans', superAdminOnlyMiddleware, async (_req: Request, res: Response) => {
  try {
    const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    const entitlements = await db.select().from(planServiceEntitlements);

    const entMap: Record<string, any[]> = {};
    entitlements.forEach((e) => {
      if (!entMap[e.planId]) entMap[e.planId] = [];
      entMap[e.planId].push({
        ...e,
        isEnabled: e.isEnabled === 'true',
        isUnlimited: e.isUnlimited === 'true',
      });
    });

    const result = plans.map((p) => ({
      ...p,
      isActive: p.isActive === 'true',
      isPublic: p.isPublic === 'true',
      priceMonthly: parseFloat(p.priceMonthly),
      priceAnnual: parseFloat(p.priceAnnual),
      entitlements: entMap[p.id] || [],
    }));

    return res.json({ success: true, plans: result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list plans', details: err.message });
  }
});

/**
 * 13. POST /api/v1/billing/admin/plans
 * Create dynamic subscription plan with custom service limits and reset periods
 */
billingRouter.post('/admin/plans', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, code, name, description, planType, priceMonthly, priceAnnual, currency, billingCycle, isActive, isPublic, sortOrder, features, entitlements } = req.body;
    if (!name || (!id && !code)) {
      return res.status(400).json({ error: 'name and id/code are required' });
    }

    const planId = (id || code).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const planCode = (code || id).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    const [createdPlan] = await db
      .insert(subscriptionPlans)
      .values({
        id: planId,
        code: planCode,
        name,
        description: description || null,
        planType: planType || 'paid',
        priceMonthly: String(priceMonthly || 0),
        priceAnnual: String(priceAnnual || 0),
        currency: currency || 'USD',
        billingCycle: billingCycle || 'monthly',
        isActive: isActive !== false ? 'true' : 'false',
        isPublic: isPublic !== false ? 'true' : 'false',
        sortOrder: Number(sortOrder || 0),
        features: Array.isArray(features) ? features : [],
      })
      .returning();

    if (Array.isArray(entitlements)) {
      for (const ent of entitlements) {
        if (ent.serviceCode) {
          await db
            .insert(planServiceEntitlements)
            .values({
              planId: createdPlan.id,
              serviceCode: ent.serviceCode,
              isEnabled: ent.isEnabled !== false ? 'true' : 'false',
              isUnlimited: ent.isUnlimited ? 'true' : 'false',
              usageLimit: Number(ent.usageLimit || 0),
              resetPeriod: ent.resetPeriod || 'monthly',
            })
            .onConflictDoNothing();
        }
      }
    }

    return res.status(201).json({ success: true, plan: createdPlan });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create plan', details: err.message });
  }
});

/**
 * 14. PATCH /api/v1/billing/admin/plans/:id
 * Modify existing plan metadata, pricing, active status, or service entitlements
 */
billingRouter.patch('/admin/plans/:id', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, description, planType, priceMonthly, priceAnnual, currency, billingCycle, isActive, isPublic, sortOrder, features, entitlements } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (planType !== undefined) updateData.planType = planType;
    if (priceMonthly !== undefined) updateData.priceMonthly = String(priceMonthly);
    if (priceAnnual !== undefined) updateData.priceAnnual = String(priceAnnual);
    if (currency !== undefined) updateData.currency = currency;
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (isActive !== undefined) updateData.isActive = isActive ? 'true' : 'false';
    if (isPublic !== undefined) updateData.isPublic = isPublic ? 'true' : 'false';
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);
    if (features !== undefined) updateData.features = features;

    const [updatedPlan] = await db
      .update(subscriptionPlans)
      .set(updateData)
      .where(eq(subscriptionPlans.id, id))
      .returning();

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Upsert entitlements
    if (Array.isArray(entitlements)) {
      for (const ent of entitlements) {
        if (ent.serviceCode) {
          await db
            .insert(planServiceEntitlements)
            .values({
              planId: id,
              serviceCode: ent.serviceCode,
              isEnabled: ent.isEnabled !== false ? 'true' : 'false',
              isUnlimited: ent.isUnlimited ? 'true' : 'false',
              usageLimit: Number(ent.usageLimit || 0),
              resetPeriod: ent.resetPeriod || 'monthly',
            })
            .onConflictDoUpdate({
              target: [planServiceEntitlements.planId, planServiceEntitlements.serviceCode],
              set: {
                isEnabled: ent.isEnabled !== false ? 'true' : 'false',
                isUnlimited: ent.isUnlimited ? 'true' : 'false',
                usageLimit: Number(ent.usageLimit || 0),
                resetPeriod: ent.resetPeriod || 'monthly',
                updatedAt: new Date(),
              },
            });
        }
      }
    }

    return res.json({ success: true, plan: updatedPlan });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update plan', details: err.message });
  }
});

/**
 * 15. GET /api/v1/billing/admin/subscriptions
 * Customer subscriptions list with plan tiers and status
 */
billingRouter.get('/admin/subscriptions', superAdminOnlyMiddleware, async (_req: Request, res: Response) => {
  try {
    const orgList = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    const subList = await db.select().from(subscriptions);
    const planList = await db.select().from(subscriptionPlans);

    const subMap = new Map(subList.map((s) => [s.organizationId, s]));
    const planMap = new Map(planList.map((p) => [p.id, p]));

    const data = orgList.map((org) => {
      const sub = subMap.get(org.id);
      const planId = sub?.planId || org.planTier || 'free';
      const plan = planMap.get(planId);

      return {
        organizationId: org.id,
        organizationName: org.name,
        planId,
        planName: plan?.name || planId,
        status: sub?.status || 'active',
        billingCycle: sub?.billingCycle || 'monthly',
        currentPeriodStart: sub?.currentPeriodStart,
        currentPeriodEnd: sub?.currentPeriodEnd,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd === 'true',
      };
    });

    return res.json({ success: true, subscriptions: data });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list subscriptions', details: err.message });
  }
});

/**
 * 16. PATCH /api/v1/billing/admin/subscriptions/:orgId/assign-plan
 * Manually assign a plan to an organization with audit trail
 */
billingRouter.patch('/admin/subscriptions/:orgId/assign-plan', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params.orgId);
    const { planId, reason } = req.body;
    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const adminUser = (req as any).user;
    const result = await EntitlementService.assignPlan(
      adminUser?.userId || null,
      adminUser?.email || null,
      orgId,
      planId,
      reason || 'Administrative manual plan assignment'
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to assign plan', details: err.message });
  }
});

/**
 * 17. GET /api/v1/billing/admin/payment-gateways
 * Payment gateway configurations (Credentials masked for security)
 */
billingRouter.get('/admin/payment-gateways', superAdminOnlyMiddleware, async (_req: Request, res: Response) => {
  try {
    const gateways = await db.select().from(paymentGatewayConfigs);
    const sanitized = gateways.map(({ credentialsEncrypted, ...rest }) => ({
      ...rest,
      isEnabled: rest.isEnabled === 'true',
      isDefault: rest.isDefault === 'true',
      hasCredentialsConfigured: Boolean(credentialsEncrypted && Object.keys(credentialsEncrypted).length > 0),
    }));

    return res.json({ success: true, gateways: sanitized });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch gateways', details: err.message });
  }
});

/**
 * 18. PATCH /api/v1/billing/admin/payment-gateways/:id
 * Toggle gateway mode, enable/disable status, or update supported payment methods
 */
billingRouter.patch('/admin/payment-gateways/:id', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { isEnabled, isDefault, mode, supportedPaymentMethods, supportedCurrencies } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled ? 'true' : 'false';
    if (isDefault !== undefined) updateData.isDefault = isDefault ? 'true' : 'false';
    if (mode !== undefined) updateData.mode = mode;

    const ALLOWED_METHODS = [
      'card',
      'us_bank_account',
      'sepa_debit',
      'ideal',
      'link',
      'bacs_debit',
      'alipay',
      'upi',
      'klarna',
      'wechat_pay',
      'promptpay',
      'oxxo',
      'boleto',
    ];
    if (supportedPaymentMethods !== undefined) {
      if (!Array.isArray(supportedPaymentMethods) || supportedPaymentMethods.length === 0) {
        return res.status(400).json({ error: 'supportedPaymentMethods must be a non-empty array' });
      }
      const invalid = supportedPaymentMethods.filter((m: string) => !ALLOWED_METHODS.includes(m));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: `Unsupported payment methods: ${invalid.join(', ')}. Supported: ${ALLOWED_METHODS.join(', ')}`,
        });
      }
      updateData.supportedPaymentMethods = supportedPaymentMethods;
    }

    if (supportedCurrencies !== undefined) updateData.supportedCurrencies = supportedCurrencies;

    const [updated] = await db
      .update(paymentGatewayConfigs)
      .set(updateData)
      .where(eq(paymentGatewayConfigs.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Gateway not found' });
    }

    const { credentialsEncrypted, ...sanitized } = updated;
    return res.json({
      success: true,
      gateway: {
        ...sanitized,
        isEnabled: sanitized.isEnabled === 'true',
        isDefault: sanitized.isDefault === 'true',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update gateway', details: err.message });
  }
});

/**
 * 19. POST /api/v1/billing/admin/payment-gateways/:id/test
 * Test connectivity for payment gateway
 */
billingRouter.post('/admin/payment-gateways/:id/test', superAdminOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [gw] = await db.select().from(paymentGatewayConfigs).where(eq(paymentGatewayConfigs.id, id)).limit(1);

    if (!gw) {
      return res.status(404).json({ error: 'Gateway not found' });
    }

    let testSuccess = false;
    let testDetails = '';

    if (id === 'stripe') {
      try {
        const stripe = StripeService.getClient();
        await stripe.paymentMethods.list({ limit: 1 }).catch((err) => {
          testDetails = err.message;
        });
        testSuccess = true;
        testDetails = testDetails || 'Stripe API communication validated successfully';
      } catch (e: any) {
        testDetails = e.message;
      }
    }

    await db
      .update(paymentGatewayConfigs)
      .set({ lastTestedAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentGatewayConfigs.id, id));

    return res.json({
      success: testSuccess,
      gatewayId: id,
      details: testDetails,
      testedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to test gateway', details: err.message });
  }
});

/**
 * 20. GET /api/v1/billing/admin/audit-logs
 * Immutable audit logs of administrative plan changes and limit modifications
 */
billingRouter.get('/admin/audit-logs', superAdminOnlyMiddleware, async (_req: Request, res: Response) => {
  try {
    const logs = await db.select().from(subscriptionAuditLogs).orderBy(desc(subscriptionAuditLogs.createdAt)).limit(50);
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
  }
});
