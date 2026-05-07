import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { contract } from "../contracts";

function getOpenApiUrl() {
	if (typeof window !== "undefined") {
		return new URL("/api", window.location.origin);
	}

	return new URL("/api", "http://localhost:3000");
}

const link = new OpenAPILink(contract, {
	url: getOpenApiUrl,
	headers: () => ({}),
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		fetch(input, { ...init, credentials: "include" }),
});

export const orpc: ContractRouterClient<typeof contract> = createORPCClient(link);
