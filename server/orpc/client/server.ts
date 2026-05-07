import { createRouterClient } from "@orpc/server";
import type { dbSqlite } from "../../../database/drizzle/db";
import { router } from "../routers";

export function createServerORPCClient(context: {
	headers: Headers;
	db: ReturnType<typeof dbSqlite>;
}) {
	return createRouterClient(router, { context });
}
