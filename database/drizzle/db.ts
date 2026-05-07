import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

function createDb() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL environment variable is not set");
	}

	// libSQL soporta URLs locales (file:) y remotas (libsql://, https://, wss://)
	const client = createClient({
		url: databaseUrl,
		authToken: process.env.DATABASE_AUTH_TOKEN,
	});

	return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

let dbInstance: Database | undefined;

export function getDb(): Database {
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
export const db = new Proxy({} as Database, {
	get(_target, property, receiver) {
		const target = getDb();
		const value = Reflect.get(target, property, receiver);
		return typeof value === "function" ? value.bind(target) : value;
	},
});
