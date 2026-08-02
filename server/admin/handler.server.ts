import { createError } from "evlog";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { dbSqlite } from "@/database/drizzle/db";
import { AdminSetOrganizationModuleSchema } from "@/features/admin/admin.schema";
import {
  AdminQueryParseError,
  parseAdminOptionsQuery,
  parseAdminOrganizationsQuery,
  parseAdminOverviewQuery,
  parseAdminProductImportsQuery,
  parseAdminSalesQuery,
  parseAdminUsersQuery,
} from "@/features/admin/admin-query-params.server";
import { runBuildAdminOptions } from "@/features/admin/build-admin-options.server";
import { runBuildAdminOrganizationDetail } from "@/features/admin/build-admin-organizations.server";
import { runBuildAdminOrganizationsList } from "@/features/admin/build-admin-organizations-list.server";
import { runBuildAdminOverviewFiltered } from "@/features/admin/build-admin-overview-filtered.server";
import {
  runBuildAdminSaleDetail,
  runBuildAdminSales,
} from "@/features/admin/build-admin-sales.server";
import { runBuildAdminUsers } from "@/features/admin/build-admin-users.server";
import { runAdminSetOrganizationModule } from "@/features/admin/set-organization-module.server";
import { resolveDashboardTimeZone } from "@/features/dashboard/zoned-time.server";
import { getProductImporter } from "@/features/product-imports/product-importer-registry.server";
import { PRODUCT_IMPORT_MAX_FILE_BYTES } from "@/features/product-imports/product-imports.schema";
import {
  getProductImporterDescriptors,
  loadProductImportDetail,
  loadProductImportHistory,
  ProductImportOperationError,
  runCommitProductImport,
  runPreviewProductImport,
} from "@/features/product-imports/product-imports.server";
import { resolveZeroAuth, type ZeroAuth } from "@/server/zero/context.server";

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

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function throwProductImportError(error: unknown): never {
  if (error instanceof ProductImportOperationError) {
    throw createError({ message: error.message, status: error.status });
  }
  throw error;
}

function parseAdminRequest<T>(
  request: Request,
  parser: (params: URLSearchParams) => T
) {
  try {
    return parser(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof AdminQueryParseError || error instanceof Error) {
      throw createError({ message: error.message, status: 400 });
    }
    throw error;
  }
}

