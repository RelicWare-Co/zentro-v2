// Server-side override for products.registerInventoryMovement.
//
// Validates product existence and trackInventory, then delegates stock delta
// + movement insert to applyInventoryDeltas from inventory-operations.server.ts.
// This ensures authoritative Drizzle-level updates instead of Zero mutator calls.

import { and, eq, isNull } from "drizzle-orm";
import { product } from "@/database/drizzle/schema/inventory.schema";
import {
  applyInventoryDeltas,
  type InventoryMovementSource,
} from "@/features/inventory/inventory-operations.server";
import { registerInventoryMovementArgsSchema } from "@/features/products/products.mutators";
import {
  normalizeOptionalString,
  resolveTimestamp,
  toInteger,
} from "@/lib/domain-values.shared";
import { defineZentroServerMutator } from "@/zero/sdk.server";

export const productsServerMutators = {
  registerInventoryMovement: defineZentroServerMutator(
    registerInventoryMovementArgsSchema,
    async ({ drizzleTx, args, auth }) => {
      const baseQuantity = toInteger(args.quantity, "quantity");
      if (baseQuantity === 0) {
        throw new Error("La cantidad debe ser diferente de 0");
      }

      let deltaQuantity = baseQuantity;
      const normalizedRestockMode = args.restockMode ?? "add_to_stock";
      if (args.type === "restock" && baseQuantity < 0) {
        throw new Error("La reposición debe tener una cantidad positiva");
      }
      if (args.type === "waste") {
        deltaQuantity = -Math.abs(baseQuantity);
      }

      const [targetProduct] = await drizzleTx
        .select({
          id: product.id,
          name: product.name,
          trackInventory: product.trackInventory,
          stock: product.stock,
        })
        .from(product)
        .where(
          and(
            eq(product.id, args.productId),
            eq(product.organizationId, auth.organizationId),
            isNull(product.deletedAt)
          )
        )
        .limit(1);

      if (!targetProduct) {
        throw new Error(
          `Producto no encontrado o inactivo en la organización actual: ${args.productId}`
        );
      }

      if (!targetProduct.trackInventory) {
        throw new Error(
          "No puedes registrar movimientos en un producto sin control de inventario"
        );
      }

      const currentStock = targetProduct.stock ?? 0;
      if (args.type === "restock" && normalizedRestockMode === "set_as_total") {
        deltaQuantity = baseQuantity - currentStock;
      }

      const stockDeltas = new Map<string, number>([
        [targetProduct.id, deltaQuantity],
      ]);
      const productsMap = new Map([
        [
          targetProduct.id,
          {
            id: targetProduct.id,
            name: targetProduct.name,
            trackInventory: targetProduct.trackInventory,
          },
        ],
      ]);

      const source: InventoryMovementSource = {
        type: args.type,
        notes: normalizeOptionalString(args.notes) ?? "",
      };

      await applyInventoryDeltas(drizzleTx, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        deltas: stockDeltas,
        products: productsMap,
        source,
        createdAt: new Date(resolveTimestamp(args.createdAt)),
      });
    },
    { operationName: "El registro de movimientos de inventario" }
  ),
};
