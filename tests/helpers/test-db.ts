import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../database/drizzle/schema";
import { readFileSync } from "fs";
import { resolve } from "path";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface CreateTestDbResult {
	db: TestDb;
	client: Client;
	cleanup: () => Promise<void>;
}

export function createTestDb(): CreateTestDbResult {
	const client = createClient({ url: ":memory:" });
	const db = drizzle(client, { schema });

	const migrationPath = resolve(
		import.meta.dir,
		"../../database/migrations/0000_wealthy_the_fury.sql",
	);
	const migrationSql = readFileSync(migrationPath, "utf-8");

	// Strip Drizzle breakpoint markers and split into individual statements
	const cleanedSql = migrationSql.replace(/-->\s*statement-breakpoint/g, "");
	const statements = cleanedSql
		.split(";")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	for (const stmt of statements) {
		client.execute(stmt);
	}

	const cleanup = async () => {
		await client.close();
	};

	return { db, client, cleanup };
}

export async function setupTestDb(): Promise<CreateTestDbResult> {
	const result = createTestDb();
	return result;
}
