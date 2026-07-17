import { createError } from "evlog";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { dbSqlite } from "@/database/drizzle/db";
import { resolveDashboardTimeZone } from "@/features/dashboard/zoned-time.server";
import {
  buildBusinessReport,
  MAX_REPORT_EXPORT_ROWS,
} from "@/features/reports/build-report.server";
import { buildReportWorkbook } from "@/features/reports/build-report-workbook.server";
import { ReportFiltersSchema } from "@/features/reports/reports.schema";
import { resolveZeroAuth } from "@/server/zero/context.server";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function parseReportRequest(query: Record<string, string>) {
  const parsed = ReportFiltersSchema.safeParse({
    startDate: query.startDate,
    endDate: query.endDate,
    cashierId: query.cashierId || undefined,
    status: query.status || undefined,
  });
  if (!parsed.success) {
    throw createError({
      message:
        parsed.error.issues[0]?.message ?? "Filtros de reporte inválidos",
      status: 400,
    });
  }
  return parsed.data;
}

async function resolveReportContext(
  headers: Headers,
  query: Record<string, string>
) {
  const authBundle = await resolveZeroAuth(headers);
  if (!authBundle?.ctx?.orgID) {
    throw createError({
      message: "No hay una organización activa",
      status: 403,
    });
  }

  return {
    authBundle,
    filters: parseReportRequest(query),
    timeZone: resolveDashboardTimeZone(query.tz),
  };
}

export function createReportsApp() {
  const app = new Hono<EvlogVariables>();

  app.get("/overview", async (c) => {
    const { authBundle, filters, timeZone } = await resolveReportContext(
      c.req.raw.headers,
      c.req.query()
    );
    c.get("log").set({
      report: "business-overview",
      userId: authBundle.userID,
      organizationId: authBundle.ctx?.orgID,
      timeZone,
      startDate: filters.startDate,
      endDate: filters.endDate,
      cashierId: filters.cashierId,
      saleStatus: filters.status,
    });

    const report = await buildBusinessReport(
      dbSqlite(),
      authBundle.ctx?.orgID ?? "",
      filters,
      timeZone
    );
    return c.json(report);
  });

  app.get("/export.xlsx", async (c) => {
    const { authBundle, filters, timeZone } = await resolveReportContext(
      c.req.raw.headers,
      c.req.query()
    );
    c.get("log").set({
      report: "business-export",
      userId: authBundle.userID,
      organizationId: authBundle.ctx?.orgID,
      timeZone,
      startDate: filters.startDate,
      endDate: filters.endDate,
      cashierId: filters.cashierId,
      saleStatus: filters.status,
    });

    const report = await buildBusinessReport(
      dbSqlite(),
      authBundle.ctx?.orgID ?? "",
      filters,
      timeZone,
      MAX_REPORT_EXPORT_ROWS
    );
    if (report.truncated.sales || report.truncated.movements) {
      throw createError({
        message:
          "La exportación supera 50.000 registros. Selecciona un rango más corto.",
        status: 400,
      });
    }
    const bytes = await buildReportWorkbook(report);
    const filename = `reporte-negocio-${filters.startDate}-${filters.endDate}.xlsx`;

    return c.body(bytes, 200, {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": XLSX_CONTENT_TYPE,
    });
  });

  return app;
}
