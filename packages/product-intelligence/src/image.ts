import crypto from 'crypto';

export interface ImageAnalysisResult {
  imageHash: string;
  isPrimaryCandidate: boolean;
  score: number;
  width?: number;
  height?: number;
  normalizedUrl: string;
}

export class ImageIntelligenceEngine {
  /**
   * Deterministic perceptual hash (dHash simulation from image URL/metadata)
   */
  public static computeImageHash(url: string, width = 0, height = 0): string {
    const cleanUrl = url.split('?')[0].toLowerCase();
    return crypto.createHash('sha256').update(`${cleanUrl}:${width}x${height}`).digest('hex');
  }

  /**
   * Evaluates image list to identify duplicates, ranks main studio shot
   */
  public static processImages(images: Array<{ url: string; width?: number; height?: number }>): {
    primaryImage: string | null;
    dedupedImages: ImageAnalysisResult[];
  } {
    const seenHashes = new Set<string>();
    const results: ImageAnalysisResult[] = [];

    for (const img of images) {
      const hash = this.computeImageHash(img.url, img.width, img.height);
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);

      // Score main image candidate: prefer higher resolution and manufacturer naming patterns
      let score = 50;
      if (img.width && img.width >= 1000) score += 30;
      if (img.url.includes('hero') || img.url.includes('front') || img.url.includes('main')) score += 20;

      results.push({
        imageHash: hash,
        isPrimaryCandidate: false,
        score,
        width: img.width,
        height: img.height,
        normalizedUrl: img.url,
      });
    }

    results.sort((a, b) => b.score - a.score);

    if (results.length > 0) {
      results[0].isPrimaryCandidate = true;
    }

    return {
      primaryImage: results[0]?.normalizedUrl || null,
      dedupedImages: results,
    };
  }
}

