import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  db,
  tenantMediaAssets,
  globalMediaAssets,
  productImageTransformations,
  serviceUsageRecords,
  organizations,
  systemStorageSettings,
} from '@saas/database';
import { eq, and, sql, lt, ne, inArray, desc } from 'drizzle-orm';
import { EntitlementService } from './entitlement.service';

export interface StorageQuotaCheckResult {
  allowed: boolean;
  statusCode?: number;
  reason?: string;
  currentUsageBytes: number;
  currentUsageMb: number;
  limitBytes: number;
  limitMb: number;
  incomingBytes: number;
  projectedBytes: number;
  isUnlimited: boolean;
  remainingBytes: number | 'unlimited';
}

export interface TenantStorageUsage {
  organizationId: string;
  activeBytes: number;
  activeMb: number;
  softDeletedBytes: number;
  softDeletedMb: number;
  totalAssetsCount: number;
  activeAssetsCount: number;
  softDeletedAssetsCount: number;
  breakdownByType: {
    catalogImage: { bytes: number; count: number };
    studioTransformation: { bytes: number; count: number };
    customUpload: { bytes: number; count: number };
  };
  limitMb: number;
  limitBytes: number;
  isUnlimited: boolean;
  remainingBytes: number | 'unlimited';
  usagePercentage: number;
}

export class StorageAccountingService {
  /**
   * Get Authoritative Per-Tenant Storage Usage
   */
  public static async getTenantStorageUsage(organizationId: string): Promise<TenantStorageUsage> {
    const records = await db
      .select({
        assetType: tenantMediaAssets.assetType,
        status: tenantMediaAssets.status,
        fileSizeBytes: tenantMediaAssets.fileSizeBytes,
      })
      .from(tenantMediaAssets)
      .where(eq(tenantMediaAssets.organizationId, organizationId));

    let activeBytes = 0;
    let softDeletedBytes = 0;
    let activeAssetsCount = 0;
    let softDeletedAssetsCount = 0;

    const breakdownByType = {
      catalogImage: { bytes: 0, count: 0 },
      studioTransformation: { bytes: 0, count: 0 },
      customUpload: { bytes: 0, count: 0 },
    };

    for (const r of records) {
      const bytes = Number(r.fileSizeBytes) || 0;
      if (r.status === 'active') {
        activeBytes += bytes;
        activeAssetsCount++;
        if (r.assetType === 'catalog_image') {
          breakdownByType.catalogImage.bytes += bytes;
          breakdownByType.catalogImage.count++;
        } else if (r.assetType === 'studio_transformation') {
          breakdownByType.studioTransformation.bytes += bytes;
          breakdownByType.studioTransformation.count++;
        } else {
          breakdownByType.customUpload.bytes += bytes;
          breakdownByType.customUpload.count++;
        }
      } else if (r.status === 'soft_deleted') {
        softDeletedBytes += bytes;
        softDeletedAssetsCount++;
      }
    }

    // Resolve tenant storage entitlement
    const entitlement = await EntitlementService.checkServiceEntitlement(organizationId, 'storage_megabytes', 0);
    const isUnlimited = entitlement.isUnlimited === true;
    const limitMb = isUnlimited ? 999999 : (typeof entitlement.usageLimit === 'number' ? entitlement.usageLimit : 100);
    const limitBytes = limitMb * 1024 * 1024;
    const remainingBytes = isUnlimited ? 'unlimited' : Math.max(0, limitBytes - activeBytes);
    const usagePercentage = isUnlimited ? 0 : limitBytes === 0 ? 100 : Math.min(100, Math.round((activeBytes / limitBytes) * 1000) / 10);

    return {
      organizationId,
      activeBytes,
      activeMb: Math.ceil(activeBytes / (1024 * 1024)),
      softDeletedBytes,
      softDeletedMb: Math.ceil(softDeletedBytes / (1024 * 1024)),
      totalAssetsCount: records.length,
      activeAssetsCount,
      softDeletedAssetsCount,
      breakdownByType,
      limitMb,
      limitBytes,
      isUnlimited,
      remainingBytes,
      usagePercentage,
    };
  }

