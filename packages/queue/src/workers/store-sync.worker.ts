import { Worker, Job } from 'bullmq';
import { redisConfig } from '../redis';
import { QUEUE_NAMES } from '../queues/definitions';
import { StoreSyncJobPayload } from '../types/jobs';
import { db, automatedSyncSchedules, connectedStores, services, subscriptions, planServiceEntitlements, organizations } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';

export interface StoreSyncResult {
  success: boolean;
  succeededCount: number;
  failedCount: number;
  totalRequested: number;
  summary: string;
}

export type StoreSyncHandler = (payload: StoreSyncJobPayload) => Promise<StoreSyncResult>;

export function createStoreSyncWorker(syncHandler?: StoreSyncHandler) {
  const worker = new Worker<StoreSyncJobPayload>(
    QUEUE_NAMES.STORE_SYNC,
    async (job: Job<StoreSyncJobPayload>) => {
      const { scheduleId, organizationId, storeId } = job.data;
      console.log(`[StoreSyncWorker] Processing job ${job.id} for schedule ${scheduleId} (Store: ${storeId})`);

      // 0. Worker-Level Dynamic Service Entitlement Enforcement
      const [svc] = await db
        .select()
        .from(services)
        .where(eq(services.code, 'automated_sync'))
        .limit(1);

      if (svc && svc.isGloballyActive !== 'true') {
        const errorMsg = "Service 'automated_sync' is globally disabled by platform administrator.";
        console.warn(`[StoreSyncWorker] ${errorMsg} Skipping execution.`);
        await db
          .update(automatedSyncSchedules)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: 'FAILED',
            lastRunSummary: `Execution blocked: ${errorMsg}`,
            updatedAt: new Date(),
          })
          .where(eq(automatedSyncSchedules.id, scheduleId));
        return { success: false, skipped: true, reason: 'SERVICE_GLOBALLY_DISABLED' };
      }

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, organizationId))
        .orderBy(desc(subscriptions.updatedAt))
        .limit(1);

      const [org] = await db
        .select({ planTier: organizations.planTier })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      const activePlanId = sub?.planId || org?.planTier || 'free';
      const [ent] = await db
        .select()
        .from(planServiceEntitlements)
        .where(
          and(
            eq(planServiceEntitlements.planId, activePlanId),
            eq(planServiceEntitlements.serviceCode, 'automated_sync')
          )
        )
        .limit(1);

      if (ent && ent.isEnabled !== 'true') {
        const errorMsg = `Service 'automated_sync' is not enabled in plan '${activePlanId}'.`;
        console.warn(`[StoreSyncWorker] ${errorMsg} Skipping execution.`);
        await db
          .update(automatedSyncSchedules)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: 'FAILED',
            lastRunSummary: `Execution blocked: ${errorMsg}`,
            updatedAt: new Date(),
          })
          .where(eq(automatedSyncSchedules.id, scheduleId));
        return { success: false, skipped: true, reason: 'SERVICE_NOT_ENTITLED' };
      }

      // 1. Verify schedule in database
      const [schedule] = await db
        .select()
        .from(automatedSyncSchedules)
        .where(eq(automatedSyncSchedules.id, scheduleId))
        .limit(1);

      if (!schedule || schedule.status === 'DELETED') {
        console.warn(`[StoreSyncWorker] Schedule ${scheduleId} is deleted or missing, skipping job ${job.id}`);
        return { success: true, skipped: true, reason: 'SCHEDULE_DELETED' };
      }

      // 2. Verify store connection in database
      const [store] = await db
        .select()
        .from(connectedStores)
        .where(and(eq(connectedStores.id, storeId), eq(connectedStores.organizationId, organizationId)))
        .limit(1);

      const isStoreActive = store && (store.status === 'active' || store.status === 'connected');
      if (!isStoreActive) {
        const errorMsg = !store ? 'Target store not found' : `Target store is not active (status: ${store.status})`;
        await db
          .update(automatedSyncSchedules)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: 'FAILED',
            lastRunSummary: `Execution failed: ${errorMsg}`,
            updatedAt: new Date(),
          })
          .where(eq(automatedSyncSchedules.id, scheduleId));

        throw new Error(errorMsg);
      }

      // 3. Execute synchronization handler
      let result: StoreSyncResult;
      if (syncHandler) {
        result = await syncHandler(job.data);
      } else {
        result = {
          success: true,
          succeededCount: 0,
          failedCount: 0,
          totalRequested: 0,
          summary: 'Synchronization completed with default handler.',
        };
      }

      // 4. Update schedule last run status
      const executionStatus = result.failedCount === 0 ? 'SUCCESS' : result.succeededCount > 0 ? 'PARTIAL' : 'FAILED';
      await db
        .update(automatedSyncSchedules)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: executionStatus,
          lastRunSummary: result.summary,
          updatedAt: new Date(),
        })
        .where(eq(automatedSyncSchedules.id, scheduleId));

      return result;
    },
    {
      connection: redisConfig,
      concurrency: 3,
    }
  );

  worker.on('failed', async (job, err) => {
    console.error(`[StoreSyncWorker] Job ${job?.id} failed:`, err.message);
    if (job?.data?.scheduleId) {
      await db
        .update(automatedSyncSchedules)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: 'FAILED',
          lastRunSummary: `Worker execution error: ${err.message}`,
          updatedAt: new Date(),
        })
        .where(eq(automatedSyncSchedules.id, job.data.scheduleId))
        .catch(() => {});
    }
  });

  return worker;
}
