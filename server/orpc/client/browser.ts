import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { router } from "../routers";

const link = new RPCLink({
	url: "/rpc",
	headers: () => ({}),
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		fetch(input, { ...init, credentials: "include" }),
});

export const orpc: RouterClient<typeof router> = createORPCClient(link);
