import { z } from "zod";
import { SalesListQueryArgsSchema } from "@/features/sales/sales.schema";
import {
  parseDateBoundary as parseSaleDateBoundary,
  resolveAmountRange,
} from "@/features/sales/sales.shared";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const SALES_TERMINAL_OPTIONS_LIMIT = 300;

const saleByIdArgsSchema = z.object({
  saleId: z.string().trim().optional().nullable(),
});

function normalizeSalesPageLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function applyShiftIdsFilter<T extends ReturnType<typeof zql.sale.where>>(
  query: T,
  shiftIds: string[] | null
) {
  if (shiftIds === null) {
    return query;
  }
  if (shiftIds.length === 0) {
    return query.where(({ cmpLit }) => cmpLit(false, "=", true));
  }
  return query.where(({ cmp, or }) =>
    or(...shiftIds.map((shiftId) => cmp("shiftId", "=", shiftId)))
  );
}

function buildSalesListQuery(
  organizationId: string,
  args: z.infer<typeof SalesListQueryArgsSchema>
) {
  const pageSize = normalizeSalesPageLimit(args.limit);
  const fetchLimit = pageSize + 1;
  const startDateMs = parseSaleDateBoundary(args.startDate);
  const endDateMs = parseSaleDateBoundary(args.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;
  const amountRange = resolveAmountRange(args.amountMin, args.amountMax);
  const normalizedSearch = args.searchQuery?.trim() ?? "";
  const normalizedShiftIds = args.shiftIds?.filter(Boolean) ?? null;
  const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : "";
  const normalizedStatus = args.status?.trim() ?? "";
  const normalizedCashierId = args.cashierId?.trim() ?? "";
  const normalizedTerminalName = args.terminalName?.trim() ?? "";
  const normalizedPaymentMethod = args.paymentMethod?.trim() ?? "";

  let query = applyShiftIdsFilter(
    zql.sale.where("organizationId", organizationId),
    normalizedShiftIds
  )
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

export const salesQueries = {
  sales: {
    list: defineZentroQuery(SalesListQueryArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.sale);
      }

      return buildSalesListQuery(ctx.orgID, args);
    }),
    filterOptions: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.member);
      }

      return zql.member
        .where("organizationId", ctx.orgID)
        .related("user")
        .orderBy("createdAt", "asc")
        .orderBy("id", "asc");
    }),
    terminalOptions: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.shift);
      }

      return zql.shift
        .where("organizationId", ctx.orgID)
        .orderBy("openedAt", "desc")
        .orderBy("id", "desc")
        .limit(SALES_TERMINAL_OPTIONS_LIMIT);
    }),
    byId: defineZentroQuery(saleByIdArgsSchema, ({ args, ctx }) => {
      const normalizedSaleId = args.saleId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedSaleId)) {
        return denyQuery(zql.sale);
      }

      return buildSaleDetailQuery(normalizedSaleId, ctx.orgID);
    }),
  },
};
