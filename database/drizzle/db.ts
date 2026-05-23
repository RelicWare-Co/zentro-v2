import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires all schemas as a namespace object
import * as schema from "./schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;

let dbInstance: Database | undefined;

function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = createDb();
  return dbInstance;
}

// Compatibilidad con código existente de zentro-v2 que espera dbSqlite()
export function dbSqlite() {
  return getDb();
}

// Proxy para lazy initialization
const _db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const target = getDb();
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export { _db as db };
