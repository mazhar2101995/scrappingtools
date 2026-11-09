import { pgTable, uuid, varchar, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Global Media Assets - Content-Addressable Image Storage & Deduplication Registry
 *
 * Ensures that if multiple clients (or the same client across multiple scraping runs)
 * scrape the exact same product image, the binary file is downloaded ONCE.
 * Subsquent references are resolved instantly via content-hash or canonical URL match.
 */
export const globalMediaAssets = pgTable('global_media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  // SHA-256 binary hash of the image content
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  // Canonical normalized origin URL (stripped of volatile query params)
  canonicalUrl: text('canonical_url').notNull(),
  // Original first-seen URL
  originalUrl: text('original_url').notNull(),
  // Persistent local or cloud CDN storage URI (e.g. /media/assets/sha256.jpg)
  storageUri: text('storage_uri').notNull(),
  // MIME type, e.g. 'image/jpeg', 'image/png', 'image/webp'
  mimeType: varchar('mime_type', { length: 50 }).notNull().default('image/jpeg'),
  // Pixel dimensions & file size
  byteSize: integer('byte_size').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  // Count of how many product listings or tenant products are referencing this media asset
  referenceCount: integer('reference_count').notNull().default(1),
  lastReferencedAt: timestamp('last_referenced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_gma_content_hash').on(table.contentHash),
  index('idx_gma_canonical_url').on(table.canonicalUrl),
]);
