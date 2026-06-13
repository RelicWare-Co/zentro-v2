import { createError } from "evlog";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { dbSqlite } from "@/database/drizzle/db";
import { resolveZeroAuth } from "@/server/zero/context.server";
import { runBuildDashboardOverview } from "./build-overview.server";
import { resolveDashboardTimeZone } from "./zoned-time.server";

export function createDashboardApp() {
  const app = new Hono<EvlogVariables>();

  app.get("/overview", async (c) => {
    const authBundle = await resolveZeroAuth(c.req.raw.headers);
    if (!authBundle?.ctx?.orgID) {
      throw createError({
        message: "No hay una organización activa",
        status: 403,
      });
    }

    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));

    c.get("log").set({
      dashboard: "overview",
      userId: authBundle.userID,
      organizationId: authBundle.ctx.orgID,
      timeZone,
    });

    const overview = await runBuildDashboardOverview(
      dbSqlite(),
      {
        organizationId: authBundle.ctx.orgID,
        userId: authBundle.userID,
      },
      timeZone
    );

    return c.json(overview);
  });

  return app;
}
