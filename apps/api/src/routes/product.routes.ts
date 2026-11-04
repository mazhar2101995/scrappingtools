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
  tenantBrandProfiles,
  customerProductMappings,
  customerProductOverrides,
  scrapingJobs,
} from '@saas/database';
import { eq, ilike, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const productsRouter = Router();

// Helper to get organization ID
function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req.headers['x-organization-id'] as string) || null;
}

// Apply Auth Middleware to all product routes
productsRouter.use(authMiddleware);

// 0. CREATE / SAVE PRODUCT (Client Tenant Scoped from Extraction)
productsRouter.post('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  const {
    brandId,
    productUrl,
    title,
    modelNumber,
    sku,
    price,
    description,
    primaryImageUrl,
    images,
    attributes,
    customData,
  } = req.body;

  if (!brandId) {
    return res.status(400).json({ error: 'brandId is required to create a product' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Product title is required' });
  }

  try {
    // 1. Verify tenant owns this Brand Profile
    const [brandProfile] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!brandProfile) {
      return res.status(403).json({ error: 'Unauthorized: Brand profile not found or does not belong to your organization' });
    }

    // 2. Resolve or find base brand ID for foreign key in globalProducts
    let globalBrandId = brandId;
    const [existingGlobalBrand] = await db
      .select()
      .from(brands)
      .where(eq(brands.normalizedName, brandProfile.normalizedName))
      .limit(1);

    if (existingGlobalBrand) {
      globalBrandId = existingGlobalBrand.id;
    } else {
      // Create lightweight brand entry if not exists
      const [newGb] = await db
        .insert(brands)
        .values({
          name: brandProfile.name,
          normalizedName: brandProfile.normalizedName,
          officialWebsite: brandProfile.officialWebsite,
          organizationId: orgId,
          isVerified: true,
        })
        .returning();
      globalBrandId = newGb.id;
    }

    const cleanTitle = title.trim();
    const cleanModel = modelNumber ? String(modelNumber).trim() : null;
    const normModel = cleanModel ? cleanModel.toLowerCase().replace(/[^a-z0-9]/g, '') : null;

    // 3. Insert or update global product
    const [savedProduct] = await db
      .insert(globalProducts)
      .values({
        brandId: globalBrandId,
        canonicalTitle: cleanTitle,
        modelNumber: cleanModel,
        normalizedModel: normModel,
        standardizedDescription: description ? String(description).trim() : null,
        primaryImageUrl: primaryImageUrl || (Array.isArray(images) && images[0]) || null,
        confidenceScore: '1.00',
        verificationStatus: 'verified',
        sourcesCount: 1,
      })
      .returning();

    // 4. Map directly to customer/tenant catalog
    await db
      .insert(customerProductMappings)
      .values({
        organizationId: orgId,
        globalProductId: savedProduct.id,
        customerInternalSku: sku ? String(sku).trim() : cleanModel,
        syncStatus: 'active',
      })
      .onConflictDoUpdate({
        target: [customerProductMappings.organizationId, customerProductMappings.globalProductId],
        set: {
          customerInternalSku: sku ? String(sku).trim() : cleanModel,
          updatedAt: new Date(),
        },
      });

    // 5. Save tenant overrides for price, custom attributes, internal notes
    if (price || attributes || customData) {
      await db
        .insert(customerProductOverrides)
        .values({
          organizationId: orgId,
          globalProductId: savedProduct.id,
          customTitle: cleanTitle,
          customDescription: description ? String(description).trim() : null,
          customAttributes: {
            price: price || null,
            extractedAttributes: attributes || {},
            customFields: customData || {},
            productUrl: productUrl || null,
          },
        })
        .onConflictDoUpdate({
          target: [customerProductOverrides.organizationId, customerProductOverrides.globalProductId],
          set: {
            customTitle: cleanTitle,
            customDescription: description ? String(description).trim() : null,
            customAttributes: {
              price: price || null,
              extractedAttributes: attributes || {},
              customFields: customData || {},
              productUrl: productUrl || null,
            },
            updatedAt: new Date(),
          },
        });
    }

    // 6. Save images if provided
    if (Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imgUrl = images[i];
        if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          await db.insert(productImages).values({
            globalProductId: savedProduct.id,
            originUrl: imgUrl,
            storageUri: imgUrl,
            imageHash: `hash_${Date.now()}_${i}`,
            isPrimary: i === 0,
            sortOrder: i,
          }).catch(() => {});
        }
      }
    }

    // 7. Save SKU / Model identifier if provided
    if (sku) {
      await db.insert(productIdentifiers).values({
        globalProductId: savedProduct.id,
        idType: 'MANUFACTURER_SKU',
        idValue: String(sku).trim(),
        normalizedValue: String(sku).trim().toUpperCase(),
        confidence: '1.00',
        isPrimary: true,
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Product saved and mapped to your organization catalog successfully',
      product: savedProduct,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save product', details: err.message });
  }
});