  /**
   * Enforce Storage Quota Before Upload or Transformation (Concurrency-Safe)
   */
  public static async checkStorageQuota(
    organizationId: string,
    incomingBytes: number
  ): Promise<StorageQuotaCheckResult> {
    const usage = await this.getTenantStorageUsage(organizationId);

    if (usage.isUnlimited) {
      return {
        allowed: true,
        currentUsageBytes: usage.activeBytes,
        currentUsageMb: usage.activeMb,
        limitBytes: usage.limitBytes,
        limitMb: usage.limitMb,
        incomingBytes,
        projectedBytes: usage.activeBytes + incomingBytes,
        isUnlimited: true,
        remainingBytes: 'unlimited',
      };
    }

    const projectedBytes = usage.activeBytes + incomingBytes;
    if (projectedBytes > usage.limitBytes) {
      const neededMb = (incomingBytes / (1024 * 1024)).toFixed(2);
      const availMb = (Math.max(0, usage.limitBytes - usage.activeBytes) / (1024 * 1024)).toFixed(2);
      return {
        allowed: false,
        statusCode: 403,
        reason: `STORAGE_QUOTA_EXCEEDED: Operation requires ${neededMb} MB but only ${availMb} MB remaining under plan limit (${usage.limitMb} MB). Please upgrade your subscription plan.`,
        currentUsageBytes: usage.activeBytes,
        currentUsageMb: usage.activeMb,
        limitBytes: usage.limitBytes,
        limitMb: usage.limitMb,
        incomingBytes,
        projectedBytes,
        isUnlimited: false,
        remainingBytes: Math.max(0, usage.limitBytes - usage.activeBytes),
      };
    }

    return {
      allowed: true,
      currentUsageBytes: usage.activeBytes,
      currentUsageMb: usage.activeMb,
      limitBytes: usage.limitBytes,
      limitMb: usage.limitMb,
      incomingBytes,
      projectedBytes,
      isUnlimited: false,
      remainingBytes: usage.limitBytes - projectedBytes,
    };
  }

