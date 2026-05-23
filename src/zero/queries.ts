// Shared Zero queries.
//
// Each entry is a named `defineQuery(...)` so the server endpoint
// (`/api/zero/query`) can re-derive the authoritative query text from
// `(name, args)` without trusting raw client AST.
//
// Conventions:
// - Always validate `args` with a Standard-Schema validator (Zod) when the
//   query takes inputs. The client may lie; the validator is the trust
//   boundary.
// - Always read identity/permissions from `ctx`, never from `args`.
// - When the user is not allowed to see anything, return an empty query
//   instead of throwing. Throwing on the server kills the whole batch.
// - Keep query text identical client/server — Zero merges them by name.

import { defineQueries, defineQuery } from "@rocicorp/zero";
import { z } from "zod";
// Importing `./context` registers `ZeroContext` into Zero's DefaultTypes so
// `ctx` here is typed as `ZeroContext | undefined`.
import "./context";
import { zql } from "./schema";

const customersSearchArgsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  searchQuery: z.string().trim().optional().nullable(),
});

const productsSearchArgsSchema = z.object({
  categoryId: z.string().trim().optional().nullable(),
  limit: z.number().int().min(1).max(1000).optional(),
  searchQuery: z.string().trim().optional().nullable(),
});

const posCatalogArgsSchema = productsSearchArgsSchema;

const shiftByIdArgsSchema = z.object({
  shiftId: z.string().trim().optional().nullable(),
});

const creditTransactionsArgsSchema = z.object({
  creditAccountId: z.string().trim().optional().nullable(),
});

const SHIFTS_SYNC_LIMIT = 500;
export const SALES_SYNC_LIMIT = 1000;

const saleByIdArgsSchema = z.object({
  saleId: z.string().trim().optional().nullable(),
});

function normalizeLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

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

