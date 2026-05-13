import { createRouterClient } from "@orpc/server";
import type { AppContext } from "../context";
import { router } from "../routers";

export function createServerORPCClient(context: AppContext) {
	return createRouterClient(router, { context });
}
