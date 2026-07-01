import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { db } from "@/database/drizzle/db";
import { runCreateOrder } from "@/features/orders/create-order.server";
import {
  CreateOrderInputSchema,
  PUBLIC_CATALOG_SCHEMA,
} from "@/features/orders/orders.schema";
import { getPublicCatalogBySlug } from "@/features/orders/public-catalog.server";

const catalogQuerySchema = z.object({
  slug: z.string().trim().min(1).max(255),
});

export function createPublicApp() {
  const app = new Hono();

  app.get("/catalog", async (c) => {
    const parsed = catalogQuerySchema.safeParse({
      slug: c.req.query("slug") ?? "",
    });
    if (!parsed.success) {
      return c.json({ error: "Slug inválido" }, 400);
    }

    const catalog = await getPublicCatalogBySlug({
      db,
      slug: parsed.data.slug,
    });
    if (!catalog) {
      return c.json({ error: "Negocio no encontrado" }, 404);
    }

    const safe = PUBLIC_CATALOG_SCHEMA.safeParse(catalog);
    if (!safe.success) {
      return c.json({ error: "Catálogo no disponible" }, 500);
    }

    return c.json(safe.data);
  });

  app.post("/orders", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Cuerpo de la petición inválido" }, 400);
    }

    const parsed = CreateOrderInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json(
        { error: firstError?.message ?? "Datos del pedido inválidos" },
        400
      );
    }

    try {
      const result = await runCreateOrder(db, parsed.data);
      return c.json(result, 201);
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        typeof error.status === "number"
      ) {
        return c.json(
          { error: error.message },
          error.status as ContentfulStatusCode
        );
      }
      throw error;
    }
  });

  return app;
}
