import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../database/drizzle/schema";
import { readFileSync, unlinkSync } from "fs";
import { resolve } from "path";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface CreateTestDbResult {
	db: TestDb;
	client: Client;
	cleanup: () => Promise<void>;
}

export function createTestDb(): CreateTestDbResult {
	// Use a temporary file database instead of :memory: to avoid libSQL
	// transaction isolation issues where transaction queries may run on
	// a separate in-memory connection that sees an empty database.
	const dbPath = `/tmp/zentro-test-${crypto.randomUUID()}.db`;
	const client = createClient({ url: `file:${dbPath}` });
	const db = drizzle(client, { schema });

	const migrationPath = resolve(
		import.meta.dir,
		"../../database/migrations/0000_wealthy_the_fury.sql",
	);
	const migrationSql = readFileSync(migrationPath, "utf-8");

	// Strip Drizzle breakpoint markers and split into individual statements
	const cleanedSql = migrationSql.replace(/-->\s*statement-breakpoint/g, "");
	const statements = cleanedSql.split(";").reduce<string[]>((acc, s) => {
		const trimmed = s.trim();
		if (trimmed.length > 0) acc.push(trimmed);
		return acc;
	}, []);

	for (const stmt of statements) {
		client.execute(stmt);
	}

	const cleanup = async () => {
		await client.close();
		try {
			unlinkSync(dbPath);
		} catch {
			// ignore cleanup errors
		}
	};

	return { db, client, cleanup };
}

async function setupTestDb(): Promise<CreateTestDbResult> {
	const result = createTestDb();
	return result;
}
