import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, bigserial, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './tenants';
import { brands, sourceWebsites, sourceProductListings, tenantBrandProfiles } from './sources';
import { globalProducts } from './products';

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

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

