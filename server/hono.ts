import vike from "@vikejs/hono";
import { parseError } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { dbSqlite } from "@/database/drizzle/db";
import { auth } from "./auth";
import { dbMiddleware } from "./db-middleware";
import { orpcHandler } from "./orpc/handler";
import { createZeroApp } from "./zero/handler.server";

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
  const app = new Hono<EvlogVariables>();

  // evlog wide-event logging
  app.use(evlog());

  // Global error handler — captures unexpected throws
  app.onError((error, c) => {
    c.get("log").error(error);
    const parsed = parseError(error);
    return c.json(
      {
        message: parsed.message,
        why: parsed.why,
        fix: parsed.fix,
        link: parsed.link,
      },
      (parsed.status as ContentfulStatusCode) ?? 500
    );
  });

  // Better Auth handler
  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // Zero authoritative endpoints — must be mounted BEFORE the oRPC `/api/*`
  // catch-all so `/api/zero/{query,mutate}` is not swallowed by oRPC.
  app.route("/api/zero", createZeroApp());

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
        log: c.get("log"),
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
