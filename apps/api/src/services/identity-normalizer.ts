/**
 * Product Identity & Normalization Engine
 * 
 * Implements strict, deterministic normalization and comparison rules:
 * - Brand normalization (alphanumeric, lowercase, stripped special characters)
 * - Model number / MPN normalization (strips dashes, slashes, spaces)
 * - Barcode normalization (digits only, length check)
 * - Title normalization (lowercased, punctuation-cleaned, tokenized)
 * - Variant and Product Family difference detection (colors, dimensions, 'Ultimate' vs 'VXL', 'RTR' vs 'Kit')
 * - Conflict detection (conflicting GTINs or conflicting model numbers)
 */

export interface NormalizedIdentityCandidate {
  rawTitle: string;
  normalizedTitle: string;
  brandName?: string | null;
  normalizedBrand?: string | null;
  modelNumber?: string | null;
  normalizedModel?: string | null;
  mpn?: string | null;
  normalizedMpn?: string | null;
  gtin?: string | null;
  normalizedGtin?: string | null;
  sku?: string | null;
  normalizedSku?: string | null;
  colorVariant?: string | null;
  attributes?: Record<string, any>;
}

// Common color variations that define SKU variants rather than distinct product identities
const KNOWN_COLOR_VARIANTS = [
  'red', 'blue', 'green', 'black', 'white', 'orange', 'silver', 'yellow', 'grey', 'gray',
  'purple', 'pink', 'gold', 'clear', 'carbon', 'graphite', 'camo', 'fox', 'edition'
];

// Product family qualifiers that represent DIFFERENT physical models (NOT safe to merge)
const FAMILY_QUALIFIERS = [
  'ultimate', 'vxl', 'brushless', 'brushed', 'pro', 'elite', 'max', 'mini', 'micro',
  'rtr', 'kit', 'roller', 'chassis', 'body', 'suspension', 'parts', 'accessory', 'upgrade'
];

/**
 * Normalizes a brand name
 */
export function normalizeBrandName(brand?: string | null): string {
  if (!brand || typeof brand !== 'string') return '';
  return brand.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes an identifier (Model, MPN, SKU)
 */
export function normalizeIdentifier(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes barcode GTIN / EAN / UPC (numbers only)
 */
export function normalizeGtin(gtin?: string | null): string {
  if (!gtin || typeof gtin !== 'string') return '';
  return gtin.replace(/[^0-9]/g, '');
}

/**
 * Normalizes product title for comparison
 */
export function normalizeProductTitle(title: string): string {
  if (!title || typeof title !== 'string') return '';
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Detects if a title contains variant markers like color
 */
export function extractVariantMarkers(title: string): { color: string | null; keywords: string[] } {
  const norm = normalizeProductTitle(title);
  const tokens = norm.split(' ');
  let foundColor: string | null = null;
  const keywords: string[] = [];

  for (const t of tokens) {
    if (KNOWN_COLOR_VARIANTS.includes(t)) {
      if (!foundColor) foundColor = t;
    }
    if (FAMILY_QUALIFIERS.includes(t)) {
      keywords.push(t);
    }
  }

  return { color: foundColor, keywords };
}

/**
 * Calculates Jaccard / Token Similarity between two product titles
 */
export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const normA = normalizeProductTitle(titleA);
  const normB = normalizeProductTitle(titleB);

  if (normA === normB) return 1.0;

  const setA = new Set(normA.split(' ').filter(w => w.length > 1));
  const setB = new Set(normB.split(' ').filter(w => w.length > 1));

  if (setA.size === 0 || setB.size === 0) return 0.0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Checks for hard conflicts between two products (e.g. conflicting trusted GTINs or incompatible families)
 */
export function detectIdentityConflicts(candidateA: NormalizedIdentityCandidate, candidateB: NormalizedIdentityCandidate): {
  hasConflict: boolean;
  conflictReason: string | null;
} {
  // 1. Conflicting GTINs
  if (candidateA.normalizedGtin && candidateB.normalizedGtin && candidateA.normalizedGtin !== candidateB.normalizedGtin) {
    return {
      hasConflict: true,
      conflictReason: `Conflicting GTIN/EAN barcodes: "${candidateA.normalizedGtin}" vs "${candidateB.normalizedGtin}"`,
    };
  }

  // 2. Conflicting Models under the same brand
  if (
    candidateA.normalizedBrand &&
    candidateB.normalizedBrand &&
    candidateA.normalizedBrand === candidateB.normalizedBrand &&
    candidateA.normalizedModel &&
    candidateB.normalizedModel &&
    candidateA.normalizedModel !== candidateB.normalizedModel
  ) {
    // If models are distinctly different (e.g. 680864 vs 6804), it's a conflict
    return {
      hasConflict: true,
      conflictReason: `Distinct model numbers under same brand: "${candidateA.modelNumber}" vs "${candidateB.modelNumber}"`,
    };
  }

  // 3. Incompatible Product Family Qualifiers (e.g. "VXL" vs "Ultimate", or "RTR" vs "Kit")
  const varA = extractVariantMarkers(candidateA.rawTitle);
  const varB = extractVariantMarkers(candidateB.rawTitle);

  const criticalQualifiers = ['ultimate', 'vxl', 'kit', 'rtr', 'roller'];
  for (const q of criticalQualifiers) {
    const hasA = varA.keywords.includes(q);
    const hasB = varB.keywords.includes(q);
    if ((hasA && !hasB) || (!hasA && hasB)) {
      // One is VXL and the other is Ultimate (or Kit vs RTR)
      if (candidateA.rawTitle.length > 10 && candidateB.rawTitle.length > 10) {
        return {
          hasConflict: true,
          conflictReason: `Product family or build type mismatch: One has '${q}', the other does not.`,
        };
      }
    }
  }

  return { hasConflict: false, conflictReason: null };
}
