import fs from 'fs';
import path from 'path';
import {
  db,
  globalMediaAssets,
  productImages,
  productImageTransformations,
  customerProductMappings,
  scrapingJobs,
  scrapingJobLogs,
  aiProcessingHistory,
  productVersions,
  sourceCache,
  systemStorageSettings,
  garbageCollectionLogs,
} from '@saas/database';
import { eq, sql, lt, and, inArray, desc, or, ne } from 'drizzle-orm';

export interface GcReport {
  id: string;
  runType: 'automatic' | 'manual';
  bytesReclaimed: number;
  filesDeleted: number;
  dbRecordsPruned: number;
  orphansMarked: number;
  details: {
    orphanedFilesRemoved?: string[];
    jobsPrunedCount?: number;
    aiHistoryPrunedCount?: number;
    versionsPrunedCount?: number;
    durationMs: number;
  };
  createdAt: string;
}

export class GarbageCollectionService {
  private static UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'products');

  /**
   * Resolve all active physical uploads directories across workspace roots
   */
  private static getUploadDirs(): string[] {
    const cwd = process.cwd();
    const dirs = [
      path.resolve(cwd, 'public', 'uploads', 'products'),
      path.resolve(cwd, 'apps', 'api', 'public', 'uploads', 'products'),
    ];
    return [...new Set(dirs)].filter((d) => fs.existsSync(d));
  }

  /**
   * Safely locate a physical file across known uploads paths
   */
  private static findPhysicalFilePath(filename: string): string | null {
    for (const dir of this.getUploadDirs()) {
      const p = path.join(dir, filename);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Get Current Platform Retention Settings
   */
  public static async getSettings() {
    const [settings] = await db
      .select()
      .from(systemStorageSettings)
      .where(eq(systemStorageSettings.id, 'default'))
      .limit(1);

    if (settings) return settings;

    // Default fallback
    const [created] = await db
      .insert(systemStorageSettings)
      .values({ id: 'default' })
      .onConflictDoNothing()
      .returning();

    return created || {
      id: 'default',
      tempDataRetentionHours: 24,
      failedJobRetentionDays: 14,
      completedJobRetentionHours: 24,
      aiHistoryRetentionDays: 30,
      orphanAssetGracePeriodDays: 7,
      maxProductVersions: 10,
      autoGcEnabled: true,
      lastGcRunAt: null,
    };
  }

  /**
   * Update Platform Retention Settings
   */
  public static async updateSettings(updates: Partial<{
    tempDataRetentionHours: number;
    failedJobRetentionDays: number;
    completedJobRetentionHours: number;
    aiHistoryRetentionDays: number;
    orphanAssetGracePeriodDays: number;
    maxProductVersions: number;
    autoGcEnabled: boolean;
  }>) {
    const [updated] = await db
      .insert(systemStorageSettings)
      .values({
        id: 'default',
        ...updates,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemStorageSettings.id,
        set: {
          ...updates,
          updatedAt: new Date(),
        },
      })
      .returning();

    return updated;
  }

  /**
   * Safe Orphan Asset Detection & Mark Process (Step 1 of 2)
   * Scans globalMediaAssets for assets that are NO LONGER referenced by any product_images
   * OR active AI Image Studio transformations (product_image_transformations).
   */
  public static async detectAndMarkOrphans(): Promise<number> {
    // 1. Recalculate reference counts from product_images table
    const referencedHashesRes = await db
      .select({
        imageHash: productImages.imageHash,
        count: sql<number>`count(*)::int`,
      })
      .from(productImages)
      .groupBy(productImages.imageHash);

    const refMap = new Map<string, number>();
    for (const row of referencedHashesRes) {
      if (row.imageHash) refMap.set(row.imageHash, row.count);
    }

    // 2. Fetch all active Studio transformations (status != 'FAILED')
    const activeTransformations = await db
      .select({
        originalUrl: productImageTransformations.originalUrl,
        cleanedUrl: productImageTransformations.cleanedUrl,
      })
      .from(productImageTransformations)
      .where(ne(productImageTransformations.status, 'FAILED'));

    const transformationUrlCounts = new Map<string, number>();
    for (const t of activeTransformations) {
      if (t.originalUrl) {
        const u = t.originalUrl.toLowerCase().trim();
        transformationUrlCounts.set(u, (transformationUrlCounts.get(u) || 0) + 1);
      }
      if (t.cleanedUrl) {
        const c = t.cleanedUrl.toLowerCase().trim();
        transformationUrlCounts.set(c, (transformationUrlCounts.get(c) || 0) + 1);
      }
    }

    // 3. Fetch all assets in global registry
    const allAssets = await db.select().from(globalMediaAssets);
    let newlyMarkedCount = 0;

    for (const asset of allAssets) {
      const hashCount = refMap.get(asset.contentHash) || 0;
      const origUrl = (asset.originalUrl || '').toLowerCase().trim();
      const canonUrl = (asset.canonicalUrl || '').toLowerCase().trim();
      const storageUri = (asset.storageUri || '').toLowerCase().trim();

      const transCount =
        (origUrl ? transformationUrlCounts.get(origUrl) || 0 : 0) +
        (canonUrl && canonUrl !== origUrl ? transformationUrlCounts.get(canonUrl) || 0 : 0) +
        (storageUri ? transformationUrlCounts.get(storageUri) || 0 : 0);

      const totalActiveReferences = hashCount + transCount;

      if (totalActiveReferences === 0) {
        // Unreferenced! If not already marked as orphan, mark it with timestamp
        if (asset.status !== 'orphan_candidate') {
          await db
            .update(globalMediaAssets)
            .set({
              referenceCount: 0,
              status: 'orphan_candidate',
              orphanMarkedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(globalMediaAssets.id, asset.id));

          newlyMarkedCount++;
        }
      } else {
        // Referenced! If previously marked as orphan candidate, restore to active
        if (asset.status === 'orphan_candidate' || asset.referenceCount !== totalActiveReferences) {
          await db
            .update(globalMediaAssets)
            .set({
              referenceCount: totalActiveReferences,
              status: 'active',
              orphanMarkedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(globalMediaAssets.id, asset.id));
        }
      }
    }

    return newlyMarkedCount;
  }

  /**
   * Run Full Storage Garbage Collection (Step 2 of 2)
   * Safely purges expired orphan files, pruned jobs, old AI payloads, and excessive versions.
   */
  public static async executeGarbageCollection(runType: 'automatic' | 'manual' = 'automatic'): Promise<GcReport> {
    const startTime = Date.now();
    const settings = await this.getSettings();

    let bytesReclaimed = 0;
    let filesDeleted = 0;
    let dbRecordsPruned = 0;
    const deletedFileNames: string[] = [];

    // --- PHASE 1: Detect and mark any newly orphaned assets ---
    const orphansMarked = await this.detectAndMarkOrphans();

    // --- PHASE 2: Purge Expired Orphan Assets whose Grace Period has Elapsed ---
    const graceCutoff = new Date(Date.now() - settings.orphanAssetGracePeriodDays * 24 * 60 * 60 * 1000);

    const expiredOrphans = await db
      .select()
      .from(globalMediaAssets)
      .where(
        and(
          eq(globalMediaAssets.status, 'orphan_candidate'),
          lt(globalMediaAssets.orphanMarkedAt, graceCutoff)
        )
      );

    for (const orphan of expiredOrphans) {
      // Final Safety Check: Verify once more across ALL reference sources before unlinking
      const [stillRefImage] = await db
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.imageHash, orphan.contentHash))
        .limit(1);

      const [stillRefTrans] = await db
        .select({ id: productImageTransformations.id })
        .from(productImageTransformations)
        .where(
          and(
            ne(productImageTransformations.status, 'FAILED'),
            or(
              eq(productImageTransformations.originalUrl, orphan.originalUrl),
              eq(productImageTransformations.originalUrl, orphan.canonicalUrl),
              eq(productImageTransformations.cleanedUrl, orphan.storageUri)
            )
          )
        )
        .limit(1);

      if (stillRefImage || stillRefTrans) {
        // Rescued! A reference is active in catalog or studio transformations. Restore to active!
        await db
          .update(globalMediaAssets)
          .set({
            referenceCount: (stillRefImage ? 1 : 0) + (stillRefTrans ? 1 : 0),
            status: 'active',
            orphanMarkedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(globalMediaAssets.id, orphan.id));
        continue;
      }

      // Safely unlink physical file from disk
      const filename = path.basename(orphan.storageUri);
      const physicalPath = this.findPhysicalFilePath(filename);

      if (physicalPath && fs.existsSync(physicalPath)) {
        try {
          const stats = fs.statSync(physicalPath);
          bytesReclaimed += stats.size;
          fs.unlinkSync(physicalPath);
          filesDeleted++;
          deletedFileNames.push(filename);
        } catch (unlinkErr) {
          console.warn(`[GC] Could not unlink ${physicalPath}:`, unlinkErr);
        }
      }

      // Delete from globalMediaAssets registry
      await db.delete(globalMediaAssets).where(eq(globalMediaAssets.id, orphan.id));
      dbRecordsPruned++;
    }

    // --- PHASE 3: Prune Completed and Failed Scraping Jobs ---
    const completedJobCutoffIso = new Date(Date.now() - settings.completedJobRetentionHours * 60 * 60 * 1000).toISOString();
    const failedJobCutoffIso = new Date(Date.now() - settings.failedJobRetentionDays * 24 * 60 * 60 * 1000).toISOString();

    // Delete associated scraping_job_logs first
    const staleJobs = await db
      .select({ id: scrapingJobs.id })
      .from(scrapingJobs)
      .where(
        sql`(${scrapingJobs.status} IN ('completed', 'success') AND ${scrapingJobs.completedAt} < ${completedJobCutoffIso}::timestamptz)
            OR (${scrapingJobs.status} = 'failed' AND ${scrapingJobs.createdAt} < ${failedJobCutoffIso}::timestamptz)`
      )
      .limit(500);

    let jobsPrunedCount = 0;
    if (staleJobs.length > 0) {
      const jobIds = staleJobs.map((j) => j.id);
      await db.delete(scrapingJobLogs).where(inArray(scrapingJobLogs.jobId, jobIds)).catch(() => {});
      const delJobs = await db.delete(scrapingJobs).where(inArray(scrapingJobs.id, jobIds));
      jobsPrunedCount = staleJobs.length;
      dbRecordsPruned += jobsPrunedCount;
    }

    // --- PHASE 4: Prune Stale AI Processing History ---
    const aiHistoryCutoff = new Date(Date.now() - settings.aiHistoryRetentionDays * 24 * 60 * 60 * 1000);
    const staleAiRes = await db
      .delete(aiProcessingHistory)
      .where(lt(aiProcessingHistory.executedAt, aiHistoryCutoff))
      .returning({ id: aiProcessingHistory.id })
      .catch(() => []);

    const aiHistoryPrunedCount = staleAiRes.length;
    dbRecordsPruned += aiHistoryPrunedCount;

    // --- PHASE 5: Prune Product Versions beyond Max Retention ---
    let versionsPrunedCount = 0;
    try {
      const distinctProducts = await db
        .select({ globalProductId: productVersions.globalProductId })
        .from(productVersions)
        .groupBy(productVersions.globalProductId);

      for (const prod of distinctProducts) {
        const versions = await db
          .select({ id: productVersions.id, versionNumber: productVersions.versionNumber })
          .from(productVersions)
          .where(eq(productVersions.globalProductId, prod.globalProductId))
          .orderBy(desc(productVersions.versionNumber));

        if (versions.length > settings.maxProductVersions) {
          const excessVersions = versions.slice(settings.maxProductVersions);
          const excessIds = excessVersions.map((v) => v.id);
          await db.delete(productVersions).where(inArray(productVersions.id, excessIds));
          versionsPrunedCount += excessIds.length;
          dbRecordsPruned += excessIds.length;
        }
      }
    } catch (_) {}

    // --- PHASE 6: Prune Expired Source Cache Records ---
    let sourceCachePrunedCount = 0;
    try {
      const expiredCacheRes = await db
        .delete(sourceCache)
        .where(lt(sourceCache.expiresAt, new Date()))
        .returning({ id: sourceCache.id })
        .catch(() => []);
      sourceCachePrunedCount = expiredCacheRes.length;
      dbRecordsPruned += sourceCachePrunedCount;
    } catch (_) {}

    const durationMs = Date.now() - startTime;

    // --- PHASE 6: Update Last GC Timestamp & Log Execution Details ---
    await db
      .update(systemStorageSettings)
      .set({
        lastGcRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(systemStorageSettings.id, 'default'));

    const [logEntry] = await db
      .insert(garbageCollectionLogs)
      .values({
        runType,
        bytesReclaimed,
        filesDeleted,
        dbRecordsPruned,
        details: {
          orphanedFilesRemoved: deletedFileNames,
          jobsPrunedCount,
          aiHistoryPrunedCount,
          versionsPrunedCount,
          durationMs,
        },
      })
      .returning();

    return {
      id: logEntry.id,
      runType,
      bytesReclaimed,
      filesDeleted,
      dbRecordsPruned,
      orphansMarked,
      details: {
        orphanedFilesRemoved: deletedFileNames,
        jobsPrunedCount,
        aiHistoryPrunedCount,
        versionsPrunedCount,
        durationMs,
      },
      createdAt: logEntry.createdAt.toISOString(),
    };
  }

  /**
   * Live Storage Telemetry & Metrics Aggregator for Admin Monitoring
   */
  public static async getStorageTelemetry() {
    // 1. Filesystem physical media usage (deduplicated across known physical directories)
    let physicalMediaBytes = 0;
    let physicalMediaFilesCount = 0;
    const seenFilenames = new Set<string>();

    for (const dir of this.getUploadDirs()) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (!seenFilenames.has(f)) {
            seenFilenames.add(f);
            const fp = path.join(dir, f);
            const stat = fs.statSync(fp);
            if (!stat.isDirectory()) {
              physicalMediaFilesCount++;
              physicalMediaBytes += stat.size;
            }
          }
        }
      } catch (_) {}
    }

    // 2. Global media assets statistics
    const [mediaStats] = await db
      .select({
        totalAssets: sql<number>`count(*)::int`,
        activeAssets: sql<number>`count(case when status = 'active' then 1 end)::int`,
        orphanCandidates: sql<number>`count(case when status = 'orphan_candidate' then 1 end)::int`,
        totalReferences: sql<number>`coalesce(sum(reference_count), 0)::int`,
      })
      .from(globalMediaAssets);

    // Calculate Storage Saved by Deduplication
    // (Total references - physical unique assets) * average file size
    const totalRefs = mediaStats?.totalReferences || 0;
    const uniqueAssets = mediaStats?.totalAssets || 1;
    const avgSizeBytes = uniqueAssets > 0 ? physicalMediaBytes / uniqueAssets : 0;
    const storageSavedBytes = Math.max(0, (totalRefs - uniqueAssets) * avgSizeBytes);

    // 3. Database Table Sizes
    const dbSizes = await db.execute(sql`
      SELECT relname AS table_name,
             pg_total_relation_size(relid) AS bytes,
             pg_size_pretty(pg_total_relation_size(relid)) AS pretty_size,
             n_live_tup AS live_rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 10;
    `);

    // 4. Recent Garbage Collection Activity Logs
    const recentLogs = await db
      .select()
      .from(garbageCollectionLogs)
      .orderBy(desc(garbageCollectionLogs.createdAt))
      .limit(10);

    const settings = await this.getSettings();

    // Determine System Health Status
    let healthStatus: 'Healthy' | 'Warning' | 'High Usage' | 'Critical' = 'Healthy';
    if (mediaStats?.orphanCandidates > 500) healthStatus = 'Warning';

    return {
      healthStatus,
      settings,
      physicalStorage: {
        mediaBytes: physicalMediaBytes,
        mediaFilesCount: physicalMediaFilesCount,
        storageSavedBytes: Math.round(storageSavedBytes),
        deduplicationRatio: uniqueAssets > 0 && totalRefs > 0 ? (totalRefs / uniqueAssets).toFixed(2) + 'x' : '1.00x',
      },
      registryStats: {
        totalAssets: mediaStats?.totalAssets || 0,
        activeAssets: mediaStats?.activeAssets || 0,
        orphanCandidates: mediaStats?.orphanCandidates || 0,
        totalReferences: totalRefs,
      },
      databaseStorage: {
        topTables: (dbSizes as any)?.rows || [],
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        runType: l.runType,
        bytesReclaimed: l.bytesReclaimed,
        filesDeleted: l.filesDeleted,
        dbRecordsPruned: l.dbRecordsPruned,
        details: l.details,
        createdAt: l.createdAt,
      })),
    };
  }
}
