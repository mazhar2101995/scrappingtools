import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 255 }).notNull().unique(),
  officialWebsite: text('official_website'),
  logoUrl: text('logo_url'),
  countryOfOrigin: varchar('country_of_origin', { length: 3 }),
  isVerified: boolean('is_verified').notNull().default(false),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_brands_normalized').on(table.normalizedName),
]);

export const sourceWebsites = pgTable('source_websites', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull().unique(),
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'official_brand', 'authorized_distributor', 'marketplace', 'supplier'
  trustScore: numeric('trust_score', { precision: 3, scale: 2 }).notNull().default('0.85'),
  country: varchar('country', { length: 3 }).default('USA'),
  rateLimitPerMinute: integer('rate_limit_per_minute').default(60),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_source_websites_domain').on(table.domain),
]);

export const brandScrapingProfiles = pgTable('brand_scraping_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  sourceWebsiteId: uuid('source_website_id').notNull().references(() => sourceWebsites.id, { onDelete: 'cascade' }),
  profileVersion: integer('profile_version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  selectorConfig: jsonb('selector_config').notNull(),
  paginationConfig: jsonb('pagination_config').default(sql`'{}'::jsonb`),
  antiBotStrategy: varchar('anti_bot_strategy', { length: 50 }).default('playwright_stealth'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_bsp_version_unique').on(table.brandId, table.sourceWebsiteId, table.profileVersion),
]);

export const sourceProductListings = pgTable('source_product_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceWebsiteId: uuid('source_website_id').notNull().references(() => sourceWebsites.id, { onDelete: 'cascade' }),
  sourceUrl: text('source_url').notNull(),
  sourceProductId: varchar('source_product_id', { length: 255 }),
  canonicalProductId: uuid('canonical_product_id'), // Soft reference to global_products to avoid circular Drizzle import
  rawTitle: text('raw_title').notNull(),
  rawDescription: text('raw_description'),
  rawPrice: numeric('raw_price', { precision: 14, scale: 4 }),
  rawCurrency: varchar('raw_currency', { length: 3 }).default('USD'),
  rawAttributes: jsonb('raw_attributes').notNull().default(sql`'{}'::jsonb`),
  rawIdentifiers: jsonb('raw_identifiers').notNull().default(sql`'{}'::jsonb`),
  rawImages: jsonb('raw_images').notNull().default(sql`'[]'::jsonb`),
  htmlSnapshotUri: text('html_snapshot_uri'),
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }).notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_spl_unique_url').on(table.sourceWebsiteId, table.sourceUrl),
  index('idx_spl_canonical_id').on(table.canonicalProductId),
  index('idx_spl_content_hash').on(table.contentHash),
]);

