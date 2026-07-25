import { createError } from "evlog";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { dbSqlite } from "@/database/drizzle/db";
import { buildSalesSummary } from "@/features/sales/build-sales-summary.server";
import { SalesSummaryQueryArgsSchema } from "@/features/sales/sales.schema";
import { resolveZeroAuth } from "@/server/zero/context.server";

async function parseSalesSummaryRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw createError({
      message: "El cuerpo del resumen de ventas no es JSON válido",
      status: 400,
    });
  }

  const parsed = SalesSummaryQueryArgsSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      message: parsed.error.issues[0]?.message ?? "Filtros de ventas inválidos",
      status: 400,
    });
  }

  return parsed.data;
}

export function createSalesApp() {
  const app = new Hono<EvlogVariables>();

  app.post("/summary", async (c) => {
    const authBundle = await resolveZeroAuth(c.req.raw.headers);
    if (!authBundle?.ctx?.orgID) {
      throw createError({
        message: "No hay una organización activa",
        status: 403,
      });
    }

    const filters = await parseSalesSummaryRequest(c.req.raw);
    c.get("log").set({
      sales: "summary",
      userId: authBundle.userID,
      organizationId: authBundle.ctx.orgID,
    });

    const summary = await buildSalesSummary(
      dbSqlite(),
      {
        organizationId: authBundle.ctx.orgID,
        userId: authBundle.userID,
      },
      filters
    );

    return c.json(summary, 200, { "Cache-Control": "no-store" });
  });

  return app;
}