function buildShiftDetailQuery(shiftId: string, organizationId: string) {
  return zql.shift
    .where("id", shiftId)
    .where("organizationId", organizationId)
    .related("user")
    .related("cashMovements", (query) =>
      query.orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .related("closures")
    .related("sales")
    .related("payments", (query) =>
      query.related("sale").orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .limit(1);
}

function buildShiftsByOrgQuery(organizationId: string) {
  return zql.shift
    .where("organizationId", organizationId)
    .related("user")
    .related("cashMovements", (query) =>
      query.orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .related("closures")
    .related("sales")
    .related("payments", (query) =>
      query.related("sale").orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .orderBy("openedAt", "desc")
    .orderBy("id", "desc")
    .limit(SHIFTS_SYNC_LIMIT);
}

function buildSalesByOrgQuery(organizationId: string) {
  return zql.sale
    .where("organizationId", organizationId)
    .related("user")
    .related("customer")
    .related("shift")
    .related("payments")
    .related("items")
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(SALES_SYNC_LIMIT);
}

function buildSaleDetailQuery(saleId: string, organizationId: string) {
  return zql.sale
    .where("id", saleId)
    .where("organizationId", organizationId)
    .related("user")
    .related("customer")
    .related("shift")
    .related("payments", (query) => query.related("creditTransactions"))
    .related("items", (query) =>
      query
        .related("product")
        .related("modifiers", (modifierQuery) =>
          modifierQuery.related("modifierProduct")
        )
    )
    .limit(1);
}

export const queries = defineQueries({
  /**
   * Returns the active membership rows of the authenticated user for their
   * active organization. Useful as a low-cost auth probe and for surfacing
   * the user's role in the UI (badges, conditional rendering).
   *
   * Logged-out clients receive an empty result via the `cmpLit(false, '=', true)`
   * permission gate (Zero's idiomatic "deny everything" predicate).
   */
  myMembership: defineQuery(({ ctx }) => {
    if (!ctx) {
      return zql.member.where(({ cmpLit }) => cmpLit(false, "=", true));
    }
    return zql.member
      .where("userId", ctx.id)
      .where("organizationId", ctx.orgID);
  }),
  customers: {
    search: defineQuery(customersSearchArgsSchema, ({ args, ctx }) => {
      if (!ctx) {
        return zql.customer.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      const normalizedSearch = args.searchQuery?.trim() ?? "";
      const searchPattern = `%${normalizedSearch}%`;
      let query = zql.customer
        .where("organizationId", ctx.orgID)
        .where("deletedAt", "IS", null);

      if (normalizedSearch) {
        query = query.where(({ cmp, or }) =>
          or(
            cmp("name", "ILIKE", searchPattern),
            cmp("documentNumber", "ILIKE", searchPattern),
            cmp("phone", "ILIKE", searchPattern),
            cmp("email", "ILIKE", searchPattern)
          )
        );
      }

      return query
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(normalizeLimit(args.limit));
    }),
  },
  products: {
    categories: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.category.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.category
        .where("organizationId", ctx.orgID)
        .orderBy("name", "asc")
        .orderBy("id", "asc");
    }),
    search: defineQuery(productsSearchArgsSchema, ({ args, ctx }) => {
      if (!ctx) {
        return zql.product.where(({ cmpLit }) => cmpLit(false, "=", true));
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
    modifiers: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.product.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.product
        .where("organizationId", ctx.orgID)
        .where("isModifier", true)
        .where("deletedAt", "IS", null)
        .related("category")
        .orderBy("name", "asc")
        .orderBy("id", "asc");
    }),
    posCatalog: defineQuery(posCatalogArgsSchema, ({ args, ctx }) => {
      if (!ctx) {
        return zql.product.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildPosCatalogQuery(ctx.orgID, args);
    }),
  },
  credit: {
    accounts: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.creditAccount.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.creditAccount
        .where("organizationId", ctx.orgID)
        .related("customer")
        .orderBy("id", "asc");
    }),
    transactions: defineQuery(creditTransactionsArgsSchema, ({ args, ctx }) => {
      const normalizedCreditAccountId = args.creditAccountId?.trim() ?? "";
      if (!(ctx && normalizedCreditAccountId)) {
        return zql.creditTransaction.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.creditTransaction
        .where("organizationId", ctx.orgID)
        .where("creditAccountId", normalizedCreditAccountId)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc");
    }),
  },
  shifts: {
    active: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.shift.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.shift
        .where("organizationId", ctx.orgID)
        .where("userId", ctx.id)
        .where("status", "open")
        .orderBy("openedAt", "desc")
        .orderBy("id", "desc")
        .limit(1);
    }),
    byOrg: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.shift.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildShiftsByOrgQuery(ctx.orgID);
    }),
    byId: defineQuery(shiftByIdArgsSchema, ({ args, ctx }) => {
      const normalizedShiftId = args.shiftId?.trim() ?? "";
      if (!(ctx && normalizedShiftId)) {
        return zql.shift.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildShiftDetailQuery(normalizedShiftId, ctx.orgID);
    }),
    organization: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
  },
  sales: {
    byOrg: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.sale.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildSalesByOrgQuery(ctx.orgID);
    }),
    byId: defineQuery(saleByIdArgsSchema, ({ args, ctx }) => {
      const normalizedSaleId = args.saleId?.trim() ?? "";
      if (!(ctx && normalizedSaleId)) {
        return zql.sale.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildSaleDetailQuery(normalizedSaleId, ctx.orgID);
    }),
  },
  organization: {
    environment: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization
        .where("id", ctx.orgID)
        .related("members")
        .related("invitations")
        .related("products", (query) => query.where("deletedAt", "IS", null))
        .related("customers", (query) => query.where("deletedAt", "IS", null))
        .limit(1);
    }),
    moduleEntitlements: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.organizationModuleEntitlement.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.organizationModuleEntitlement.where(
        "organizationId",
        ctx.orgID
      );
    }),
  },
  modules: {
    capabilities: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
  },
});

export type Queries = typeof queries;
