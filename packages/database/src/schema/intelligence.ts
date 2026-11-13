import { pgTable, uuid, varchar, text, numeric, integer, boolean, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { globalProducts, productVariants } from './products';
import { users } from './tenants';

// 1. Centralized Versioned Prompt Management
export const aiPromptTemplates = pgTable('ai_prompt_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull(),
  version: integer('version').notNull().default(1),
  taskType: varchar('task_type', { length: 50 }).notNull(), // 'SPEC_STRUCTURING', 'TITLE_CLEANING', 'FEATURE_EXTRACTION', 'CATEGORY_MAPPING'
  systemPrompt: text('system_prompt').notNull(),
  userPromptTemplate: text('user_prompt_template').notNull(),
  inputSchema: jsonb('input_schema').notNull(),
  outputSchema: jsonb('output_schema').notNull(),
  modelPreference: varchar('model_preference', { length: 100 }).notNull().default('gpt-4o-mini'),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).notNull().default('0.10'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_apt_slug_version').on(table.slug, table.version),
  index('idx_apt_task_active').on(table.taskType, table.isActive),
]);

// 2. Multilingual Translation Cache
export const translationsCache = pgTable('translations_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  sourceLanguage: varchar('source_language', { length: 10 }).notNull(),
  targetLanguage: varchar('target_language', { length: 10 }).notNull(),
  originalText: text('original_text').notNull(),
  translatedText: text('translated_text').notNull(),
  modelUsed: varchar('model_used', { length: 100 }).notNull().default('deterministic_dictionary'),
  characterCount: integer('character_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_tc_hash_lang').on(table.contentHash, table.sourceLanguage, table.targetLanguage),
]);

// 3. Canonical Product Attribute Dictionary
export const productAttributeDictionary = pgTable('product_attribute_dictionary', {
  id: uuid('id').defaultRandom().primaryKey(),
  rawAttributeName: varchar('raw_attribute_name', { length: 150 }).notNull(),
  canonicalKey: varchar('canonical_key', { length: 100 }).notNull(),
  categoryScope: varchar('category_scope', { length: 100 }).default('GLOBAL'),
  unitType: varchar('unit_type', { length: 50 }), // 'LENGTH', 'WEIGHT', 'VOLTAGE', 'SPEED', 'CAPACITY'
  standardUnit: varchar('standard_unit', { length: 20 }), // 'mm', 'kg', 'V', 'km/h', 'mAh'
  conversionMultiplier: numeric('conversion_multiplier', { precision: 12, scale: 6 }).default('1.000000'),
  dataType: varchar('data_type', { length: 30 }).notNull().default('string'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_pad_raw_scope').on(table.rawAttributeName, table.categoryScope),
  index('idx_pad_canonical').on(table.canonicalKey),
]);

// 4. Reversible Product Merge History
export const productMergeHistory = pgTable('product_merge_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  targetGlobalProductId: uuid('target_global_product_id').notNull().references(() => globalProducts.id, { onDelete: 'cascade' }),
  sourceGlobalProductId: uuid('source_global_product_id').notNull(),
  mergedByUserId: uuid('merged_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  mergeReason: varchar('merge_reason', { length: 255 }).notNull(),
  mergeConfidence: numeric('merge_confidence', { precision: 3, scale: 2 }).notNull(),
  snapshotState: jsonb('snapshot_state').notNull(), // Complete backup of source product before merge
  isReversed: boolean('is_reversed').notNull().default(false),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_pmh_target').on(table.targetGlobalProductId),
  index('idx_pmh_source').on(table.sourceGlobalProductId),
]);

// 5. In-House AI Fine-Tuning & Correction Feedback Dataset (Self-Training Pipeline)
export const aiTrainingExamples = pgTable('ai_training_examples', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskType: varchar('task_type', { length: 50 }).notNull(), // 'TRANSLATION', 'TITLE_NORMALIZATION', 'ATTRIBUTE_EXTRACTION', 'DESCRIPTION_CLEANING'
  sourceText: text('source_text').notNull(),
  modelOutput: text('model_output').notNull(),
  correctedOutput: text('corrected_output').notNull(),
  brandScope: varchar('brand_scope', { length: 150 }).default('GLOBAL'),
  languageCode: varchar('language_code', { length: 20 }).default('en'),
  correctionReason: text('correction_reason'),
  isVerifiedForTraining: boolean('is_verified_for_training').notNull().default(true),
  sourceModel: varchar('source_model', { length: 100 }).default('in_house_baseline'),
  qualityScore: numeric('quality_score', { precision: 3, scale: 2 }).default('1.00'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ai_training_task').on(table.taskType, table.languageCode),
  index('idx_ai_training_brand').on(table.brandScope),
]);


