import { db, automatedSyncSchedules, connectedStores, brands, globalProducts, storeProductMappings } from '@saas/database';
import { eq, and, sql, lte } from 'drizzle-orm';
import { StoreExportExecutionService } from './store-export-execution.service';

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
   * Calculate next run timestamp from frequency
   */
  public static calculateNextRun(frequency: string, fromDate = new Date()): Date {
    const next = new Date(fromDate);
    switch (frequency) {
      case 'HOURLY':
        next.setHours(next.getHours() + 1);
        break;
      case 'EVERY_6_HOURS':
        next.setHours(next.getHours() + 6);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'DAILY':
      default:
        next.setDate(next.getDate() + 1);
        break;
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
   * Background runner: checks due schedules across all tenants and triggers execution
   */
  public static async processDueSchedules() {
    const now = new Date();
    const dueSchedules = await db
      .select()
      .from(automatedSyncSchedules)
      .where(
        and(
          eq(automatedSyncSchedules.status, 'ACTIVE'),
          lte(automatedSyncSchedules.nextRunAt, now)
        )
      )
      .limit(10);

    if (dueSchedules.length === 0) {
      return 0;
    }

    console.log(`[SyncScheduler] Found ${dueSchedules.length} due schedules to process.`);

    for (const sched of dueSchedules) {
      try {
        await this.executeScheduleNow(sched.id);
      } catch (err) {
        console.error(`[SyncScheduler] Failed to process due schedule ${sched.id}:`, err);
      }
    }

    return dueSchedules.length;
  }
}
