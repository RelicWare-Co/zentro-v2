import { defineMutator } from "@rocicorp/zero";
import type { z } from "zod";
import { ToggleProductFavoriteInputSchema } from "@/features/pos/pos.schema";
import {
  CreateCategorySchema,
  CreateProductSchema,
  DeleteCategorySchema,
  DeleteProductSchema,
  RegisterInventoryMovementSchema,
  UpdateCategorySchema,
  UpdateProductSchema,
} from "@/features/products/products.schema";
import "@/zero/context";
import {
  assertOrgZeroContext,
  normalizeOptionalString,
  resolveTimestamp,
  toInteger,
  toNonNegativeInteger,
  type ZeroMutatorTransaction,
} from "@/zero/mutators.shared";
import { zql } from "@/zero/schema";

interface ProductUpdatePatch {
  barcode?: string | null;
  categoryId?: string | null;
  cost?: number;
  isModifier?: boolean;
  minStock?: number | null;
  name?: string;
  price?: number;
  reorderQuantity?: number | null;
  sku?: string | null;
  stock?: number;
  taxRate?: number;
  trackInventory?: boolean;
}

export const createProductArgsSchema = CreateProductSchema.extend({
  id: DeleteProductSchema.shape.id,
});
export const updateProductArgsSchema = UpdateProductSchema;
export const deleteProductArgsSchema = DeleteProductSchema;
export const registerInventoryMovementArgsSchema =
  RegisterInventoryMovementSchema.extend({
    id: DeleteProductSchema.shape.id,
  });
export const createCategoryArgsSchema = CreateCategorySchema.extend({
  id: DeleteCategorySchema.shape.id,
});
export const updateCategoryArgsSchema = UpdateCategorySchema;
export const deleteCategoryArgsSchema = DeleteCategorySchema;
export const toggleProductFavoriteArgsSchema = ToggleProductFavoriteInputSchema;

