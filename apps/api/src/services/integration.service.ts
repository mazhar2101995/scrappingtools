import {
  db,
  globalProducts,
  productIdentifiers,
  productAttributes,
  productImages,
  fieldProvenance,
  customerProductOverrides,
  webhookSubscriptions,
  webhookEvents,
  scrapingJobs,
} from '@saas/database';
import { eq, and, or, inArray, desc } from 'drizzle-orm';
import { ProductDiscoveryService } from './product-discovery.service';
import { ProductDataQualityService } from './product-quality.service';
import { scrapingQueue } from '@saas/queue';
import crypto from 'crypto';
import axios from 'axios';

export interface IntegrationLookupParams {
  identifier?: string;
  type?: string; // 'GTIN' | 'EAN' | 'UPC' | 'MPN' | 'SKU' | 'MODEL' | 'ID'
  organizationId: string;
}

export interface FormattedProductResponse {
  status: 'FOUND' | 'NOT_FOUND' | 'MULTIPLE_CANDIDATES' | 'REVIEW_REQUIRED';
  product?: {
    id: string;
    identity: {
      canonicalTitle: string;
      brandName: string | null;
      modelNumber: string | null;
      brandId: string | null;
    };
    content: {
      standardizedDescription: string | null;
      categoryPath: string[];
      attributes: Record<string, any>;
      images: Array<{
        id: string;
        url: string;
        isPrimary: boolean;
        width: number | null;
        height: number | null;
      }>;
    };
    identifiers: {
      gtin?: string;
      ean?: string;
      upc?: string;
      mpn?: string;
      sku?: string;
      all: Array<{ type: string; value: string }>;
    };
    tenantCustomizations?: {
      hasOverride: boolean;
      customTitle?: string;
      customDescription?: string;
      customPrice?: string;
      customAttributes?: Record<string, any>;
    };
  };
  quality: {
    status: string;
    score: number;
    completeness: number;
    reviewPriority: string | null;
    requiresReview: boolean;
    flaggedIssuesCount: number;
  };
  freshness: {
    lastVerifiedAt: string | null;
    freshnessDays: number;
    isStale: boolean;
    staleThresholdDays: number;
  };
  provenance: {
    sourcesCount: number;
    summary: string;
  };
  candidatesCount?: number;
  message?: string;
}

