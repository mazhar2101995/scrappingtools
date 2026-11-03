import { Router, Request, Response } from 'express';
import {
  db,
  globalProducts,
  productVariants,
  productIdentifiers,
  productAttributes,
  productImages,
  fieldProvenance,
  productVersions,
  brands,
} from '@saas/database';
import { eq, ilike, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const productsRouter = Router();

// Apply Auth Middleware to all product routes
productsRouter.use(authMiddleware);

// 1. Search Global Canonical Products (Text search, Brand, Pagination)
productsRouter.get('/', async (req: Request, res: Response) => {
  const query = req.query.q as string | undefined;
  const brandId = req.query.brandId as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
  const offset = parseInt(req.query.offset as string || '0', 10);

  const conditions = [];
  if (query) {
    conditions.push(ilike(globalProducts.canonicalTitle, `%${query}%`));
  }
  if (brandId) {
    conditions.push(eq(globalProducts.brandId, brandId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const products = await db
    .select({
      id: globalProducts.id,
      canonicalTitle: globalProducts.canonicalTitle,
      modelNumber: globalProducts.modelNumber,
      categoryPath: globalProducts.categoryPath,
      primaryImageUrl: globalProducts.primaryImageUrl,
      confidenceScore: globalProducts.confidenceScore,
      sourcesCount: globalProducts.sourcesCount,
      brandId: globalProducts.brandId,
      createdAt: globalProducts.createdAt,
    })
    .from(globalProducts)
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  return res.json({
    data: products,
    pagination: { limit, offset, count: products.length },
  });
});

// 2. Strict Barcode Search (EAN / GTIN / UPC)
productsRouter.get('/search/ean/:ean', async (req: Request, res: Response) => {
  const ean = req.params.ean as string;
  const normalizedEan = ean.trim();

  const [identifier] = await db
    .select({
      globalProductId: productIdentifiers.globalProductId,
      idType: productIdentifiers.idType,
      normalizedValue: productIdentifiers.normalizedValue,
      confidence: productIdentifiers.confidence,
    })
    .from(productIdentifiers)
    .where(eq(productIdentifiers.normalizedValue, normalizedEan))
    .limit(1);

  if (!identifier) {
    return res.status(404).json({ error: `No global product found with barcode: ${ean}` });
  }

  const [product] = await db
    .select()
    .from(globalProducts)
    .where(eq(globalProducts.id, identifier.globalProductId))
    .limit(1);

  return res.json({ product, matchedIdentifier: identifier });
});

// 3. Strict Model Search (Brand + Model)
productsRouter.get('/search/model', async (req: Request, res: Response) => {
  const brandId = req.query.brandId as string;
  const model = req.query.model as string;

  if (!brandId || !model) {
    return res.status(400).json({ error: 'brandId and model query parameters are required' });
  }

  const normalizedModel = model.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const [product] = await db
    .select()
    .from(globalProducts)
    .where(
      and(
        eq(globalProducts.brandId, brandId),
        eq(globalProducts.normalizedModel, normalizedModel)
      )
    )
    .limit(1);

  if (!product) {
    return res.status(404).json({ error: `No global product found for model: ${model}` });
  }

  return res.json({ product });
});

// 4. Get Detailed Product with Variants, Attributes, Identifiers & Images
productsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const [product] = await db.select().from(globalProducts).where(eq(globalProducts.id, id)).limit(1);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const [variants, identifiers, attributes, images] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.globalProductId, id)),
    db.select().from(productIdentifiers).where(eq(productIdentifiers.globalProductId, id)),
    db.select().from(productAttributes).where(eq(productAttributes.globalProductId, id)),
    db.select().from(productImages).where(eq(productImages.globalProductId, id)),
  ]);

  return res.json({
    product,
    variants,
    identifiers,
    attributes,
    images,
  });
});

// 5. Retrieve Field-Level Provenance & Freshness
productsRouter.get('/:id/provenance', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const provenance = await db
    .select()
    .from(fieldProvenance)
    .where(eq(fieldProvenance.globalProductId, id));

  return res.json({ globalProductId: id, provenance });
});

// 6. Retrieve Version History & Snapshot Diffs
productsRouter.get('/:id/versions', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const versions = await db
    .select()
    .from(productVersions)
    .where(eq(productVersions.globalProductId, id));

  return res.json({ globalProductId: id, versions });
});
