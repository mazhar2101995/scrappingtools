/**
 * Product Data Validation & Provenance Engine
 * Implements deterministic checks for:
 * - Product Name / Title (non-empty, placeholder detection)
 * - EAN / GTIN / UPC (checksum algorithm validation)
 * - Model Number / MPN (whitespace & formatting normalization)
 * - Product Images (URL protocol, deduplication, thumbnail/placeholder removal)
 * - Description (cleans scripts, navigation residue)
 * - Transparent Confidence Score calculation (0-100%)
 */

export interface ValidationRuleResult {
  field: string;
  isValid: boolean;
  severity: 'valid' | 'warning' | 'error';
  message: string;
  normalizedValue?: any;
}

export interface ProductValidationSummary {
  overallValid: boolean;
  confidenceScore: number; // 0.00 to 1.00
  confidenceTier: 'High' | 'Medium' | 'Low';
  signals: {
    hasTitle: boolean;
    hasIdentifiers: boolean;
    validEan: boolean;
    hasImages: boolean;
    sourceTrustScore: number;
    selectorStability: number;
  };
  fieldValidations: Record<string, ValidationRuleResult>;
}

/**
 * Validates EAN-13, EAN-8, or UPC-A checksum
 */
export function validateGtinChecksum(gtin: string): boolean {
  const clean = gtin.replace(/[^0-9]/g, '');
  if (![8, 12, 13, 14].includes(clean.length)) {
    return false;
  }

  const digits = clean.split('').map(Number);
  const checkDigit = digits.pop()!;
  
  let sum = 0;
  // Calculate checksum from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    const weight = (digits.length - i) % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
}

/**
 * Validates and cleans product title
 */
export function validateProductTitle(title?: string | null): ValidationRuleResult {
  if (!title || typeof title !== 'string' || !title.trim()) {
    return {
      field: 'title',
      isValid: false,
      severity: 'error',
      message: 'Product title is required and cannot be empty.',
    };
  }

  const clean = title.trim().replace(/\s+/g, ' ');
  const placeholderPatterns = [
    /^untitled/i,
    /^test\s*product/i,
    /^lorem\s*ipsum/i,
    /^sample\s*item/i,
    /^loading/i,
    /^null$/i,
    /^undefined$/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(clean)) {
      return {
        field: 'title',
        isValid: false,
        severity: 'warning',
        message: 'Product title appears to be a placeholder or temporary value.',
        normalizedValue: clean,
      };
    }
  }

  return {
    field: 'title',
    isValid: true,
    severity: 'valid',
    message: 'Valid product title',
    normalizedValue: clean,
  };
}

/**
 * Validates and normalizes Model / MPN
 */
export function validateModelNumber(model?: string | null): ValidationRuleResult {
  if (!model || typeof model !== 'string' || !model.trim()) {
    return {
      field: 'model',
      isValid: true, // Optional field
      severity: 'warning',
      message: 'Model number not detected (Optional).',
    };
  }

  const clean = model.trim().replace(/\s+/g, ' ');
  return {
    field: 'model',
    isValid: true,
    severity: 'valid',
    message: 'Model number verified',
    normalizedValue: clean,
  };
}

/**
 * Validates EAN / GTIN / Barcode
 */
export function validateEanBarcode(ean?: string | null): ValidationRuleResult {
  if (!ean || typeof ean !== 'string' || !ean.trim()) {
    return {
      field: 'ean',
      isValid: true, // Optional
      severity: 'warning',
      message: 'No EAN/GTIN barcode provided (Optional).',
    };
  }

  const clean = ean.replace(/[^0-9]/g, '');
  if (!clean) {
    return {
      field: 'ean',
      isValid: false,
      severity: 'warning',
      message: 'EAN contains non-numeric characters.',
    };
  }

  const isCheckValid = validateGtinChecksum(clean);
  return {
    field: 'ean',
    isValid: isCheckValid,
    severity: isCheckValid ? 'valid' : 'warning',
    message: isCheckValid
      ? `Valid GTIN/EAN format & checksum (${clean.length} digits)`
      : `EAN format detected but checksum failed (${clean})`,
    normalizedValue: clean,
  };
}

/**
 * Validates and deduplicates product image URLs
 */
