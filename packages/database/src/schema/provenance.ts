import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { globalProducts } from './products';
import { sourceWebsites, sourceProductListings } from './sources';
import { users } from './tenants';

export const fieldProvenance = pgTable('field_provenance', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  currentValue: text('current_value').notNull(),
  sourceWebsiteId: uuid('source_website_id').notNull().references(() => sourceWebsites.id, { onDelete: 'cascade' }),
  sourceProductListingId: uuid('source_product_listing_id').notNull().references(() => sourceProductListings.id, { onDelete: 'cascade' }),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('1.00'),
  lastCorroboratedAt: timestamp('last_corroborated_at', { withTimezone: true }).notNull().defaultNow(),
  lastChangedAt: timestamp('last_changed_at', { withTimezone: true }).notNull().defaultNow(),
  changeCount: integer('change_count').notNull().default(1),
  isStale: boolean('is_stale').notNull().default(false),
}, (table) => [
  uniqueIndex('idx_fp_unique_field').on(table.globalProductId, table.fieldName),
  index('idx_fp_freshness').on(table.lastCorroboratedAt, table.isStale),
]);

export const productVersions = pgTable('product_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  changedBySourceId: uuid('changed_by_source_id').references(() => sourceWebsites.id, { onDelete: 'set null' }),
  diffPayload: jsonb('diff_payload').notNull(),
  fullSnapshot: jsonb('full_snapshot').notNull(),
  reason: varchar('reason', { length: 255 }).notNull().default('automated_corroboration'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_pv_unique_version').on(table.globalProductId, table.versionNumber),
  index('idx_pv_history').on(table.globalProductId, table.versionNumber),
]);

export const productSourceHistory = pgTable('product_source_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  sourceProductListingId: uuid('source_product_listing_id').notNull().references(() => sourceProductListings.id, { onDelete: 'cascade' }),
  observedPrice: numeric('observed_price', { precision: 14, scale: 4 }),
  observedCurrency: varchar('observed_currency', { length: 3 }),
  availabilityStatus: varchar('availability_status', { length: 50 }),
  extractedAt: timestamp('extracted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_psh_gp').on(table.globalProductId, table.extractedAt),
]);

export const identityReviewQueue = pgTable('identity_review_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceProductListingId: uuid('source_product_listing_id').notNull().references(() => sourceProductListings.id, { onDelete: 'cascade' }),
  suggestedGlobalProductId: uuid('suggested_global_product_id').references(() => globalProducts.id, { onDelete: 'set null' }),
  matchConfidence: numeric('match_confidence', { precision: 3, scale: 2 }).notNull(),
  matchReasons: jsonb('match_reasons').notNull(),
  resolutionStatus: varchar('resolution_status', { length: 50 }).notNull().default('pending'),
  resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_irq_status').on(table.resolutionStatus),
]);

