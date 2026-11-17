import { pgTable, uuid, varchar, text, integer, timestamp, boolean, bigint, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './tenants';

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

/**
 * Product Image Transformations (Background Removal & Watermark Cleaning Studio)
 */
export const productImageTransformations = pgTable('product_image_transformations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  globalProductId: uuid('global_product_id').notNull(),
  originalUrl: text('original_url').notNull(),
  cleanedUrl: text('cleaned_url').notNull(),
  transformationType: varchar('transformation_type', { length: 50 }).notNull(),
  parameters: jsonb('parameters').notNull().default(sql`'{}'::jsonb`),
  status: varchar('status', { length: 50 }).notNull().default('COMPLETED'),
  errorMessage: text('error_message'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull().default(0),
  outputFormat: varchar('output_format', { length: 20 }).notNull().default('webp'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_img_trans_org_prod').on(table.organizationId, table.globalProductId),
]);

/**
 * Tenant Media Assets - Authoritative Per-Tenant Storage Accounting & Reference Ledger
 *
 * Tracks every billable media asset (original catalog image, studio transformation,
 * or custom upload) associated with an organization. Enforces storage quotas and supports
 * safe garbage collection with retention grace periods without deleting shared global assets.
 */
export const tenantMediaAssets = pgTable('tenant_media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assetType: varchar('asset_type', { length: 50 }).notNull().default('catalog_image'), // 'catalog_image' | 'studio_transformation' | 'custom_upload'
  globalMediaAssetId: uuid('global_media_asset_id').references(() => globalMediaAssets.id, { onDelete: 'set null' }),
  transformationId: uuid('transformation_id').references(() => productImageTransformations.id, { onDelete: 'set null' }),
  storagePath: text('storage_path').notNull(),
  mimeType: varchar('mime_type', { length: 64 }).notNull().default('image/webp'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull().default(0),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('active'), // 'active' | 'soft_deleted' | 'purged'
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_tma_org_hash_type').on(table.organizationId, table.contentHash, table.assetType),
  index('idx_tma_org_status').on(table.organizationId, table.status),
  index('idx_tma_gma').on(table.globalMediaAssetId),
  index('idx_tma_deleted').on(table.deletedAt),
]);
