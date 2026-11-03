import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/product_intelligence_dev';

// Configure postgres.js client
export const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });

export * from './schema';
export * from './queries/catalog';
export { schema };
