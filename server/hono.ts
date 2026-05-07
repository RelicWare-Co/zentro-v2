import { dbMiddleware } from "./db-middleware";
import vike from "@vikejs/hono";
import { Hono } from "hono";
import { auth } from "./auth";
import { orpcHandler } from "./orpc/handler";
import { dbSqlite } from "../database/drizzle/db";

const BODY_PARSER_METHODS = new Set([
	"arrayBuffer",
	"blob",
	"formData",
	"json",
	"text",
] as const);

type BodyParserMethod =
	typeof BODY_PARSER_METHODS extends Set<infer T> ? T : never;

function getApp() {
	const app = new Hono();

	// Better Auth handler
	app.on(["POST", "GET"], "/api/auth/*", (c) => {
		return auth.handler(c.req.raw);
	});

	// oRPC OpenAPI handler (REST transport + Scalar docs)
	app.use("/api/*", async (c, next) => {
		const request = new Proxy(c.req.raw, {
			get(target, prop) {
				if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
					return () => c.req[prop as BodyParserMethod]();
				}
				return Reflect.get(target, prop, target);
			},
		});

		const { matched, response } = await orpcHandler.handle(request, {
			prefix: "/api",
			context: {
				headers: c.req.raw.headers,
				db: dbSqlite(),
			},
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});

	vike(app, [
		// Make database available in Context as `context.db`
		dbMiddleware,
	]);

	return app;
}

export const app = getApp();
