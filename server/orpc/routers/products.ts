import { implement, ORPCError } from "@orpc/server";
import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import type { dbSqlite } from "@/database/drizzle/db";
import {
  category,
  inventoryMovement,
  product,
} from "@/database/drizzle/schema/inventory.schema";
import type { AppContext } from "../context";
import { productsContract } from "../contracts/products";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const productsImplementer = implement(productsContract).$context<AppContext>();

const orgRequiredProcedure = productsImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
}

function normalizeCount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }
  return 0;
}

function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`,
    });
  }
  return Math.round(value);
}

function toInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido`,
    });
  }
  return Math.round(value);
}

function resolveDate(input?: number) {
  if (input === undefined) {
    return new Date();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La fecha indicada no es válida",
    });
  }

  return new Date(Math.round(input));
}

async function assertCategoryFromOrganization(input: {
  db: ReturnType<typeof dbSqlite>;
  organizationId: string;
  categoryId?: string | null;
}) {
  const normalizedCategoryId = normalizeOptionalString(input.categoryId);
  if (!normalizedCategoryId) {
    return null;
  }

  const [existingCategory] = await input.db
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        eq(category.id, normalizedCategoryId),
        eq(category.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!existingCategory) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La categoría seleccionada no existe en la organización actual",
    });
  }

  return normalizedCategoryId;
}

export const list = orgRequiredProcedure.list.handler(
  async ({ input, context }) => {
    const page = Math.max(input.page ?? 0, 0);
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const normalizedQuery = input.query?.trim().toLowerCase() ?? "";
    const normalizedCategoryId = input.categoryId?.trim() ?? "";
    const searchPattern = `%${normalizedQuery}%`;

    const clauses = [
      eq(product.organizationId, context.organizationId),
      isNull(product.deletedAt),
    ];
    if (normalizedCategoryId === "uncategorized") {
      clauses.push(isNull(product.categoryId));
    } else if (normalizedCategoryId) {
      clauses.push(eq(product.categoryId, normalizedCategoryId));
    }
    if (normalizedQuery) {
      clauses.push(
        sql`(lower(${product.name}) LIKE ${searchPattern} OR lower(coalesce(${product.sku}, '')) LIKE ${searchPattern} OR lower(coalesce(${product.barcode}, '')) LIKE ${searchPattern})`
      );
    }

    const [rows, totalRows] = await Promise.all([
      context.db
        .select({
          id: product.id,
          name: product.name,
          categoryId: product.categoryId,
          categoryName: category.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price,
          cost: product.cost,
          taxRate: product.taxRate,
          stock: product.stock,
          trackInventory: product.trackInventory,
          isModifier: product.isModifier,
          isFavorite: product.isFavorite,
          createdAt: product.createdAt,
        })
        .from(product)
        .leftJoin(
          category,
          and(
            eq(product.categoryId, category.id),
            eq(category.organizationId, context.organizationId)
          )
        )
        .where(and(...clauses))
        .orderBy(asc(product.name))
        .limit(pageSize)
        .offset(page * pageSize),
      context.db
        .select({ total: sql<number>`count(*)` })
        .from(product)
        .leftJoin(
          category,
          and(
            eq(product.categoryId, category.id),
            eq(category.organizationId, context.organizationId)
          )
        )
        .where(and(...clauses)),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        cost: row.cost ?? 0,
        taxRate: row.taxRate ?? 0,
        createdAt: toTimestamp(row.createdAt),
      })),
      total: normalizeCount(totalRows[0]?.total),
      page,
      pageSize,
    };
  }
);

export const categories = orgRequiredProcedure.categories.handler(
  async ({ context }) =>
    context.db
      .select({
        id: category.id,
        name: category.name,
        description: category.description,
      })
      .from(category)
      .where(eq(category.organizationId, context.organizationId))
      .orderBy(asc(category.name))
);

export const create = orgRequiredProcedure.create.handler(
  async ({ input, context }) => {
    const resolvedCategoryId = await assertCategoryFromOrganization({
      db: context.db,
      organizationId: context.organizationId,
      categoryId: input.categoryId,
    });
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new ORPCError("BAD_REQUEST", {
        message: "El nombre del producto es obligatorio",
      });
    }

    const id = crypto.randomUUID();
    await context.db.insert(product).values({
      id,
      organizationId: context.organizationId,
      categoryId: resolvedCategoryId,
      name: normalizedName,
      sku: normalizeOptionalString(input.sku),
      barcode: normalizeOptionalString(input.barcode),
      price: toNonNegativeInteger(input.price, "price"),
      cost: toNonNegativeInteger(input.cost ?? 0, "cost"),
      taxRate: toNonNegativeInteger(input.taxRate ?? 0, "taxRate"),
      stock: toNonNegativeInteger(input.stock ?? 0, "stock"),
      trackInventory: input.trackInventory ?? true,
      isModifier: input.isModifier ?? false,
      createdAt: new Date(),
    });

    return { id };
  }
);

