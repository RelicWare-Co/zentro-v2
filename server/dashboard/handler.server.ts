import { createError } from "evlog";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { dbSqlite } from "@/database/drizzle/db";
import { resolveZeroAuth } from "@/server/zero/context.server";
import { runBuildDashboardOverview } from "./build-overview.server";

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

    c.get("log").set({
      dashboard: "overview",
      userId: authBundle.userID,
      organizationId: authBundle.ctx.orgID,
    });

    const overview = await runBuildDashboardOverview(dbSqlite(), {
      organizationId: authBundle.ctx.orgID,
      userId: authBundle.userID,
    });

    return c.json(overview);
  });

  return app;
}