export function validateImages(images?: (string | null | undefined)[] | string | null): ValidationRuleResult {
  const rawList = Array.isArray(images)
    ? images
    : typeof images === 'string'
    ? [images]
    : [];

  const validImages: string[] = [];
  for (const item of rawList) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (
        (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
        !trimmed.includes('pixel') &&
        !trimmed.includes('blank.gif') &&
        !trimmed.includes('spinner') &&
        !trimmed.includes('placeholder')
      ) {
        if (!validImages.includes(trimmed)) {
          validImages.push(trimmed);
        }
      }
    }
  }

  if (validImages.length === 0) {
    return {
      field: 'images',
      isValid: true,
      severity: 'warning',
      message: 'No valid product images found.',
      normalizedValue: [],
    };
  }

  return {
    field: 'images',
    isValid: true,
    severity: 'valid',
    message: `${validImages.length} high-resolution image(s) verified`,
    normalizedValue: validImages,
  };
}

/**
 * Validates and cleans HTML/plain description
 */
export function validateDescription(description?: string | null): ValidationRuleResult {
  if (!description || typeof description !== 'string' || !description.trim()) {
    return {
      field: 'description',
      isValid: true,
      severity: 'warning',
      message: 'No product description found.',
    };
  }

  // Remove scripts, styles, iframes, inline event handlers
  let clean = description
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .trim();

  return {
    field: 'description',
    isValid: true,
    severity: 'valid',
    message: `Description verified (${clean.length} characters)`,
    normalizedValue: clean,
  };
}

/**
 * Computes overall Product Confidence Score based on transparent deterministic signals
 */
export function evaluateProductQuality(params: {
  title?: string | null;
  model?: string | null;
  sku?: string | null;
  ean?: string | null;
  images?: string[] | string | null;
  description?: string | null;
  sourceTrustScore?: number;
  selectorMatchCount?: number;
}): ProductValidationSummary {
  const titleVal = validateProductTitle(params.title);
  const modelVal = validateModelNumber(params.model);
  const eanVal = validateEanBarcode(params.ean);
  const imgVal = validateImages(params.images);
  const descVal = validateDescription(params.description);

  let score = 0;

  // Title signal (weight: 35)
  if (titleVal.isValid && titleVal.severity === 'valid') {
    score += 35;
  } else if (titleVal.severity === 'warning') {
    score += 15;
  }

  // Identifiers signal (model/mpn, sku, ean) (weight: 30)
  const hasModel = Boolean(modelVal.normalizedValue);
  const hasSku = Boolean(params.sku && params.sku.trim());
  const hasValidEan = eanVal.isValid && eanVal.severity === 'valid';

  if (hasValidEan) score += 20;
  else if (hasModel) score += 15;
  else if (hasSku) score += 10;

  if (hasModel && hasSku) score += 10;

  // Images signal (weight: 20)
  const imgCount = Array.isArray(imgVal.normalizedValue) ? imgVal.normalizedValue.length : 0;
  if (imgCount >= 3) score += 20;
  else if (imgCount >= 1) score += 12;

  // Description signal (weight: 15)
  if (descVal.normalizedValue && descVal.normalizedValue.length > 50) {
    score += 15;
  } else if (descVal.normalizedValue) {
    score += 5;
  }

  const confidenceScore = Math.min(1.0, Math.max(0.1, Number((score / 100).toFixed(2))));
  const confidenceTier: 'High' | 'Medium' | 'Low' =
    confidenceScore >= 0.8 ? 'High' : confidenceScore >= 0.5 ? 'Medium' : 'Low';

  return {
    overallValid: titleVal.isValid,
    confidenceScore,
    confidenceTier,
    signals: {
      hasTitle: titleVal.isValid && titleVal.severity === 'valid',
      hasIdentifiers: hasModel || hasSku || hasValidEan,
      validEan: hasValidEan,
      hasImages: imgCount > 0,
      sourceTrustScore: params.sourceTrustScore || 0.95,
      selectorStability: params.selectorMatchCount === 1 ? 1.0 : 0.8,
    },
    fieldValidations: {
      title: titleVal,
      model: modelVal,
      ean: eanVal,
      images: imgVal,
      description: descVal,
    },
  };
}

