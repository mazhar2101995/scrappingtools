import {
  db,
  globalProducts,
  productIdentifiers,
  productImages,
  productAttributes,
  sourceWebsites,
  sourceProductListings,
  brands,
  tenantBrandProfiles,
  fieldProvenance,
} from '@saas/database';
import { eq, and, sql, or, desc, inArray } from 'drizzle-orm';
import { normalizeProductUrl } from '../utils/url-normalizer';
import { normalizeIdentifier, normalizeGtin, normalizeBrandName } from './identity-normalizer';
import { ProductIntelligenceService } from './product-intelligence.service';
import { validateGtinChecksum } from '../utils/validation';

export type DiscoveryInputType = 'URL' | 'IDENTIFIER' | 'STRUCTURED_SEARCH';

export interface ProductDiscoveryInput {
  type: DiscoveryInputType;
  value: string; // URL, Barcode, or Model Number
  brandHint?: string;
  organizationId: string;
}

export interface DiscoveredSourceCandidate {
  sourceWebsiteId?: string;
  sourceName: string;
  domain: string;
  sourceType: 'official_brand' | 'authorized_distributor' | 'marketplace' | 'supplier';
  trustScore: number;
  sampleProductUrl?: string;
  rankPriority: number;
  reason: string;
}

export interface ProductDiscoveryResult {
  status: 'FOUND_EXISTING' | 'SOURCE_DISCOVERED' | 'MULTIPLE_CANDIDATES' | 'NOT_FOUND' | 'INVALID_INPUT';
  inputType: DiscoveryInputType;
  canonicalProduct?: any;
  discoveredSources: DiscoveredSourceCandidate[];
  recommendedSource?: DiscoveredSourceCandidate;
  recommendationReason: string;
  reusedFromIntelligence: boolean;
  message: string;
}