const PRIVATE_JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export function createAdminApp() {
  const app = new Hono<EvlogVariables>();

  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Cookie");
  });

  app.get("/overview", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));
    const query = parseAdminRequest(c.req.raw, parseAdminOverviewQuery);

    c.get("log").set({
      admin: "overview",
      userId: authBundle.userID,
      timeZone,
      period: query.period,
      hasOrganizationFilter: Boolean(query.organizationId),
    });

    const overview = await runBuildAdminOverviewFiltered(
      dbSqlite(),
      query,
      timeZone
    );
    return c.json(overview, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/options", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const query = parseAdminRequest(c.req.raw, parseAdminOptionsQuery);

    c.get("log").set({
      admin: "options",
      userId: authBundle.userID,
      resource: query.resource,
      page: query.page,
      hasSearch: Boolean(query.search),
      selectedCount: query.selectedIds.length,
    });

    const options = await runBuildAdminOptions(dbSqlite(), query);
    return c.json(options, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/organizations", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));
    const query = parseAdminRequest(c.req.raw, parseAdminOrganizationsQuery);

    c.get("log").set({
      admin: "organizations",
      userId: authBundle.userID,
      timeZone,
      period: query.period,
      hasSearch: Boolean(query.search),
      hasMetricFilter: query.paidMin !== null || query.paidMax !== null,
    });

    const organizations = await runBuildAdminOrganizationsList(
      dbSqlite(),
      query,
      timeZone
    );
    return c.json(organizations, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/users", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));
    const query = parseAdminRequest(c.req.raw, parseAdminUsersQuery);

    c.get("log").set({
      admin: "users",
      userId: authBundle.userID,
      timeZone,
      period: query.period,
      page: query.page,
      hasSearch: Boolean(query.search),
      hasOrganizationFilter: Boolean(query.organizationId),
    });

    const users = await runBuildAdminUsers(dbSqlite(), query, timeZone);
    return c.json(users, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/sales", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));
    const query = parseAdminRequest(c.req.raw, parseAdminSalesQuery);

    c.get("log").set({
      admin: "sales",
      userId: authBundle.userID,
      timeZone,
      period: query.period,
      page: query.page,
      hasSearch: Boolean(query.search),
      hasOrganizationFilter: Boolean(query.organizationId),
    });

    const sales = await runBuildAdminSales(dbSqlite(), query, timeZone);
    return c.json(sales, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/sales/:id", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const saleId = c.req.param("id");
    c.get("log").set({
      admin: "sale-detail",
      userId: authBundle.userID,
      hasSaleId: Boolean(saleId),
    });
    const detail = await runBuildAdminSaleDetail(dbSqlite(), saleId);
    if (!detail) {
      throw createError({ message: "No se encontró la venta.", status: 404 });
    }
    return c.json(detail, 200, PRIVATE_JSON_HEADERS);
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
    return c.json(detail, 200, PRIVATE_JSON_HEADERS);
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
    return c.json({ modules }, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/product-imports/importers", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    c.get("log").set({
      admin: "product-importers",
      userId: authBundle.userID,
    });
    return c.json(
      { importers: getProductImporterDescriptors() },
      200,
      PRIVATE_JSON_HEADERS
    );
  });

  app.get("/product-imports/importers/:key/template", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const importerKey = c.req.param("key");
    const importer = getProductImporter(importerKey);
    if (!importer?.template) {
      throw createError({
        message: "El importador no tiene una plantilla disponible.",
        status: 404,
      });
    }
    c.get("log").set({
      admin: "product-import-template",
      userId: authBundle.userID,
      importerKey,
    });
    const bytes = await importer.template.build();
    const responseBytes = new Uint8Array(bytes.byteLength);
    responseBytes.set(bytes);
    return c.body(responseBytes, 200, {
      "Content-Type": importer.template.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(importer.template.fileName)}`,
      "Cache-Control": "private, no-store",
    });
  });

  app.post(
    "/organizations/:id/product-imports/preview",
    bodyLimit({
      maxSize: PRODUCT_IMPORT_MAX_FILE_BYTES + 256 * 1024,
      onError: (c) =>
        c.json({ message: "El archivo supera el límite de 5 MiB." }, 413),
    }),
    async (c) => {
      const authBundle = await requirePlatformAdmin(c.req.raw.headers);
      const organizationId = c.req.param("id");
      const body = await c.req.parseBody();
      const importerKey = body.importerKey;
      const file = body.file;
      if (typeof importerKey !== "string" || !(file instanceof File)) {
        throw createError({
          message: "Debes seleccionar un importador y un archivo.",
          status: 400,
        });
      }
      c.get("log").set({
        admin: "preview-product-import",
        userId: authBundle.userID,
        organizationId,
        importerKey,
        hasFile: true,
        fileType: file.type,
      });
      try {
        const detail = await runPreviewProductImport(dbSqlite(), {
          organizationId,
          importerKey,
          fileName: file.name,
          fileType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
          userId: authBundle.userID,
          userEmail: authBundle.ctx.email ?? "desconocido",
        });
        return c.json(detail, 200, PRIVATE_JSON_HEADERS);
      } catch (error) {
        throwProductImportError(error);
      }
    }
  );

  app.get("/product-imports", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const query = parseAdminRequest(c.req.raw, parseAdminProductImportsQuery);
    const timeZone = resolveDashboardTimeZone(c.req.query("tz"));
    c.get("log").set({
      admin: "product-import-history",
      userId: authBundle.userID,
      timeZone,
      page: query.page,
      hasSearch: Boolean(query.search),
      hasOrganizationFilter: Boolean(query.organizationId),
    });
    const history = await loadProductImportHistory(dbSqlite(), {
      ...query,
      timeZone,
    });
    return c.json(history, 200, PRIVATE_JSON_HEADERS);
  });

  app.get("/product-imports/:id", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const batchId = c.req.param("id");
    c.get("log").set({
      admin: "product-import-detail",
      userId: authBundle.userID,
      batchId,
    });
    const detail = await loadProductImportDetail(dbSqlite(), batchId, {
      rowPage: parsePositiveInteger(c.req.query("rowPage")),
      rowPageSize: parsePositiveInteger(c.req.query("rowPageSize")),
    });
    if (!detail) {
      throw createError({
        message: "No se encontró la importación.",
        status: 404,
      });
    }
    return c.json(detail, 200, PRIVATE_JSON_HEADERS);
  });

  app.post("/product-imports/:id/commit", async (c) => {
    const authBundle = await requirePlatformAdmin(c.req.raw.headers);
    const batchId = c.req.param("id");
    c.get("log").set({
      admin: "commit-product-import",
      userId: authBundle.userID,
      batchId,
    });
    try {
      const detail = await runCommitProductImport(dbSqlite(), {
        batchId,
        userId: authBundle.userID,
      });
      return c.json(detail, 200, PRIVATE_JSON_HEADERS);
    } catch (error) {
      throwProductImportError(error);
    }
  });

  return app;
}
