import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { brands } from './sources';
import { sourceWebsites } from './sources';

export const globalProducts = pgTable('global_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' }),
  canonicalTitle: varchar('canonical_title', { length: 500 }).notNull(),
  modelNumber: varchar('model_number', { length: 255 }),
  normalizedModel: varchar('normalized_model', { length: 255 }),
  categoryPath: varchar('category_path', { length: 500 }),
  standardizedDescription: text('standardized_description'),
  primaryImageUrl: text('primary_image_url'),
  confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }).notNull().default('1.00'),
  verificationStatus: varchar('verification_status', { length: 50 }).notNull().default('unverified'),
  sourcesCount: integer('sources_count').notNull().default(1),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_gp_brand_id').on(table.brandId),
  index('idx_gp_normalized_model').on(table.brandId, table.normalizedModel),
  index('idx_gp_verification').on(table.verificationStatus),
]);

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  variantName: varchar('variant_name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 255 }),
  color: varchar('color', { length: 100 }),
  size: varchar('size', { length: 100 }),
  weightGrams: numeric('weight_grams', { precision: 10, scale: 2 }),
  dimensionsCm: jsonb('dimensions_cm'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_pv_global_product').on(table.globalProductId),
]);

export const productIdentifiers = pgTable('product_identifiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  idType: varchar('id_type', { length: 30 }).notNull(), // 'EAN_13', 'GTIN_14', 'UPC_A', 'MPN', 'ASIN', 'MANUFACTURER_SKU'
  idValue: varchar('id_value', { length: 100 }).notNull(),
  normalizedValue: varchar('normalized_value', { length: 100 }).notNull(),
  sourceWebsiteId: uuid('source_website_id').references(() => sourceWebsites.id, { onDelete: 'set null' }),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('1.00'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_pi_unique_id').on(table.idType, table.normalizedValue),
  index('idx_pi_lookup').on(table.idType, table.normalizedValue),
  index('idx_pi_gp').on(table.globalProductId),
]);

export const productAttributes = pgTable('product_attributes', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  attributeKey: varchar('attribute_key', { length: 100 }).notNull(),
  rawValue: text('raw_value').notNull(),
  normalizedValue: text('normalized_value').notNull(),
  unit: varchar('unit', { length: 30 }),
  dataType: varchar('data_type', { length: 30 }).notNull().default('string'),
  sourceWebsiteId: uuid('source_website_id').references(() => sourceWebsites.id, { onDelete: 'set null' }),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('1.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_pa_unique_attr').on(table.globalProductId, table.productVariantId, table.attributeKey),
  index('idx_pa_key_val').on(table.attributeKey, table.normalizedValue),
]);

export const productImages = pgTable('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  originUrl: text('origin_url').notNull(),
  storageUri: text('storage_uri').notNull(),
  imageHash: varchar('image_hash', { length: 64 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  width: integer('width'),
  height: integer('height'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_pimg_gp').on(table.globalProductId),
  index('idx_pimg_hash').on(table.imageHash),
]);

// Phase 9C: Master Product + Reusable Product Language Versions
export const productLanguageVersions = pgTable('product_language_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  globalProductId: uuid('global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  languageCode: varchar('language_code', { length: 20 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  features: jsonb('features').default([]),
  specifications: jsonb('specifications').default({}),
  seoTitle: varchar('seo_title', { length: 500 }),
  seoDescription: text('seo_description'),
  status: varchar('status', { length: 50 }).notNull().default('current'), // 'current' | 'needs_review' | 'outdated' | 'processing' | 'failed'
  version: integer('version').notNull().default(1),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_plv_product_lang').on(table.globalProductId, table.languageCode),
  index('idx_plv_lang').on(table.languageCode),
  index('idx_plv_status').on(table.status),
]);


