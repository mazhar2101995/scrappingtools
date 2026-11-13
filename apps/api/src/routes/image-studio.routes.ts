import { Router, Request, Response } from 'express';
import { authMiddleware, requireOrgRole } from '../middleware/auth.middleware';
import { ImageStudioService } from '../services/image-studio.service';

export const imageStudioRouter = Router();

imageStudioRouter.use(authMiddleware);

function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req as any).apiKey?.organizationId || null;
}

/**
 * GET /api/v1/image-studio/:productId/history
 * List transformation history for product
 */
imageStudioRouter.get('/:productId/history', requireOrgRole('viewer'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const productId = String(req.params.productId);
    const history = await ImageStudioService.getTransformations(orgId, productId);

    return res.json({ data: history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch image studio history' });
  }
});

/**
 * POST /api/v1/image-studio/transform
 * Clean background, remove watermark, or auto-enhance product image
 */
imageStudioRouter.post('/transform', requireOrgRole('editor'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const { globalProductId, sourceImageUrl, transformationType, options } = req.body;

    if (!globalProductId || !sourceImageUrl || !transformationType) {
      return res.status(400).json({
        error: 'globalProductId, sourceImageUrl, and transformationType are required',
      });
    }

    const result = await ImageStudioService.transformProductImage({
      organizationId: orgId,
      globalProductId,
      sourceImageUrl,
      transformationType,
      options,
    });

    return res.json({
      message: 'Product image successfully processed and updated in catalog',
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process image in studio' });
  }
});
