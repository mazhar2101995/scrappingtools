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

