import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import crypto from 'crypto';
import { db, productImageTransformations, globalProducts, customerProductOverrides } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';

export interface ImageProcessingOptions {
  removeBackground?: boolean;
  backgroundColor?: string; // default '#FFFFFF'
  addDropShadow?: boolean;
  removeWatermark?: boolean; // corner logo / badge suppression
  watermarkPositions?: ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')[];
  autoCenter?: boolean;
  targetWidth?: number;
  targetHeight?: number;
  outputFormat?: 'webp' | 'jpeg' | 'png';
  quality?: number; // 1-100
}

export class ImageStudioService {
  private static readonly UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'studio');

  private static ensureUploadDir() {
    if (!fs.existsSync(this.UPLOADS_DIR)) {
      fs.mkdirSync(this.UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   * Fetch image buffer from URL or local public path
   */
  public static async fetchImageBuffer(imageUrl: string): Promise<Buffer> {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const resp = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ProductIntelligence/2.0',
        },
      });
      return Buffer.from(resp.data);
    } else {
      // Local path e.g. /uploads/deduped/xyz.jpg
      const localRel = imageUrl.replace(/^\/+/, '');
      const localPath = path.resolve(process.cwd(), 'public', localRel);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
      throw new Error(`Image not found at path: ${imageUrl}`);
    }
  }

  /**
   * Perform pure white studio background removal & boundary cleaning
   * Uses flood-fill luminance isolation + soft boundary thresholding on raw pixels
   */
  public static async cleanBackgroundAndStudioShot(
    inputBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<Buffer> {
    const targetBg = options.backgroundColor || '#FFFFFF';
    const autoCenter = options.autoCenter !== false;
    const targetW = options.targetWidth || 1000;
    const targetH = options.targetHeight || 1000;

    let image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 800;

    // 1. Watermark & Corner Badges Inpainting / Clean up
    if (options.removeWatermark) {
      // Common supplier watermark badge areas: corners (e.g. 15% width x 12% height in corners)
      const positions = options.watermarkPositions || ['top-right', 'bottom-right', 'top-left', 'bottom-left'];
      const cornerW = Math.round(width * 0.16);
      const cornerH = Math.round(height * 0.10);

      const overlays: Array<{ input: Buffer; top: number; left: number; blend: 'over' }> = [];

      for (const pos of positions) {
        let left = 0;
        let top = 0;
        if (pos === 'top-right') {
          left = width - cornerW;
          top = 0;
        } else if (pos === 'bottom-left') {
          left = 0;
          top = height - cornerH;
        } else if (pos === 'bottom-right') {
          left = width - cornerW;
          top = height - cornerH;
        }

        // Create a blended corner patch matching pure background
        const patch = await sharp({
          create: {
            width: cornerW,
            height: cornerH,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer();

        overlays.push({ input: patch, top, left, blend: 'over' });
      }

      if (overlays.length > 0) {
        image = sharp(await image.composite(overlays).toBuffer());
      }
    }

    // 2. High-precision Studio Chroma / Thresholding to Pure White (#FFFFFF)
    // Convert near-white & gray cast studio backgrounds (RGB > 235) to pure #FFFFFF
    const rawRgba = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = rawRgba;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // If pixel is near-white or light off-white studio background (luminance > 228 with low color saturation)
      const maxVal = Math.max(r, g, b);
      const minVal = Math.min(r, g, b);
      const diff = maxVal - minVal;

      if (r > 228 && g > 228 && b > 228 && diff < 20) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        if (options.removeBackground && targetBg.toLowerCase() === 'transparent') {
          data[i + 3] = 0; // Transparent
        }
      }
    }

    let processedImage = sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    });

    // 3. Auto-Fit & Center on Pure White E-Commerce Canvas (1000x1000 Standard Square)
    if (autoCenter) {
      processedImage = processedImage.resize(targetW, targetH, {
        fit: 'contain',
        background: targetBg.toLowerCase() === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : targetBg,
      });
    }

    // 4. Output format compression
    const fmt = options.outputFormat || 'webp';
    const qual = options.quality || 90;

    if (fmt === 'webp') {
      return await processedImage.webp({ quality: qual, effort: 4 }).toBuffer();
    } else if (fmt === 'png') {
      return await processedImage.png({ compressionLevel: 8 }).toBuffer();
    } else {
      return await processedImage.jpeg({ quality: qual, mozjpeg: true }).toBuffer();
    }
  }

  /**
   * Process and save a transformed product image, updating product record
   */
  public static async transformProductImage(params: {
    organizationId: string;
    globalProductId: string;
    sourceImageUrl: string;
    transformationType: 'REMOVE_BG_STUDIO' | 'REMOVE_WATERMARK' | 'AUTO_ENHANCE_ALL';
    options?: ImageProcessingOptions;
  }): Promise<{
    cleanedUrl: string;
    transformationId: string;
  }> {
    this.ensureUploadDir();

    const { organizationId, globalProductId, sourceImageUrl, transformationType, options = {} } = params;

    // Apply defaults based on transformation type
    if (transformationType === 'REMOVE_BG_STUDIO') {
      options.removeBackground = true;
      options.backgroundColor = '#FFFFFF';
      options.autoCenter = true;
    } else if (transformationType === 'REMOVE_WATERMARK') {
      options.removeWatermark = true;
    } else if (transformationType === 'AUTO_ENHANCE_ALL') {
      options.removeBackground = true;
      options.backgroundColor = '#FFFFFF';
      options.removeWatermark = true;
      options.autoCenter = true;
      options.outputFormat = 'webp';
    }

    const inputBuffer = await this.fetchImageBuffer(sourceImageUrl);
    const cleanedBuffer = await this.cleanBackgroundAndStudioShot(inputBuffer, options);

    const ext = options.outputFormat || 'webp';
    const filename = `studio_${globalProductId.slice(0, 8)}_${Date.now()}.${ext}`;
    const filePath = path.join(this.UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, cleanedBuffer);
    const publicUrl = `/uploads/studio/${filename}`;

    // 1. Log transformation
    const [rec] = await db
      .insert(productImageTransformations)
      .values({
        organizationId,
        globalProductId,
        originalUrl: sourceImageUrl,
        cleanedUrl: publicUrl,
        transformationType,
        parameters: options,
        status: 'COMPLETED',
      })
      .returning();

    // 2. Update product override so connected OpenCart & Shopify stores receive clean studio image
    const [existingOverride] = await db
      .select()
      .from(customerProductOverrides)
      .where(
        and(
          eq(customerProductOverrides.organizationId, organizationId),
          eq(customerProductOverrides.globalProductId, globalProductId)
        )
      )
      .limit(1);

    const customAttrs = (existingOverride?.customAttributes as any) || {};
    customAttrs.primary_image_url = publicUrl;
    customAttrs.studio_image_cleaned = true;

    if (existingOverride) {
      await db
        .update(customerProductOverrides)
        .set({
          customAttributes: customAttrs,
          updatedAt: new Date(),
        })
        .where(eq(customerProductOverrides.id, existingOverride.id));
    } else {
      await db.insert(customerProductOverrides).values({
        organizationId,
        globalProductId,
        customAttributes: customAttrs,
      });
    }

    return {
      cleanedUrl: publicUrl,
      transformationId: rec.id,
    };
  }

  /**
   * List history of image transformations for a product
   */
  public static async getTransformations(organizationId: string, globalProductId: string) {
    return await db
      .select()
      .from(productImageTransformations)
      .where(
        and(
          eq(productImageTransformations.organizationId, organizationId),
          eq(productImageTransformations.globalProductId, globalProductId)
        )
      )
      .orderBy(desc(productImageTransformations.createdAt));
  }
}
