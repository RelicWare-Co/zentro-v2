import { createError } from "evlog";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { dbSqlite } from "@/database/drizzle/db";
import { AdminSetOrganizationModuleSchema } from "@/schemas/admin";
import { resolveDashboardTimeZone } from "@/server/dashboard/zoned-time.server";
import { resolveZeroAuth, type ZeroAuth } from "@/server/zero/context.server";
import {
  runBuildAdminOrganizationDetail,
  runBuildAdminOrganizations,
} from "./build-admin-organizations.server";
import { runBuildAdminOverview } from "./build-admin-overview.server";
import { runAdminSetOrganizationModule } from "./set-organization-module.server";

/**
 * Platform-admin gate. Unlike org-scoped endpoints, an active organization is
 * not required: the admin panel must work for admins without an active org.
 */
async function requirePlatformAdmin(headers: Headers): Promise<ZeroAuth> {
  const authBundle = await resolveZeroAuth(headers);
  if (authBundle?.ctx?.systemRole !== "admin") {
    throw createError({
      message: "Esta acción requiere permisos de administrador de la app.",
      status: 403,
    });
  }
  return authBundle;
}

export function createAdminApp() {
  const app = new Hono<EvlogVariables>();

  app.get("/overview", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));

    c.get("log").set({
      admin: "overview",
      userId: authBundle.userID,
      timeZone,
    });

    const overview = await runBuildAdminOverview(dbSqlite(), timeZone);
    return c.json(overview);
  });

  app.get("/organizations", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));

    c.get("log").set({
      admin: "organizations",
      userId: authBundle.userID,
      timeZone,
    });

    const organizations = await runBuildAdminOrganizations(
      dbSqlite(),
      timeZone
    );
    return c.json(organizations);
  });

  app.get("/organizations/:id", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));
    const organizationId = c.req.param("id");

    c.get("log").set({
      admin: "organization-detail",
      userId: authBundle.userID,
      organizationId,
      timeZone,
    });

    const detail = await runBuildAdminOrganizationDetail(
      dbSqlite(),
      organizationId,
      timeZone
    );
    if (!detail) {
      throw createError({
        message: "No se encontró la organización.",
        status: 404,
      });
    }
    return c.json(detail);
  });

  app.post("/organizations/:id/modules", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const organizationId = c.req.param("id");

    const parsed = AdminSetOrganizationModuleSchema.safeParse(
      await c.req.json().catch(() => null)
    );
    if (!parsed.success) {
      throw createError({
        message: "La solicitud de cambio de módulo no es válida.",
        status: 400,
      });
    }

    c.get("log").set({
      admin: "set-organization-module",
      userId: authBundle.userID,
      organizationId,
      moduleKey: parsed.data.moduleKey,
      moduleStatus: parsed.data.status,
    });

    const modules = await runAdminSetOrganizationModule(dbSqlite(), {
      ...parsed.data,
      organizationId,
      updatedByUserId: authBundle.userID,
    });
    if (!modules) {
      throw createError({
        message: "No se encontró la organización.",
        status: 404,
      });
    }
    return c.json({ modules });
  });

  return app;
}