export const update = orgRequiredProcedure.update.handler(
  async ({ input, context }) => {
    const updates: Partial<typeof product.$inferInsert> = {};
    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) {
        throw new ORPCError("BAD_REQUEST", {
          message: "El nombre del producto es obligatorio",
        });
      }
      updates.name = normalizedName;
    }
    if (input.sku !== undefined) {
      updates.sku = normalizeOptionalString(input.sku);
    }
    if (input.barcode !== undefined) {
      updates.barcode = normalizeOptionalString(input.barcode);
    }
    if (input.price !== undefined) {
      updates.price = toNonNegativeInteger(input.price, "price");
    }
    if (input.cost !== undefined) {
      updates.cost = toNonNegativeInteger(input.cost, "cost");
    }
    if (input.taxRate !== undefined) {
      updates.taxRate = toNonNegativeInteger(input.taxRate, "taxRate");
    }
    if (input.stock !== undefined) {
      updates.stock = toNonNegativeInteger(input.stock, "stock");
    }
    if (input.trackInventory !== undefined) {
      updates.trackInventory = input.trackInventory;
    }
    if (input.isModifier !== undefined) {
      updates.isModifier = input.isModifier;
    }
    if (input.categoryId !== undefined) {
      updates.categoryId = await assertCategoryFromOrganization({
        db: context.db,
        organizationId: context.organizationId,
        categoryId: input.categoryId,
      });
    }

    const updatedProducts = await context.db
      .update(product)
      .set(updates)
      .where(
        and(
          eq(product.id, input.id),
          eq(product.organizationId, context.organizationId),
          isNull(product.deletedAt)
        )
      )
      .returning({ id: product.id });

    if (updatedProducts.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message:
          "El producto no existe o ya fue eliminado en la organización actual",
      });
    }

    return { success: true };
  }
);

export const deleteProduct = orgRequiredProcedure.delete.handler(
  async ({ input, context }) => {
    const deletedProducts = await context.db
      .update(product)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(product.id, input.id),
          eq(product.organizationId, context.organizationId),
          isNull(product.deletedAt)
        )
      )
      .returning({ id: product.id });

    if (deletedProducts.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message:
          "El producto no existe o ya fue eliminado en la organización actual",
      });
    }

    return { success: true };
  }
);

export const registerInventoryMovement =
  orgRequiredProcedure.registerInventoryMovement.handler(
    ({ input, context }) => {
      const baseQuantity = toInteger(input.quantity, "quantity");
      if (baseQuantity === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "La cantidad debe ser diferente de 0",
        });
      }

      let deltaQuantity = baseQuantity;
      const normalizedRestockMode = input.restockMode ?? "add_to_stock";
      if (input.type === "restock" && baseQuantity < 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "La reposición debe tener una cantidad positiva",
        });
      }
      if (input.type === "waste") {
        deltaQuantity = -Math.abs(baseQuantity);
      }

      const createdAt = resolveDate(input.createdAt);

      return context.db.transaction(async (tx) => {
        const [targetProduct] = await tx
          .select({
            id: product.id,
            name: product.name,
            stock: product.stock,
            trackInventory: product.trackInventory,
          })
          .from(product)
          .where(
            and(
              eq(product.id, input.productId),
              eq(product.organizationId, context.organizationId),
              isNull(product.deletedAt)
            )
          )
          .limit(1);

        if (!targetProduct) {
          throw new ORPCError("NOT_FOUND", {
            message: "Producto no encontrado en la organización activa",
          });
        }

        if (!targetProduct.trackInventory) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "No puedes registrar movimientos en un producto sin control de inventario",
          });
        }

        if (
          input.type === "restock" &&
          normalizedRestockMode === "set_as_total" &&
          targetProduct.stock < 0
        ) {
          deltaQuantity = baseQuantity - targetProduct.stock;
        }

        const updated = await tx
          .update(product)
          .set({ stock: sql`${product.stock} + ${deltaQuantity}` })
          .where(
            and(
              eq(product.id, targetProduct.id),
              eq(product.organizationId, context.organizationId),
              isNull(product.deletedAt),
              ...(deltaQuantity < 0
                ? [gte(product.stock, Math.abs(deltaQuantity))]
                : [])
            )
          )
          .returning({ id: product.id });

        if (updated.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Stock insuficiente para ${targetProduct.name}. Disponible: ${targetProduct.stock}`,
          });
        }

        const movementId = crypto.randomUUID();
        await tx.insert(inventoryMovement).values({
          id: movementId,
          organizationId: context.organizationId,
          productId: targetProduct.id,
          userId: context.user.id,
          type: input.type,
          quantity: deltaQuantity,
          notes: normalizeOptionalString(input.notes),
          createdAt,
        });

        return {
          id: movementId,
          productId: targetProduct.id,
          quantity: deltaQuantity,
        };
      });
    }
  );

export const createCategory = orgRequiredProcedure.createCategory.handler(
  async ({ input, context }) => {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new ORPCError("BAD_REQUEST", {
        message: "El nombre de la categoría es obligatorio",
      });
    }

    const id = crypto.randomUUID();
    await context.db.insert(category).values({
      id,
      organizationId: context.organizationId,
      name: normalizedName,
      description: normalizeOptionalString(input.description),
      createdAt: new Date(),
    });

    return { id };
  }
);

export const updateCategory = orgRequiredProcedure.updateCategory.handler(
  async ({ input, context }) => {
    const updates: Partial<typeof category.$inferInsert> = {};
    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) {
        throw new ORPCError("BAD_REQUEST", {
          message: "El nombre de la categoría es obligatorio",
        });
      }
      updates.name = normalizedName;
    }
    if (input.description !== undefined) {
      updates.description = normalizeOptionalString(input.description);
    }

    const updatedCategories = await context.db
      .update(category)
      .set(updates)
      .where(
        and(
          eq(category.id, input.id),
          eq(category.organizationId, context.organizationId)
        )
      )
      .returning({ id: category.id });

    if (updatedCategories.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message: "La categoría no existe en la organización actual",
      });
    }

    return { success: true };
  }
);

export const deleteCategory = orgRequiredProcedure.deleteCategory.handler(
  async ({ input, context }) => {
    const deletedCategories = await context.db
      .delete(category)
      .where(
        and(
          eq(category.id, input.id),
          eq(category.organizationId, context.organizationId)
        )
      )
      .returning({ id: category.id });

    if (deletedCategories.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message: "La categoría no existe en la organización actual",
      });
    }

    return { success: true };
  }
);
