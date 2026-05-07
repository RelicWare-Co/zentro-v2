import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
	currentDir,
	"..",
	"database",
	"migrations",
);

console.log("[INFO] Running database migrations...");
console.log(`[INFO] Database URL: ${databaseUrl}`);
console.log(`[INFO] Migrations folder: ${migrationsFolder}`);

const client = createClient({
	url: databaseUrl,
	authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client);
await migrate(db, { migrationsFolder });

console.log("[SUCCESS] Database migrations completed.");
