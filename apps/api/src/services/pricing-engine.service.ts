import { db, pricingRules } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';

export interface CalculatedPriceResult {
  supplierPrice: number;
  calculatedPrice: number;
  appliedRuleId?: string;
  appliedRuleName?: string;
  marginAmount: number;
  marginPercent: number;
  breakdown: {
    baseMarkup: number;
    shippingFee: number;
    rawPrice: number;
    roundedPrice: number;
  };
}

export class PricingEngineService {
  /**
   * Calculate final retail store price from raw supplier price based on active tenant rules
   */
  static async calculatePrice(params: {
    organizationId: string;
    supplierPrice: number;
    brandId?: string;
  }): Promise<CalculatedPriceResult> {
    const { organizationId, supplierPrice, brandId } = params;

    if (!supplierPrice || isNaN(supplierPrice) || supplierPrice <= 0) {
      return {
        supplierPrice: 0,
        calculatedPrice: 0,
        marginAmount: 0,
        marginPercent: 0,
        breakdown: { baseMarkup: 0, shippingFee: 0, rawPrice: 0, roundedPrice: 0 },
      };
    }

    // Fetch active rules for the tenant sorted by priority descending
    const rules = await db
      .select()
      .from(pricingRules)
      .where(and(eq(pricingRules.organizationId, organizationId), eq(pricingRules.isActive, true)))
      .orderBy(desc(pricingRules.priority), desc(pricingRules.createdAt));

    let matchedRule: typeof rules[0] | null = null;

    for (const rule of rules) {
      // 1. Check brand constraint if rule specifies a brand
      if (rule.brandId && brandId && rule.brandId !== brandId) {
        continue;
      }

      // 2. Check supplier price range bounds
      if (rule.minSupplierPrice && supplierPrice < parseFloat(rule.minSupplierPrice)) {
        continue;
      }
      if (rule.maxSupplierPrice && supplierPrice > parseFloat(rule.maxSupplierPrice)) {
        continue;
      }

      matchedRule = rule;
      break;
    }

    if (!matchedRule) {
      // Default: Return supplier price without markup
      return {
        supplierPrice,
        calculatedPrice: supplierPrice,
        marginAmount: 0,
        marginPercent: 0,
        breakdown: {
          baseMarkup: 0,
          shippingFee: 0,
          rawPrice: supplierPrice,
          roundedPrice: supplierPrice,
        },
      };
    }

    const markupVal = parseFloat(matchedRule.markupValue || '0') || 0;
    const shippingFee = parseFloat(matchedRule.fixedShippingFee || '0') || 0;
    const minMargin = matchedRule.minMarginAmount ? parseFloat(matchedRule.minMarginAmount) : null;

    let baseMarkup = 0;
    if (matchedRule.markupType === 'PERCENTAGE') {
      baseMarkup = supplierPrice * (markupVal / 100);
    } else if (matchedRule.markupType === 'FIXED') {
      baseMarkup = markupVal;
    } else if (matchedRule.markupType === 'MULTIPLIER') {
      baseMarkup = supplierPrice * (markupVal - 1);
    }

    // Enforce minimum margin threshold if set
    if (minMargin !== null && baseMarkup < minMargin) {
      baseMarkup = minMargin;
    }

    const rawPrice = supplierPrice + baseMarkup + shippingFee;
    const roundedPrice = this.applyRounding(rawPrice, matchedRule.roundingMode);
    const finalMargin = roundedPrice - supplierPrice;
    const marginPercent = supplierPrice > 0 ? (finalMargin / supplierPrice) * 100 : 0;

    return {
      supplierPrice,
      calculatedPrice: roundedPrice,
      appliedRuleId: matchedRule.id,
      appliedRuleName: matchedRule.name,
      marginAmount: parseFloat(finalMargin.toFixed(2)),
      marginPercent: parseFloat(marginPercent.toFixed(2)),
      breakdown: {
        baseMarkup: parseFloat(baseMarkup.toFixed(2)),
        shippingFee: parseFloat(shippingFee.toFixed(2)),
        rawPrice: parseFloat(rawPrice.toFixed(2)),
        roundedPrice,
      },
    };
  }

  /**
   * Apply psychological or rounding strategies
   */
  private static applyRounding(price: number, mode: string): number {
    if (mode === 'PSYCHOLOGICAL_99') {
      // e.g. 19.45 -> 19.99, 20.00 -> 19.99, 20.80 -> 20.99
      const floor = Math.floor(price);
      return parseFloat((floor + 0.99).toFixed(2));
    }
    if (mode === 'PSYCHOLOGICAL_95') {
      const floor = Math.floor(price);
      return parseFloat((floor + 0.95).toFixed(2));
    }
    if (mode === 'NEAREST_WHOLE') {
      return Math.round(price);
    }
    // NONE
    return parseFloat(price.toFixed(2));
  }
}
