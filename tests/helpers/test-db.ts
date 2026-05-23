import path from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires all schemas as a namespace object
import * as schema from "@/database/drizzle/schema";

const DB_URL_REPLACE_REGEX = /\/[^/]+$/;

export type TestDb = NodePgDatabase<typeof schema> & { $client: Pool };

export interface CreateTestDbResult {
  cleanup: () => Promise<void>;
  client: Pool;
  db: TestDb;
}

export async function createTestDb(): Promise<CreateTestDbResult> {
  const adminUrl =
    process.env.DATABASE_URL?.replace(DB_URL_REPLACE_REGEX, "/postgres") ??
    "postgresql://zentro:zentro@localhost:5432/postgres";

  const dbName = `zentro_test_${crypto.randomUUID().replace(/-/g, "_")}`;

  const adminClient = new Pool({ connectionString: adminUrl, max: 1 });
  await adminClient.query(`CREATE DATABASE "${dbName}"`);
  await adminClient.end();

  const testUrl =
    process.env.DATABASE_URL?.replace(DB_URL_REPLACE_REGEX, `/${dbName}`) ??
    `postgresql://zentro:zentro@localhost:5432/${dbName}`;

  const pool = new Pool({ connectionString: testUrl, max: 1 });
  const db = drizzle(pool, { schema });

  const migrationsFolder = path.resolve(
    import.meta.dir,
    "../../database/migrations"
  );
  await migrate(db, { migrationsFolder });

  const cleanup = async () => {
    await pool.end();
    const dropPool = new Pool({ connectionString: adminUrl, max: 1 });
    await dropPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`
    );
    await dropPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await dropPool.end();
  };

  return { db, client: pool, cleanup };
}
