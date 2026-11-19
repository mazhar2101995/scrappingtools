import { db, automatedSyncSchedules, connectedStores, brands, globalProducts, storeProductMappings } from '@saas/database';
import { eq, and, sql, lte, desc } from 'drizzle-orm';
import { StoreExportExecutionService } from './store-export-execution.service';
import { storeSyncQueue, createRedisConnection } from '@saas/queue';

export interface CreateScheduleInput {
  organizationId: string;
  name: string;
  scheduleType?: 'STORE_PUSH' | 'SCRAPE_REFRESH' | 'BIDIRECTIONAL';
  frequency: 'HOURLY' | 'EVERY_6_HOURS' | 'DAILY' | 'WEEKLY';
  storeId?: string;
  brandId?: string;
  targetLanguage?: string;
  autoTranslate?: boolean;
}

export class BackgroundSyncSchedulerService {
  /**
   * Calculate next run timestamp from frequency with missed schedule recovery
   * and server-timezone-independent UTC / local timezone DST awareness.
   */
  public static calculateNextRun(
    frequency: string,
    fromDate = new Date(),
    ensureFuture = true,
    timeZone: string = 'UTC'
  ): Date {
    let next = new Date(fromDate);

    const step = () => {
      if (!timeZone || timeZone === 'UTC') {
        switch (frequency) {
          case 'HOURLY':
            next.setUTCHours(next.getUTCHours() + 1);
            break;
          case 'EVERY_6_HOURS':
            next.setUTCHours(next.getUTCHours() + 6);
            break;
          case 'WEEKLY':
            next.setUTCDate(next.getUTCDate() + 7);
            break;
          case 'DAILY':
          default:
            next.setUTCDate(next.getUTCDate() + 1);
            break;
        }
      } else {
        // Timezone-aware stepping preserving local wall-clock time in target timeZone
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        const parts = formatter.formatToParts(next).reduce((acc: any, p) => {
          acc[p.type] = p.value;
          return acc;
        }, {});

        let y = parseInt(parts.year, 10);
        let m = parseInt(parts.month, 10) - 1;
        let d = parseInt(parts.day, 10);
        let h = parseInt(parts.hour, 10);
        let min = parseInt(parts.minute, 10);
        let s = parseInt(parts.second, 10);

        switch (frequency) {
          case 'HOURLY':
            h += 1;
            break;
          case 'EVERY_6_HOURS':
            h += 6;
            break;
          case 'WEEKLY':
            d += 7;
            break;
          case 'DAILY':
          default:
            d += 1;
            break;
        }

        const candidateUtc = new Date(Date.UTC(y, m, d, h, min, s));
        const candParts = formatter.formatToParts(candidateUtc).reduce((acc: any, p) => {
          acc[p.type] = p.value;
          return acc;
        }, {});
        const candLocalAsUtc = Date.UTC(
          parseInt(candParts.year, 10),
          parseInt(candParts.month, 10) - 1,
          parseInt(candParts.day, 10),
          parseInt(candParts.hour, 10),
          parseInt(candParts.minute, 10),
          parseInt(candParts.second, 10)
        );
        const targetLocalAsUtc = Date.UTC(y, m, d, h, min, s);
        const diff = candLocalAsUtc - targetLocalAsUtc;
        next = new Date(candidateUtc.getTime() - diff);
      }
    };

    step();

    if (ensureFuture) {
      const now = new Date();
      let safetyCounter = 0;
      while (next <= now && safetyCounter < 500) {
        step();
        safetyCounter++;
      }
    }

    return next;
  }

