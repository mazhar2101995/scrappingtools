import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { db, globalMediaAssets, productImages } from '@saas/database';
import { eq, or, sql } from 'drizzle-orm';

export interface ProcessedMediaResult {
  assetId: string;
  originalUrl: string;
  canonicalUrl: string;
  storageUri: string;
  contentHash: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  isExisting: boolean; // True if downloaded previously and reused without re-downloading!
}

export class MediaDeduplicationService {
  private static STORAGE_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'products');

  /**
   * Ensure local physical media directory exists
   */
  private static ensureStorageDir(): void {
    if (!fs.existsSync(this.STORAGE_DIR)) {
      fs.mkdirSync(this.STORAGE_DIR, { recursive: true });
    }
  }

  /**
   * Canonicalize image URL by stripping volatile analytics / dynamic resize query parameters.
   * Examples stripped: ?v=..., ?w=..., ?quality=..., ?cache=...
   */
  public static canonicalizeImageUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const u = new URL(rawUrl.trim());
      const volatileParams = [
        'v', 'version', 't', 'timestamp',
        'width', 'height', 'w', 'h',
        'fit', 'crop', 'quality', 'q',
        'cache', 'format', 'auto', 'utm_source', 'utm_medium'
      ];
      volatileParams.forEach((p) => u.searchParams.delete(p));
      const cleaned = `${u.origin}${u.pathname}`.toLowerCase().trim();
      return cleaned;
    } catch {
      return rawUrl.split('?')[0].toLowerCase().trim();
    }
  }

  /**
   * Parse image dimensions directly from binary header bytes without external heavy dependencies.
   */
  public static detectImageMetadata(buffer: Buffer): { width: number | null; height: number | null; mimeType: string } {
    // 1. JPEG (0xFF, 0xD8)
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        // SOF0 (0xC0) or SOF2 (0xC2) Baseline/Progressive DCT
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, mimeType: 'image/jpeg' };
        }
        const len = buffer.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
      return { width: null, height: null, mimeType: 'image/jpeg' };
    }

    // 2. PNG
    if (buffer.length > 24 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, mimeType: 'image/png' };
    }

    // 3. GIF
    if (buffer.length > 10 && buffer.subarray(0, 3).toString() === 'GIF') {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height, mimeType: 'image/gif' };
    }

    // 4. WebP
    if (buffer.length > 30 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
      if (buffer.subarray(12, 16).toString() === 'VP8 ') {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height, mimeType: 'image/webp' };
      }
      return { width: null, height: null, mimeType: 'image/webp' };
    }

    return { width: null, height: null, mimeType: 'image/jpeg' };
  }

  /**
   * Download image bytes with automated User-Agent & timeout protection via Node native fetch
   */
  private static async downloadBuffer(targetUrl: string, timeoutMs = 12000): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP Download failed with status ${res.status}`);
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Core Deduplication Ingestion Pipeline:
   * 1. Check if canonical URL is already indexed in globalMediaAssets -> REUSE instantly!
   * 2. If not, download binary bytes and compute cryptographic SHA-256 hash.
   * 3. Check if exact SHA-256 exists (e.g. same image under different domain or CDN URL) -> REUSE instantly!
   * 4. If completely new, save physical file once, write to global registry, and return asset.
   */
  public static async processAndDeduplicateImage(rawImageUrl: string): Promise<ProcessedMediaResult | null> {
    if (!rawImageUrl || typeof rawImageUrl !== 'string' || !rawImageUrl.startsWith('http')) {
      return null;
    }

    const canonical = this.canonicalizeImageUrl(rawImageUrl);

    // --- STEP 1: FAST PATH - Check Canonical URL Match in Global Registry ---
    const [existingByUrl] = await db
      .select()
      .from(globalMediaAssets)
      .where(eq(globalMediaAssets.canonicalUrl, canonical))
      .limit(1);

    if (existingByUrl) {
      // Image already exists! Increment reference count and return immediately without downloading
      await db
        .update(globalMediaAssets)
        .set({
          referenceCount: sql`${globalMediaAssets.referenceCount} + 1`,
          lastReferencedAt: new Date(),
        })
        .where(eq(globalMediaAssets.id, existingByUrl.id))
        .catch(() => {});

      return {
        assetId: existingByUrl.id,
        originalUrl: rawImageUrl,
        canonicalUrl: existingByUrl.canonicalUrl,
        storageUri: existingByUrl.storageUri,
        contentHash: existingByUrl.contentHash,
        mimeType: existingByUrl.mimeType,
        width: existingByUrl.width,
        height: existingByUrl.height,
        byteSize: existingByUrl.byteSize,
        isExisting: true,
      };
    }

    // --- STEP 2: SLOW PATH - Download Buffer to Compute Cryptographic SHA-256 ---
    let buffer: Buffer;
    try {
      buffer = await this.downloadBuffer(rawImageUrl);
    } catch (err: any) {
      // Fallback: If live download fails, return raw URL as fallback without throwing
      console.warn(`[MediaDeduplication] Failed to download "${rawImageUrl}": ${err.message}`);
      return {
        assetId: 'raw_fallback',
        originalUrl: rawImageUrl,
        canonicalUrl: canonical,
        storageUri: rawImageUrl,
        contentHash: crypto.createHash('sha256').update(rawImageUrl).digest('hex'),
        mimeType: 'image/jpeg',
        width: null,
        height: null,
        byteSize: 0,
        isExisting: false,
      };
    }

    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const meta = this.detectImageMetadata(buffer);
    const byteSize = buffer.length;

    // --- STEP 3: Check if same SHA-256 Content Hash already exists in Registry ---
    const [existingByHash] = await db
      .select()
      .from(globalMediaAssets)
      .where(eq(globalMediaAssets.contentHash, contentHash))
      .limit(1);

    if (existingByHash) {
      // Exact identical image already saved under another URL! Reuse existing storageUri
      await db
        .update(globalMediaAssets)
        .set({
          referenceCount: sql`${globalMediaAssets.referenceCount} + 1`,
          lastReferencedAt: new Date(),
        })
        .where(eq(globalMediaAssets.id, existingByHash.id))
        .catch(() => {});

      return {
        assetId: existingByHash.id,
        originalUrl: rawImageUrl,
        canonicalUrl: canonical,
        storageUri: existingByHash.storageUri,
        contentHash: existingByHash.contentHash,
        mimeType: existingByHash.mimeType,
        width: existingByHash.width || meta.width,
        height: existingByHash.height || meta.height,
        byteSize: existingByHash.byteSize || byteSize,
        isExisting: true,
      };
    }

    // --- STEP 4: Brand New Image - Persist to Physical Storage & Register Asset ---
    this.ensureStorageDir();
    const ext = meta.mimeType === 'image/png' ? 'png' : meta.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${contentHash}.${ext}`;
    const filePath = path.join(this.STORAGE_DIR, filename);

    // Save physical binary file (atomic write)
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buffer);
      }
    } catch (fsErr) {
      console.warn('[MediaDeduplication] Could not write file to disk, retaining remote URL:', fsErr);
    }

    const persistentStorageUri = `/uploads/products/${filename}`;

    const [savedAsset] = await db
      .insert(globalMediaAssets)
      .values({
        contentHash,
        canonicalUrl: canonical,
        originalUrl: rawImageUrl,
        storageUri: persistentStorageUri,
        mimeType: meta.mimeType,
        byteSize,
        width: meta.width,
        height: meta.height,
        referenceCount: 1,
      })
      .returning();

    return {
      assetId: savedAsset.id,
      originalUrl: rawImageUrl,
      canonicalUrl: canonical,
      storageUri: persistentStorageUri,
      contentHash,
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
      byteSize,
      isExisting: false,
    };
  }

  /**
   * Batch process an array of image URLs with concurrency limit
   */
  public static async processProductImages(
    globalProductId: string,
    imageUrls: string[]
  ): Promise<ProcessedMediaResult[]> {
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];

    const results: ProcessedMediaResult[] = [];
    const seenHashes = new Set<string>();

    for (let i = 0; i < imageUrls.length; i++) {
      const u = imageUrls[i];
      if (typeof u !== 'string' || !u.startsWith('http')) continue;

      const media = await this.processAndDeduplicateImage(u);
      if (!media) continue;

      // Filter intra-product duplicates (same image listed twice in scraped gallery)
      if (seenHashes.has(media.contentHash)) continue;
      seenHashes.add(media.contentHash);

      results.push(media);

      // Link to product_images table for this global product
      await db
        .insert(productImages)
        .values({
          globalProductId,
          originUrl: media.originalUrl,
          storageUri: media.storageUri,
          imageHash: media.contentHash,
          isPrimary: i === 0,
          width: media.width,
          height: media.height,
          sortOrder: i,
        })
        .catch(() => {});
    }

    return results;
  }
}