export class IntegrationService {
  /**
   * Safe, tenant-isolated Core Product Lookup API
   */
  static async lookupProduct(params: IntegrationLookupParams): Promise<FormattedProductResponse> {
    const { identifier, type, organizationId } = params;

    if (!identifier || !identifier.trim()) {
      return {
        status: 'NOT_FOUND',
        message: 'Identifier is required for lookup',
        quality: { status: 'UNKNOWN', score: 0, completeness: 0, reviewPriority: null, requiresReview: false, flaggedIssuesCount: 0 },
        freshness: { lastVerifiedAt: null, freshnessDays: 0, isStale: false, staleThresholdDays: 30 },
        provenance: { sourcesCount: 0, summary: 'No identifier provided' },
      };
    }

    const cleanId = identifier.trim();

    // 1. Check if lookup is by direct UUID
    let targetProductId: string | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    if (isUuid) {
      const [direct] = await db
        .select()
        .from(globalProducts)
        .where(eq(globalProducts.id, cleanId))
        .limit(1);

      if (direct) {
        targetProductId = direct.id;
      }
    }

    // 2. If not found by UUID, lookup by identifier in product_identifiers table
    if (!targetProductId) {
      const matchingIdentifiers = await db
        .select()
        .from(productIdentifiers)
        .where(
          type
            ? and(eq(productIdentifiers.idType, type.toUpperCase()), eq(productIdentifiers.normalizedValue, cleanId))
            : or(
                eq(productIdentifiers.normalizedValue, cleanId),
                eq(productIdentifiers.idValue, cleanId)
              )
        )
        .limit(10);

      if (matchingIdentifiers.length === 0) {
        // Also check model number in globalProducts
        const [byModel] = await db
          .select()
          .from(globalProducts)
          .where(eq(globalProducts.modelNumber, cleanId))
          .limit(2);

        if (byModel) {
          targetProductId = byModel.id;
        } else {
          return {
            status: 'NOT_FOUND',
            message: `No verified product found matching identifier '${cleanId}'`,
            quality: { status: 'UNKNOWN', score: 0, completeness: 0, reviewPriority: null, requiresReview: false, flaggedIssuesCount: 0 },
            freshness: { lastVerifiedAt: null, freshnessDays: 0, isStale: false, staleThresholdDays: 30 },
            provenance: { sourcesCount: 0, summary: 'Zero matching identifiers' },
          };
        }
      } else {
        const uniqueProductIds = Array.from(new Set(matchingIdentifiers.map((m) => m.globalProductId)));

        if (uniqueProductIds.length > 1) {
          return {
            status: 'MULTIPLE_CANDIDATES',
            candidatesCount: uniqueProductIds.length,
            message: `Identifier matches multiple potential global products (${uniqueProductIds.length}). Manual identity resolution or brand hint required.`,
            quality: { status: 'CONFLICT', score: 40, completeness: 0, reviewPriority: 'CRITICAL', requiresReview: true, flaggedIssuesCount: 1 },
            freshness: { lastVerifiedAt: null, freshnessDays: 0, isStale: false, staleThresholdDays: 30 },
            provenance: { sourcesCount: uniqueProductIds.length, summary: 'Ambiguous multi-product mapping' },
          };
        }

        targetProductId = uniqueProductIds[0];
      }
    }

    // 3. Load product entity
    const [product] = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.id, targetProductId))
      .limit(1);

    if (!product) {
      return {
        status: 'NOT_FOUND',
        message: 'Product entity could not be retrieved',
        quality: { status: 'UNKNOWN', score: 0, completeness: 0, reviewPriority: null, requiresReview: false, flaggedIssuesCount: 0 },
        freshness: { lastVerifiedAt: null, freshnessDays: 0, isStale: false, staleThresholdDays: 30 },
        provenance: { sourcesCount: 0, summary: 'Entity not found' },
      };
    }

    // 4. Load identifiers, attributes, and images
    const [identifiers, attributes, images, provenanceRecords] = await Promise.all([
      db.select().from(productIdentifiers).where(eq(productIdentifiers.globalProductId, product.id)),
      db.select().from(productAttributes).where(eq(productAttributes.globalProductId, product.id)),
      db.select().from(productImages).where(eq(productImages.globalProductId, product.id)),
      db.select().from(fieldProvenance).where(eq(fieldProvenance.globalProductId, product.id)),
    ]);

    // 5. Load tenant-specific override safely (Strict Tenant Isolation)
    const [tenantOverride] = await db
      .select()
      .from(customerProductOverrides)
      .where(
        and(
          eq(customerProductOverrides.organizationId, organizationId),
          eq(customerProductOverrides.globalProductId, product.id)
        )
      )
      .limit(1);

    // 6. Evaluate Quality using existing Phase 6 ProductDataQualityService
    const qualityReport = await ProductDataQualityService.evaluateProductQuality(product.id);

    // Format identifiers
    const idMap: Record<string, string> = {};
    identifiers.forEach((i) => {
      idMap[i.idType.toLowerCase()] = i.idValue;
    });

    const attrMap: Record<string, any> = {};
    attributes.forEach((a) => {
      attrMap[a.attributeKey] = a.normalizedValue || a.rawValue;
    });

    const isReviewRequired = qualityReport.overallStatus === 'CONFLICT' || qualityReport.overallStatus === 'NEEDS_REVIEW';

    let categoryList: string[] = [];
    if (product.categoryPath) {
      try {
        categoryList = product.categoryPath.startsWith('[')
          ? JSON.parse(product.categoryPath)
          : product.categoryPath.split('>').map((c) => c.trim());
      } catch (_) {
        categoryList = [product.categoryPath];
      }
    }

    return {
      status: isReviewRequired ? 'REVIEW_REQUIRED' : 'FOUND',
      product: {
        id: product.id,
        identity: {
          canonicalTitle: tenantOverride?.customTitle || product.canonicalTitle,
          brandName: null,
          modelNumber: product.modelNumber,
          brandId: product.brandId,
        },
        content: {
          standardizedDescription: tenantOverride?.customDescription || product.standardizedDescription,
          categoryPath: categoryList,
          attributes: attrMap,
          images: images.map((img) => ({
            id: img.id,
            url: img.originUrl,
            isPrimary: img.isPrimary,
            width: img.width,
            height: img.height,
          })),
        },
        identifiers: {
          gtin: idMap['gtin_14'] || idMap['gtin'],
          ean: idMap['ean_13'] || idMap['ean'],
          upc: idMap['upc_a'] || idMap['upc'],
          mpn: idMap['mpn'],
          sku: idMap['manufacturer_sku'] || idMap['sku'],
          all: identifiers.map((i) => ({ type: i.idType, value: i.idValue })),
        },
        tenantCustomizations: {
          hasOverride: !!tenantOverride,
          customTitle: tenantOverride?.customTitle || undefined,
          customDescription: tenantOverride?.customDescription || undefined,
          customPrice: (tenantOverride?.customAttributes as any)?.price || undefined,
          customAttributes: (tenantOverride?.customAttributes as any) || undefined,
        },
      },
      quality: {
        status: qualityReport.overallStatus,
        score: qualityReport.qualityScore,
        completeness: qualityReport.completenessScore,
        reviewPriority: qualityReport.reviewPriority,
        requiresReview: qualityReport.requiresReview,
        flaggedIssuesCount: qualityReport.reviewReasons.length,
      },
      freshness: {
        lastVerifiedAt: product.lastVerifiedAt ? product.lastVerifiedAt.toISOString() : null,
        freshnessDays: qualityReport.freshnessDays,
        isStale: qualityReport.isStale,
        staleThresholdDays: 30,
      },
      provenance: {
        sourcesCount: provenanceRecords.length,
        summary: `Aggregated across ${provenanceRecords.length} validated field provenance records`,
      },
    };
  }

  /**
   * Submit an async discovery request via existing ProductDiscoveryService and background queue
   */
  static async requestDiscovery(params: {
    identifierOrUrl: string;
    brandHint?: string;
    organizationId: string;
    webhookUrl?: string;
  }): Promise<{ status: 'PROCESSING' | 'COMPLETED'; jobId: string; message: string; result?: any }> {
    const { identifierOrUrl, brandHint, organizationId } = params;

    const isUrl = identifierOrUrl.startsWith('http://') || identifierOrUrl.startsWith('https://');

    // 1. If it's an exact identifier, test if already in intelligence
    if (!isUrl) {
      const existing = await this.lookupProduct({ identifier: identifierOrUrl, organizationId });
      if (existing.status === 'FOUND') {
        return {
          status: 'COMPLETED',
          jobId: `cached_${crypto.randomBytes(6).toString('hex')}`,
          message: 'Product already exists with high confidence in verified intelligence catalog',
          result: existing,
        };
      }
    }

    // 2. Run discovery assessment using existing ProductDiscoveryService
    const discovery = await ProductDiscoveryService.discoverProduct({
      type: isUrl ? 'URL' : 'IDENTIFIER',
      value: identifierOrUrl,
      brandHint,
      organizationId,
    });

    // 3. Enqueue background scraping/extraction job safely
    const [job] = await db
      .insert(scrapingJobs)
      .values({
        organizationId,
        targetUrl: isUrl ? identifierOrUrl : `discovery://auto-identifier/${encodeURIComponent(identifierOrUrl)}`,
        jobType: 'discovery_extraction',
        status: 'queued',
      })
      .returning();

    // Enqueue in BullMQ queue (safe abstraction)
    try {
      await scrapingQueue.add('product-discovery-job', {
        dbJobId: job.id,
        organizationId,
        targetUrl: job.targetUrl,
        sourceWebsiteId: 'discovery-source',
        domain: isUrl ? new URL(identifierOrUrl).hostname : 'discovery.engine',
        brandNormalized: brandHint || 'generic',
        sourceType: 'marketplace',
      });
    } catch (qErr) {
      // If queue is in standalone or test mode, job remains queued in DB
    }

    return {
      status: 'PROCESSING',
      jobId: job.id,
      message: 'Product discovery job has been securely accepted for background processing.',
    };
  }

  /**
   * Retrieve async discovery job status without exposing internal queue details
   */
  static async getJobStatus(jobId: string, organizationId: string): Promise<{
    jobId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    itemsExtracted: number;
    createdAt: string;
    completedAt: string | null;
    error?: string | null;
  } | null> {
    const [job] = await db
      .select()
      .from(scrapingJobs)
      .where(and(eq(scrapingJobs.id, jobId), eq(scrapingJobs.organizationId, organizationId)))
      .limit(1);

    if (!job) return null;

    let publicStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' = 'PENDING';
    if (job.status === 'processing' || job.status === 'running') publicStatus = 'RUNNING';
    else if (job.status === 'completed' || job.status === 'success') publicStatus = 'COMPLETED';
    else if (job.status === 'failed') publicStatus = 'FAILED';

    return {
      jobId: job.id,
      status: publicStatus,
      itemsExtracted: job.itemsExtracted || 0,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      error: job.errorMessage || null,
    };
  }

  /**
   * Register a tenant webhook subscription
   */
  static async registerWebhook(params: {
    organizationId: string;
    targetUrl: string;
    events: string[];
  }): Promise<{ id: string; targetUrl: string; secret: string; events: string[] }> {
    const { organizationId, targetUrl, events } = params;
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const [sub] = await db
      .insert(webhookSubscriptions)
      .values({
        organizationId,
        targetUrl,
        secret,
        events: events.length > 0 ? events : ['*'],
        isActive: true,
      })
      .returning();

    return {
      id: sub.id,
      targetUrl: sub.targetUrl,
      secret: sub.secret,
      events: sub.events as string[],
    };
  }

  /**
   * Dispatch a safe webhook event with HMAC-SHA256 signature
   */
  static async dispatchWebhookEvent(params: {
    organizationId: string;
    eventType: string;
    payload: Record<string, any>;
  }): Promise<{ deliveredCount: number; errors: string[] }> {
    const { organizationId, eventType, payload } = params;

    const subs = await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.organizationId, organizationId), eq(webhookSubscriptions.isActive, true)));

    let delivered = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      const allowedEvents = (sub.events as string[]) || ['*'];
      if (!allowedEvents.includes('*') && !allowedEvents.includes(eventType)) {
        continue;
      }

      // Record pending event in DB
      const [evtRecord] = await db
        .insert(webhookEvents)
        .values({
          organizationId,
          subscriptionId: sub.id,
          eventType,
          payload,
          status: 'pending',
          attemptCount: 1,
        })
        .returning();

      // Sign payload with HMAC SHA-256
      const payloadString = JSON.stringify({
        id: evtRecord.id,
        event: eventType,
        createdAt: new Date().toISOString(),
        data: payload,
      });

      const signature = crypto.createHmac('sha256', sub.secret).update(payloadString).digest('hex');

      try {
        await axios.post(sub.targetUrl, payloadString, {
          headers: {
            'Content-Type': 'application/json',
            'X-Signature-SHA256': signature,
            'X-Event-Type': eventType,
          },
          timeout: 4000,
        });

        await db
          .update(webhookEvents)
          .set({ status: 'delivered', deliveredAt: new Date() })
          .where(eq(webhookEvents.id, evtRecord.id));

        delivered++;
      } catch (err: any) {
        errors.push(`Target ${sub.targetUrl}: ${err.message}`);
        await db
          .update(webhookEvents)
          .set({ status: 'failed', lastError: err.message })
          .where(eq(webhookEvents.id, evtRecord.id));
      }
    }

    return { deliveredCount: delivered, errors };
  }
}