  /**
   * List all schedules for an organization
   */
  public static async listSchedules(organizationId: string) {
    const list = await db
      .select({
        id: automatedSyncSchedules.id,
        name: automatedSyncSchedules.name,
        scheduleType: automatedSyncSchedules.scheduleType,
        frequency: automatedSyncSchedules.frequency,
        storeId: automatedSyncSchedules.storeId,
        storeName: connectedStores.storeName,
        platformType: connectedStores.platformType,
        brandId: automatedSyncSchedules.brandId,
        brandName: brands.name,
        targetLanguage: automatedSyncSchedules.targetLanguage,
        autoTranslate: automatedSyncSchedules.autoTranslate,
        status: automatedSyncSchedules.status,
        lastRunAt: automatedSyncSchedules.lastRunAt,
        lastRunStatus: automatedSyncSchedules.lastRunStatus,
        lastRunSummary: automatedSyncSchedules.lastRunSummary,
        nextRunAt: automatedSyncSchedules.nextRunAt,
        createdAt: automatedSyncSchedules.createdAt,
      })
      .from(automatedSyncSchedules)
      .leftJoin(connectedStores, eq(automatedSyncSchedules.storeId, connectedStores.id))
      .leftJoin(brands, eq(automatedSyncSchedules.brandId, brands.id))
      .where(eq(automatedSyncSchedules.organizationId, organizationId))
      .orderBy(sql`${automatedSyncSchedules.createdAt} DESC`);

    return list;
  }

