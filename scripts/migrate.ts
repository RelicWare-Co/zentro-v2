import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  currentDir,
  "..",
  "database",
  "migrations"
);

console.log("[INFO] Running database migrations...");
console.log(`[INFO] Database URL: ${databaseUrl}`);
console.log(`[INFO] Migrations folder: ${migrationsFolder}`);

const pool = new Pool({
  connectionString: databaseUrl,
});

const db = drizzle(pool);
await migrate(db, { migrationsFolder });

console.log("[SUCCESS] Database migrations completed.");

await pool.end();
