import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './tenants';
import { globalProducts } from './products';

export const customerProductMappings = pgTable('customer_product_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'restrict' }),
  customerInternalSku: varchar('customer_internal_sku', { length: 255 }),
  isFavorite: boolean('is_favorite').notNull().default(false),
  syncStatus: varchar('sync_status', { length: 50 }).notNull().default('active'),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_cpm_unique_tenant_product').on(table.organizationId, table.globalProductId),
  index('idx_cpm_sku').on(table.organizationId, table.customerInternalSku),
]);

export const customerProductOverrides = pgTable('customer_product_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  customTitle: varchar('custom_title', { length: 500 }),
  customDescription: text('custom_description'),
  customCategory: varchar('custom_category', { length: 255 }),
  customTags: jsonb('custom_tags').default(sql`'[]'::jsonb`),
  customAttributes: jsonb('custom_attributes').default(sql`'{}'::jsonb`),
  internalNotes: text('internal_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_cpo_unique_tenant_product').on(table.organizationId, table.globalProductId),
  index('idx_cpo_tenant').on(table.organizationId, table.globalProductId),
]);

