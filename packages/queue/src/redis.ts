import Redis, { RedisOptions } from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || 'redis_dev_password',
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

export function createRedisConnection(): Redis {
  return new Redis(redisConfig);
}

