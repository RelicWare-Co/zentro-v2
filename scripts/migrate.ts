import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

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

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);
await migrate(db, { migrationsFolder });

console.log("[SUCCESS] Database migrations completed.");

await client.end();
