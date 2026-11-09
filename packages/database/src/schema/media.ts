import { pgTable, uuid, varchar, text, integer, timestamp, boolean, bigint, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Global Media Assets - Content-Addressable Image Storage & Deduplication Registry
 *
 * Ensures that if multiple clients scrape the exact same product image,
 * the binary file is downloaded ONCE. Subsequent references are resolved instantly.
 */
export const globalMediaAssets = pgTable('global_media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  canonicalUrl: text('canonical_url').notNull(),
  originalUrl: text('original_url').notNull(),
  storageUri: text('storage_uri').notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull().default('image/jpeg'),
  byteSize: integer('byte_size').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  referenceCount: integer('reference_count').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'orphan_candidate'
  orphanMarkedAt: timestamp('orphan_marked_at', { withTimezone: true }),
  lastReferencedAt: timestamp('last_referenced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_gma_content_hash').on(table.contentHash),
  index('idx_gma_canonical_url').on(table.canonicalUrl),
  index('idx_gma_status').on(table.status),
]);

/**
 * System Platform Storage & Retention Settings
 */
export const systemStorageSettings = pgTable('system_storage_settings', {
  id: varchar('id', { length: 50 }).primaryKey().default('default'),
  tempDataRetentionHours: integer('temp_data_retention_hours').notNull().default(24),
  failedJobRetentionDays: integer('failed_job_retention_days').notNull().default(14),
  completedJobRetentionHours: integer('completed_job_retention_hours').notNull().default(24),
  aiHistoryRetentionDays: integer('ai_history_retention_days').notNull().default(30),
  orphanAssetGracePeriodDays: integer('orphan_asset_grace_period_days').notNull().default(7),
  maxProductVersions: integer('max_product_versions').notNull().default(10),
  autoGcEnabled: boolean('auto_gc_enabled').notNull().default(true),
  lastGcRunAt: timestamp('last_gc_run_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Garbage Collection & Maintenance Logs
 */
export const garbageCollectionLogs = pgTable('garbage_collection_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runType: varchar('run_type', { length: 20 }).notNull().default('automatic'), // 'automatic' | 'manual'
  bytesReclaimed: bigint('bytes_reclaimed', { mode: 'number' }).notNull().default(0),
  filesDeleted: integer('files_deleted').notNull().default(0),
  dbRecordsPruned: integer('db_records_pruned').notNull().default(0),
  details: jsonb('details').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