export class ProductDiscoveryService {
  /**
   * Main Product Discovery Entrypoint
   * Evaluates input, checks Global Intelligence first, ranks available sources, and routes to acquisition.
   */
  public static async discoverProduct(input: ProductDiscoveryInput): Promise<ProductDiscoveryResult> {
    const { type, value, brandHint, organizationId } = input;

    if (!value || typeof value !== 'string' || !value.trim()) {
      return {
        status: 'INVALID_INPUT',
        inputType: type,
        discoveredSources: [],
        recommendationReason: 'Empty discovery input provided.',
        reusedFromIntelligence: false,
        message: 'A valid Product URL, EAN/GTIN barcode, or Model Number is required.',
      };
    }

    const trimmed = value.trim();

    // =========================================================================
    // BRANCH 1: PRODUCT URL DISCOVERY
    // =========================================================================
    if (type === 'URL' || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const norm = normalizeProductUrl(trimmed);
      if (!norm.isValid) {
        return {
          status: 'INVALID_INPUT',
          inputType: 'URL',
          discoveredSources: [],
          recommendationReason: 'Malformed URL format.',
          reusedFromIntelligence: false,
          message: 'The URL provided does not have a valid HTTP/HTTPS structure.',
        };
      }

      // Step 1: Check existing intelligence via Phase 1 Smart Reuse
      const lookup = await ProductIntelligenceService.lookupProduct({
        productUrl: norm.normalizedUrl,
        currentOrganizationId: organizationId,
      });

      if (lookup.decision === 'REUSE_EXISTING' && lookup.reusableProduct) {
        return {
          status: 'FOUND_EXISTING',
          inputType: 'URL',
          canonicalProduct: lookup.reusableProduct,
          discoveredSources: [],
          recommendationReason: `Verified product intelligence found for URL (${norm.normalizedDomain})`,
          reusedFromIntelligence: true,
          message: 'Existing high-confidence product intelligence found. Scraping avoided.',
        };
      }

      // Step 2: Discover and Rank Source Domain
      const [website] = await db
        .select()
        .from(sourceWebsites)
        .where(eq(sourceWebsites.domain, norm.normalizedDomain))
        .limit(1);

      let sourceCandidate: DiscoveredSourceCandidate;
      if (website) {
        sourceCandidate = {
          sourceWebsiteId: website.id,
          sourceName: website.name,
          domain: website.domain,
          sourceType: website.sourceType as any,
          trustScore: parseFloat(String(website.trustScore || '0.85')),
          sampleProductUrl: norm.normalizedUrl,
          rankPriority: website.sourceType === 'official_brand' ? 1 : website.sourceType === 'authorized_distributor' ? 2 : 3,
          reason: `Configured platform source with trust score ${website.trustScore}`,
        };
      } else {
        // Evaluate domain trust dynamically
        const isOfficialHint = brandHint && norm.normalizedDomain.includes(normalizeBrandName(brandHint));
        sourceCandidate = {
          sourceName: norm.normalizedDomain,
          domain: norm.normalizedDomain,
          sourceType: isOfficialHint ? 'official_brand' : 'authorized_distributor',
          trustScore: isOfficialHint ? 0.95 : 0.80,
          sampleProductUrl: norm.normalizedUrl,
          rankPriority: isOfficialHint ? 1 : 2,
          reason: isOfficialHint ? 'Domain directly matches specified brand' : 'Discovered public e-commerce domain',
        };
      }

      return {
        status: 'SOURCE_DISCOVERED',
        inputType: 'URL',
        discoveredSources: [sourceCandidate],
        recommendedSource: sourceCandidate,
        recommendationReason: sourceCandidate.reason,
        reusedFromIntelligence: false,
        message: `Trusted source discovered on domain ${norm.normalizedDomain}. Ready for extraction pipeline.`,
      };
    }

    // =========================================================================
    // BRANCH 2: PRODUCT IDENTIFIER DISCOVERY (EAN / GTIN / UPC / MPN / MODEL)
    // =========================================================================
    if (type === 'IDENTIFIER') {
      const cleanGtin = normalizeGtin(trimmed);
      const isBarcode = cleanGtin.length >= 8 && cleanGtin.length <= 14;

      // Validate Barcode Checksum only if 12, 13, or 14 digits strictly formatted
      if (isBarcode && [12, 13, 14].includes(cleanGtin.length)) {
        // If it starts with non-standard prefix or fails checksum, check if it exists in DB first before rejecting
        const [existingId] = await db
          .select({ globalProductId: productIdentifiers.globalProductId })
          .from(productIdentifiers)
          .where(eq(productIdentifiers.normalizedValue, cleanGtin))
          .limit(1);

        if (!existingId && !validateGtinChecksum(cleanGtin)) {
          return {
            status: 'INVALID_INPUT',
            inputType: 'IDENTIFIER',
            discoveredSources: [],
            recommendationReason: `Identifier '${cleanGtin}' failed GTIN/EAN mathematical checksum validation.`,
            reusedFromIntelligence: false,
            message: 'Invalid barcode checksum. Please check the digits and try again.',
          };
        }
      }

      // Step 1: Check Global Product Intelligence for this exact identifier
      const lookup = await ProductIntelligenceService.lookupProduct({
        ean: isBarcode ? cleanGtin : undefined,
        modelNumber: !isBarcode ? trimmed : undefined,
        currentOrganizationId: organizationId,
      });

      if (lookup.decision === 'REUSE_EXISTING' && lookup.reusableProduct) {
        return {
          status: 'FOUND_EXISTING',
          inputType: 'IDENTIFIER',
          canonicalProduct: lookup.reusableProduct,
          discoveredSources: [],
          recommendationReason: lookup.matchReason,
          reusedFromIntelligence: true,
          message: 'Verified canonical product intelligence found for this identifier.',
        };
      }

      // Step 2: Source Discovery for this Identifier
      // Query source websites and brand profiles configured for this brand or catalog
      const cleanBrand = normalizeBrandName(brandHint);
      let query = db.select().from(sourceWebsites);
      const availableWebsites = await query.limit(5);

      if (availableWebsites.length === 0) {
        return {
          status: 'NOT_FOUND',
          inputType: 'IDENTIFIER',
          discoveredSources: [],
          recommendationReason: 'No registered source websites configured for this brand identifier.',
          reusedFromIntelligence: false,
          message: 'No reliable sources currently configured for this product identifier.',
        };
      }

      // Rank available sources by trust score & official relationship
      const rankedSources: DiscoveredSourceCandidate[] = availableWebsites
        .map((w) => {
          const isOfficial = w.sourceType === 'official_brand' || (cleanBrand && w.domain.includes(cleanBrand));
          const trust = parseFloat(String(w.trustScore || '0.80'));
          return {
            sourceWebsiteId: w.id,
            sourceName: w.name,
            domain: w.domain,
            sourceType: isOfficial ? 'official_brand' : (w.sourceType as any),
            trustScore: isOfficial ? Math.max(trust, 0.95) : trust,
            rankPriority: isOfficial ? 1 : 2,
            reason: isOfficial ? 'Official brand website (Highest trust)' : 'Authorized commercial partner',
          };
        })
        .sort((a, b) => b.trustScore - a.trustScore);

      const topSource = rankedSources[0];

      return {
        status: 'SOURCE_DISCOVERED',
        inputType: 'IDENTIFIER',
        discoveredSources: rankedSources,
        recommendedSource: topSource,
        recommendationReason: `Recommended top trusted source: ${topSource.sourceName} (${topSource.reason})`,
        reusedFromIntelligence: false,
        message: `Identifier validated. ${rankedSources.length} potential sources ranked for acquisition.`,
      };
    }

    return {
      status: 'NOT_FOUND',
      inputType: type,
      discoveredSources: [],
      recommendationReason: 'Discovery parameters could not be resolved.',
      reusedFromIntelligence: false,
      message: 'No product information or source discovered.',
    };
  }
}
