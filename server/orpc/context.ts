import { os } from "@orpc/server";
import type { dbSqlite } from "../../database/drizzle/db";

export const base = os.$context<{
	headers: Headers;
	db: ReturnType<typeof dbSqlite>;
}>();