  /**
   * Create a new automated schedule
   */
  public static async createSchedule(input: CreateScheduleInput) {
    const nextRun = this.calculateNextRun(input.frequency);

    const [created] = await db
      .insert(automatedSyncSchedules)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        scheduleType: input.scheduleType || 'STORE_PUSH',
        frequency: input.frequency,
        storeId: input.storeId || null,
        brandId: input.brandId || null,
        targetLanguage: input.targetLanguage || 'en',
        autoTranslate: input.autoTranslate ?? true,
        status: 'ACTIVE',
        nextRunAt: nextRun,
      })
      .returning();

    return created;
  }

  /**
   * Update schedule status (Pause / Resume / Frequency)
   */
  public static async updateSchedule(
    id: string,
    organizationId: string,
    updates: {
      name?: string;
      frequency?: 'HOURLY' | 'EVERY_6_HOURS' | 'DAILY' | 'WEEKLY';
      status?: 'ACTIVE' | 'PAUSED';
      targetLanguage?: string;
    }
  ) {
    const valuesToUpdate: any = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) valuesToUpdate.name = updates.name;
    if (updates.status !== undefined) valuesToUpdate.status = updates.status;
    if (updates.targetLanguage !== undefined) valuesToUpdate.targetLanguage = updates.targetLanguage;
    if (updates.frequency !== undefined) {
      valuesToUpdate.frequency = updates.frequency;
      valuesToUpdate.nextRunAt = this.calculateNextRun(updates.frequency);
    }

    const [updated] = await db
      .update(automatedSyncSchedules)
      .set(valuesToUpdate)
      .where(and(eq(automatedSyncSchedules.id, id), eq(automatedSyncSchedules.organizationId, organizationId)))
      .returning();

    return updated;
  }

  /**
   * Delete an automated schedule
   */
  public static async deleteSchedule(id: string, organizationId: string) {
    const [deleted] = await db
      .delete(automatedSyncSchedules)
      .where(and(eq(automatedSyncSchedules.id, id), eq(automatedSyncSchedules.organizationId, organizationId)))
      .returning();

    return deleted;
  }

  /**
   * Execute a schedule immediately (Manual trigger or Cron worker)
   */
  public static async executeScheduleNow(scheduleId: string, organizationId?: string) {
    const queryConditions = [eq(automatedSyncSchedules.id, scheduleId)];
    if (organizationId) {
      queryConditions.push(eq(automatedSyncSchedules.organizationId, organizationId));
    }

    const [schedule] = await db
      .select()
      .from(automatedSyncSchedules)
      .where(and(...queryConditions));

    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    console.log(`[SyncScheduler] Executing schedule "${schedule.name}" (${schedule.id})...`);

    let executionStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' = 'SUCCESS';
    let summaryText = '';

    try {
      if (schedule.scheduleType === 'STORE_PUSH') {
        if (!schedule.storeId) {
          throw new Error('Target store is not configured for this schedule.');
        }

        // Readiness & Capability Gating for Scheduled Operations
        const { StoreDiagnosticsService } = await import('./store-diagnostics.service');
        try {
          await StoreDiagnosticsService.assertStoreCapability(schedule.storeId, schedule.organizationId, 'SCHEDULED_SYNC');
        } catch (gateErr: any) {
          console.warn(`[SyncScheduler] Schedule ${schedule.id} blocked by store readiness: ${gateErr.message}`);
          await db
            .update(automatedSyncSchedules)
            .set({
              lastRunStatus: 'FAILED',
              lastRunSummary: `Blocked by readiness gating: ${gateErr.message} (Code: ${gateErr.code || 'STORE_CAPABILITY_NOT_VERIFIED'})`,
              lastRunAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(automatedSyncSchedules.id, schedule.id));

          return {
            scheduleId: schedule.id,
            executionStatus: 'FAILED',
            summary: `Blocked by store readiness gating: ${gateErr.message}`,
          };
        }

        // Fetch products matching the brand (or all org products if no brand specified)
        let targetProducts: { id: string }[] = [];
        if (schedule.brandId) {
          targetProducts = await db
            .select({ id: globalProducts.id })
            .from(globalProducts)
            .innerJoin(brands, eq(globalProducts.brandId, brands.id))
            .where(
              and(
                eq(brands.organizationId, schedule.organizationId),
                eq(globalProducts.brandId, schedule.brandId)
              )
            );
        } else {
          targetProducts = await db
            .select({ id: globalProducts.id })
            .from(globalProducts)
            .innerJoin(brands, eq(globalProducts.brandId, brands.id))
            .where(eq(brands.organizationId, schedule.organizationId));
        }

        if (targetProducts.length === 0) {
          summaryText = 'No eligible products found matching schedule brand filters.';
        } else {
          const productIds = targetProducts.map((p) => p.id);
          const pushResult = await StoreExportExecutionService.executeBulkControlledPush(
            schedule.organizationId,
            productIds,
            schedule.storeId,
            schedule.targetLanguage || 'en'
          );

          const { succeededCount, failedCount, totalRequested } = pushResult;
          if (failedCount === 0) {
            executionStatus = 'SUCCESS';
            summaryText = `Successfully exported ${succeededCount} of ${totalRequested} products to store.`;
          } else if (succeededCount > 0) {
            executionStatus = 'PARTIAL';
            summaryText = `Partially completed: ${succeededCount} succeeded, ${failedCount} failed out of ${totalRequested}.`;
          } else {
            executionStatus = 'FAILED';
            summaryText = `All ${failedCount} products failed export. Check store credentials and logs.`;
          }
        }
      } else {
        summaryText = `Schedule type "${schedule.scheduleType}" executed successfully.`;
      }
    } catch (err: any) {
      executionStatus = 'FAILED';
      summaryText = `Execution failed: ${err.message || 'Unknown error'}`;
      console.error(`[SyncScheduler] Error during schedule execution:`, err);
    }

    // Update schedule last run & next run timestamp
    const nextRun = this.calculateNextRun(schedule.frequency);
    const [updated] = await db
      .update(automatedSyncSchedules)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: executionStatus,
        lastRunSummary: summaryText,
        nextRunAt: nextRun,
        updatedAt: new Date(),
      })
      .where(eq(automatedSyncSchedules.id, schedule.id))
      .returning();

    return {
      schedule: updated,
      status: executionStatus,
      summary: summaryText,
    };
  }

  /**
   * Primary Scheduler Runner: Scans due schedules across all active tenants,
   * claims distributed locks, advances recurrence timestamps, and dispatches jobs to BullMQ.
   */
  public static async runDueSchedules(): Promise<{
    scanned: number;
    dispatched: number;
    skipped: number;
    errors: number;
  }> {
    const now = new Date();
    const redis = createRedisConnection();

    try {
      // 1. Fetch active schedules whose nextRunAt has arrived
      const dueSchedules = await db
        .select()
        .from(automatedSyncSchedules)
        .where(
          and(
            eq(automatedSyncSchedules.status, 'ACTIVE'),
            lte(automatedSyncSchedules.nextRunAt, now)
          )
        )
        .limit(50);

      if (dueSchedules.length === 0) {
        return { scanned: 0, dispatched: 0, skipped: 0, errors: 0 };
      }

      console.log(`[SyncScheduler] Found ${dueSchedules.length} due schedules to process.`);
      let dispatched = 0;
      let skipped = 0;
      let errors = 0;

      for (const sched of dueSchedules) {
        try {
          // 2. Validate connected store
          if (!sched.storeId) {
            console.warn(`[SyncScheduler] Schedule ${sched.id} has no store configured, marking failed.`);
            const nextRun = this.calculateNextRun(sched.frequency, sched.nextRunAt || now);
            await db
              .update(automatedSyncSchedules)
              .set({
                lastRunAt: now,
                lastRunStatus: 'FAILED',
                lastRunSummary: 'Execution skipped: Target store is not configured for this schedule.',
                nextRunAt: nextRun,
                updatedAt: now,
              })
              .where(eq(automatedSyncSchedules.id, sched.id));
            skipped++;
            continue;
          }

          const [store] = await db
            .select({ id: connectedStores.id, status: connectedStores.status })
            .from(connectedStores)
            .where(
              and(
                eq(connectedStores.id, sched.storeId),
                eq(connectedStores.organizationId, sched.organizationId)
              )
            )
            .limit(1);

          const isStoreActive = store && (store.status === 'active' || store.status === 'connected');
          if (!isStoreActive) {
            console.warn(`[SyncScheduler] Store ${sched.storeId} is inactive or missing for schedule ${sched.id}`);
            const nextRun = this.calculateNextRun(sched.frequency, sched.nextRunAt || now);
            await db
              .update(automatedSyncSchedules)
              .set({
                lastRunAt: now,
                lastRunStatus: 'FAILED',
                lastRunSummary: `Execution skipped: Target store is not active (status: ${store?.status || 'NOT_FOUND'}).`,
                nextRunAt: nextRun,
                updatedAt: now,
              })
              .where(eq(automatedSyncSchedules.id, sched.id));
            skipped++;
            continue;
          }

          // 3. Distributed Lock & Deduplication per Occurrence Slot
          const occurrenceSlot = sched.nextRunAt
            ? Math.floor(sched.nextRunAt.getTime() / 60000) * 60000
            : Math.floor(now.getTime() / 60000) * 60000;
          const scheduleLockKey = `lock:schedule:${sched.id}:${occurrenceSlot}`;
          const deterministicJobId = `sync_${sched.id}_${occurrenceSlot}`;

          const acquired = await redis.set(scheduleLockKey, 'claimed', 'PX', 300000, 'NX'); // 5-minute TTL
          if (!acquired) {
            console.log(`[SyncScheduler] Occurrence for schedule ${sched.id} slot ${occurrenceSlot} is already claimed. Skipping.`);
            skipped++;
            continue;
          }

          // 4. Enqueue synchronization task to BullMQ storeSyncQueue first
          try {
            await storeSyncQueue.add(
              'execute-store-sync',
              {
                scheduleId: sched.id,
                organizationId: sched.organizationId,
                storeId: sched.storeId,
                brandId: sched.brandId,
                targetLanguage: sched.targetLanguage || 'en',
                autoTranslate: sched.autoTranslate ?? true,
                scheduleType: (sched.scheduleType as any) || 'STORE_PUSH',
                occurrenceTimestamp: sched.nextRunAt ? sched.nextRunAt.toISOString() : now.toISOString(),
              },
              {
                jobId: deterministicJobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
              }
            );
          } catch (queueErr: any) {
            console.error(`[SyncScheduler] Failed to submit job to BullMQ for schedule ${sched.id}:`, queueErr.message);
            // Release occurrence slot lock so it can be retried on next scan tick
            await redis.del(scheduleLockKey).catch(() => {});
            // Do NOT advance nextRunAt; record failure diagnostic so schedule is not lost
            await db
              .update(automatedSyncSchedules)
              .set({
                lastRunAt: now,
                lastRunStatus: 'FAILED',
                lastRunSummary: `Queue submission failed: ${queueErr.message}. Schedule retained for retry on next scan tick.`,
                updatedAt: now,
              })
              .where(eq(automatedSyncSchedules.id, sched.id));
            errors++;
            continue;
          }

          // 5. Advance nextRunAt in database only after confirmed queue submission
          const nextRun = this.calculateNextRun(sched.frequency, sched.nextRunAt || now);
          await db
            .update(automatedSyncSchedules)
            .set({
              lastRunAt: now,
              lastRunStatus: 'DISPATCHED',
              lastRunSummary: `Dispatched job ${deterministicJobId} to BullMQ queue.`,
              nextRunAt: nextRun,
              updatedAt: now,
            })
            .where(eq(automatedSyncSchedules.id, sched.id));

          dispatched++;
          console.log(`[SyncScheduler] Successfully dispatched schedule "${sched.name}" (${sched.id}) as job ${deterministicJobId}. Next run: ${nextRun.toISOString()}`);
        } catch (itemErr: any) {
          errors++;
          console.error(`[SyncScheduler] Error dispatching schedule ${sched.id}:`, itemErr);
        }
      }

      return {
        scanned: dueSchedules.length,
        dispatched,
        skipped,
        errors,
      };
    } finally {
      await redis.quit().catch(() => {});
    }
  }

  /**
   * Backward-compatible runner method
   */
  public static async processDueSchedules(): Promise<number> {
    const res = await this.runDueSchedules();
    return res.dispatched;
  }

  /**
   * Platform Admin Observability: Return live schedule metrics across all tenants
   */
  public static async getSchedulerMetrics() {
    const now = new Date();
    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automatedSyncSchedules);

    const [activeRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automatedSyncSchedules)
      .where(eq(automatedSyncSchedules.status, 'ACTIVE'));

    const [dueRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automatedSyncSchedules)
      .where(
        and(
          eq(automatedSyncSchedules.status, 'ACTIVE'),
          lte(automatedSyncSchedules.nextRunAt, now)
        )
      );

    const [nextUpcoming] = await db
      .select({ nextRunAt: automatedSyncSchedules.nextRunAt })
      .from(automatedSyncSchedules)
      .where(
        and(
          eq(automatedSyncSchedules.status, 'ACTIVE'),
          sql`${automatedSyncSchedules.nextRunAt} > ${now.toISOString()}::timestamptz`
        )
      )
      .orderBy(automatedSyncSchedules.nextRunAt)
      .limit(1);

    const recentRuns = await db
      .select({
        id: automatedSyncSchedules.id,
        name: automatedSyncSchedules.name,
        organizationId: automatedSyncSchedules.organizationId,
        storeId: automatedSyncSchedules.storeId,
        lastRunAt: automatedSyncSchedules.lastRunAt,
        lastRunStatus: automatedSyncSchedules.lastRunStatus,
        lastRunSummary: automatedSyncSchedules.lastRunSummary,
      })
      .from(automatedSyncSchedules)
      .where(sql`${automatedSyncSchedules.lastRunAt} IS NOT NULL`)
      .orderBy(desc(automatedSyncSchedules.lastRunAt))
      .limit(10);

    return {
      totalSchedules: totalRes?.count || 0,
      activeSchedules: activeRes?.count || 0,
      dueSchedules: dueRes?.count || 0,
      nextUpcomingExecution: nextUpcoming?.nextRunAt || null,
      recentRuns,
    };
  }
}
