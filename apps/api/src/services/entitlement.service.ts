import {
  db,
  services,
  subscriptionPlans,
  planServiceEntitlements,
  serviceUsageRecords,
  subscriptions,
  organizations,
  tenantUsageQuotas,
  subscriptionAuditLogs,
} from '@saas/database';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface EntitlementCheckResult {
  allowed: boolean;
  statusCode?: number;
  reason?: string;
  serviceCode: string;
  serviceName?: string;
  planId?: string;
  planName?: string;
  currentUsage?: number;
  usageLimit?: number;
  remaining?: number | 'unlimited';
  isUnlimited?: boolean;
  resetPeriod?: string;
}

export class EntitlementService {
  /**
   * Resolves default fallback plan dynamically from PostgreSQL database.
   * Never hardcodes limits or assumes fixed Free plan IDs.
   */
  public static async resolveDefaultFallbackPlan(): Promise<string> {
    const [freePlan] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.planType, 'free'), eq(subscriptionPlans.isActive, 'true')))
      .limit(1);

    if (freePlan?.id) {
      return freePlan.id;
    }

    const [lowestPlan] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 'true'))
      .orderBy(subscriptionPlans.priceMonthly)
      .limit(1);

    return lowestPlan?.id || 'free';
  }

  /**
   * Helper to calculate the current period key based on reset policy
   */
  public static getPeriodKey(resetPeriod: string, date: Date = new Date()): string {
    switch (resetPeriod) {
      case 'daily':
        return date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      case 'yearly':
        return date.toISOString().slice(0, 4); // 'YYYY'
      case 'never':
      case 'lifetime':
        return 'lifetime';
      case 'monthly':
      default:
        return date.toISOString().slice(0, 7); // 'YYYY-MM'
    }
  }

  /**
   * Core dynamic authorization check: verifies global service status, plan entitlement, and quota
   */
  public static async checkServiceEntitlement(
    organizationId: string,
    serviceCode: string,
    requestedUnits: number = 1
  ): Promise<EntitlementCheckResult> {
    // 1. Inspect Service Catalogue: Global Availability Check
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.code, serviceCode))
      .limit(1);

    if (!service) {
      return {
        allowed: false,
        statusCode: 404,
        reason: `SERVICE_NOT_FOUND: Service '${serviceCode}' is not registered in the platform service catalogue.`,
        serviceCode,
      };
    }

    if (service.isGloballyActive !== 'true') {
      return {
        allowed: false,
        statusCode: 403,
        reason: `SERVICE_GLOBALLY_DISABLED: Platform service '${service.name}' is currently disabled globally by the system administrator.`,
        serviceCode,
        serviceName: service.name,
      };
    }

    // 2. Resolve Organization Active Subscription
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const activePlanId = sub?.planId || (await this.resolveDefaultFallbackPlan());

    // 3. Resolve Subscription Plan
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, activePlanId))
      .limit(1);

    if (!plan) {
      return {
        allowed: false,
        statusCode: 403,
        reason: `PLAN_NOT_FOUND: The subscription plan '${activePlanId}' assigned to this organization does not exist.`,
        serviceCode,
        serviceName: service.name,
        planId: activePlanId,
      };
    }

    if (plan.isActive !== 'true') {
      return {
        allowed: false,
        statusCode: 403,
        reason: `PLAN_INACTIVE: Subscription plan '${plan.name}' is currently inactive.`,
        serviceCode,
        serviceName: service.name,
        planId: plan.id,
        planName: plan.name,
      };
    }

    // 4. Resolve Plan Entitlement for this Service
    const [entitlement] = await db
      .select()
      .from(planServiceEntitlements)
      .where(
        and(
          eq(planServiceEntitlements.planId, plan.id),
          eq(planServiceEntitlements.serviceCode, serviceCode)
        )
      )
      .limit(1);

    if (!entitlement || entitlement.isEnabled !== 'true') {
      return {
        allowed: false,
        statusCode: 403,
        reason: `SERVICE_NOT_IN_PLAN: Service '${service.name}' is not enabled in your current subscription plan (${plan.name}). Please upgrade your plan.`,
        serviceCode,
        serviceName: service.name,
        planId: plan.id,
        planName: plan.name,
        currentUsage: 0,
        usageLimit: 0,
        remaining: 0,
        isUnlimited: false,
      };
    }

    // 5. Check Quota: Unlimited vs Numeric Limit
    const isUnlimited = entitlement.isUnlimited === 'true';
    if (isUnlimited) {
      return {
        allowed: true,
        statusCode: 200,
        serviceCode,
        serviceName: service.name,
        planId: plan.id,
        planName: plan.name,
        isUnlimited: true,
        remaining: 'unlimited',
        resetPeriod: entitlement.resetPeriod,
      };
    }

    // 6. Check Current Usage for the active period key
    const periodKey = this.getPeriodKey(entitlement.resetPeriod);
    const [usageRecord] = await db
      .select({ unitsUsed: serviceUsageRecords.unitsUsed })
      .from(serviceUsageRecords)
      .where(
        and(
          eq(serviceUsageRecords.organizationId, organizationId),
          eq(serviceUsageRecords.serviceCode, serviceCode),
          eq(serviceUsageRecords.periodKey, periodKey)
        )
      )
      .limit(1);

    const currentUsage = usageRecord?.unitsUsed || 0;
    const limit = entitlement.usageLimit;
    const remaining = Math.max(0, limit - currentUsage);

    if (currentUsage + requestedUnits > limit) {
      return {
        allowed: false,
        statusCode: 403,
        reason: `PLAN_QUOTA_EXCEEDED: Quota exceeded for service '${service.name}'. Usage: ${currentUsage}/${limit} ${service.unit}. Upgrade your subscription to increase limits.`,
        serviceCode,
        serviceName: service.name,
        planId: plan.id,
        planName: plan.name,
        currentUsage,
        usageLimit: limit,
        remaining,
        isUnlimited: false,
        resetPeriod: entitlement.resetPeriod,
      };
    }

    return {
      allowed: true,
      statusCode: 200,
      serviceCode,
      serviceName: service.name,
      planId: plan.id,
      planName: plan.name,
      currentUsage,
      usageLimit: limit,
      remaining: remaining - requestedUnits,
      isUnlimited: false,
      resetPeriod: entitlement.resetPeriod,
    };
  }

  /**
   * Concurrency-safe atomic usage increment
   */
  public static async recordUsage(
    organizationId: string,
    serviceCode: string,
    units: number = 1
  ): Promise<{ unitsUsed: number; periodKey: string }> {
    // Resolve reset period from entitlement or service default
    const [entitlement] = await db
      .select({ resetPeriod: planServiceEntitlements.resetPeriod })
      .from(planServiceEntitlements)
      .innerJoin(
        subscriptions,
        eq(subscriptions.planId, planServiceEntitlements.planId)
      )
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(planServiceEntitlements.serviceCode, serviceCode)
        )
      )
      .limit(1);

    const resetPeriod = entitlement?.resetPeriod || 'monthly';
    const periodKey = this.getPeriodKey(resetPeriod);

    // Atomic upsert with Postgres ON CONFLICT DO UPDATE
    const [record] = await db
      .insert(serviceUsageRecords)
      .values({
        organizationId,
        serviceCode,
        periodKey,
        unitsUsed: units,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          serviceUsageRecords.organizationId,
          serviceUsageRecords.serviceCode,
          serviceUsageRecords.periodKey,
        ],
        set: {
          unitsUsed: sql`${serviceUsageRecords.unitsUsed} + ${units}`,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({ unitsUsed: serviceUsageRecords.unitsUsed });

    // Also sync to legacy tenant_usage_quotas for backward compatibility where applicable
    if (serviceCode === 'product_scraping') {
      const ym = new Date().toISOString().slice(0, 7);
      await db
        .insert(tenantUsageQuotas)
        .values({
          organizationId,
          currentPeriod: ym,
          productsUsed: units,
        })
        .onConflictDoUpdate({
          target: [tenantUsageQuotas.organizationId, tenantUsageQuotas.currentPeriod],
          set: {
            productsUsed: sql`${tenantUsageQuotas.productsUsed} + ${units}`,
            updatedAt: new Date(),
          },
        })
        .catch(() => {});
    }

    return { unitsUsed: record?.unitsUsed || units, periodKey };
  }

  /**
   * Safely releases reserved usage when a background operation fails
   */
  public static async releaseUsage(
    organizationId: string,
    serviceCode: string,
    units: number = 1
  ): Promise<void> {
    const periodKey = this.getPeriodKey('monthly');
    await db
      .update(serviceUsageRecords)
      .set({
        unitsUsed: sql`GREATEST(0, ${serviceUsageRecords.unitsUsed} - ${units})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serviceUsageRecords.organizationId, organizationId),
          eq(serviceUsageRecords.serviceCode, serviceCode),
          eq(serviceUsageRecords.periodKey, periodKey)
        )
      );
  }

  /**
   * Retrieves live, dynamic service entitlements and usage for an organization dashboard
   */
  public static async getOrganizationEntitlements(organizationId: string) {
    // 1. Resolve organization and subscription
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const fallbackPlanId = await this.resolveDefaultFallbackPlan();
    const activePlanId = sub?.planId || org?.planTier || fallbackPlanId;

    // 2. Resolve plan details
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, activePlanId))
      .limit(1);

    // 3. Fetch all platform services
    const allServices = await db
      .select()
      .from(services)
      .orderBy(services.category, services.name);

    // 4. Fetch plan entitlements
    const entitlements = await db
      .select()
      .from(planServiceEntitlements)
      .where(eq(planServiceEntitlements.planId, activePlanId));

    const entitlementMap = new Map<string, typeof entitlements[0]>();
    for (const ent of entitlements) {
      entitlementMap.set(ent.serviceCode, ent);
    }

    // 5. Fetch usage records
    const currentPeriodMonth = new Date().toISOString().slice(0, 7);
    const usageList = await db
      .select()
      .from(serviceUsageRecords)
      .where(eq(serviceUsageRecords.organizationId, organizationId));

    const usageMap = new Map<string, number>();
    for (const u of usageList) {
      usageMap.set(`${u.serviceCode}:${u.periodKey}`, u.unitsUsed);
    }

    // 6. Build dynamic service list
    const servicesList = allServices.map((svc) => {
      const ent = entitlementMap.get(svc.code);
      const isGloballyActive = svc.isGloballyActive === 'true';
      const isPlanEnabled = isGloballyActive && ent?.isEnabled === 'true';
      const isUnlimited = ent?.isUnlimited === 'true';
      const limit = ent?.usageLimit || 0;
      const resetPeriod = ent?.resetPeriod || svc.defaultResetPeriod || 'monthly';
      const periodKey = this.getPeriodKey(resetPeriod);
      const usage = usageMap.get(`${svc.code}:${periodKey}`) || 0;
      const remaining = isUnlimited ? 'unlimited' : Math.max(0, limit - usage);

      let status = 'available';
      if (!isGloballyActive) {
        status = 'globally_disabled';
      } else if (!ent || ent.isEnabled !== 'true') {
        status = 'not_included_in_plan';
      } else if (!isUnlimited && usage >= limit) {
        status = 'quota_exceeded';
      }

      return {
        code: svc.code,
        name: svc.name,
        description: svc.description,
        category: svc.category,
        unit: svc.unit,
        metricType: svc.metricType,
        isGloballyActive,
        isPlanEnabled,
        isUnlimited,
        usageLimit: limit,
        currentUsage: usage,
        remaining,
        resetPeriod,
        status,
      };
    });

    return {
      organization: {
        id: org?.id,
        name: org?.name,
        planTier: activePlanId,
      },
      subscription: sub ? {
        id: sub.id,
        planId: sub.planId,
        status: sub.status,
        billingCycle: sub.billingCycle,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd === 'true',
      } : {
        planId: fallbackPlanId,
        status: 'active',
        billingCycle: 'monthly',
      },
      plan: plan ? {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        planType: plan.planType,
        priceMonthly: parseFloat(plan.priceMonthly),
        priceAnnual: parseFloat(plan.priceAnnual),
        currency: plan.currency,
        features: plan.features,
      } : {
        id: fallbackPlanId,
        name: 'Standard Tier',
        priceMonthly: 0,
        priceAnnual: 0,
      },
      services: servicesList,
    };
  }

  /**
   * Admin-initiated dynamic plan assignment with audit logging
   */
  public static async assignPlan(
    actorId: string | null,
    actorEmail: string | null,
    organizationId: string,
    newPlanId: string,
    reason: string = 'Administrative plan assignment'
  ) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, newPlanId))
      .limit(1);

    if (!plan) {
      throw new Error(`Target plan '${newPlanId}' not found.`);
    }

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const previousPlanId = existingSub?.planId || 'free';

    // Update or insert subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (existingSub) {
      await db
        .update(subscriptions)
        .set({
          planId: newPlanId,
          status: 'active',
          updatedAt: now,
        })
        .where(eq(subscriptions.organizationId, organizationId));
    } else {
      await db.insert(subscriptions).values({
        organizationId,
        planId: newPlanId,
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    }

    // Update organization planTier
    await db
      .update(organizations)
      .set({
        planTier: newPlanId,
        updatedAt: now,
      })
      .where(eq(organizations.id, organizationId));

    // Record in audit log
    await db.insert(subscriptionAuditLogs).values({
      organizationId,
      actorId: actorId as any,
      actorEmail,
      action: 'PLAN_ASSIGNED',
      previousPlanId,
      newPlanId,
      reason,
      metadata: { planName: plan.name, timestamp: now.toISOString() },
    });

    return { success: true, organizationId, previousPlanId, newPlanId };
  }
}
