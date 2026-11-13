import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { InHouseAiTrainingService } from '../services/in-house-ai-training.service';

export const aiTrainingRouter = Router();

aiTrainingRouter.use(authMiddleware);

/**
 * GET /api/v1/ai-training/stats
 * View local fine-tuning dataset statistics
 */
aiTrainingRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await InHouseAiTrainingService.getDatasetStats();
    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch dataset stats', details: err.message });
  }
});

/**
 * GET /api/v1/ai-training/dataset
 * List training pairs
 */
aiTrainingRouter.get('/dataset', async (req: Request, res: Response) => {
  try {
    const taskType = req.query.taskType as string | undefined;
    const languageCode = req.query.languageCode as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const dataset = await InHouseAiTrainingService.listTrainingDataset({
      taskType,
      languageCode,
      limit,
    });
    return res.json({ success: true, dataset });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch training dataset', details: err.message });
  }
});

/**
 * POST /api/v1/ai-training/record-correction
 * Record a correction from client/admin review
 */
aiTrainingRouter.post('/record-correction', async (req: Request, res: Response) => {
  try {
    const {
      taskType,
      sourceText,
      modelOutput,
      correctedOutput,
      brandScope,
      languageCode,
      correctionReason,
    } = req.body;

    const example = await InHouseAiTrainingService.recordCorrection({
      taskType: taskType || 'TRANSLATION',
      sourceText,
      modelOutput: modelOutput || '',
      correctedOutput,
      brandScope,
      languageCode: languageCode || 'en',
      correctionReason,
    });

    return res.status(201).json({ success: true, example });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record training example', details: err.message });
  }
});

/**
 * GET /api/v1/ai-training/export
 * Download fine-tuning JSONL file
 */
aiTrainingRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const taskType = req.query.taskType as string | undefined;
    const exported = await InHouseAiTrainingService.exportDatasetForFineTuning(taskType);

    res.setHeader('Content-Disposition', `attachment; filename="in_house_ai_training_${Date.now()}.jsonl"`);
    res.setHeader('Content-Type', 'application/x-jsonlines');
    return res.send(exported.jsonl);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export training dataset', details: err.message });
  }
});

