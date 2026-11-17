import { pgTable, uuid, varchar, integer, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './tenants';

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  planId: varchar('plan_id', { length: 50 }).notNull().default('starter'), // 'starter', 'pro', 'enterprise'
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'past_due', 'canceled', 'trialing'
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'), // 'monthly', 'annual'
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: varchar('cancel_at_period_end', { length: 10 }).default('false'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_subscriptions_org').on(table.organizationId),
  index('idx_subscriptions_status').on(table.status),
]);

export const tenantUsageQuotas = pgTable('tenant_usage_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  currentPeriod: varchar('current_period', { length: 7 }).notNull(), // '2026-11'
  productsUsed: integer('products_used').notNull().default(0),
  productsLimit: integer('products_limit').notNull().default(500),
  aiTokensUsed: integer('ai_tokens_used').notNull().default(0),
  aiTokensLimit: integer('ai_tokens_limit').notNull().default(50000),
  storesConnected: integer('stores_connected').notNull().default(0),
  storesLimit: integer('stores_limit').notNull().default(1),
  scrapingJobsRun: integer('scraping_jobs_run').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_usage_quotas_org_period').on(table.organizationId, table.currentPeriod),
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  amountDueUsd: numeric('amount_due_usd', { precision: 10, scale: 2 }).notNull().default('0.00'),
  amountPaidUsd: numeric('amount_paid_usd', { precision: 10, scale: 2 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  status: varchar('status', { length: 50 }).notNull().default('paid'), // 'paid', 'open', 'void', 'uncollectible'
  paidAt: timestamp('paid_at', { withTimezone: true }),
  hostedInvoiceUrl: varchar('hosted_invoice_url', { length: 500 }),
  invoicePdfUrl: varchar('invoice_pdf_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_invoices_org').on(table.organizationId),
]);

export const billingWebhookEvents = pgTable('billing_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).notNull().default('PROCESSED'), // 'PROCESSED', 'FAILED'
  payload: jsonb('payload'),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_billing_events_id').on(table.eventId),
  index('idx_billing_events_org').on(table.organizationId),
]);

/**
 * 1. Service Catalogue: Central registry of platform capabilities and metered features
 */
export const services = pgTable('services', {
  id: varchar('id', { length: 100 }).primaryKey(), // e.g. 'product_scraping'
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: varchar('description', { length: 500 }),
  category: varchar('category', { length: 50 }).notNull().default('general'), // 'scraping', 'catalog', 'media', 'ai', 'stores', 'automation'
  unit: varchar('unit', { length: 50 }).notNull().default('units'), // 'URLs', 'Brands', 'Images', 'Tokens', 'Stores', 'Schedules'
  metricType: varchar('metric_type', { length: 50 }).notNull().default('count'), // 'count', 'tokens', 'storage_mb'
  supportsUnlimited: varchar('supports_unlimited', { length: 10 }).notNull().default('true'),
  defaultResetPeriod: varchar('default_reset_period', { length: 50 }).notNull().default('monthly'), // 'never', 'monthly', 'yearly', 'daily'
  isGloballyActive: varchar('is_globally_active', { length: 10 }).notNull().default('true'), // 'true' | 'false'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_services_code').on(table.code),
  index('idx_services_active').on(table.isGloballyActive),
]);

/**
 * 2. Subscription Plans: Dynamic, Admin-defined subscription tiers
 */
