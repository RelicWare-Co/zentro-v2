import { z } from "zod";
import { InventoryMovementsListQueryArgsSchema } from "@/features/products/inventory-movements.schema";
import { parseDateBoundary as parseSaleDateBoundary } from "@/features/sales/sales.shared";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const productsSearchArgsSchema = z.object({
  categoryId: z.string().trim().optional().nullable(),
  limit: z.number().int().min(1).max(1000).optional(),
  searchQuery: z.string().trim().optional().nullable(),
});

const productByIdArgsSchema = z.object({
  productId: z.string().trim().optional().nullable(),
});

const productIngredientsByProductArgsSchema = z.object({
  productId: z.string().trim().optional().nullable(),
});

const posCatalogArgsSchema = productsSearchArgsSchema;

function normalizeProductLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 1000, 1), 1000);
}

function buildPosCatalogQuery(
  organizationId: string,
  args: z.infer<typeof posCatalogArgsSchema>
) {
  const normalizedSearch = args.searchQuery?.trim() ?? "";
  const normalizedCategoryId = args.categoryId?.trim() ?? "";
  const searchPattern = `%${normalizedSearch}%`;
  let query = zql.product
    .where("organizationId", organizationId)
    .where("deletedAt", "IS", null)
    .where("isModifier", false)
    .where("isIngredient", false)
    .related("category");

  if (normalizedCategoryId === "uncategorized") {
    query = query.where("categoryId", "IS", null);
  } else if (normalizedCategoryId) {
    query = query.where("categoryId", normalizedCategoryId);
  }

  if (normalizedSearch) {
    query = query.where(({ cmp, or }) =>
      or(
        cmp("name", "ILIKE", searchPattern),
        cmp("sku", "ILIKE", searchPattern),
        cmp("barcode", "ILIKE", searchPattern)
      )
    );
  }

  return query
    .orderBy("name", "asc")
    .orderBy("id", "asc")
    .limit(normalizeProductLimit(args.limit));
}

function normalizeInventoryMovementsPageLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function buildInventoryMovementsListQuery(
  organizationId: string,
  args: z.infer<typeof InventoryMovementsListQueryArgsSchema>
) {
  const pageSize = normalizeInventoryMovementsPageLimit(args.limit);
  const fetchLimit = pageSize + 1;
  const startDateMs = parseSaleDateBoundary(args.startDate);
  const endDateMs = parseSaleDateBoundary(args.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;
  const normalizedSearch = args.searchQuery?.trim() ?? "";
  const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : "";
  const normalizedProductId = args.productId?.trim() ?? "";
  const normalizedType = args.type?.trim() ?? "";

  let query = zql.inventoryMovement
    .where("organizationId", organizationId)
    .related("product")
    .related("user");

  if (normalizedProductId) {
    query = query.where("productId", normalizedProductId);
  }
  if (normalizedType) {
    query = query.where("type", normalizedType);
  }
  if (startDateMs !== null) {
    query = query.where("createdAt", ">=", startDateMs);
  }
  if (endDateExclusiveMs !== null) {
    query = query.where("createdAt", "<", endDateExclusiveMs);
  }
  if (searchPattern) {
    query = query.where(({ cmp, or, exists }) =>
      or(
        cmp("notes", "ILIKE", searchPattern),
        exists("product", (productQuery) =>
          productQuery.where(({ cmp: productCmp, or: productOr }) =>
            productOr(
              productCmp("name", "ILIKE", searchPattern),
              productCmp("sku", "ILIKE", searchPattern),
              productCmp("barcode", "ILIKE", searchPattern)
            )
          )
        ),
        exists("user", (userQuery) =>
          userQuery.where("name", "ILIKE", searchPattern)
        )
      )
    );
  }

  query = query.orderBy("createdAt", "desc").orderBy("id", "desc");

  const normalizedCursorId = args.cursor?.id.trim() ?? "";
  if (args.cursor && normalizedCursorId) {
    query = query.start({
      createdAt: args.cursor.createdAt,
      id: normalizedCursorId,
      organizationId,
    });
  }

  return query.limit(fetchLimit);
}

export const productsQueries = {
  products: {
    categories: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.category);
      }

      return zql.category
        .where("organizationId", ctx.orgID)
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(500);
    }),
    search: defineZentroQuery(productsSearchArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.product);
      }

      const normalizedSearch = args.searchQuery?.trim() ?? "";
      const normalizedCategoryId = args.categoryId?.trim() ?? "";
      const searchPattern = `%${normalizedSearch}%`;
      let query = zql.product
        .where("organizationId", ctx.orgID)
        .where("deletedAt", "IS", null)
        .related("category");

      if (normalizedCategoryId === "uncategorized") {
        query = query.where("categoryId", "IS", null);
      } else if (normalizedCategoryId) {
        query = query.where("categoryId", normalizedCategoryId);
      }

      if (normalizedSearch) {
        query = query.where(({ cmp, or }) =>
          or(
            cmp("name", "ILIKE", searchPattern),
            cmp("sku", "ILIKE", searchPattern),
            cmp("barcode", "ILIKE", searchPattern)
          )
        );
      }

      return query
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(normalizeProductLimit(args.limit));
    }),
    byId: defineZentroQuery(productByIdArgsSchema, ({ args, ctx }) => {
      const normalizedProductId = args.productId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedProductId)) {
        return denyQuery(zql.product);
      }

      return zql.product
        .where("organizationId", ctx.orgID)
        .where("id", normalizedProductId)
        .where("deletedAt", "IS", null)
        .related("category")
        .limit(1);
    }),
    modifiers: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.product);
      }

      return zql.product
        .where("organizationId", ctx.orgID)
        .where("isModifier", true)
        .where("isIngredient", false)
        .where("deletedAt", "IS", null)
        .related("category")
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(500);
    }),
    ingredients: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.product);
      }

      return zql.product
        .where("organizationId", ctx.orgID)
        .where("isIngredient", true)
        .where("deletedAt", "IS", null)
        .related("category")
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(500);
    }),
    posCatalog: defineZentroQuery(posCatalogArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.product);
      }

      return buildPosCatalogQuery(ctx.orgID, args);
    }),
    movements: {
      list: defineZentroQuery(
        InventoryMovementsListQueryArgsSchema,
        ({ args, ctx }) => {
          if (!hasOrgContext(ctx)) {
            return denyQuery(zql.inventoryMovement);
          }

          return buildInventoryMovementsListQuery(ctx.orgID, args);
        }
      ),
    },
  },
  productIngredients: {
    byProduct: defineZentroQuery(
      productIngredientsByProductArgsSchema,
      ({ args, ctx }) => {
        const normalizedProductId = args.productId?.trim() ?? "";
        if (!(hasOrgContext(ctx) && normalizedProductId)) {
          return denyQuery(zql.productIngredient);
        }

        return zql.productIngredient
          .where("organizationId", ctx.orgID)
          .where("productId", normalizedProductId)
          .orderBy("id", "asc")
          .limit(500);
      }
    ),
  },
};
