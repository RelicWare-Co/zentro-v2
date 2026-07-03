// Inventory operations — server-only, reusable across domains.
//
// Sales, cancellations, and product mutator overrides import from here
// instead of redefining stock delta + movement logic.

import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  inventoryMovement,
  product,
} from "@/database/drizzle/schema/inventory.schema";

type DrizzleTx = Pick<Database, "select" | "insert" | "update">;

export interface InventoryMovementSource {
  notes: string;
  type: "sale" | "adjustment" | "restock" | "waste";
}

export function saleMovementSource(saleId: string): InventoryMovementSource {
  return { type: "sale", notes: `Venta ${saleId}` };
}

export function cancelSaleMovementSource(
  saleId: string
): InventoryMovementSource {
  return { type: "adjustment", notes: `Anulacion venta ${saleId}` };
}

interface ProductInventoryInfo {
  id: string;
  name: string;
  trackInventory: boolean;
}

export async function applyInventoryDeltas(
  tx: DrizzleTx,
  input: {
    organizationId: string;
    userId: string;
    deltas: Map<string, number>;
    products: Map<string, ProductInventoryInfo>;
    source: InventoryMovementSource;
    createdAt: Date;
  }
): Promise<Array<{ productId: string; deltaQuantity: number }>> {
  const entriesToUpdate: Array<{
    productId: string;
    deltaQuantity: number;
    productRow: ProductInventoryInfo;
  }> = [];
  for (const [productId, deltaQuantity] of input.deltas.entries()) {
    if (deltaQuantity === 0) {
      continue;
    }

    const productRow = input.products.get(productId);
    if (!productRow) {
      throw new Error(`Producto no encontrado para inventario: ${productId}`);
    }
    if (!productRow.trackInventory) {
      continue;
    }
    entriesToUpdate.push({ productId, deltaQuantity, productRow });
  }

  const updateResults = await Promise.all(
    entriesToUpdate.map(({ productId, deltaQuantity, productRow }) =>
      tx
        .update(product)
        .set({ stock: sql`${product.stock} + ${deltaQuantity}` })
        .where(
          and(
            eq(product.id, productId),
            eq(product.organizationId, input.organizationId),
            isNull(product.deletedAt),
            sql`${product.stock} + ${deltaQuantity} >= 0`
          )
        )
        .returning({ id: product.id })
        .then((updatedProducts) => {
          if (updatedProducts.length === 0) {
            throw new Error(`Stock insuficiente para ${productRow.name}`);
          }
          return { productId, deltaQuantity };
        })
    )
  );

  const inventoryRows = updateResults.map(({ productId, deltaQuantity }) => ({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    productId,
    userId: input.userId,
    type: input.source.type,
    quantity: deltaQuantity,
    notes: input.source.notes,
    createdAt: input.createdAt,
  }));

  if (inventoryRows.length > 0) {
    await tx.insert(inventoryMovement).values(inventoryRows);
  }

  return updateResults;
}

export async function restoreSaleInventory(
  tx: DrizzleTx,
  input: {
    organizationId: string;
    userId: string;
    saleId: string;
    cancelledAt: Date;
  }
): Promise<void> {
  const saleMovementRows = await tx
    .select({
      productId: inventoryMovement.productId,
      quantity: inventoryMovement.quantity,
      productName: product.name,
    })
    .from(inventoryMovement)
    .innerJoin(
      product,
      and(
        eq(product.id, inventoryMovement.productId),
        eq(product.organizationId, input.organizationId)
      )
    )
    .where(
      and(
        eq(inventoryMovement.organizationId, input.organizationId),
        eq(inventoryMovement.type, "sale"),
        eq(inventoryMovement.notes, `Venta ${input.saleId}`)
      )
    );

  const stockRestorations = new Map<
    string,
    { quantity: number; productName: string }
  >();
  for (const movementRow of saleMovementRows) {
    const restorationQuantity = Math.max(-movementRow.quantity, 0);
    if (restorationQuantity <= 0) {
      continue;
    }

    stockRestorations.set(movementRow.productId, {
      quantity:
        (stockRestorations.get(movementRow.productId)?.quantity ?? 0) +
        restorationQuantity,
      productName: movementRow.productName,
    });
  }

  const entriesToRestore: Array<{
    productId: string;
    restoration: { quantity: number; productName: string };
  }> = [];
  for (const [productId, restoration] of stockRestorations.entries()) {
    if (restoration.quantity <= 0) {
      continue;
    }
    entriesToRestore.push({ productId, restoration });
  }

  const restoreResults = await Promise.all(
    entriesToRestore.map(({ productId, restoration }) =>
      tx
        .update(product)
        .set({
          stock: sql`${product.stock} + ${restoration.quantity}`,
        })
        .where(
          and(
            eq(product.id, productId),
            eq(product.organizationId, input.organizationId)
          )
        )
        .returning({ id: product.id })
        .then((updatedProducts) => {
          if (updatedProducts.length === 0) {
            throw new Error(
              `No fue posible restaurar el stock de ${restoration.productName}`
            );
          }
          return { productId, restoration };
        })
    )
  );

  const inventoryRows: (typeof inventoryMovement.$inferInsert)[] =
    restoreResults.map(({ productId, restoration }) => ({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      productId,
      userId: input.userId,
      type: "adjustment",
      quantity: restoration.quantity,
      notes: `Anulacion venta ${input.saleId}`,
      createdAt: input.cancelledAt,
    }));

  if (inventoryRows.length > 0) {
    await tx.insert(inventoryMovement).values(inventoryRows);
  }
}
