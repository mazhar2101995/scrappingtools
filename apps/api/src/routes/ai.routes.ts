import { Router, Request, Response } from 'express';
import {
  db,
  aiPromptTemplates,
  aiProcessingHistory,
  translationsCache,
  organizations,
  tenantBrandProfiles,
} from '@saas/database';
import { eq, desc, sql, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';
import { AiIntelligenceService } from '../services/ai-intelligence.service';
import axios from 'axios';

export const aiRouter = Router();

aiRouter.use(authMiddleware);

// --- Phase 4: AI Eligibility Check Endpoint ---
aiRouter.post('/check-eligibility', async (req: Request, res: Response) => {
  const { rawTitle, rawDescription, deterministicConfidence, hasStructuredSpecs, isExplicitUserRequest } = req.body;
  const result = AiIntelligenceService.evaluateEligibility({
    rawTitle,
    rawDescription,
    deterministicConfidence: Number(deterministicConfidence || 0),
    hasStructuredSpecs: Boolean(hasStructuredSpecs),
    isExplicitUserRequest: Boolean(isExplicitUserRequest),
  });
  return res.json({ success: true, eligibility: result });
});

// GET /api/v1/ai/metrics - Aggregate AI tokens, estimated costs, and task breakdown
aiRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [tokenSummary] = await db
      .select({
        totalTokens: sql<number>`coalesce(sum(${aiProcessingHistory.tokenUsage}), 0)::int`,
        totalExecutions: sql<number>`count(*)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${aiProcessingHistory.latencyMs}), 0)::int`,
      })
      .from(aiProcessingHistory);

    const [transSummary] = await db
      .select({
        totalTranslations: sql<number>`count(*)::int`,
        totalCharacters: sql<number>`coalesce(sum(${translationsCache.characterCount}), 0)::int`,
      })
      .from(translationsCache);

    // Cost calculation: standard blended ~$0.15 per million tokens
    const estimatedCostUsd = Number(((tokenSummary.totalTokens / 1_000_000) * 0.15).toFixed(4));

    return res.json({
      success: true,
      data: {
        totalTokensUsed: tokenSummary.totalTokens,
        totalExecutions: tokenSummary.totalExecutions,
        estimatedCostUsd,
        avgLatencyMs: tokenSummary.avgLatencyMs,
        cachedTranslationsCount: transSummary.totalTranslations,
        totalCharactersTranslated: transSummary.totalCharacters,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/ai/prompts - List all database-backed versioned prompt templates
aiRouter.get('/prompts', async (req: Request, res: Response) => {
  try {
    const prompts = await db
      .select()
      .from(aiPromptTemplates)
      .orderBy(desc(aiPromptTemplates.version));

    return res.json({ success: true, count: prompts.length, data: prompts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/ai/prompts - Create or version a prompt template (Platform Admin only)
aiRouter.post('/prompts', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'viewer';
    if (!['super_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Platform admin permission required' });
    }

    const { slug, taskType, systemPrompt, userPromptTemplate, inputSchema, outputSchema, modelPreference } = req.body;

    if (!slug || !taskType || !systemPrompt || !userPromptTemplate) {
      return res.status(400).json({ error: 'slug, taskType, systemPrompt and userPromptTemplate are required' });
    }

    // Get current latest version for slug
    const [latest] = await db
      .select({ version: aiPromptTemplates.version })
      .from(aiPromptTemplates)
      .where(eq(aiPromptTemplates.slug, slug))
      .orderBy(desc(aiPromptTemplates.version))
      .limit(1);

    const nextVersion = (latest?.version || 0) + 1;

    const [newTemplate] = await db
      .insert(aiPromptTemplates)
      .values({
        slug,
        version: nextVersion,
        taskType,
        systemPrompt,
        userPromptTemplate,
        inputSchema: inputSchema || {},
        outputSchema: outputSchema || {},
        modelPreference: modelPreference || 'gpt-4o-mini',
      })
      .returning();

    return res.status(201).json({ success: true, data: newTemplate });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/ai/history - List recent AI execution logs
aiRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const history = await db
      .select()
      .from(aiProcessingHistory)
      .orderBy(desc(aiProcessingHistory.executedAt))
      .limit(50);

    return res.json({ success: true, count: history.length, data: history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/ai/enrich-product - Centralized AI Enrichment Service with Provenance (Phase 4)
aiRouter.post('/enrich-product', async (req: Request, res: Response) => {
  const orgId = (req as any).user?.organizationId;
  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  const {
    brandId,
    brandName,
    rawTitle,
    rawDescription,
    modelNumber,
    sku,
    price,
    features,
    attributes,
    customFields,
    isExplicitRequest = true,
  } = req.body;

  if (!rawTitle && !rawDescription) {
    return res.status(400).json({ error: 'At least rawTitle or rawDescription is required for enrichment' });
  }

  try {
    const result = await AiIntelligenceService.enrichProduct({
      organizationId: orgId,
      brandId,
      brandName,
      rawTitle: rawTitle || '',
      modelNumber,
      sku,
      price,
      rawDescription,
      features,
      attributes,
      customFields,
      isExplicitRequest,
    });

    return res.json({
      success: result.success,
      data: result.output,
      meta: {
        provider: result.provenance.provider,
        model: result.provenance.model,
        tokensUsed: result.provenance.tokensUsed,
        latencyMs: result.provenance.latencyMs,
        skipped: result.skipped,
        reason: result.reason,
        validation: result.validation,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI Enrichment failed', details: err.message });
  }
});


