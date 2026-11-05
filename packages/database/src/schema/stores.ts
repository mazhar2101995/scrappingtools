import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { organizations, users } from './tenants';
import { globalProducts } from './products';

// 1. Connected E-Commerce Stores (Multi-Tenant)
export const connectedStores = pgTable('connected_stores', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  platformType: varchar('platform_type', { length: 50 }).notNull(), // 'opencart', 'shopify', 'woocommerce'
  storeName: varchar('store_name', { length: 255 }).notNull(),
  storeUrl: text('store_url').notNull(),
  apiEndpoint: text('api_endpoint'),
  encryptedCredentials: text('encrypted_credentials').notNull(), // AES-256-GCM encrypted JSON payload
  webhookSecret: varchar('webhook_secret', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('connected'), // 'connected', 'error', 'paused', 'syncing'
  syncSchedule: varchar('sync_schedule', { length: 50 }).default('HOURLY'), // 'MANUAL', 'HOURLY', 'DAILY', 'REALTIME_WEBHOOK'
  capabilities: jsonb('capabilities').notNull(), // Array of declared capability flags
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_cs_org').on(table.organizationId, table.status),
  uniqueIndex('idx_cs_store_url_org').on(table.organizationId, table.storeUrl),
]);

// 2. Store Product Mappings
export const storeProductMappings = pgTable('store_product_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectedStoreId: uuid('connected_store_id').notNull().references(() => connectedStores.id, { onDelete: 'cascade' }),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  externalProductId: varchar('external_product_id', { length: 255 }).notNull(),
  externalSku: varchar('external_sku', { length: 255 }),
  syncStatus: varchar('sync_status', { length: 50 }).notNull().default('synced'), // 'synced', 'pending', 'conflict', 'failed'
  lastPushedAt: timestamp('last_pushed_at', { withTimezone: true }),
  lastPulledAt: timestamp('last_pulled_at', { withTimezone: true }),
  storeSpecificMetadata: jsonb('store_specific_metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_spm_store_ext_id').on(table.connectedStoreId, table.externalProductId),
  uniqueIndex('idx_spm_store_product').on(table.connectedStoreId, table.globalProductId),
  index('idx_spm_gp').on(table.globalProductId),
  index('idx_spm_status').on(table.connectedStoreId, table.syncStatus),
]);

// 3. Store Synchronization History
export const storeSyncHistory = pgTable('store_sync_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectedStoreId: uuid('connected_store_id').notNull().references(() => connectedStores.id, { onDelete: 'cascade' }),
  jobId: varchar('job_id', { length: 100 }).notNull(),
  syncType: varchar('sync_type', { length: 50 }).notNull(), // 'full', 'incremental', 'webhook', 'single_product'
  direction: varchar('direction', { length: 20 }).notNull(), // 'PULL', 'PUSH'
  itemsProcessed: integer('items_processed').notNull().default(0),
  itemsSucceeded: integer('items_succeeded').notNull().default(0),
  itemsFailed: integer('items_failed').notNull().default(0),
  status: varchar('status', { length: 50 }).notNull().default('processing'), // 'completed', 'failed', 'partial_error'
  errorDetails: text('error_details'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ssh_store').on(table.connectedStoreId, table.createdAt),
]);

// 4. Synchronization Field Conflict Logs
export const storeConflictLogs = pgTable('store_conflict_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectedStoreId: uuid('connected_store_id').notNull().references(() => connectedStores.id, { onDelete: 'cascade' }),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  externalProductId: varchar('external_product_id', { length: 255 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  localValue: text('local_value').notNull(),
  remoteValue: text('remote_value').notNull(),
  resolution: varchar('resolution', { length: 50 }).notNull().default('pending'), // 'pending', 'saas_overrode', 'store_retained', 'manual_resolved'
  resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_scl_store_pending').on(table.connectedStoreId, table.resolution),
]);

