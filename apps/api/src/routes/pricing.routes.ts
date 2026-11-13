import { Router, Request, Response } from 'express';
import { db, pricingRules, brands } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, requireOrgRole } from '../middleware/auth.middleware';
import { PricingEngineService } from '../services/pricing-engine.service';

export const pricingRouter = Router();

pricingRouter.use(authMiddleware);

// Helper to get organization ID
function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req as any).apiKey?.organizationId || null;
}

// GET /api/v1/pricing/rules - List all pricing rules for tenant
pricingRouter.get('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const list = await db
      .select({
        id: pricingRules.id,
        name: pricingRules.name,
        markupType: pricingRules.markupType,
        markupValue: pricingRules.markupValue,
        fixedShippingFee: pricingRules.fixedShippingFee,
        minMarginAmount: pricingRules.minMarginAmount,
        roundingMode: pricingRules.roundingMode,
        minSupplierPrice: pricingRules.minSupplierPrice,
        maxSupplierPrice: pricingRules.maxSupplierPrice,
        brandId: pricingRules.brandId,
        brandName: brands.name,
        isActive: pricingRules.isActive,
        priority: pricingRules.priority,
        createdAt: pricingRules.createdAt,
        updatedAt: pricingRules.updatedAt,
      })
      .from(pricingRules)
      .leftJoin(brands, eq(pricingRules.brandId, brands.id))
      .where(eq(pricingRules.organizationId, orgId))
      .orderBy(desc(pricingRules.priority), desc(pricingRules.createdAt));

    return res.json({ success: true, count: list.length, rules: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list pricing rules' });
  }
});

// POST /api/v1/pricing/rules - Create a new pricing rule
pricingRouter.post('/rules', requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const {
      name,
      markupType,
      markupValue,
      fixedShippingFee,
      minMarginAmount,
      roundingMode,
      minSupplierPrice,
      maxSupplierPrice,
      brandId,
      priority,
      isActive,
    } = req.body;

    if (!name || markupValue === undefined) {
      return res.status(400).json({ error: 'Rule name and markupValue are required' });
    }

    const [rule] = await db
      .insert(pricingRules)
      .values({
        organizationId: orgId,
        name: name.trim(),
        markupType: markupType || 'PERCENTAGE',
        markupValue: String(markupValue),
        fixedShippingFee: String(fixedShippingFee || '0.00'),
        minMarginAmount: minMarginAmount ? String(minMarginAmount) : null,
        roundingMode: roundingMode || 'PSYCHOLOGICAL_99',
        minSupplierPrice: minSupplierPrice ? String(minSupplierPrice) : null,
        maxSupplierPrice: maxSupplierPrice ? String(maxSupplierPrice) : null,
        brandId: brandId || null,
        priority: typeof priority === 'number' ? priority : 10,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      })
      .returning();

    return res.status(201).json({ success: true, rule });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create pricing rule' });
  }
});

// PUT /api/v1/pricing/rules/:id - Update an existing rule
pricingRouter.put('/rules/:id', requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = String(getOrgId(req));
    const ruleId = String(req.params.id);

    const {
      name,
      markupType,
      markupValue,
      fixedShippingFee,
      minMarginAmount,
      roundingMode,
      minSupplierPrice,
      maxSupplierPrice,
      brandId,
      priority,
      isActive,
    } = req.body;

    const [updated] = await db
      .update(pricingRules)
      .set({
        name: name ? name.trim() : undefined,
        markupType,
        markupValue: markupValue !== undefined ? String(markupValue) : undefined,
        fixedShippingFee: fixedShippingFee !== undefined ? String(fixedShippingFee) : undefined,
        minMarginAmount: minMarginAmount !== undefined ? (minMarginAmount ? String(minMarginAmount) : null) : undefined,
        roundingMode,
        minSupplierPrice: minSupplierPrice !== undefined ? (minSupplierPrice ? String(minSupplierPrice) : null) : undefined,
        maxSupplierPrice: maxSupplierPrice !== undefined ? (maxSupplierPrice ? String(maxSupplierPrice) : null) : undefined,
        brandId: brandId !== undefined ? (brandId ? brandId : null) : undefined,
        priority: typeof priority === 'number' ? priority : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(pricingRules.id, ruleId), eq(pricingRules.organizationId, orgId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    return res.json({ success: true, rule: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update pricing rule' });
  }
});

// DELETE /api/v1/pricing/rules/:id - Delete a rule
pricingRouter.delete('/rules/:id', requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = String(getOrgId(req));
    const ruleId = String(req.params.id);

    const [deleted] = await db
      .delete(pricingRules)
      .where(and(eq(pricingRules.id, ruleId), eq(pricingRules.organizationId, orgId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    return res.json({ success: true, message: `Rule "${deleted.name}" deleted successfully` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete pricing rule' });
  }
});

// POST /api/v1/pricing/simulate - Test and simulate price calculation
pricingRouter.post('/simulate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const { supplierPrice, brandId } = req.body;
    const priceNum = parseFloat(String(supplierPrice || '0'));

    const calculation = await PricingEngineService.calculatePrice({
      organizationId: orgId,
      supplierPrice: priceNum,
      brandId,
    });

    return res.json({ success: true, result: calculation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to simulate price calculation' });
  }
});
