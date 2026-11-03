import { db } from '../index';
import {
  globalProducts,
  productIdentifiers,
  productVariants,
  customerProductMappings,
  customerProductOverrides,
  fieldProvenance,
  productVersions,
} from '../schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Deterministically match an incoming listing against global canonical products.
 * Never matches on ambiguous title strings alone.
 */
export async function matchProductByIdentifiers(params: {
  ean?: string;
  gtin?: string;
  upc?: string;
  brandId: string;
  mpn?: string;
  model?: string;
}) {
  // 1. Strict barcode matching (EAN / GTIN / UPC)
  const barcode = params.ean || params.gtin || params.upc;
  if (barcode) {
    const normalizedBarcode = barcode.trim();
    const [identifierMatch] = await db
      .select({
        globalProductId: productIdentifiers.globalProductId,
        variantId: productIdentifiers.productVariantId,
      })
      .from(productIdentifiers)
      .where(eq(productIdentifiers.normalizedValue, normalizedBarcode))
      .limit(1);

    if (identifierMatch) {
      return {
        matched: true,
        globalProductId: identifierMatch.globalProductId,
        variantId: identifierMatch.variantId,
        confidence: 1.0,
        strategy: 'STRICT_BARCODE',
      };
    }
  }

  // 2. Strict Brand + MPN (Manufacturer Part Number) matching
  if (params.brandId && params.mpn) {
    const normalizedMpn = params.mpn.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const [mpnMatch] = await db
      .select({
        globalProductId: productIdentifiers.globalProductId,
        variantId: productIdentifiers.productVariantId,
      })
      .from(productIdentifiers)
      .where(
        and(
          eq(productIdentifiers.idType, 'MPN'),
          eq(productIdentifiers.normalizedValue, normalizedMpn)
        )
      )
      .limit(1);

    if (mpnMatch) {
      return {
        matched: true,
        globalProductId: mpnMatch.globalProductId,
        variantId: mpnMatch.variantId,
        confidence: 0.95,
        strategy: 'BRAND_MPN',
      };
    }
  }

  // 3. Strict Brand + Normalized Model matching
  if (params.brandId && params.model) {
    const normalizedModel = params.model.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const [modelMatch] = await db
      .select({ id: globalProducts.id })
      .from(globalProducts)
      .where(
        and(
          eq(globalProducts.brandId, params.brandId),
          eq(globalProducts.normalizedModel, normalizedModel)
        )
      )
      .limit(1);

    if (modelMatch) {
      return {
        matched: true,
        globalProductId: modelMatch.id,
        variantId: null,
        confidence: 0.90,
        strategy: 'BRAND_NORMALIZED_MODEL',
      };
    }
  }

  return { matched: false, globalProductId: null, variantId: null, confidence: 0.0, strategy: 'NONE' };
}

/**
 * Fetch a customer's product catalog with tenant overrides merged seamlessly.
 * If tenant has a custom title or custom description, it overrides the global canonical value.
 */
export async function getTenantProductCatalog(organizationId: string, limit = 50) {
  return await db
    .select({
      mappingId: customerProductMappings.id,
      globalProductId: globalProducts.id,
      customerInternalSku: customerProductMappings.customerInternalSku,
      // Resolves to custom title if tenant set an override, otherwise global canonical title
      title: sql<string>`COALESCE(${customerProductOverrides.customTitle}, ${globalProducts.canonicalTitle})`,
      description: sql<string>`COALESCE(${customerProductOverrides.customDescription}, ${globalProducts.standardizedDescription})`,
      category: sql<string>`COALESCE(${customerProductOverrides.customCategory}, ${globalProducts.categoryPath})`,
      isOverridden: sql<boolean>`CASE WHEN ${customerProductOverrides.id} IS NOT NULL THEN true ELSE false END`,
      importedAt: customerProductMappings.importedAt,
    })
    .from(customerProductMappings)
    .innerJoin(globalProducts, eq(customerProductMappings.globalProductId, globalProducts.id))
    .leftJoin(
      customerProductOverrides,
      and(
        eq(customerProductOverrides.organizationId, customerProductMappings.organizationId),
        eq(customerProductOverrides.globalProductId, globalProducts.id)
      )
    )
    .where(eq(customerProductMappings.organizationId, organizationId))
    .limit(limit);
}

