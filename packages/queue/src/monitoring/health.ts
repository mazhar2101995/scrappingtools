import { Queue } from 'bullmq';
import {
  scrapingQueue,
  normalizationQueue,
  matchingQueue,
  persistenceQueue,
} from '../queues/definitions';
import { createRedisConnection } from '../redis';

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export async function getQueueMetrics(queue: Queue): Promise<QueueMetrics> {
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  const isPaused = await queue.isPaused();

  return {
    name: queue.name,
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed,
    paused: isPaused,
  };
}

export async function getAllQueuesHealth() {
  const redis = createRedisConnection();
  const startTime = Date.now();
  let redisStatus = 'healthy';
  let redisLatencyMs = 0;

  try {
    await redis.ping();
    redisLatencyMs = Date.now() - startTime;
  } catch (err) {
    redisStatus = 'unhealthy';
  } finally {
    await redis.quit();
  }

  const queues = [scrapingQueue, normalizationQueue, matchingQueue, persistenceQueue];
  const metrics = await Promise.all(queues.map(getQueueMetrics));

  return {
    timestamp: new Date().toISOString(),
    redis: {
      status: redisStatus,
      latencyMs: redisLatencyMs,
    },
    queues: metrics,
  };
}

