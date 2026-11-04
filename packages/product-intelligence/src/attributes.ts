import { db, productAttributeDictionary } from '@saas/database';
import { eq, or } from 'drizzle-orm';

export interface NormalizedAttributeResult {
  canonicalKey: string;
  rawValue: any;
  normalizedValue: string;
  unit?: string;
  dataType: string;
}

export class AttributeNormalizerEngine {
  private static readonly UNIT_SYNONYMS: Record<string, { standardUnit: string; multiplier: number }> = {
    // Length to mm
    'mm': { standardUnit: 'mm', multiplier: 1 },
    'millimeter': { standardUnit: 'mm', multiplier: 1 },
    'millimeters': { standardUnit: 'mm', multiplier: 1 },
    'cm': { standardUnit: 'mm', multiplier: 10 },
    'centimeter': { standardUnit: 'mm', multiplier: 10 },
    'in': { standardUnit: 'mm', multiplier: 25.4 },
    'inch': { standardUnit: 'mm', multiplier: 25.4 },
    'inches': { standardUnit: 'mm', multiplier: 25.4 },
    '"': { standardUnit: 'mm', multiplier: 25.4 },

    // Weight to grams
    'g': { standardUnit: 'g', multiplier: 1 },
    'gram': { standardUnit: 'g', multiplier: 1 },
    'grams': { standardUnit: 'g', multiplier: 1 },
    'kg': { standardUnit: 'g', multiplier: 1000 },
    'kilogram': { standardUnit: 'g', multiplier: 1000 },
    'oz': { standardUnit: 'g', multiplier: 28.3495 },
    'ounce': { standardUnit: 'g', multiplier: 28.3495 },
    'lbs': { standardUnit: 'g', multiplier: 453.592 },
    'lb': { standardUnit: 'g', multiplier: 453.592 },
    'pound': { standardUnit: 'g', multiplier: 453.592 },

    // Speed to km/h
    'mph': { standardUnit: 'km/h', multiplier: 1.60934 },
    'km/h': { standardUnit: 'km/h', multiplier: 1 },
    'kph': { standardUnit: 'km/h', multiplier: 1 },
  };

  /**
   * Normalizes raw attribute key names and measurement values
   */
  public normalizeAttribute(rawKey: string, rawVal: any): NormalizedAttributeResult {
    const cleanKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const strVal = String(rawVal).trim();

    // 1. Check for numerical values with units (e.g., "60+ mph", "2.16 kg", "190mm")
    const match = strVal.match(/^([\d.,]+)\s*([a-zA-Z"\/]+)?/);
    if (match) {
      const numPart = parseFloat(match[1].replace(',', ''));
      const unitPart = match[2]?.toLowerCase();

      if (!isNaN(numPart) && unitPart && AttributeNormalizerEngine.UNIT_SYNONYMS[unitPart]) {
        const conv = AttributeNormalizerEngine.UNIT_SYNONYMS[unitPart];
        const normalizedVal = (numPart * conv.multiplier).toFixed(2);
        return {
          canonicalKey: this.mapCanonicalKey(cleanKey),
          rawValue: rawVal,
          normalizedValue: normalizedVal,
          unit: conv.standardUnit,
          dataType: 'number',
        };
      }
    }

    return {
      canonicalKey: this.mapCanonicalKey(cleanKey),
      rawValue: rawVal,
      normalizedValue: strVal,
      dataType: typeof rawVal === 'boolean' ? 'boolean' : 'string',
    };
  }

  private mapCanonicalKey(key: string): string {
    const keyMap: Record<string, string> = {
      weight: 'weight',
      product_weight: 'weight',
      item_weight: 'weight',
      drivetrain: 'drivetrain',
      drive_type: 'drivetrain',
      drive_system: 'drivetrain',
      motor: 'motor_type',
      motor_type: 'motor_type',
      esc: 'speed_control',
      speed_controller: 'speed_control',
      scale: 'scale',
      model_scale: 'scale',
      top_speed: 'top_speed',
      max_speed: 'top_speed',
      wheelbase: 'wheelbase',
      width: 'width',
      length: 'length',
    };

    return keyMap[key] || key;
  }
}

