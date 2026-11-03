import { Router, Request, Response } from 'express';
import { db, brands, brandScrapingProfiles, sourceWebsites } from '@saas/database';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';

export const brandsRouter = Router();
brandsRouter.use(authMiddleware);

// 1. List Brands
brandsRouter.get('/', async (req: Request, res: Response) => {
  const brandList = await db.select().from(brands).limit(100);
  return res.json({ brands: brandList });
});

// 2. Get Brand Profiles
brandsRouter.get('/:id/profiles', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const profiles = await db
    .select({
      id: brandScrapingProfiles.id,
      brandId: brandScrapingProfiles.brandId,
      sourceWebsiteId: brandScrapingProfiles.sourceWebsiteId,
      profileVersion: brandScrapingProfiles.profileVersion,
      isActive: brandScrapingProfiles.isActive,
      selectorConfig: brandScrapingProfiles.selectorConfig,
      sourceDomain: sourceWebsites.domain,
    })
    .from(brandScrapingProfiles)
    .innerJoin(sourceWebsites, eq(brandScrapingProfiles.sourceWebsiteId, sourceWebsites.id))
    .where(eq(brandScrapingProfiles.brandId, id));

  return res.json({ brandId: id, profiles });
});
