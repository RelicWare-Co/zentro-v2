import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { createError } from "evlog";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import { pedido, pedidoItem } from "@/database/drizzle/schema/orders.schema";
import type {
  CreateOrderInputSchema,
  CreateOrderResultSchema,
} from "@/features/orders/orders.schema";
import {
  normalizeOptionalString,
  normalizeRequiredString,
  toNonNegativeInteger,
} from "@/lib/domain-values.shared";

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
export type CreateOrderResult = z.infer<typeof CreateOrderResultSchema>;

interface ProductRow {
  id: string;
  name: string;
  price: number;
  taxRate: number;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function resolveOrganizationBySlug(tx: Tx, slug: string) {
  const [org] = await tx
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (!org) {
    throw createError({
      message: "Organización no encontrada",
      status: 404,
      why: "El slug no corresponde a ninguna organización.",
      fix: "Verifica el enlace e inténtalo de nuevo.",
    });
  }
  return org;
}

async function loadOrderProducts(
  tx: Tx,
  productIds: string[],
  organizationId: string
): Promise<Map<string, ProductRow>> {
  if (productIds.length === 0) {
    throw createError({
      message: "No hay productos válidos en el pedido",
      status: 400,
      why: "El pedido no incluye productos.",
      fix: "Agrega al menos un producto.",
    });
  }

  const rows = await tx
    .select({
      id: product.id,
      name: product.name,
      price: product.price,
      taxRate: product.taxRate,
    })
    .from(product)
    .where(
      and(
        eq(product.organizationId, organizationId),
        isNull(product.deletedAt),
        eq(product.isModifier, false),
        inArray(product.id, productIds)
      )
    );

  const productMap = new Map<string, ProductRow>(
    rows.map((row) => [row.id, row])
  );

  for (const productId of productIds) {
    if (!productMap.has(productId)) {
      throw createError({
        message: `Producto no disponible: ${productId}`,
        status: 400,
        why: "Uno de los productos del pedido no existe o no está publicado.",
        fix: "Recarga el catálogo e inténtalo de nuevo.",
      });
    }
  }

  return productMap;
}

async function nextOrderNumber(
  tx: Tx,
  organizationId: string
): Promise<number> {
  const [row] = await tx
    .select({
      maxNumber: sql<number>`coalesce(max("sub"."order_number"), 0)`,
    })
    .from(
      sql`(SELECT ${pedido.orderNumber} as "order_number" FROM ${pedido} WHERE ${pedido.organizationId} = ${organizationId} FOR UPDATE) as "sub"`
    );
  return (row?.maxNumber ?? 0) + 1;
}

export function runCreateOrder(
  db: Database,
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  if (input.fulfillment === "delivery" && !input.deliveryAddress?.trim()) {
    throw createError({
      message: "La dirección de entrega es obligatoria para domicilios",
      status: 400,
      why: "Pediste domicilio pero no ingresaste dirección.",
      fix: "Ingresa la dirección de entrega.",
    });
  }

  return db.transaction(async (tx) => {
    const org = await resolveOrganizationBySlug(tx, input.organizationSlug);

    const productIds = input.items.map((item) => item.productId);
    const productMap = await loadOrderProducts(tx, productIds, org.id);

    let subtotal = 0;
    let taxAmount = 0;

    const preparedItems = input.items.map((item) => {
      const productRow = productMap.get(item.productId);
      if (!productRow) {
        throw createError({
          message: `Producto no disponible: ${item.productId}`,
          status: 400,
        });
      }

      const unitPrice = productRow.price;
      const lineSubtotal = unitPrice * item.quantity;
      const lineTax = Math.round((lineSubtotal * productRow.taxRate) / 100);
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxAmount += lineTax;

      return {
        id: crypto.randomUUID(),
        productId: item.productId,
        quantity: toNonNegativeInteger(item.quantity, "Cantidad inválida"),
        unitPrice,
        taxRate: productRow.taxRate,
        totalAmount: lineTotal,
        notes: normalizeOptionalString(item.notes),
      };
    });

    const totalAmount = subtotal + taxAmount;
    const orderNumber = await nextOrderNumber(tx, org.id);
    const orderId = crypto.randomUUID();

    await tx.insert(pedido).values({
      id: orderId,
      organizationId: org.id,
      orderNumber,
      status: "pending",
      fulfillment: input.fulfillment,
      source: "web",
      contactName: normalizeRequiredString(
        input.contactName,
        "Nombre requerido"
      ),
      contactPhone: normalizeRequiredString(
        input.contactPhone,
        "Teléfono requerido"
      ),
      deliveryAddress:
        input.fulfillment === "delivery"
          ? normalizeRequiredString(
              input.deliveryAddress ?? "",
              "Dirección requerida"
            )
          : null,
      deliveryNotes: normalizeOptionalString(input.deliveryNotes),
      notes: normalizeOptionalString(input.notes),
      subtotal,
      taxAmount,
      totalAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await tx.insert(pedidoItem).values(
      preparedItems.map((item) => ({
        id: item.id,
        organizationId: org.id,
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        totalAmount: item.totalAmount,
        notes: item.notes,
        createdAt: new Date(),
      }))
    );

    return {
      orderId,
      orderNumber,
      status: "pending",
      totalAmount,
    };
  });
}
