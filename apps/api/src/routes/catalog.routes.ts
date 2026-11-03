import { Router, Request, Response } from 'express';
import {
  db,
  customerProductMappings,
  customerProductOverrides,
  globalProducts,
  getTenantProductCatalog,
} from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const catalogRouter = Router();
catalogRouter.use(authMiddleware);

// 1. Get Tenant Catalog (Merged with Private Overrides)
catalogRouter.get('/', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);

  const catalog = await getTenantProductCatalog(organizationId, limit);
  return res.json({ organizationId, catalog });
});

// 2. Map Canonical Product to Tenant Catalog
catalogRouter.post('/map', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const { globalProductId, customerInternalSku } = req.body;

  if (!globalProductId) {
    return res.status(400).json({ error: 'globalProductId is required' });
  }

  const [mapping] = await db
    .insert(customerProductMappings)
    .values({
      organizationId,
      globalProductId,
      customerInternalSku,
    })
    .onConflictDoUpdate({
      target: [customerProductMappings.organizationId, customerProductMappings.globalProductId],
      set: { customerInternalSku, updatedAt: new Date() },
    })
    .returning();

  return res.status(201).json({ message: 'Product mapped to tenant catalog', mapping });
});

// 3. Set or Update Private Product Overrides
catalogRouter.put('/:productId/override', async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const productId = req.params.productId as string;
  const { customTitle, customDescription, customCategory, customTags, internalNotes } = req.body;

  const [override] = await db
    .insert(customerProductOverrides)
    .values({
      organizationId,
      globalProductId: productId,
      customTitle,
      customDescription,
      customCategory,
      customTags,
      internalNotes,
    })
    .onConflictDoUpdate({
      target: [customerProductOverrides.organizationId, customerProductOverrides.globalProductId],
      set: {
        customTitle,
        customDescription,
        customCategory,
        customTags,
        internalNotes,
        updatedAt: new Date(),
      },
    })
    .returning();

  return res.json({ message: 'Tenant override updated successfully', override });
});
