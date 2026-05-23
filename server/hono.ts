import vike from "@vikejs/hono";
import { parseError } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { auth } from "./auth";
import { createDashboardApp } from "./dashboard/handler.server";
import { dbMiddleware } from "./db-middleware";
import { createZeroApp } from "./zero/handler.server";

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

  app.route("/api/zero", createZeroApp());
  app.route("/api/dashboard", createDashboardApp());

  vike(app, [
    // Make database available in Context as `context.db`
    dbMiddleware,
  ]);

  return app;
}

export const app = getApp();
