import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires all schemas as a namespace object
import * as schema from "@/database/drizzle/schema";

const DB_URL_REPLACE_REGEX = /\/[^/]+$/;

export type TestDb = PostgresJsDatabase<typeof schema> & { $client: Sql };

export interface CreateTestDbResult {
  cleanup: () => Promise<void>;
  client: Sql;
  databaseUrl: string;
  db: TestDb;
}

type Sql = ReturnType<typeof postgres>;

export async function createTestDb(): Promise<CreateTestDbResult> {
  const adminUrl =
    process.env.DATABASE_URL?.replace(DB_URL_REPLACE_REGEX, "/postgres") ??
    "postgresql://zentro:zentro@localhost:5432/postgres";

  const dbName = `zentro_test_${crypto.randomUUID().replace(/-/g, "_")}`;

  const adminSql = postgres(adminUrl, { max: 1 });
  await adminSql`CREATE DATABASE ${adminSql(dbName)}`;
  await adminSql.end();

  const testUrl =
    process.env.DATABASE_URL?.replace(DB_URL_REPLACE_REGEX, `/${dbName}`) ??
    `postgresql://zentro:zentro@localhost:5432/${dbName}`;

  const client = postgres(testUrl, { max: 1 });
  const db = drizzle(client, { schema });

  const migrationsFolder = path.resolve(
    import.meta.dir,
    "../../database/migrations"
  );
  await migrate(db, { migrationsFolder });

  const cleanup = async () => {
    await client.end();
    const dropSql = postgres(adminUrl, { max: 1 });
    await dropSql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${dbName} AND pid <> pg_backend_pid()`;
    await dropSql`DROP DATABASE IF EXISTS ${dropSql(dbName)}`;
    await dropSql.end();
  };

  return { db, client, cleanup, databaseUrl: testUrl };
}
