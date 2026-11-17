import Stripe from 'stripe';
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
  subscriptionPlans,
  planServiceEntitlements,
  paymentGatewayConfigs,
} from '@saas/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { EntitlementService } from './entitlement.service';

export interface PlanConfig {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  productLimit: number;
  storeLimit: number;
  aiTokenLimit: number;
  priceIdMonthly?: string;
  priceIdAnnual?: string;
  features: string[];
}

export const SAAS_PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free Starter',
    priceMonthly: 0,
    priceAnnual: 0,
    productLimit: 50,
    storeLimit: 1,
    aiTokenLimit: 5000,
    features: [
      'Up to 50 catalog products',
      '1 Connected Store',
      '5,000 AI normalization tokens / month',
      'Standard community support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    priceMonthly: 49,
    priceAnnual: 470,
    productLimit: 500,
    storeLimit: 1,
    aiTokenLimit: 50000,
    priceIdMonthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    priceIdAnnual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
    features: [
      'Up to 500 catalog products',
      '1 Connected Store (OpenCart, Shopify, or WooCommerce)',
      '50,000 AI normalization tokens / month',
      'Universal Bridge v2.0 sync',
      'Automated spec extraction',
      'Standard email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Professional Growth',
    priceMonthly: 149,
    priceAnnual: 1430,
    productLimit: 5000,
    storeLimit: 3,
    aiTokenLimit: 500000,
    priceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    priceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    features: [
      'Up to 5,000 catalog products',
      '3 Connected Stores with multi-store routing',
      '500,000 AI normalization tokens / month',
      'Priority BullMQ scraping queue',
      'Batch variant extraction & multi-angle galleries',
      'High-speed proxy rotation',
      'Priority Discord & ticket support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Scale',
    priceMonthly: 499,
    priceAnnual: 4790,
    productLimit: 50000,
    storeLimit: 10,
    aiTokenLimit: 5000000,
    priceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    priceIdAnnual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
    features: [
      'Up to 50,000 catalog products',
      '10 Connected Stores + custom REST API endpoints',
      '5,000,000 AI normalization tokens (Gemini 1.5 Pro / Claude)',
      'BYOK (Bring Your Own API Keys)',
      'Dedicated headless worker instances',
      'Custom brand selector authoring',
      'Dedicated SLA & 24/7 technical architect support',
    ],
  },
};

export class StripeService {
  private static stripeClient: Stripe | null = null;

  public static getClient(): Stripe {
    if (!this.stripeClient) {
      const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_change_in_production';
      this.stripeClient = new Stripe(secretKey, {
        apiVersion: '2024-11-20.acacia' as any,
        typescript: true,
      });
    }
    return this.stripeClient;
  }

  public static getWebhookSecret(): string {
    return process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_cryptographic_verification_32bytes';
  }

  /**
   * Resolves or creates a Stripe Customer linked to organizationId
   */
  public static async getOrCreateCustomer(
    organizationId: string,
    email: string,
    name?: string
  ): Promise<string> {
    const [sub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (sub?.stripeCustomerId) {
      return sub.stripeCustomerId;
    }

    const stripe = this.getClient();
    const customer = await stripe.customers.create({
      email,
      name: name || `Org ${organizationId.slice(0, 8)}`,
      metadata: {
        organizationId,
      },
    });

    // Update customer ID in subscription record if exists
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: customer.id,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.organizationId, organizationId));

    return customer.id;
  }

  /**
   * Generates a Stripe Checkout Session for subscription purchase/upgrade
   */
  public static async createCheckoutSession(params: {
    organizationId: string;
    userId: string;
    userEmail: string;
    userName?: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; checkoutUrl: string | null }> {
    const { organizationId, userEmail, userName, planId, billingCycle, successUrl, cancelUrl } = params;

    // 1. Verify Payment Gateway is enabled
    const [gateway] = await db
      .select()
      .from(paymentGatewayConfigs)
      .where(eq(paymentGatewayConfigs.id, 'stripe'))
      .limit(1);

    if (gateway && gateway.isEnabled !== 'true') {
      throw new Error('Payment gateway Stripe is currently disabled by platform administrator.');
    }

    // 2. Resolve Plan: Database-driven first, fallback to static config
    let planName = '';
    let monthlyPrice = 0;
    let annualPrice = 0;
    let priceId: string | undefined;

    const [dbPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (dbPlan) {
      if (dbPlan.planType === 'free') {
        throw new Error(`Plan "${dbPlan.name}" is a free plan and does not require checkout.`);
      }
      planName = dbPlan.name;
      monthlyPrice = parseFloat(dbPlan.priceMonthly);
      annualPrice = parseFloat(dbPlan.priceAnnual);
      priceId = billingCycle === 'annual' ? (dbPlan.stripeAnnualPriceId || undefined) : (dbPlan.stripeMonthlyPriceId || undefined);
    } else {
      const plan = SAAS_PLANS[planId];
      if (!plan || planId === 'free') {
        throw new Error(`Invalid plan for Stripe checkout: "${planId}"`);
      }
      planName = plan.name;
      monthlyPrice = plan.priceMonthly;
      annualPrice = plan.priceAnnual;
      priceId = billingCycle === 'annual' ? plan.priceIdAnnual : plan.priceIdMonthly;
    }

    const customerId = await this.getOrCreateCustomer(organizationId, userEmail, userName);
    const stripe = this.getClient();

    const amountCents = Math.round((billingCycle === 'annual' ? annualPrice : monthlyPrice) * 100);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Product Intelligence AI - ${planName}`,
                description: `${planName} (${billingCycle}) dynamic subscription plan.`,
              },
              unit_amount: amountCents,
              recurring: {
                interval: billingCycle === 'annual' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ];

    // Resolve dynamically enabled payment methods from gateway configuration
    const allowedStripeMethods = [
      'card',
      'us_bank_account',
      'sepa_debit',
      'ideal',
      'link',
      'bacs_debit',
      'alipay',
    ];

    let paymentMethodTypes: string[] = ['card'];
    if (gateway && Array.isArray(gateway.supportedPaymentMethods) && gateway.supportedPaymentMethods.length > 0) {
      const filtered = (gateway.supportedPaymentMethods as string[]).filter((m) =>
        allowedStripeMethods.includes(m)
      );
      if (filtered.length > 0) {
        paymentMethodTypes = filtered;
      }
    }

    const sessionParams: any = {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: organizationId,
      line_items: lineItems,
      payment_method_types: paymentMethodTypes,
      allowed_payment_method_types: paymentMethodTypes,
      metadata: {
        organizationId,
        planId,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          organizationId,
          planId,
          billingCycle,
        },
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  /**
   * Generates a Stripe Customer Portal session for billing self-service
   */
  public static async createCustomerPortalSession(
    organizationId: string,
    returnUrl: string
  ): Promise<{ portalUrl: string }> {
    const [sub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      throw new Error('No active Stripe customer found for this organization');
    }

    const stripe = this.getClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return {
      portalUrl: session.url,
    };
  }

  /**
   * Verifies Stripe webhook HMAC signature against raw request Buffer
   */
  public static constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const webhookSecret = this.getWebhookSecret();
    const stripe = this.getClient();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  /**
   * Idempotent, transaction-safe webhook event processor
   */
  public static async processWebhookEvent(event: Stripe.Event): Promise<{
    processed: boolean;
    duplicate: boolean;
    actionTaken: string;
    organizationId?: string | null;
  }> {
    // 1. Idempotency Check: Verify if event has already been processed
    const [existingEvent] = await db
      .select()
      .from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.eventId, event.id))
      .limit(1);

    if (existingEvent && existingEvent.status === 'PROCESSED') {
      console.log(`[StripeWebhook] Event ${event.id} already processed. Skipping duplicate.`);
      return {
        processed: true,
        duplicate: true,
        actionTaken: 'SKIPPED_DUPLICATE',
        organizationId: existingEvent.organizationId,
      };
    }

    let organizationId: string | null = null;
    let actionTaken = 'NONE';

    try {
      switch (event.type) {
        // A. Checkout completed (initial payment & subscription activation)
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          organizationId = session.client_reference_id || session.metadata?.organizationId || null;
          const planId = session.metadata?.planId || 'pro';
          const billingCycle = session.metadata?.billingCycle || 'monthly';
          const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
          const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;

          if (organizationId) {
            await this.activateSubscription({
              organizationId,
              planId,
              billingCycle,
              stripeCustomerId,
              stripeSubscriptionId,
              eventTimestamp: event.created,
            });
            actionTaken = 'SUBSCRIPTION_ACTIVATED';
          }
          break;
        }

        // B. Invoice Payment Succeeded (Renewal or initial payment)
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
          const custId = typeof invoice.customer === 'string' ? invoice.customer : null;

          // Find org by subscription or customer
          organizationId = await this.resolveOrgFromStripeIds(subId, custId);

          if (organizationId) {
            // Update subscription period
            const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : new Date();
            const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(Date.now() + 30 * 86400000);

            await db
              .update(subscriptions)
              .set({
                status: 'active',
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.organizationId, organizationId));

            // Record invoice in invoices table
            await this.recordInvoiceRecord(organizationId, invoice, 'paid');
            actionTaken = 'INVOICE_PAID_AND_RENEWED';
          }
          break;
        }

        // C. Invoice Payment Failed (Past Due)
        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
          const custId = typeof invoice.customer === 'string' ? invoice.customer : null;

          organizationId = await this.resolveOrgFromStripeIds(subId, custId);

          if (organizationId) {
            await db
              .update(subscriptions)
              .set({
                status: 'past_due',
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.organizationId, organizationId));

            await this.recordInvoiceRecord(organizationId, invoice, 'open');
            actionTaken = 'SUBSCRIPTION_MARKED_PAST_DUE';
          }
          break;
        }

        // D. Subscription Updated (Plan change, cancellation at period end)
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const custId = typeof sub.customer === 'string' ? sub.customer : null;
          organizationId = sub.metadata?.organizationId || (await this.resolveOrgFromStripeIds(sub.id, custId));

          if (organizationId) {
            const planId = sub.metadata?.planId || 'pro';
            const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status;
            const cancelAtPeriodEnd = sub.cancel_at_period_end ? 'true' : 'false';

            // Out-of-Order Safety Check
            const [currentSub] = await db
              .select()
              .from(subscriptions)
              .where(eq(subscriptions.organizationId, organizationId))
              .limit(1);

            const lastTimestamp = (currentSub?.metadata as any)?.lastEventTimestamp || 0;
            if (event.created < lastTimestamp) {
              console.warn(`[StripeWebhook] Skipping out-of-order event ${event.id} (Created: ${event.created} < Current: ${lastTimestamp})`);
              actionTaken = 'SKIPPED_OUT_OF_ORDER';
              break;
            }

            const updatedMetadata = {
              ...(currentSub?.metadata as any),
              lastEventTimestamp: event.created,
              stripePriceId: sub.items.data[0]?.price?.id,
            };

            await db
              .update(subscriptions)
              .set({
                planId,
                status,
                cancelAtPeriodEnd,
                metadata: updatedMetadata,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.organizationId, organizationId));

            await this.syncUsageQuotas(organizationId, planId);
            actionTaken = 'SUBSCRIPTION_UPDATED';
          }
          break;
        }

        // E. Subscription Canceled / Deleted
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const custId = typeof sub.customer === 'string' ? sub.customer : null;
          organizationId = sub.metadata?.organizationId || (await this.resolveOrgFromStripeIds(sub.id, custId));

          if (organizationId) {
            const fallbackPlanId = await EntitlementService.resolveDefaultFallbackPlan();
            await db
              .update(subscriptions)
              .set({
                status: 'canceled',
                planId: fallbackPlanId,
                cancelAtPeriodEnd: 'false',
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.organizationId, organizationId));

            // Downgrade organization planTier and quotas dynamically to fallback plan
            await db
              .update(organizations)
              .set({ planTier: fallbackPlanId, updatedAt: new Date() })
              .where(eq(organizations.id, organizationId));

            await this.syncUsageQuotas(organizationId, fallbackPlanId);
            actionTaken = 'SUBSCRIPTION_CANCELED';
          }
          break;
        }

        default:
          actionTaken = `UNHANDLED_EVENT_${event.type}`;
          break;
      }

      // Record successful processing in billingWebhookEvents for deduplication
      await db
        .insert(billingWebhookEvents)
        .values({
          eventId: event.id,
          eventType: event.type,
          organizationId,
          status: 'PROCESSED',
          payload: { eventType: event.type, actionTaken },
        })
        .onConflictDoUpdate({
          target: [billingWebhookEvents.eventId],
          set: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });

      return {
        processed: true,
        duplicate: false,
        actionTaken,
        organizationId,
      };
    } catch (err: any) {
      console.error(`[StripeWebhook] Error processing event ${event.id}:`, err);

      await db
        .insert(billingWebhookEvents)
        .values({
          eventId: event.id,
          eventType: event.type,
          organizationId,
          status: 'FAILED',
          payload: { error: err.message },
        })
        .onConflictDoUpdate({
          target: [billingWebhookEvents.eventId],
          set: {
            status: 'FAILED',
            processedAt: new Date(),
          },
        });

      throw err;
    }
  }

  /**
   * Helper: Activates subscription & syncs quota
   */
  public static async activateSubscription(params: {
    organizationId: string;
    planId: string;
    billingCycle: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    eventTimestamp?: number;
  }) {
    const { organizationId, planId, billingCycle, stripeCustomerId, stripeSubscriptionId, eventTimestamp } = params;

    const nextPeriod = new Date();
    if (billingCycle === 'annual') {
      nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);
    } else {
      nextPeriod.setMonth(nextPeriod.getMonth() + 1);
    }

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    const metadata = {
      ...(existingSub?.metadata as any),
      lastEventTimestamp: eventTimestamp || Math.floor(Date.now() / 1000),
    };

    if (existingSub) {
      await db
        .update(subscriptions)
        .set({
          planId,
          status: 'active',
          billingCycle,
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextPeriod,
          cancelAtPeriodEnd: 'false',
          stripeCustomerId: stripeCustomerId || existingSub.stripeCustomerId,
          stripeSubscriptionId: stripeSubscriptionId || existingSub.stripeSubscriptionId,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingSub.id));
    } else {
      await db.insert(subscriptions).values({
        organizationId,
        planId,
        status: 'active',
        billingCycle,
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextPeriod,
        cancelAtPeriodEnd: 'false',
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: stripeSubscriptionId || null,
        metadata,
      });
    }

    // Sync organization planTier
    await db
      .update(organizations)
      .set({ planTier: planId, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId));

    // Sync quotas
    await this.syncUsageQuotas(organizationId, planId);
  }

  /**
   * Helper: Synchronizes tenantUsageQuotas for active period
   */
  public static async syncUsageQuotas(organizationId: string, planId: string) {
    const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    // Fetch dynamic entitlements from database
    const entitlements = await db
      .select()
      .from(planServiceEntitlements)
      .where(eq(planServiceEntitlements.planId, planId));

    const entMap = new Map<string, typeof entitlements[0]>();
    for (const ent of entitlements) {
      entMap.set(ent.serviceCode, ent);
    }

    const prodEnt = entMap.get('product_scraping');
    const storeEnt = entMap.get('store_integration');
    const aiEnt = entMap.get('ai_intelligence');

    // Dynamic resolution from database entitlements with zero hardcoded defaults
    const productsLimit = prodEnt
      ? (prodEnt.isUnlimited === 'true' ? 9999999 : prodEnt.usageLimit)
      : (SAAS_PLANS[planId]?.productLimit ?? 0);
    const storesLimit = storeEnt
      ? (storeEnt.isUnlimited === 'true' ? 999 : storeEnt.usageLimit)
      : (SAAS_PLANS[planId]?.storeLimit ?? 0);
    const aiTokensLimit = aiEnt
      ? (aiEnt.isUnlimited === 'true' ? 999999999 : aiEnt.usageLimit)
      : (SAAS_PLANS[planId]?.aiTokenLimit ?? 0);

    const [existingQuota] = await db
      .select()
      .from(tenantUsageQuotas)
      .where(
        and(
          eq(tenantUsageQuotas.organizationId, organizationId),
          eq(tenantUsageQuotas.currentPeriod, currentPeriod)
        )
      )
      .limit(1);

    if (existingQuota) {
      await db
        .update(tenantUsageQuotas)
        .set({
          productsLimit,
          storesLimit,
          aiTokensLimit,
          updatedAt: new Date(),
        })
        .where(eq(tenantUsageQuotas.id, existingQuota.id));
    } else {
      await db.insert(tenantUsageQuotas).values({
        organizationId,
        currentPeriod,
        productsUsed: 0,
        productsLimit,
        storesConnected: 0,
        storesLimit,
        aiTokensUsed: 0,
        aiTokensLimit,
        scrapingJobsRun: 0,
      });
    }
  }

  /**
   * Helper: Inserts invoice record into invoices table
   */
  private static async recordInvoiceRecord(
    organizationId: string,
    invoice: Stripe.Invoice,
    status: 'paid' | 'open' | 'void'
  ) {
    const invNum = invoice.number || `INV-${invoice.id.slice(-8)}`;
    const amountDue = (invoice.amount_due ? invoice.amount_due / 100 : 0).toFixed(2);
    const amountPaid = (invoice.amount_paid ? invoice.amount_paid / 100 : 0).toFixed(2);
    const hostedUrl = invoice.hosted_invoice_url || null;
    const pdfUrl = invoice.invoice_pdf || null;
    const paidAt = invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : new Date();

    await db
      .insert(invoices)
      .values({
        organizationId,
        invoiceNumber: invNum,
        amountDueUsd: amountDue,
        amountPaidUsd: amountPaid,
        currency: (invoice.currency || 'usd').toUpperCase(),
        status,
        paidAt: status === 'paid' ? paidAt : null,
        hostedInvoiceUrl: hostedUrl,
        invoicePdfUrl: pdfUrl,
      })
      .onConflictDoUpdate({
        target: [invoices.invoiceNumber],
        set: {
          amountPaidUsd: amountPaid,
          status,
          paidAt: status === 'paid' ? paidAt : null,
          hostedInvoiceUrl: hostedUrl,
          invoicePdfUrl: pdfUrl,
        },
      });
  }

  /**
   * Helper: Resolves organizationId from Stripe subscription or customer ID
   */
  private static async resolveOrgFromStripeIds(
    subscriptionId: string | null,
    customerId: string | null
  ): Promise<string | null> {
    if (subscriptionId) {
      const [sub] = await db
        .select({ organizationId: subscriptions.organizationId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1);
      if (sub?.organizationId) return sub.organizationId;
    }

    if (customerId) {
      const [sub] = await db
        .select({ organizationId: subscriptions.organizationId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId))
        .limit(1);
      if (sub?.organizationId) return sub.organizationId;
    }

    return null;
  }
}
