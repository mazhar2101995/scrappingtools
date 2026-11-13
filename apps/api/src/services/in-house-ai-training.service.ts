import { db, aiTrainingExamples, translationsCache } from '@saas/database';
import { eq, desc, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface RecordCorrectionInput {
  taskType: 'TRANSLATION' | 'TITLE_NORMALIZATION' | 'ATTRIBUTE_EXTRACTION' | 'DESCRIPTION_CLEANING';
  sourceText: string;
  modelOutput: string;
  correctedOutput: string;
  brandScope?: string;
  languageCode?: string;
  correctionReason?: string;
  sourceModel?: string;
}

export class InHouseAiTrainingService {
  /**
   * Record a human correction as a high-quality training pair for future local model fine-tuning
   */
  public static async recordCorrection(input: RecordCorrectionInput) {
    if (!input.sourceText?.trim() || !input.correctedOutput?.trim()) {
      throw new Error('Both sourceText and correctedOutput are required for training data.');
    }

    const [example] = await db
      .insert(aiTrainingExamples)
      .values({
        taskType: input.taskType,
        sourceText: input.sourceText.trim(),
        modelOutput: input.modelOutput?.trim() || '',
        correctedOutput: input.correctedOutput.trim(),
        brandScope: input.brandScope || 'GLOBAL',
        languageCode: input.languageCode || 'en',
        correctionReason: input.correctionReason || 'User manual catalog edit',
        sourceModel: input.sourceModel || 'in_house_baseline',
        isVerifiedForTraining: true,
      })
      .returning();

    // If task is translation, immediately update translations_cache so future scrapes use the human-corrected value
    if (input.taskType === 'TRANSLATION' && input.languageCode) {
      const contentHash = crypto.createHash('sha256').update(input.sourceText.trim()).digest('hex');
      try {
        await db
          .insert(translationsCache)
          .values({
            contentHash,
            sourceLanguage: 'en',
            targetLanguage: input.languageCode,
            originalText: input.sourceText.trim(),
            translatedText: input.correctedOutput.trim(),
            modelUsed: 'human_verified_correction',
            characterCount: input.correctedOutput.trim().length,
          })
          .onConflictDoUpdate({
            target: [translationsCache.contentHash, translationsCache.sourceLanguage, translationsCache.targetLanguage],
            set: {
              translatedText: input.correctedOutput.trim(),
              modelUsed: 'human_verified_correction',
            },
          });
      } catch (cacheErr) {
        console.error('[AiTrainingService] Cache sync warning:', cacheErr);
      }
    }

    return example;
  }

  /**
   * List accumulated training examples
   */
  public static async listTrainingDataset(params?: {
    taskType?: string;
    languageCode?: string;
    limit?: number;
  }) {
    const conditions = [];
    if (params?.taskType) {
      conditions.push(eq(aiTrainingExamples.taskType, params.taskType));
    }
    if (params?.languageCode) {
      conditions.push(eq(aiTrainingExamples.languageCode, params.languageCode));
    }

    const query = db
      .select()
      .from(aiTrainingExamples);

    return conditions.length > 0
      ? query.where(and(...conditions)).orderBy(desc(aiTrainingExamples.createdAt)).limit(params?.limit || 50)
      : query.orderBy(desc(aiTrainingExamples.createdAt)).limit(params?.limit || 50);
  }

  /**
   * Export dataset in JSONL format ready for standard LLM fine-tuning (e.g. Unsloth, Llama 3, Mistral, Ollama)
   */
  public static async exportDatasetForFineTuning(taskType?: string) {
    const list = await this.listTrainingDataset({ taskType, limit: 1000 });

    const formattedJsonl = list.map((item) => {
      let systemPrompt = 'You are an enterprise catalog AI specialized in product data extraction, normalization, and e-commerce localization.';
      if (item.taskType === 'TRANSLATION') {
        systemPrompt = `You are a professional e-commerce translator. Translate technical product text to ${item.languageCode} accurately.`;
      }

      return JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: item.sourceText },
          { role: 'assistant', content: item.correctedOutput },
        ],
      });
    }).join('\n');

    return {
      count: list.length,
      jsonl: formattedJsonl,
    };
  }

  /**
   * Get training statistics
   */
  public static async getDatasetStats() {
    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiTrainingExamples);

    const taskDistribution = await db
      .select({
        taskType: aiTrainingExamples.taskType,
        count: sql<number>`count(*)::int`,
      })
      .from(aiTrainingExamples)
      .groupBy(aiTrainingExamples.taskType);

    return {
      totalExamples: totalRes?.count || 0,
      distribution: taskDistribution,
    };
  }
}

