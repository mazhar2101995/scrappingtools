import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './tenants';

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
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
  index('idx_brands_org_id').on(table.organizationId),
]);

// 1.1 Tenant Brand Profiles with Dynamic Field Mapping & Custom Fields
export const tenantBrandProfiles = pgTable('tenant_brand_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 255 }).notNull(),
  officialWebsite: text('official_website'),
  logoUrl: text('logo_url'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  notes: text('notes'),
  sourceConfigs: jsonb('source_configs').notNull().default(sql`'[]'::jsonb`),
  fieldMappings: jsonb('field_mappings').notNull().default(sql`'[]'::jsonb`),
  fieldGroups: jsonb('field_groups').notNull().default(sql`'[]'::jsonb`),
  customFields: jsonb('custom_fields').notNull().default(sql`'[]'::jsonb`),
  aiPromptRules: text('ai_prompt_rules'),
  languagePromptRules: jsonb('language_prompt_rules').notNull().default(sql`'{}'::jsonb`),
  modelPatternRules: jsonb('model_pattern_rules').notNull().default(sql`'{}'::jsonb`),
  seoSettings: jsonb('seo_settings').notNull().default(sql`'{}'::jsonb`),
  // Phase 9D: Product Presentation, Field Control & Business Rules Engine
  fieldConfigs: jsonb('field_configs').notNull().default(sql`'[]'::jsonb`),
  imageExtractionRules: jsonb('image_extraction_rules').notNull().default(sql`'{"galleryImages": true, "contentImages": true, "decorativeImages": false, "logosAndIcons": false}'::jsonb`),
  contentTemplates: jsonb('content_templates').notNull().default(sql`'[]'::jsonb`),
  missingDataRules: jsonb('missing_data_rules').notNull().default(sql`'{}'::jsonb`),
  pricingRules: jsonb('pricing_rules').notNull().default(sql`'{"strategy": "none", "value": 0, "applyMargin": false}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_tbp_org_brand_name').on(table.organizationId, table.normalizedName),
  index('idx_tbp_org_id').on(table.organizationId),
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

export const sourceCache = pgTable('source_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  urlHash: varchar('url_hash', { length: 64 }).notNull(),
  normalizedUrl: text('normalized_url').notNull(),
  originalUrl: text('original_url').notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  statusCode: integer('status_code').notNull().default(200),
  contentType: varchar('content_type', { length: 100 }).notNull().default('text/html'),
  content: text('content').notNull(),
  byteSize: integer('byte_size').notNull().default(0),
  acquisitionMethod: varchar('acquisition_method', { length: 50 }).notNull().default('DIRECT_HTTP'),
  versionNumber: integer('version_number').notNull().default(1),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).notNull().defaultNow(),
  accessCount: integer('access_count').notNull().default(1),
  lastError: jsonb('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_source_cache_url_hash').on(table.urlHash),
  index('idx_source_cache_domain').on(table.domain),
  index('idx_source_cache_expires_at').on(table.expiresAt),
]);

export const sourceVersionHistory = pgTable('source_version_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  urlHash: varchar('url_hash', { length: 64 }).notNull(),
  normalizedUrl: text('normalized_url').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  versionNumber: integer('version_number').notNull(),
  contentDiffSummary: text('content_diff_summary'),
  byteSize: integer('byte_size').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_svh_url_version').on(table.urlHash, table.versionNumber),
]);

export const sourceDomainHealth = pgTable('source_domain_health', {
  domain: varchar('domain', { length: 255 }).primaryKey(),
  healthStatus: varchar('health_status', { length: 50 }).notNull().default('HEALTHY'), // HEALTHY, DEGRADED, TEMPORARILY_UNAVAILABLE, REQUIRES_REVIEW, DISABLED
  totalRequests: integer('total_requests').notNull().default(0),
  successfulRequests: integer('successful_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  successRate: numeric('success_rate', { precision: 5, scale: 2 }).notNull().default('100.00'),
  avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
  lastStatusCode: integer('last_status_code'),
  lastErrorCategory: varchar('last_error_category', { length: 100 }),
  lastErrorMessage: text('last_error_message'),
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sdh_health_status').on(table.healthStatus),
  index('idx_sdh_cooldown_until').on(table.cooldownUntil),
]);

export const sourceIncidentEvents = pgTable('source_incident_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // COOLDOWN_ACTIVATED, HEALTH_DEGRADED, CIRCUIT_OPEN, RECOVERY
  severity: varchar('severity', { length: 20 }).notNull().default('WARNING'), // INFO, WARNING, CRITICAL
  errorCategory: varchar('error_category', { length: 100 }).notNull(),
  message: text('message').notNull(),
  context: jsonb('context').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sie_domain').on(table.domain, table.createdAt),
]);

export const networkRoutes = pgTable('network_routes', {
  routeId: varchar('route_id', { length: 64 }).primaryKey(),
  providerId: varchar('provider_id', { length: 64 }).notNull(),
  routeType: varchar('route_type', { length: 32 }).notNull().default('DIRECT'), // DIRECT, PROXY, INTERNAL_RESIDENTIAL
  status: varchar('status', { length: 32 }).notNull().default('AVAILABLE'), // AVAILABLE, DEGRADED, TEMPORARILY_UNAVAILABLE, DISABLED
  concurrencyLimit: integer('concurrency_limit').notNull().default(5),
  activeRequests: integer('active_requests').notNull().default(0),
  totalRequests: integer('total_requests').notNull().default(0),
  successfulRequests: integer('successful_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
  lastErrorMessage: text('last_error_message'),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_nr_provider_type').on(table.providerId, table.routeType),
  index('idx_nr_status').on(table.status),
]);

export const networkRouteIncidents = pgTable('network_route_incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  routeId: varchar('route_id', { length: 64 }).notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  severity: varchar('severity', { length: 32 }).notNull().default('INFO'),
  statusCode: integer('status_code'),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_nri_route_id').on(table.routeId, table.createdAt),
]);

export const customerSupplierCredentials = pgTable('customer_supplier_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  supplierDomain: varchar('supplier_domain', { length: 255 }).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }).notNull(),
  loginUrl: text('login_url').notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  encryptedPassword: text('encrypted_password').notNull(),
  sessionCookies: jsonb('session_cookies').default(sql`'[]'::jsonb`),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastStatus: varchar('last_status', { length: 50 }).notNull().default('PENDING'),
  lastErrorMessage: text('last_error_message'),
  autoRefreshHours: integer('auto_refresh_hours').notNull().default(12),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_cust_supp_creds_org').on(table.organizationId),
  index('idx_cust_supp_creds_domain').on(table.organizationId, table.supplierDomain),
]);

export const supplierFeedSources = pgTable('supplier_feed_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  feedName: varchar('feed_name', { length: 255 }).notNull(),
  feedType: varchar('feed_type', { length: 50 }).notNull(), // 'FTP', 'SFTP', 'HTTP_URL', 'GOOGLE_SHEETS'
  connectionConfig: jsonb('connection_config').notNull().default(sql`'{}'::jsonb`),
  columnMapping: jsonb('column_mapping').notNull().default(sql`'{"sku":"sku","price":"price","stock":"stock","title":"title"}'::jsonb`),
  syncFrequencyHours: integer('sync_frequency_hours').notNull().default(6),
  autoPushToStores: boolean('auto_push_to_stores').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncStatus: varchar('last_sync_status', { length: 50 }).notNull().default('PENDING'),
  lastErrorMessage: text('last_error_message'),
  lastItemsProcessed: integer('last_items_processed').default(0),
  lastItemsUpdated: integer('last_items_updated').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sfs_org').on(table.organizationId),
  index('idx_sfs_status').on(table.organizationId, table.lastSyncStatus),
]);


