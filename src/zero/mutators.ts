// Shared Zero mutators.
//
// "Shared" means runnable on both client (optimistic) and server (authoritative).
// Anything that needs Drizzle, the better-auth instance, or other server-only
// modules belongs in `./mutators.server.ts` as an override.
//
// Conventions:
// - Validate `args` with Zod.
// - Always `await tx.mutate.*` writes; an unawaited write breaks transactionality.
// - Read identity/permissions from `ctx`. Reject mismatches with `throw new Error(...)`.
// - Mutators must be idempotent: Zero rebases optimistic mutations during
//   reconciliation, so the same mutator may execute multiple times locally.

import {
  defineMutator,
  defineMutators,
  type Transaction,
} from "@rocicorp/zero";
import type { z } from "zod";
import {
  CreateCustomerSchema,
  DeleteCustomerSchema,
  UpdateCustomerSchema,
} from "@/schemas/customers";
import {
  CreateCategorySchema,
  CreateProductSchema,
  DeleteCategorySchema,
  DeleteProductSchema,
  RegisterInventoryMovementSchema,
  UpdateCategorySchema,
  UpdateProductSchema,
} from "@/schemas/products";
import "./context";
import { type Schema, type ZeroContext, zql } from "./schema";

type ZeroMutatorTransaction = Transaction<Schema>;

interface ProductUpdatePatch {
  barcode?: string | null;
  categoryId?: string | null;
  cost?: number;
  isModifier?: boolean;
  name?: string;
  price?: number;
  sku?: string | null;
  stock?: number;
  taxRate?: number;
  trackInventory?: boolean;
}

const FORBIDDEN_MESSAGE = "No tienes acceso a la organización activa";

export const createCustomerArgsSchema = CreateCustomerSchema.extend({
  id: DeleteCustomerSchema.shape.id,
});

export const updateCustomerArgsSchema = UpdateCustomerSchema;
export const deleteCustomerArgsSchema = DeleteCustomerSchema;

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

function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function assertZeroContext(ctx: ZeroContext | undefined) {
  if (!ctx) {
    throw new Error(FORBIDDEN_MESSAGE);
  }

  return ctx;
}

function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`
    );
  }
  return Math.round(value);
}

function toInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`El campo "${fieldName}" debe ser un número válido`);
  }
  return Math.round(value);
}

function resolveTimestamp(input?: number) {
  if (input === undefined) {
    return Date.now();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new Error("La fecha indicada no es válida");
  }

  return Math.round(input);
}

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
  if (args.trackInventory !== undefined) {
    updates.trackInventory = args.trackInventory;
  }
  if (args.isModifier !== undefined) {
    updates.isModifier = args.isModifier;
  }

  return updates;
}

async function assertUniqueDocumentNumber({
  documentNumber,
  excludeCustomerId,
  organizationId,
  tx,
}: {
  documentNumber: string | null;
  excludeCustomerId?: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  if (!documentNumber) {
    return;
  }

  let query = zql.customer
    .where("organizationId", organizationId)
    .where("documentNumber", documentNumber)
    .where("deletedAt", "IS", null);

  if (excludeCustomerId) {
    query = query.where("id", "!=", excludeCustomerId);
  }

  const existingCustomers = await tx.run(query.limit(1));
  if (existingCustomers.length > 0) {
    throw new Error("Ya existe un cliente activo con ese documento");
  }
}

async function assertActiveCustomer({
  id,
  organizationId,
  tx,
}: {
  id: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const existingCustomers = await tx.run(
    zql.customer
      .where("id", id)
      .where("organizationId", organizationId)
      .where("deletedAt", "IS", null)
      .limit(1)
  );

  if (existingCustomers.length === 0) {
    throw new Error(
      "El cliente no existe o ya fue eliminado en la organización actual"
    );
  }
}

export const mutators = defineMutators({
  customers: {
    create: defineMutator(
      createCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
        const documentNumber = normalizeOptionalString(args.documentNumber);
        await assertUniqueDocumentNumber({
          documentNumber,
          organizationId: zeroContext.orgID,
          tx,
        });

        const now = Date.now();
        await tx.mutate.customer.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          type: normalizeOptionalString(args.type) ?? "natural",
          documentType: normalizeOptionalString(args.documentType),
          documentNumber,
          name: args.name.trim(),
          email: normalizeOptionalString(args.email),
          phone: normalizeOptionalString(args.phone),
          address: normalizeOptionalString(args.address),
          city: normalizeOptionalString(args.city),
          taxRegime: normalizeOptionalString(args.taxRegime),
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    ),
    update: defineMutator(
      updateCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
        const documentNumber =
          args.documentNumber === undefined
            ? undefined
            : normalizeOptionalString(args.documentNumber);

        await assertActiveCustomer({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        if (documentNumber !== undefined) {
          await assertUniqueDocumentNumber({
            documentNumber,
            excludeCustomerId: args.id,
            organizationId: zeroContext.orgID,
            tx,
          });
        }

        await tx.mutate.customer.update({
          id: args.id,
          type:
            args.type === undefined
              ? undefined
              : (normalizeOptionalString(args.type) ?? "natural"),
          documentType:
            args.documentType === undefined
              ? undefined
              : normalizeOptionalString(args.documentType),
          documentNumber,
          name: args.name === undefined ? undefined : args.name.trim(),
          email:
            args.email === undefined
              ? undefined
              : normalizeOptionalString(args.email),
          phone:
            args.phone === undefined
              ? undefined
              : normalizeOptionalString(args.phone),
          address:
            args.address === undefined
              ? undefined
              : normalizeOptionalString(args.address),
          city:
            args.city === undefined
              ? undefined
              : normalizeOptionalString(args.city),
          taxRegime:
            args.taxRegime === undefined
              ? undefined
              : normalizeOptionalString(args.taxRegime),
          updatedAt: Date.now(),
        });
      }
    ),
    delete: defineMutator(
      deleteCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
        await assertActiveCustomer({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        const now = Date.now();
        await tx.mutate.customer.update({
          id: args.id,
          deletedAt: now,
          updatedAt: now,
        });
      }
    ),
  },
  products: {
    create: defineMutator(
      createProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
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
        const zeroContext = assertZeroContext(ctx);
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
        const zeroContext = assertZeroContext(ctx);
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
    registerInventoryMovement: defineMutator(
      registerInventoryMovementArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
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
          normalizedRestockMode === "set_as_total" &&
          currentStock < 0
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
        const zeroContext = assertZeroContext(ctx);
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
        const zeroContext = assertZeroContext(ctx);
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
        const zeroContext = assertZeroContext(ctx);
        await assertActiveCategory({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.category.delete({ id: args.id });
      }
    ),
  },
});

export type Mutators = typeof mutators;
