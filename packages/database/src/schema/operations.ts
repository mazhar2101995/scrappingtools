import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, bigserial, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './tenants';
import { brands, sourceWebsites, sourceProductListings, tenantBrandProfiles } from './sources';
import { globalProducts } from './products';
import { connectedStores } from './stores';

export const scrapingJobs = pgTable('scraping_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  brandProfileId: uuid('brand_profile_id').references(() => tenantBrandProfiles.id, { onDelete: 'set null' }),
  sourceWebsiteId: uuid('source_website_id').references(() => sourceWebsites.id, { onDelete: 'cascade' }),
  targetUrl: text('target_url').notNull(),
  jobType: varchar('job_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  itemsExtracted: integer('items_extracted').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_jobs_status').on(table.status, table.createdAt),
]);

export const scrapingJobLogs = pgTable('scraping_job_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  jobId: uuid('job_id').notNull().references(() => scrapingJobs.id, { onDelete: 'cascade' }),
  logLevel: varchar('log_level', { length: 20 }).notNull().default('INFO'),
  message: text('message').notNull(),
  context: jsonb('context').default(sql`'{}'::jsonb`),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_job_logs').on(table.jobId, table.loggedAt),
]);

export const aiProcessingHistory = pgTable('ai_processing_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  taskType: varchar('task_type', { length: 50 }).notNull(),
  modelName: varchar('model_name', { length: 100 }).notNull(),
  inputPayload: jsonb('input_payload').notNull(),
  outputResult: jsonb('output_result').notNull(),
  tokenUsage: integer('token_usage'),
  latencyMs: integer('latency_ms'),
  executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ai_history').on(table.globalProductId, table.taskType),
]);

export const dataValidationResults = pgTable('data_validation_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceProductListingId: uuid('source_product_listing_id').notNull().references(() => sourceProductListings.id, { onDelete: 'cascade' }),
  ruleName: varchar('rule_name', { length: 100 }).notNull(),
  isValid: boolean('is_valid').notNull(),
  validationMessage: text('validation_message'),
  validatedAt: timestamp('validated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_dvr_listing').on(table.sourceProductListingId),
]);

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  targetUrl: text('target_url').notNull(),
  secret: varchar('secret', { length: 255 }).notNull(),
  events: jsonb('events').notNull().default(sql`'["*"]'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_webhook_subs_org').on(table.organizationId),
]);

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => webhookSubscriptions.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
}, (table) => [
  index('idx_webhook_events_org').on(table.organizationId, table.createdAt),
  index('idx_webhook_events_status').on(table.status),
]);

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  oldState: jsonb('old_state'),
  newState: jsonb('new_state'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_audit_logs_org').on(table.organizationId, table.createdAt),
]);

export const communityFeedback = pgTable('community_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userEmail: varchar('user_email', { length: 255 }),
  type: varchar('type', { length: 50 }).notNull().default('bug_report'), // 'bug_report', 'feature_feedback', 'general_feedback'
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  pageUrl: text('page_url'),
  errorReferenceId: varchar('error_reference_id', { length: 100 }),
  browserInfo: text('browser_info'),
  status: varchar('status', { length: 50 }).notNull().default('new'), // 'new', 'under_review', 'investigating', 'resolved'
  resolutionNotes: text('resolution_notes'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_feedback_org').on(table.organizationId, table.createdAt),
  index('idx_feedback_status').on(table.status),
]);

export const automatedSyncSchedules = pgTable('automated_sync_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  scheduleType: varchar('schedule_type', { length: 50 }).notNull().default('STORE_PUSH'), // 'STORE_PUSH', 'SCRAPE_REFRESH', 'BIDIRECTIONAL'
  frequency: varchar('frequency', { length: 50 }).notNull().default('DAILY'), // 'HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY'
  storeId: uuid('store_id').references(() => connectedStores.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  targetLanguage: varchar('target_language', { length: 10 }).default('en'),
  autoTranslate: boolean('auto_translate').notNull().default(true),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // 'ACTIVE', 'PAUSED'
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastRunStatus: varchar('last_run_status', { length: 50 }), // 'SUCCESS', 'FAILED', 'PARTIAL'
  lastRunSummary: text('last_run_summary'),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sync_schedules_org').on(table.organizationId),
  index('idx_sync_schedules_status').on(table.status, table.nextRunAt),
]);



