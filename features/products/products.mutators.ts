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
import { zql } from "@/zero/schema";
import {
  assertOrgZeroContext,
  defineZentroMutator,
  normalizeOptionalString,
  resolveTimestamp,
  toInteger,
  toNonNegativeInteger,
  type ZeroMutatorTransaction,
} from "@/zero/sdk";

interface ProductUpdatePatch {
  accountingTreatment?: string;
  autoPayoutEnabled?: boolean;
  autoPayoutPaymentMethod?: string;
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
  args: z.infer<typeof updateProductArgsSchema>,
  existingAccountingTreatment: string
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
  applyProductTypeUpdates(updates, args, existingAccountingTreatment);
  if (args.accountingTreatment !== undefined) {
    updates.accountingTreatment = args.accountingTreatment;
  }
  if (args.autoPayoutEnabled !== undefined) {
    updates.autoPayoutEnabled = args.autoPayoutEnabled;
  }
  if (args.autoPayoutPaymentMethod !== undefined) {
    updates.autoPayoutPaymentMethod = args.autoPayoutPaymentMethod;
  }

  return updates;
}

function applyProductTypeUpdates(
  updates: ProductUpdatePatch,
  args: z.infer<typeof updateProductArgsSchema>,
  existingAccountingTreatment: string
) {
  const effectiveTreatment =
    args.accountingTreatment ?? existingAccountingTreatment;
  if (effectiveTreatment === "passthrough") {
    updates.trackInventory = false;
    updates.isModifier = false;
    return;
  }
  if (args.trackInventory !== undefined) {
    updates.trackInventory = args.trackInventory;
  }
  if (args.isModifier !== undefined) {
    updates.isModifier = args.isModifier;
  }
}

export const productsMutators = {
  products: {
    create: defineZentroMutator(
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
          accountingTreatment: args.accountingTreatment ?? "revenue",
          trackInventory:
            (args.accountingTreatment ?? "revenue") === "passthrough"
              ? false
              : (args.trackInventory ?? true),
          isModifier:
            (args.accountingTreatment ?? "revenue") === "passthrough"
              ? false
              : (args.isModifier ?? false),
          isFavorite: false,
          autoPayoutEnabled: args.autoPayoutEnabled ?? false,
          autoPayoutPaymentMethod: args.autoPayoutPaymentMethod ?? "cash",
          deletedAt: null,
          createdAt: Date.now(),
        });
      }
    ),
    update: defineZentroMutator(
      updateProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const existingProduct = await assertActiveProduct({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        const updates = buildProductUpdatePatch(
          args,
          existingProduct.accountingTreatment ?? "revenue"
        );
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
    delete: defineZentroMutator(
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
    toggleFavorite: defineZentroMutator(
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
    registerInventoryMovement: defineZentroMutator(
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
    createCategory: defineZentroMutator(
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
    updateCategory: defineZentroMutator(
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
    deleteCategory: defineZentroMutator(
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