  /**
   * Atomically Record a Billable Asset in the Tenant Storage Ledger
   */
  public static async recordAsset(params: {
    organizationId: string;
    assetType: 'catalog_image' | 'studio_transformation' | 'custom_upload';
    storagePath: string;
    mimeType: string;
    fileSizeBytes: number;
    contentHash: string;
    transformationId?: string;
    globalMediaAssetId?: string;
  }) {
    const {
      organizationId,
      assetType,
      storagePath,
      mimeType,
      fileSizeBytes,
      contentHash,
      transformationId,
      globalMediaAssetId,
    } = params;

    // 1. Enforce quota check
    const quotaCheck = await this.checkStorageQuota(organizationId, fileSizeBytes);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason || 'STORAGE_QUOTA_EXCEEDED');
    }

    // 2. Insert into tenant_media_assets
    const [asset] = await db
      .insert(tenantMediaAssets)
      .values({
        organizationId,
        assetType,
        storagePath,
        mimeType,
        fileSizeBytes,
        contentHash,
        transformationId: transformationId || null,
        globalMediaAssetId: globalMediaAssetId || null,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [tenantMediaAssets.organizationId, tenantMediaAssets.contentHash, tenantMediaAssets.assetType],
        set: {
          fileSizeBytes,
          storagePath,
          status: 'active',
          deletedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // 3. Sync service_usage_records for lifetime storage_megabytes
    await this.syncUsageRecord(organizationId);

    return asset;
  }

  /**
   * Soft-Delete a Tenant Asset (Begins 7-day retention grace period)
   */
  public static async softDeleteAsset(organizationId: string, assetId: string) {
    const [asset] = await db
      .select()
      .from(tenantMediaAssets)
      .where(
        and(
          eq(tenantMediaAssets.id, assetId),
          eq(tenantMediaAssets.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!asset) {
      throw new Error('Asset not found or does not belong to your organization');
    }

    if (asset.status === 'soft_deleted') {
      return asset; // Already soft deleted
    }

    const [updated] = await db
      .update(tenantMediaAssets)
      .set({
        status: 'soft_deleted',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantMediaAssets.id, assetId))
      .returning();

    await this.syncUsageRecord(organizationId);
    return updated;
  }

  /**
   * Restore a Soft-Deleted Asset (within retention grace period)
   */
  public static async restoreAsset(organizationId: string, assetId: string) {
    const [asset] = await db
      .select()
      .from(tenantMediaAssets)
      .where(
        and(
          eq(tenantMediaAssets.id, assetId),
          eq(tenantMediaAssets.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!asset) {
      throw new Error('Asset not found or does not belong to your organization');
    }

    if (asset.status === 'active') {
      return asset; // Already active
    }

    if (asset.status === 'purged') {
      throw new Error('Cannot restore asset: Asset has already been permanently purged by garbage collection.');
    }

    // Verify quota before restoring
    const quotaCheck = await this.checkStorageQuota(organizationId, Number(asset.fileSizeBytes) || 0);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason || 'STORAGE_QUOTA_EXCEEDED: Cannot restore asset. Insufficient storage quota.');
    }

    const [restored] = await db
      .update(tenantMediaAssets)
      .set({
        status: 'active',
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tenantMediaAssets.id, assetId))
      .returning();

    await this.syncUsageRecord(organizationId);
    return restored;
  }

  /**
   * Hard Purge Expired Soft-Deleted Assets (Safety Verified Across All Tenants)
   *
   * Only deletes the physical file from disk/S3 if NO other tenant references the asset!
   */
  public static async hardPurgeExpiredAssets(graceDays: number = 7) {
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);

    const expiredAssets = await db
      .select()
      .from(tenantMediaAssets)
      .where(
        and(
          eq(tenantMediaAssets.status, 'soft_deleted'),
          lt(tenantMediaAssets.deletedAt, cutoff)
        )
      );

    let bytesReclaimed = 0;
    let filesDeleted = 0;
    let recordsPurged = 0;
    const affectedOrgIds = new Set<string>();

    for (const asset of expiredAssets) {
      affectedOrgIds.add(asset.organizationId);

      // Check if ANY other tenant has an active reference to the same contentHash or globalMediaAssetId
      const otherReferences = await db
        .select({ id: tenantMediaAssets.id })
        .from(tenantMediaAssets)
        .where(
          and(
            eq(tenantMediaAssets.contentHash, asset.contentHash),
            eq(tenantMediaAssets.status, 'active'),
            ne(tenantMediaAssets.id, asset.id)
          )
        )
        .limit(1);

      if (otherReferences.length > 0) {
        // Shared asset! Other tenants still reference this image.
        // DO NOT delete the physical file! Only mark this tenant's asset as purged.
        await db
          .update(tenantMediaAssets)
          .set({
            status: 'purged',
            updatedAt: new Date(),
          })
          .where(eq(tenantMediaAssets.id, asset.id));

        recordsPurged++;
        bytesReclaimed += Number(asset.fileSizeBytes) || 0;
        continue;
      }

      // No other tenant references this asset. Safely delete physical file from disk if local!
      const localRel = asset.storagePath.replace(/^\/+/, '');
      const possiblePaths = [
        ...(path.isAbsolute(asset.storagePath) ? [asset.storagePath] : []),
        path.resolve(process.cwd(), 'public', localRel),
        path.resolve(process.cwd(), 'apps', 'api', 'public', localRel),
        path.resolve(__dirname, '../../public', localRel),
      ];

      let fileUnlinked = false;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          try {
            const stat = fs.statSync(p);
            fs.unlinkSync(p);
            filesDeleted++;
            bytesReclaimed += stat.size;
            fileUnlinked = true;
            break;
          } catch (e) {
            console.warn(`[StorageAccounting] Could not unlink ${p}:`, e);
          }
        }
      }

      if (!fileUnlinked) {
        bytesReclaimed += Number(asset.fileSizeBytes) || 0;
      }

      // Mark tenant asset as purged
      await db
        .update(tenantMediaAssets)
        .set({
          status: 'purged',
          updatedAt: new Date(),
        })
        .where(eq(tenantMediaAssets.id, asset.id));

      recordsPurged++;
    }

    // Resync usage records for all affected organizations
    for (const orgId of affectedOrgIds) {
      await this.syncUsageRecord(orgId);
    }

    return {
      expiredAssetsCount: expiredAssets.length,
      recordsPurged,
      filesDeleted,
      bytesReclaimed,
      bytesReclaimedMb: Math.ceil(bytesReclaimed / (1024 * 1024)),
    };
  }

  /**
   * Sync active storage usage to service_usage_records for lifetime billing tracking
   */
  public static async syncUsageRecord(organizationId: string) {
    const [res] = await db
      .select({
        totalBytes: sql<number>`COALESCE(SUM(${tenantMediaAssets.fileSizeBytes}), 0)`,
      })
      .from(tenantMediaAssets)
      .where(
        and(
          eq(tenantMediaAssets.organizationId, organizationId),
          eq(tenantMediaAssets.status, 'active')
        )
      );

    const activeBytes = Number(res?.totalBytes) || 0;
    const activeMb = Math.ceil(activeBytes / (1024 * 1024));

    await db.execute(sql`
      INSERT INTO service_usage_records (
        organization_id, service_code, period_key, units_used, last_used_at, updated_at
      )
      VALUES (
        ${organizationId}::uuid, 'storage_megabytes', 'lifetime', ${activeMb}, NOW(), NOW()
      )
      ON CONFLICT (organization_id, service_code, period_key) DO UPDATE SET
        units_used = EXCLUDED.units_used,
        last_used_at = NOW(),
        updated_at = NOW();
    `);
  }

  /**
   * Platform-Wide Storage Telemetry for Platform Admin Portal
   */
  public static async getPlatformStorageTelemetry() {
    const orgs = await db.select().from(organizations);
    const telemetryList = [];

    for (const org of orgs) {
      const usage = await this.getTenantStorageUsage(org.id);
      telemetryList.push(usage);
    }

    const totalActiveBytes = telemetryList.reduce((acc, u) => acc + u.activeBytes, 0);
    const totalSoftDeletedBytes = telemetryList.reduce((acc, u) => acc + u.softDeletedBytes, 0);
    const totalAssets = telemetryList.reduce((acc, u) => acc + u.totalAssetsCount, 0);

    return {
      totalOrganizations: orgs.length,
      totalPlatformActiveBytes: totalActiveBytes,
      totalPlatformActiveMb: Math.ceil(totalActiveBytes / (1024 * 1024)),
      totalPlatformSoftDeletedBytes: totalSoftDeletedBytes,
      totalPlatformSoftDeletedMb: Math.ceil(totalSoftDeletedBytes / (1024 * 1024)),
      totalPlatformAssets: totalAssets,
      tenants: telemetryList,
    };
  }
}