// 1. Search Tenant-Scoped Products (Client Catalog with overrides and real brands)
productsRouter.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const query = req.query.q as string | undefined;
  const brandId = req.query.brandId as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
  const offset = parseInt((req.query.offset as string) || '0', 10);

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const conditions = [eq(customerProductMappings.organizationId, orgId)];

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      conditions.push(
        sql`(${globalProducts.canonicalTitle} ILIKE ${q} OR ${globalProducts.modelNumber} ILIKE ${q} OR ${customerProductOverrides.customTitle} ILIKE ${q})`
      );
    }

    if (brandId && brandId !== 'ALL') {
      conditions.push(eq(globalProducts.brandId, brandId));
    }

    const items = await db
      .select({
        id: globalProducts.id,
        mappingId: customerProductMappings.id,
        canonicalTitle: sql<string>`COALESCE(${customerProductOverrides.customTitle}, ${globalProducts.canonicalTitle})`,
        modelNumber: globalProducts.modelNumber,
        categoryPath: sql<string>`COALESCE(${customerProductOverrides.customCategory}, ${globalProducts.categoryPath})`,
        primaryImageUrl: globalProducts.primaryImageUrl,
        confidenceScore: globalProducts.confidenceScore,
        sourcesCount: globalProducts.sourcesCount,
        brandId: globalProducts.brandId,
        brandName: brands.name,
        customSku: customerProductMappings.customerInternalSku,
        customAttributes: customerProductOverrides.customAttributes,
        importedAt: customerProductMappings.importedAt,
        createdAt: globalProducts.createdAt,
      })
      .from(customerProductMappings)
      .innerJoin(globalProducts, eq(customerProductMappings.globalProductId, globalProducts.id))
      .leftJoin(brands, eq(globalProducts.brandId, brands.id))
      .leftJoin(
        customerProductOverrides,
        and(
          eq(customerProductOverrides.organizationId, customerProductMappings.organizationId),
          eq(customerProductOverrides.globalProductId, globalProducts.id)
        )
      )
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Format for client UI with clean non-hardcoded values
    const formatted = items.map((item) => {
      const customAttrs = (item.customAttributes as any) || {};
      const priceVal = customAttrs.price ? (String(customAttrs.price).startsWith('$') ? String(customAttrs.price) : `$${customAttrs.price}`) : null;

      return {
        id: item.id,
        mappingId: item.mappingId,
        canonicalTitle: item.canonicalTitle,
        modelNumber: item.modelNumber || item.customSku || null,
        gtinEan: item.customSku || null,
        categoryPath: item.categoryPath || 'General',
        primaryImageUrl: item.primaryImageUrl || null,
        brand: item.brandName || null,
        priceEstimate: priceVal,
        sourcesCount: item.sourcesCount || 1,
        variantsCount: 1,
        createdAt: item.createdAt,
      };
    });

    return res.json({
      data: formatted,
      pagination: { limit, offset, count: formatted.length },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch catalog', details: err.message });
  }
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

// 4. Get Detailed Product with Variants, Attributes, Identifiers, Images & Tenant Overrides
productsRouter.get('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const id = req.params.id as string;

  const [product] = await db
    .select({
      id: globalProducts.id,
      canonicalTitle: globalProducts.canonicalTitle,
      modelNumber: globalProducts.modelNumber,
      categoryPath: globalProducts.categoryPath,
      standardizedDescription: globalProducts.standardizedDescription,
      primaryImageUrl: globalProducts.primaryImageUrl,
      confidenceScore: globalProducts.confidenceScore,
      verificationStatus: globalProducts.verificationStatus,
      sourcesCount: globalProducts.sourcesCount,
      brandId: globalProducts.brandId,
      createdAt: globalProducts.createdAt,
      updatedAt: globalProducts.updatedAt,
      brandName: brands.name,
      brandWebsite: brands.officialWebsite,
    })
    .from(globalProducts)
    .leftJoin(brands, eq(globalProducts.brandId, brands.id))
    .where(eq(globalProducts.id, id))
    .limit(1);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Fetch overrides and mapping for this tenant
  let override: any = null;
  let mapping: any = null;
  if (orgId) {
    const [ov] = await db
      .select()
      .from(customerProductOverrides)
      .where(and(eq(customerProductOverrides.organizationId, orgId), eq(customerProductOverrides.globalProductId, id)))
      .limit(1);
    override = ov || null;

    const [mp] = await db
      .select()
      .from(customerProductMappings)
      .where(and(eq(customerProductMappings.organizationId, orgId), eq(customerProductMappings.globalProductId, id)))
      .limit(1);
    mapping = mp || null;
  }

  const [variants, identifiers, rawAttributes, images] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.globalProductId, id)),
    db.select().from(productIdentifiers).where(eq(productIdentifiers.globalProductId, id)),
    db.select().from(productAttributes).where(eq(productAttributes.globalProductId, id)),
    db.select().from(productImages).where(eq(productImages.globalProductId, id)),
  ]);

  // Merge tenant overrides with canonical data
  const customAttrs = (override?.customAttributes as any) || {};
  const extractedSpecs = customAttrs.extractedAttributes || {};
  const customFields = customAttrs.customFields || {};
  const price = customAttrs.price || null;
  const productUrl = customAttrs.productUrl || null;

  return res.json({
    product: {
      ...product,
      canonicalTitle: override?.customTitle || product.canonicalTitle,
      standardizedDescription: override?.customDescription || product.standardizedDescription,
      price: price ? (String(price).startsWith('$') ? String(price) : `$${price}`) : null,
      productUrl,
    },
    brandName: product.brandName || 'Traxxas',
    mapping,
    variants,
    identifiers,
    attributes: Object.keys(extractedSpecs).length > 0 ? extractedSpecs : rawAttributes,
    customFields,
    images: images.length > 0 ? images : (product.primaryImageUrl ? [{ originUrl: product.primaryImageUrl, storageUri: product.primaryImageUrl, isPrimary: true }] : []),
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
