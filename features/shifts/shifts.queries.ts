import { z } from "zod";
import { ShiftsListQueryArgsSchema } from "@/features/shifts/shifts.schema";
import { parseDateBoundary as parseShiftDateBoundary } from "@/features/shifts/shifts.shared";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const shiftByIdArgsSchema = z.object({
  shiftId: z.string().trim().optional().nullable(),
});

function applyShiftRelations<T extends ReturnType<typeof zql.shift.where>>(
  query: T
) {
  return query
    .related("user")
    .related("cashMovements", (cashMovementQuery) =>
      cashMovementQuery.orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .related("closures")
    .related("sales", (saleQuery) =>
      saleQuery.related("items", (itemQuery) =>
        itemQuery.related("product", (productQuery) =>
          productQuery.related("category")
        )
      )
    )
    .related("payments", (paymentQuery) =>
      paymentQuery
        .related("sale")
        .related("creditTransactions")
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
    );
}

function applyShiftListRelations<T extends ReturnType<typeof zql.shift.where>>(
  query: T
) {
  return query
    .related("user")
    .related("cashMovements", (cashMovementQuery) =>
      cashMovementQuery.orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .related("closures")
    .related("sales")
    .related("payments", (paymentQuery) =>
      paymentQuery
        .related("sale")
        .related("creditTransactions")
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
    );
}

function buildShiftDetailQuery(shiftId: string, organizationId: string) {
  return applyShiftRelations(
    zql.shift.where("id", shiftId).where("organizationId", organizationId)
  ).limit(1);
}

function normalizeShiftsPageLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 10, 1), 50);
}

function buildShiftsListQuery(
  organizationId: string,
  args: z.infer<typeof ShiftsListQueryArgsSchema>
) {
  const pageSize = normalizeShiftsPageLimit(args.limit);
  const fetchLimit = pageSize + 1;
  const startDateMs = parseShiftDateBoundary(args.startDate);
  const endDateMs = parseShiftDateBoundary(args.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;
  const normalizedSearch = args.searchQuery?.trim() ?? "";
  const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : "";
  const normalizedStatus = args.status?.trim() ?? "";
  const normalizedCashierId = args.cashierId?.trim() ?? "";
  const normalizedTerminalName = args.terminalName?.trim() ?? "";
  const normalizedPaymentMethod = args.paymentMethod?.trim() ?? "";

  let query = applyShiftListRelations(
    zql.shift.where("organizationId", organizationId)
  );

  if (normalizedStatus) {
    query = query.where("status", normalizedStatus);
  }
  if (normalizedCashierId) {
    query = query.where("userId", normalizedCashierId);
  }
  if (normalizedTerminalName) {
    query = query.where("terminalName", normalizedTerminalName);
  }
  if (startDateMs !== null) {
    query = query.where("openedAt", ">=", startDateMs);
  }
  if (endDateExclusiveMs !== null) {
    query = query.where("openedAt", "<", endDateExclusiveMs);
  }
  if (args.hasMovements === "yes") {
    query = query.whereExists("cashMovements", (movementQuery) =>
      movementQuery.where(({ cmpLit }) => cmpLit(true, "=", true))
    );
  }
  if (normalizedPaymentMethod) {
    query = query.where(({ or, exists }) =>
      or(
        exists("payments", (paymentQuery) =>
          paymentQuery.where("method", normalizedPaymentMethod)
        ),
        exists("cashMovements", (movementQuery) =>
          movementQuery.where("paymentMethod", normalizedPaymentMethod)
        ),
        exists("closures", (closureQuery) =>
          closureQuery.where("paymentMethod", normalizedPaymentMethod)
        )
      )
    );
  }
  if (searchPattern) {
    query = query.where(({ cmp, or, exists }) =>
      or(
        cmp("id", "ILIKE", searchPattern),
        cmp("status", "ILIKE", searchPattern),
        cmp("terminalName", "ILIKE", searchPattern),
        cmp("notes", "ILIKE", searchPattern),
        exists("user", (userQuery) =>
          userQuery.where("name", "ILIKE", searchPattern)
        )
      )
    );
  }

  query = query.orderBy("openedAt", "desc").orderBy("id", "desc");

  const normalizedCursorId = args.cursor?.id.trim() ?? "";
  if (args.cursor && normalizedCursorId) {
    query = query.start({
      openedAt: args.cursor.openedAt,
      id: normalizedCursorId,
      organizationId,
    });
  }

  return query.limit(fetchLimit);
}

export const shiftsQueries = {
  shifts: {
    active: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.shift);
      }

      return zql.shift
        .where("organizationId", ctx.orgID)
        .where("userId", ctx.id)
        .where("status", "open")
        .orderBy("openedAt", "desc")
        .orderBy("id", "desc")
        .limit(1);
    }),
    list: defineZentroQuery(ShiftsListQueryArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.shift);
      }

      return buildShiftsListQuery(ctx.orgID, args);
    }),
    byId: defineZentroQuery(shiftByIdArgsSchema, ({ args, ctx }) => {
      const normalizedShiftId = args.shiftId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedShiftId)) {
        return denyQuery(zql.shift);
      }

      return buildShiftDetailQuery(normalizedShiftId, ctx.orgID);
    }),
  },
};