export const subscriptionPlans = pgTable('subscription_plans', {
  id: varchar('id', { length: 100 }).primaryKey(), // e.g. 'free', 'starter', 'pro', 'enterprise', or custom id
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: varchar('description', { length: 500 }),
  planType: varchar('plan_type', { length: 50 }).notNull().default('paid'), // 'free' | 'paid'
  priceMonthly: numeric('price_monthly', { precision: 10, scale: 2 }).notNull().default('0.00'),
  priceAnnual: numeric('price_annual', { precision: 10, scale: 2 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'),
  isActive: varchar('is_active', { length: 10 }).notNull().default('true'), // 'true' | 'false'
  isPublic: varchar('is_public', { length: 10 }).notNull().default('true'), // 'true' | 'false'
  sortOrder: integer('sort_order').notNull().default(0),
  stripeMonthlyPriceId: varchar('stripe_monthly_price_id', { length: 255 }),
  stripeAnnualPriceId: varchar('stripe_annual_price_id', { length: 255 }),
  features: jsonb('features').default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_plans_code').on(table.code),
  index('idx_plans_active').on(table.isActive),
]);

/**
 * 3. Plan Service Entitlements: Per-plan service availability, numeric limits, unlimited options, and reset periods
 */
export const planServiceEntitlements = pgTable('plan_service_entitlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: varchar('plan_id', { length: 100 }).notNull().references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
  serviceCode: varchar('service_code', { length: 100 }).notNull().references(() => services.code, { onDelete: 'cascade' }),
  isEnabled: varchar('is_enabled', { length: 10 }).notNull().default('true'), // 'true' | 'false'
  isUnlimited: varchar('is_unlimited', { length: 10 }).notNull().default('false'), // 'true' | 'false'
  usageLimit: integer('usage_limit').notNull().default(0),
  resetPeriod: varchar('reset_period', { length: 50 }).notNull().default('monthly'), // 'never', 'monthly', 'yearly', 'daily'
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_plan_entitlements_plan').on(table.planId),
  index('idx_plan_entitlements_service').on(table.serviceCode),
]);

/**
 * 4. Service Usage Records: Organization-level, service-level dynamic usage tracking across configurable reset periods
 */
export const serviceUsageRecords = pgTable('service_usage_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  serviceCode: varchar('service_code', { length: 100 }).notNull().references(() => services.code, { onDelete: 'cascade' }),
  periodKey: varchar('period_key', { length: 50 }).notNull(), // e.g. '2026-11' for monthly, '2026' for yearly, 'lifetime' for never
  unitsUsed: integer('units_used').notNull().default(0),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_usage_records_org_svc').on(table.organizationId, table.serviceCode),
  index('idx_usage_records_period').on(table.periodKey),
]);

/**
 * 5. Payment Gateway Configurations: Secure gateway credentials, test/live modes, and enabled payment methods
 */
export const paymentGatewayConfigs = pgTable('payment_gateway_configs', {
  id: varchar('id', { length: 50 }).primaryKey(), // 'stripe', 'paypal'
  name: varchar('name', { length: 100 }).notNull(),
  isEnabled: varchar('is_enabled', { length: 10 }).notNull().default('true'),
  isDefault: varchar('is_default', { length: 10 }).notNull().default('true'),
  mode: varchar('mode', { length: 20 }).notNull().default('test'), // 'test' | 'live'
  supportedPaymentMethods: jsonb('supported_payment_methods').default('["card"]'),
  supportedCurrencies: jsonb('supported_currencies').default('["USD"]'),
  credentialsEncrypted: jsonb('credentials_encrypted').default('{}'), // never sent to client dashboard
  webhookEndpointUrl: varchar('webhook_endpoint_url', { length: 500 }),
  status: varchar('status', { length: 50 }).notNull().default('connected'), // 'connected', 'disabled', 'error'
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 6. Subscription Audit Logs: Immutable log of administrative plan assignments, limit changes, and billing mutations
 */
export const subscriptionAuditLogs = pgTable('subscription_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id'),
  actorEmail: varchar('actor_email', { length: 255 }),
  action: varchar('action', { length: 100 }).notNull(), // 'PLAN_ASSIGNED', 'LIMIT_MODIFIED', 'SERVICE_TOGGLED', etc.
  previousPlanId: varchar('previous_plan_id', { length: 100 }),
  newPlanId: varchar('new_plan_id', { length: 100 }),
  reason: varchar('reason', { length: 500 }),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sub_audit_org').on(table.organizationId),
  index('idx_sub_audit_action').on(table.action),
]);

