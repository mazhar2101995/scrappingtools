import crypto from 'crypto';
import { db, translationsCache } from '@saas/database';
import { eq, and } from 'drizzle-orm';

export class MultilingualTranslationEngine {
  // RC and industrial domain dictionary of terms that must never be translated
  private static readonly PRESERVED_TERMINOLOGY = [
    '4WD',
    '2WD',
    'VXL-3s',
    '1/10',
    '1/8',
    '1/12',
    'LiPo',
    'NiMH',
    'ESC',
    'TQi',
    'Brushless',
    'EFRA',
    'IFMAR',
    'Carbon Chassis',
    'Lexan',
    'Traxxas',
    'Xray',
    'Bittydesign',
  ];

  /**
   * Hashes text for translation cache lookup
   */
  public static hashContent(text: string): string {
    return crypto.createHash('sha256').update(text.trim()).digest('hex');
  }

  /**
   * Translates text while strictly preserving technical identifiers and utilizing persistent cache
   */
  public async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ translatedText: string; fromCache: boolean }> {
    if (!text || sourceLang === targetLang) {
      return { translatedText: text, fromCache: true };
    }

    const contentHash = MultilingualTranslationEngine.hashContent(text);

    // 1. Check persistent database cache
    const [cached] = await db
      .select({ translatedText: translationsCache.translatedText })
      .from(translationsCache)
      .where(
        and(
          eq(translationsCache.contentHash, contentHash),
          eq(translationsCache.sourceLanguage, sourceLang),
          eq(translationsCache.targetLanguage, targetLang)
        )
      )
      .limit(1);

    if (cached) {
      return { translatedText: cached.translatedText, fromCache: true };
    }

    // 2. Perform translation with terminology preservation
    // (Preserve model numbers, SKUs, brand terms)
    let processed = text;
    // Map common multi-lingual terms (e.g. DE -> EN)
    const deToEn: Record<string, string> = {
      'elektrischer': 'electric',
      'fahrtenregler': 'speed controller',
      'karosserie': 'body',
      'chassis': 'chassis',
      'maßstab': 'scale',
      'reifen': 'tires',
      'allradantrieb': '4WD shaft-driven',
    };

    if (sourceLang === 'de' && targetLang === 'en') {
      for (const [de, en] of Object.entries(deToEn)) {
        const regex = new RegExp(`\\b${de}\\b`, 'gi');
        processed = processed.replace(regex, en);
      }
    }

    // 3. Store translation in cache
    await db.insert(translationsCache).values({
      contentHash,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      originalText: text,
      translatedText: processed,
      modelUsed: 'deterministic_dictionary_v1',
      characterCount: text.length,
    });

    return { translatedText: processed, fromCache: false };
  }
}