async function assertCategoryFromOrganization({
  categoryId,
  organizationId,
  tx,
}: {
  categoryId?: string | null;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const normalizedCategoryId = normalizeOptionalString(categoryId);
  if (!normalizedCategoryId) {
    return null;
  }

  const existingCategories = await tx.run(
    zql.category
      .where("id", normalizedCategoryId)
      .where("organizationId", organizationId)
      .limit(1)
  );

  if (existingCategories.length === 0) {
    throw new Error(
      "La categoría seleccionada no existe en la organización actual"
    );
  }

  return normalizedCategoryId;
}

async function assertActiveProduct({
  id,
  organizationId,
  tx,
}: {
  id: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const existingProducts = await tx.run(
    zql.product
      .where("id", id)
      .where("organizationId", organizationId)
      .where("deletedAt", "IS", null)
      .limit(1)
  );

  const existingProduct = existingProducts[0];
  if (!existingProduct) {
    throw new Error(
      "El producto no existe o ya fue eliminado en la organización actual"
    );
  }

  return existingProduct;
}

async function assertActiveCategory({
  id,
  organizationId,
  tx,
}: {
  id: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const existingCategories = await tx.run(
    zql.category
      .where("id", id)
      .where("organizationId", organizationId)
      .limit(1)
  );

  if (existingCategories.length === 0) {
    throw new Error("La categoría no existe en la organización actual");
  }
}

function buildProductUpdatePatch(
  args: z.infer<typeof updateProductArgsSchema>
) {
  const updates: ProductUpdatePatch = {};

  if (args.name !== undefined) {
    const normalizedName = args.name.trim();
    if (!normalizedName) {
      throw new Error("El nombre del producto es obligatorio");
    }
    updates.name = normalizedName;
  }
  if (args.sku !== undefined) {
    updates.sku = normalizeOptionalString(args.sku);
  }
  if (args.barcode !== undefined) {
    updates.barcode = normalizeOptionalString(args.barcode);
  }
  if (args.price !== undefined) {
    updates.price = toNonNegativeInteger(args.price, "price");
  }
  if (args.cost !== undefined) {
    updates.cost = toNonNegativeInteger(args.cost, "cost");
  }
  if (args.taxRate !== undefined) {
    updates.taxRate = toNonNegativeInteger(args.taxRate, "taxRate");
  }
  if (args.stock !== undefined) {
    updates.stock = toNonNegativeInteger(args.stock, "stock");
  }
  if (args.minStock !== undefined) {
    updates.minStock =
      args.minStock === null
        ? null
        : toNonNegativeInteger(args.minStock, "minStock");
  }
  if (args.reorderQuantity !== undefined) {
    updates.reorderQuantity =
      args.reorderQuantity === null
        ? null
        : toNonNegativeInteger(args.reorderQuantity, "reorderQuantity");
  }
  if (args.trackInventory !== undefined) {
    updates.trackInventory = args.trackInventory;
  }
  if (args.isModifier !== undefined) {
    updates.isModifier = args.isModifier;
  }

  return updates;
}

export const productsMutators = {
  products: {
    create: defineMutator(
      createProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const normalizedName = args.name.trim();
        if (!normalizedName) {
          throw new Error("El nombre del producto es obligatorio");
        }

        const categoryId = await assertCategoryFromOrganization({
          categoryId: args.categoryId,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.product.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          categoryId,
          name: normalizedName,
          sku: normalizeOptionalString(args.sku),
          barcode: normalizeOptionalString(args.barcode),
          price: toNonNegativeInteger(args.price, "price"),
          cost: toNonNegativeInteger(args.cost ?? 0, "cost"),
          taxRate: toNonNegativeInteger(args.taxRate ?? 0, "taxRate"),
          stock: toNonNegativeInteger(args.stock ?? 0, "stock"),
          minStock:
            args.minStock === undefined || args.minStock === null
              ? null
              : toNonNegativeInteger(args.minStock, "minStock"),
          reorderQuantity:
            args.reorderQuantity === undefined || args.reorderQuantity === null
              ? null
              : toNonNegativeInteger(args.reorderQuantity, "reorderQuantity"),
          trackInventory: args.trackInventory ?? true,
          isModifier: args.isModifier ?? false,
          isFavorite: false,
          deletedAt: null,
          createdAt: Date.now(),
        });
      }
    ),
    update: defineMutator(
      updateProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveProduct({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        const updates = buildProductUpdatePatch(args);
        if (args.categoryId !== undefined) {
          updates.categoryId = await assertCategoryFromOrganization({
            categoryId: args.categoryId,
            organizationId: zeroContext.orgID,
            tx,
          });
        }

        await tx.mutate.product.update({
          id: args.id,
          ...updates,
        });
      }
    ),
    delete: defineMutator(
      deleteProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveProduct({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.product.update({
          id: args.id,
          deletedAt: Date.now(),
        });
      }
    ),
    toggleFavorite: defineMutator(
      toggleProductFavoriteArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const targetProduct = await assertActiveProduct({
          id: args.productId,
          organizationId: zeroContext.orgID,
          tx,
        });
        const nextIsFavorite = !targetProduct.isFavorite;

        await tx.mutate.product.update({
          id: args.productId,
          isFavorite: nextIsFavorite,
        });
      }
    ),
    registerInventoryMovement: defineMutator(
      registerInventoryMovementArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
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

        const targetProduct = await assertActiveProduct({
          id: args.productId,
          organizationId: zeroContext.orgID,
          tx,
        });

        if (!targetProduct.trackInventory) {
          throw new Error(
            "No puedes registrar movimientos en un producto sin control de inventario"
          );
        }

        const currentStock = targetProduct.stock ?? 0;
        if (
          args.type === "restock" &&
          normalizedRestockMode === "set_as_total"
        ) {
          deltaQuantity = baseQuantity - currentStock;
        }

        const nextStock = currentStock + deltaQuantity;
        if (nextStock < 0) {
          throw new Error(
            `Stock insuficiente para ${targetProduct.name}. Disponible: ${currentStock}`
          );
        }

        await tx.mutate.product.update({
          id: targetProduct.id,
          stock: nextStock,
        });
        await tx.mutate.inventoryMovement.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          productId: targetProduct.id,
          userId: zeroContext.id,
          type: args.type,
          quantity: deltaQuantity,
          notes: normalizeOptionalString(args.notes),
          createdAt: resolveTimestamp(args.createdAt),
        });
      }
    ),
    createCategory: defineMutator(
      createCategoryArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const normalizedName = args.name.trim();
        if (!normalizedName) {
          throw new Error("El nombre de la categoría es obligatorio");
        }

        await tx.mutate.category.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          name: normalizedName,
          description: normalizeOptionalString(args.description),
          createdAt: Date.now(),
        });
      }
    ),
    updateCategory: defineMutator(
      updateCategoryArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveCategory({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.category.update({
          id: args.id,
          name: args.name === undefined ? undefined : args.name.trim(),
          description:
            args.description === undefined
              ? undefined
              : normalizeOptionalString(args.description),
        });
      }
    ),
    deleteCategory: defineMutator(
      deleteCategoryArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveCategory({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.category.delete({ id: args.id });
      }
    ),
  },
};
