import { os } from "@orpc/server";
import type { RequestLogger } from "evlog";
import type { dbSqlite } from "../../database/drizzle/db";

export type AppContext = {
	headers: Headers;
	db: ReturnType<typeof dbSqlite>;
	log: RequestLogger;
};

export const base = os.$context<AppContext>();
