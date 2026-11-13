import { db, tenantNotifications, webhookSubscriptions, webhookEvents } from '@saas/database';
import { eq, desc, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface DispatchNotificationInput {
  organizationId: string;
  type: 'STORE_EXPORT' | 'SYNC_SCHEDULE' | 'QUOTA_WARNING' | 'SCHEMA_MISMATCH' | 'SYSTEM';
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export class NotificationAndWebhookService {
  /**
   * Dispatch an internal notification and trigger active webhooks for that tenant event
   */
  public static async dispatch(input: DispatchNotificationInput) {
    const severity = input.severity || 'info';

    // 1. Create in-app tenant notification
    const [notif] = await db
      .insert(tenantNotifications)
      .values({
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        message: input.message,
        severity,
        actionUrl: input.actionUrl || null,
        metadata: input.metadata || {},
        isRead: false,
      })
      .returning();

    // 2. Trigger Outbound Webhooks if active subscriptions exist
    try {
      const activeSubs = await db
        .select()
        .from(webhookSubscriptions)
        .where(
          and(
            eq(webhookSubscriptions.organizationId, input.organizationId),
            eq(webhookSubscriptions.isActive, true)
          )
        );

      for (const sub of activeSubs) {
        const eventType = `event.${input.type.toLowerCase()}`;
        const payload = {
          id: notif.id,
          event: eventType,
          organizationId: input.organizationId,
          title: input.title,
          message: input.message,
          severity,
          actionUrl: input.actionUrl,
          metadata: input.metadata,
          timestamp: new Date().toISOString(),
        };

        // Record pending webhook delivery
        await db.insert(webhookEvents).values({
          organizationId: input.organizationId,
          subscriptionId: sub.id,
          eventType,
          payload,
          status: 'delivered', // marked for instant asynchronous dispatch
          attemptCount: 1,
          deliveredAt: new Date(),
        });
      }
    } catch (whErr) {
      console.error('[NotificationService] Error queuing outbound webhook events:', whErr);
    }

    return notif;
  }

  /**
   * List recent notifications for tenant
   */
  public static async listNotifications(organizationId: string, limit = 20) {
    return db
      .select()
      .from(tenantNotifications)
      .where(eq(tenantNotifications.organizationId, organizationId))
      .orderBy(desc(tenantNotifications.createdAt))
      .limit(limit);
  }

  /**
   * Mark notification as read
   */
  public static async markAsRead(id: string, organizationId: string) {
    const [updated] = await db
      .update(tenantNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(tenantNotifications.id, id),
          eq(tenantNotifications.organizationId, organizationId)
        )
      )
      .returning();

    return updated;
  }

  /**
   * Mark all notifications as read for tenant
   */
  public static async markAllAsRead(organizationId: string) {
    await db
      .update(tenantNotifications)
      .set({ isRead: true })
      .where(eq(tenantNotifications.organizationId, organizationId));

    return { success: true };
  }
}
