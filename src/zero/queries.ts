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
import {
  parseDateBoundary,
  resolveAmountRange,
} from "@/features/sales/sales.shared";
import { SalesListQueryArgsSchema } from "@/schemas/sales";
import type { ZeroContext } from "./context";
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
const SALES_TERMINAL_OPTIONS_LIMIT = 300;

const saleByIdArgsSchema = z.object({
  saleId: z.string().trim().optional().nullable(),
});

const restaurantTableIdArgsSchema = z.object({
  tableId: z.string().trim().optional().nullable(),
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

function normalizeSalesPageLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function buildSalesListQuery(
  organizationId: string,
  args: z.infer<typeof SalesListQueryArgsSchema>
) {
  const pageSize = normalizeSalesPageLimit(args.limit);
  const fetchLimit = pageSize + 1;
  const startDateMs = parseDateBoundary(args.startDate);
  const endDateMs = parseDateBoundary(args.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;
  const amountRange = resolveAmountRange(args.amountMin, args.amountMax);
  const normalizedSearch = args.searchQuery?.trim() ?? "";
  const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : "";
  const normalizedStatus = args.status?.trim() ?? "";
  const normalizedCashierId = args.cashierId?.trim() ?? "";
  const normalizedTerminalName = args.terminalName?.trim() ?? "";
  const normalizedPaymentMethod = args.paymentMethod?.trim() ?? "";

  let query = zql.sale
    .where("organizationId", organizationId)
    .related("user")
    .related("customer")
    .related("shift")
    .related("payments")
    .related("items");

  if (normalizedStatus) {
    query = query.where("status", normalizedStatus);
  }
  if (normalizedCashierId) {
    query = query.where("userId", normalizedCashierId);
  }
  if (startDateMs !== null) {
    query = query.where("createdAt", ">=", startDateMs);
  }
  if (endDateExclusiveMs !== null) {
    query = query.where("createdAt", "<", endDateExclusiveMs);
  }
  if (amountRange.minimum !== null) {
    query = query.where("totalAmount", ">=", amountRange.minimum);
  }
  if (amountRange.maximum !== null) {
    query = query.where("totalAmount", "<=", amountRange.maximum);
  }
  if (normalizedTerminalName) {
    query = query.whereExists("shift", (shiftQuery) =>
      shiftQuery.where("terminalName", normalizedTerminalName)
    );
  }
  if (normalizedPaymentMethod) {
    query = query.whereExists("payments", (paymentQuery) =>
      paymentQuery.where("method", normalizedPaymentMethod)
    );
  }
  if (searchPattern) {
    query = query.where(({ cmp, or, exists }) =>
      or(
        cmp("id", "ILIKE", searchPattern),
        cmp("status", "ILIKE", searchPattern),
        exists("customer", (customerQuery) =>
          customerQuery.where(({ cmp: customerCmp, or: customerOr }) =>
            customerOr(
              customerCmp("name", "ILIKE", searchPattern),
              customerCmp("documentNumber", "ILIKE", searchPattern),
              customerCmp("phone", "ILIKE", searchPattern)
            )
          )
        ),
        exists("user", (userQuery) =>
          userQuery.where("name", "ILIKE", searchPattern)
        ),
        exists("shift", (shiftQuery) =>
          shiftQuery.where("terminalName", "ILIKE", searchPattern)
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

function denyAllMembers() {
  return zql.member.where(({ cmpLit }) => cmpLit(false, "=", true));
}

function hasOrgContext(
  ctx: ZeroContext | undefined
): ctx is ZeroContext & { orgID: string } {
  return Boolean(ctx?.orgID);
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
    if (!hasOrgContext(ctx)) {
      return denyAllMembers();
    }
    return zql.member
      .where("userId", ctx.id)
      .where("organizationId", ctx.orgID);
  }),
  customers: {
    search: defineQuery(customersSearchArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
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
      if (!hasOrgContext(ctx)) {
        return zql.category.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.category
        .where("organizationId", ctx.orgID)
        .orderBy("name", "asc")
        .orderBy("id", "asc");
    }),
    search: defineQuery(productsSearchArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
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
      if (!hasOrgContext(ctx)) {
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
      if (!hasOrgContext(ctx)) {
        return zql.product.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildPosCatalogQuery(ctx.orgID, args);
    }),
  },
  credit: {
    accounts: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
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
      if (!(hasOrgContext(ctx) && normalizedCreditAccountId)) {
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
      if (!hasOrgContext(ctx)) {
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
      if (!hasOrgContext(ctx)) {
        return zql.shift.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildShiftsByOrgQuery(ctx.orgID);
    }),
    byId: defineQuery(shiftByIdArgsSchema, ({ args, ctx }) => {
      const normalizedShiftId = args.shiftId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedShiftId)) {
        return zql.shift.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildShiftDetailQuery(normalizedShiftId, ctx.orgID);
    }),
    organization: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
  },
  sales: {
    list: defineQuery(SalesListQueryArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.sale.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildSalesListQuery(ctx.orgID, args);
    }),
    filterOptions: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.member.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.member
        .where("organizationId", ctx.orgID)
        .related("user")
        .orderBy("createdAt", "asc")
        .orderBy("id", "asc");
    }),
    terminalOptions: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.shift.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.shift
        .where("organizationId", ctx.orgID)
        .orderBy("openedAt", "desc")
        .orderBy("id", "desc")
        .limit(SALES_TERMINAL_OPTIONS_LIMIT);
    }),
    byId: defineQuery(saleByIdArgsSchema, ({ args, ctx }) => {
      const normalizedSaleId = args.saleId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedSaleId)) {
        return zql.sale.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return buildSaleDetailQuery(normalizedSaleId, ctx.orgID);
    }),
  },
  organization: {
    selection: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.invitation.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.invitation
        .where("email", ctx.email)
        .where("status", "pending")
        .related("organization")
        .orderBy("createdAt", "desc");
    }),
    management: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization
        .where("id", ctx.orgID)
        .related("members", (query) =>
          query.related("user").orderBy("createdAt", "asc")
        )
        .related("invitations", (query) =>
          query.where("status", "pending").orderBy("createdAt", "desc")
        )
        .related("joinLinks", (query) => query.orderBy("createdAt", "desc"))
        .limit(1);
    }),
    environment: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
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
      if (!hasOrgContext(ctx)) {
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
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
  },
  restaurants: {
    layout: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.restaurantArea.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantArea
        .where("organizationId", ctx.orgID)
        .related("tables", (query) =>
          query.orderBy("sortOrder", "asc").orderBy("name", "asc")
        )
        .orderBy("sortOrder", "asc")
        .orderBy("name", "asc");
    }),
    openOrders: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.restaurantOrder.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantOrder
        .where("organizationId", ctx.orgID)
        .where("status", "open")
        .related("items", (query) =>
          query
            .related("product")
            .related("modifiers", (modifierQuery) =>
              modifierQuery.related("modifierProduct")
            )
            .orderBy("createdAt", "asc")
            .orderBy("id", "asc")
        )
        .related("kitchenTickets", (query) =>
          query.orderBy("sequenceNumber", "desc")
        );
    }),
    tableById: defineQuery(restaurantTableIdArgsSchema, ({ args, ctx }) => {
      const normalizedTableId = args.tableId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedTableId)) {
        return zql.restaurantTable.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantTable
        .where("id", normalizedTableId)
        .where("organizationId", ctx.orgID)
        .related("area")
        .limit(1);
    }),
    kitchenBoard: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.restaurantKitchenTicket.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantKitchenTicket
        .where("organizationId", ctx.orgID)
        .related("order", (query) =>
          query
            .where("status", "open")
            .related("table", (tableQuery) => tableQuery.related("area"))
        )
        .related("items", (query) =>
          query
            .related("product")
            .orderBy("createdAt", "desc")
            .orderBy("id", "desc")
        )
        .orderBy("createdAt", "desc");
    }),
  },
});

export type Queries = typeof queries;
