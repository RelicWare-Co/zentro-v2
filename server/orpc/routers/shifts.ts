import { implement, ORPCError } from "@orpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import {
  organization,
  user,
} from "../../../database/drizzle/schema/auth.schema";
import {
  cashMovement as cashMovementTable,
  shift,
  shiftClosure,
} from "../../../database/drizzle/schema/pos.schema";
import { payment, sale } from "../../../database/drizzle/schema/sales.schema";
import {
  buildPaymentMethodOptions,
  comparePaymentMethodIds,
  getAllPaymentMethods,
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "../../../features/settings/settings.shared";
import type { ListShiftsInputSchema } from "../../../schemas/shifts";
import type { AppContext } from "../context";
import { shiftsContract } from "../contracts/shifts";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const shiftsImplementer = implement(shiftsContract).$context<AppContext>();

const orgRequiredProcedure = shiftsImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" es obligatorio`,
    });
  }
  return normalized;
}

function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`,
    });
  }
  return Math.round(value);
}

function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido mayor a 0`,
    });
  }
  return normalized;
}

function resolveDate(input?: number) {
  if (input === undefined) {
    return new Date();
  }
  return new Date(toNonNegativeInteger(input, "timestamp"));
}

function toTimestamp(value: Date | number | string | null | undefined) {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}

function buildExpectedAmountsByMethod(
  startingCash: number,
  payments: Array<{
    method: string;
    amount: number;
    saleId?: string | null;
    saleTotalAmount?: number | null;
  }>,
  movements: Array<{ type: string; paymentMethod: string; amount: number }>
) {
  const expectedByMethod = new Map<string, number>();
  const salePaymentStats = new Map<
    string,
    { saleTotalAmount: number; totalPaid: number; cashPaid: number }
  >();

  for (const registeredPayment of payments) {
    expectedByMethod.set(
      registeredPayment.method,
      (expectedByMethod.get(registeredPayment.method) ?? 0) +
        registeredPayment.amount
    );

    if (
      !registeredPayment.saleId ||
      registeredPayment.saleTotalAmount === null ||
      registeredPayment.saleTotalAmount === undefined
    ) {
      continue;
    }

    const paymentStats = salePaymentStats.get(registeredPayment.saleId) ?? {
      saleTotalAmount: normalizeNumber(registeredPayment.saleTotalAmount),
      totalPaid: 0,
      cashPaid: 0,
    };
    paymentStats.totalPaid += registeredPayment.amount;
    if (registeredPayment.method === "cash") {
      paymentStats.cashPaid += registeredPayment.amount;
    }
    salePaymentStats.set(registeredPayment.saleId, paymentStats);
  }

  let changeReturnedInCash = 0;
  for (const paymentStats of salePaymentStats.values()) {
    const overpayment = Math.max(
      paymentStats.totalPaid - paymentStats.saleTotalAmount,
      0
    );
    if (overpayment <= 0 || paymentStats.cashPaid <= 0) {
      continue;
    }
    changeReturnedInCash += Math.min(overpayment, paymentStats.cashPaid);
  }

  if (changeReturnedInCash > 0) {
    expectedByMethod.set(
      "cash",
      Math.max((expectedByMethod.get("cash") ?? 0) - changeReturnedInCash, 0)
    );
  }

  expectedByMethod.set(
    "cash",
    (expectedByMethod.get("cash") ?? 0) + startingCash
  );

  for (const movement of movements) {
    const paymentMethod = movement.paymentMethod || "cash";
    const currentAmount = expectedByMethod.get(paymentMethod) ?? 0;

    switch (movement.type) {
      case "inflow":
        expectedByMethod.set(paymentMethod, currentAmount + movement.amount);
        break;
      case "expense":
      case "payout":
        expectedByMethod.set(paymentMethod, currentAmount - movement.amount);
        break;
      default:
        throw new ORPCError("BAD_REQUEST", {
          message: `Tipo de movimiento de caja no soportado: ${movement.type}`,
        });
    }
  }

  return expectedByMethod;
}

function parseDateBoundary(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

function buildShiftWhereConditions(
  input: z.infer<typeof ListShiftsInputSchema>,
  organizationId: string
) {
  const trimmedSearchQuery = input.searchQuery?.trim();
  const startDateMs = parseDateBoundary(input.startDate);
  const endDateMs = parseDateBoundary(input.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;
  const totalDifferenceExpression = sql<number>`coalesce((
			select sum(${shiftClosure.difference})
			from ${shiftClosure}
			where ${shiftClosure.shiftId} = ${shift.id}
		), 0)`;

  const whereConditions = [eq(shift.organizationId, organizationId)];
  if (input.status) {
    whereConditions.push(eq(shift.status, input.status));
  }
  if (input.cashierId) {
    whereConditions.push(eq(shift.userId, input.cashierId));
  }
  if (input.terminalName) {
    whereConditions.push(eq(shift.terminalName, input.terminalName));
  }
  if (trimmedSearchQuery) {
    const searchPattern = `%${trimmedSearchQuery}%`;
    whereConditions.push(
      sql`(
					${shift.id} like ${searchPattern}
					or ${user.name} like ${searchPattern}
					or coalesce(${shift.terminalName}, '') like ${searchPattern}
					or coalesce(${shift.notes}, '') like ${searchPattern}
				)`
    );
  }
  if (input.paymentMethod) {
    whereConditions.push(
      sql`(
					exists (
						select 1
						from ${payment}
						where ${payment.organizationId} = ${organizationId}
							and ${payment.shiftId} = ${shift.id}
							and ${payment.method} = ${input.paymentMethod}
					)
					or exists (
						select 1
						from ${cashMovementTable}
						where ${cashMovementTable.organizationId} = ${organizationId}
							and ${cashMovementTable.shiftId} = ${shift.id}
							and ${cashMovementTable.paymentMethod} = ${input.paymentMethod}
					)
					or exists (
						select 1
						from ${shiftClosure}
						where ${shiftClosure.shiftId} = ${shift.id}
							and ${shiftClosure.paymentMethod} = ${input.paymentMethod}
					)
				)`
    );
  }
  if (input.hasMovements === "yes") {
    whereConditions.push(
      sql`exists (
					select 1
					from ${cashMovementTable}
					where ${cashMovementTable.organizationId} = ${organizationId}
						and ${cashMovementTable.shiftId} = ${shift.id}
				)`
    );
  }
  if (input.hasMovements === "no") {
    whereConditions.push(
      sql`not exists (
					select 1
					from ${cashMovementTable}
					where ${cashMovementTable.organizationId} = ${organizationId}
						and ${cashMovementTable.shiftId} = ${shift.id}
				)`
    );
  }
  if (input.differenceStatus === "over") {
    whereConditions.push(sql`${totalDifferenceExpression} > 0`);
  }
  if (input.differenceStatus === "short") {
    whereConditions.push(sql`${totalDifferenceExpression} < 0`);
  }
  if (input.differenceStatus === "balanced") {
    whereConditions.push(
      sql`exists (
					select 1
					from ${shiftClosure}
					where ${shiftClosure.shiftId} = ${shift.id}
				) and ${totalDifferenceExpression} = 0`
    );
  }
  if (startDateMs !== null) {
    whereConditions.push(gte(shift.openedAt, new Date(startDateMs)));
  }
  if (endDateExclusiveMs !== null) {
    whereConditions.push(lt(shift.openedAt, new Date(endDateExclusiveMs)));
  }

  return whereConditions;
}

export const list = orgRequiredProcedure.list.handler(
  async ({ input, context }) => {
    const { organizationId } = context;
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
    const cursor = Math.max(input.cursor ?? 0, 0);
    const whereConditions = buildShiftWhereConditions(input, organizationId);

    const [
      shiftRows,
      totalRows,
      cashierRows,
      terminalRows,
      organizationRows,
      paymentRowsForFilters,
      movementRowsForFilters,
      closureRowsForFilters,
    ] = await Promise.all([
      context.db
        .select({
          id: shift.id,
          userId: shift.userId,
          cashierName: user.name,
          terminalName: shift.terminalName,
          status: shift.status,
          startingCash: shift.startingCash,
          openedAt: shift.openedAt,
          closedAt: shift.closedAt,
          notes: shift.notes,
        })
        .from(shift)
        .innerJoin(user, eq(user.id, shift.userId))
        .where(and(...whereConditions))
        .orderBy(desc(shift.openedAt), desc(shift.id))
        .limit(limit + 1)
        .offset(cursor),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(shift)
        .innerJoin(user, eq(user.id, shift.userId))
        .where(and(...whereConditions)),
      context.db
        .selectDistinct({
          id: user.id,
          name: user.name,
        })
        .from(shift)
        .innerJoin(user, eq(user.id, shift.userId))
        .where(eq(shift.organizationId, organizationId))
        .orderBy(asc(user.name)),
      context.db
        .selectDistinct({
          name: shift.terminalName,
        })
        .from(shift)
        .where(
          and(
            eq(shift.organizationId, organizationId),
            sql`${shift.terminalName} is not null`
          )
        )
        .orderBy(asc(shift.terminalName)),
      context.db
        .select({
          metadata: organization.metadata,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
      context.db
        .selectDistinct({
          method: payment.method,
        })
        .from(payment)
        .where(eq(payment.organizationId, organizationId))
        .orderBy(asc(payment.method)),
      context.db
        .selectDistinct({
          paymentMethod: cashMovementTable.paymentMethod,
        })
        .from(cashMovementTable)
        .where(eq(cashMovementTable.organizationId, organizationId))
        .orderBy(asc(cashMovementTable.paymentMethod)),
      context.db
        .selectDistinct({
          paymentMethod: shiftClosure.paymentMethod,
        })
        .from(shiftClosure)
        .innerJoin(shift, eq(shift.id, shiftClosure.shiftId))
        .where(eq(shift.organizationId, organizationId))
        .orderBy(asc(shiftClosure.paymentMethod)),
    ]);
    const organizationSettings = parseOrganizationSettingsMetadata(
      organizationRows[0]?.metadata
    );
    const paymentMethods = buildPaymentMethodOptions(
      getAllPaymentMethods(organizationSettings),
      [
        ...paymentRowsForFilters.map((paymentRow) => paymentRow.method),
        ...movementRowsForFilters.map(
          (movementRow) => movementRow.paymentMethod
        ),
        ...closureRowsForFilters.map((closureRow) => closureRow.paymentMethod),
      ]
    );
    const terminalNames = terminalRows.reduce<string[]>((acc, terminal) => {
      if (terminal.name) {
        acc.push(terminal.name);
      }
      return acc;
    }, []);

    const pageRows = shiftRows.slice(0, limit);
    const hasMore = shiftRows.length > limit;
    const nextCursor = hasMore ? cursor + limit : null;
    const shiftIds = pageRows.map((currentShift) => currentShift.id);

    if (shiftIds.length === 0) {
      return {
        data: [],
        total: normalizeNumber(totalRows[0]?.total),
        hasMore,
        nextCursor,
        filterOptions: {
          cashiers: cashierRows,
          terminals: terminalNames,
          paymentMethods,
        },
      };
    }

    const [saleRows, paymentRows, movementRows, closureRows] =
      await Promise.all([
        context.db
          .select({
            shiftId: sale.shiftId,
            status: sale.status,
            salesCount: sql<number>`count(*)`,
            totalAmount: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          })
          .from(sale)
          .where(
            and(
              eq(sale.organizationId, organizationId),
              inArray(sale.shiftId, shiftIds)
            )
          )
          .groupBy(sale.shiftId, sale.status),
        context.db
          .select({
            shiftId: payment.shiftId,
            method: payment.method,
            amount: payment.amount,
            saleId: payment.saleId,
            saleTotalAmount: sale.totalAmount,
            createdAt: payment.createdAt,
          })
          .from(payment)
          .leftJoin(sale, eq(sale.id, payment.saleId))
          .where(
            and(
              eq(payment.organizationId, organizationId),
              inArray(payment.shiftId, shiftIds),
              or(isNull(payment.saleId), ne(sale.status, "cancelled"))
            )
          )
          .orderBy(desc(payment.createdAt)),
        context.db
          .select({
            id: cashMovementTable.id,
            shiftId: cashMovementTable.shiftId,
            type: cashMovementTable.type,
            paymentMethod: cashMovementTable.paymentMethod,
            amount: cashMovementTable.amount,
            description: cashMovementTable.description,
            createdAt: cashMovementTable.createdAt,
          })
          .from(cashMovementTable)
          .where(
            and(
              eq(cashMovementTable.organizationId, organizationId),
              inArray(cashMovementTable.shiftId, shiftIds)
            )
          )
          .orderBy(desc(cashMovementTable.createdAt)),
        context.db
          .select({
            shiftId: shiftClosure.shiftId,
            paymentMethod: shiftClosure.paymentMethod,
            expectedAmount: shiftClosure.expectedAmount,
            actualAmount: shiftClosure.actualAmount,
            difference: shiftClosure.difference,
          })
          .from(shiftClosure)
          .where(inArray(shiftClosure.shiftId, shiftIds)),
      ]);

    const operationsByShift = new Map<
      string,
      {
        paidSalesCount: number;
        paidSalesAmount: number;
        cancelledSalesCount: number;
        cancelledSalesAmount: number;
        creditSalesCount: number;
        creditSalesAmount: number;
      }
    >();

    for (const row of saleRows) {
      const current = operationsByShift.get(row.shiftId) ?? {
        paidSalesCount: 0,
        paidSalesAmount: 0,
        cancelledSalesCount: 0,
        cancelledSalesAmount: 0,
        creditSalesCount: 0,
        creditSalesAmount: 0,
      };

      switch (row.status) {
        case "completed":
          current.paidSalesCount += normalizeNumber(row.salesCount);
          current.paidSalesAmount += normalizeNumber(row.totalAmount);
          break;
        case "cancelled":
          current.cancelledSalesCount += normalizeNumber(row.salesCount);
          current.cancelledSalesAmount += normalizeNumber(row.totalAmount);
          break;
        case "credit":
          current.creditSalesCount += normalizeNumber(row.salesCount);
          current.creditSalesAmount += normalizeNumber(row.totalAmount);
          break;
        default:
          break;
      }

      operationsByShift.set(row.shiftId, current);
    }

    const paymentsByShift = new Map<
      string,
      Array<{
        method: string;
        amount: number;
        saleId: string | null;
        saleTotalAmount: number | null;
        createdAt: number;
      }>
    >();
    for (const row of paymentRows) {
      const current = paymentsByShift.get(row.shiftId) ?? [];
      current.push({
        method: row.method,
        amount: normalizeNumber(row.amount),
        saleId: row.saleId,
        saleTotalAmount:
          row.saleTotalAmount === null
            ? null
            : normalizeNumber(row.saleTotalAmount),
        createdAt: toTimestamp(row.createdAt) ?? 0,
      });
      paymentsByShift.set(row.shiftId, current);
    }

    const movementsByShift = new Map<
      string,
      Array<{
        id: string;
        type: string;
        paymentMethod: string;
        amount: number;
        description: string;
        createdAt: number;
      }>
    >();
    for (const row of movementRows) {
      const current = movementsByShift.get(row.shiftId) ?? [];
      current.push({
        id: row.id,
        type: row.type,
        paymentMethod: row.paymentMethod,
        amount: normalizeNumber(row.amount),
        description: row.description,
        createdAt: toTimestamp(row.createdAt) ?? 0,
      });
      movementsByShift.set(row.shiftId, current);
    }

    const closuresByShift = new Map<
      string,
      Array<{
        paymentMethod: string;
        expectedAmount: number;
        actualAmount: number;
        difference: number;
      }>
    >();
    for (const row of closureRows) {
      const current = closuresByShift.get(row.shiftId) ?? [];
      current.push({
        paymentMethod: row.paymentMethod,
        expectedAmount: normalizeNumber(row.expectedAmount),
        actualAmount: normalizeNumber(row.actualAmount),
        difference: normalizeNumber(row.difference),
      });
      closuresByShift.set(row.shiftId, current);
    }

    return {
      data: pageRows.map((row) => {
        const payments = paymentsByShift.get(row.id) ?? [];
        const movements = movementsByShift.get(row.id) ?? [];
        const closures = (closuresByShift.get(row.id) ?? []).toSorted(
          (left, right) =>
            comparePaymentMethodIds(left.paymentMethod, right.paymentMethod)
        );
        const expectedByMethod = buildExpectedAmountsByMethod(
          normalizeNumber(row.startingCash),
          payments.map((paymentRow) => ({
            method: paymentRow.method,
            amount: paymentRow.amount,
            saleId: paymentRow.saleId,
            saleTotalAmount: paymentRow.saleTotalAmount,
          })),
          movements.map((movementRow) => ({
            type: movementRow.type,
            paymentMethod: movementRow.paymentMethod,
            amount: movementRow.amount,
          }))
        );
        const paymentBreakdown = [...expectedByMethod.entries()]
          .map(([method, amount]) => ({
            method,
            amount,
          }))
          .sort((left, right) =>
            comparePaymentMethodIds(left.method, right.method)
          );
        const operations = operationsByShift.get(row.id) ?? {
          paidSalesCount: 0,
          paidSalesAmount: 0,
          cancelledSalesCount: 0,
          cancelledSalesAmount: 0,
          creditSalesCount: 0,
          creditSalesAmount: 0,
        };
        const totalPayments = payments.reduce(
          (total, paymentRow) => total + paymentRow.amount,
          0
        );
        const totalExpected = paymentBreakdown.reduce(
          (total, current) => total + current.amount,
          0
        );
        const totalActual = closures.reduce(
          (total, current) => total + current.actualAmount,
          0
        );
        const totalDifference = closures.reduce(
          (total, current) => total + current.difference,
          0
        );

        return {
          id: row.id,
          userId: row.userId,
          cashierName: row.cashierName,
          terminalName: row.terminalName,
          status: row.status,
          startingCash: normalizeNumber(row.startingCash),
          openedAt: toTimestamp(row.openedAt) ?? 0,
          closedAt: toTimestamp(row.closedAt),
          notes: row.notes,
          operations,
          paymentBreakdown,
          payments,
          movements,
          closures,
          totals: {
            totalPayments,
            expectedCash:
              expectedByMethod.get("cash") ?? normalizeNumber(row.startingCash),
            totalExpected,
            totalActual,
            totalDifference,
          },
        };
      }),
      total: normalizeNumber(totalRows[0]?.total),
      hasMore,
      nextCursor,
      filterOptions: {
        cashiers: cashierRows,
        terminals: terminalNames,
        paymentMethods,
      },
    };
  }
);

export const detail = orgRequiredProcedure.detail.handler(
  async ({ input, context }) => {
    const { organizationId } = context;
    const shiftId = input.shiftId;

    const [targetShiftRow] = await context.db
      .select({
        id: shift.id,
        userId: shift.userId,
        cashierName: user.name,
        terminalName: shift.terminalName,
        status: shift.status,
        startingCash: shift.startingCash,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        notes: shift.notes,
      })
      .from(shift)
      .innerJoin(user, eq(user.id, shift.userId))
      .where(
        and(eq(shift.id, shiftId), eq(shift.organizationId, organizationId))
      )
      .limit(1);

    if (!targetShiftRow) {
      throw new ORPCError("NOT_FOUND", {
        message: "Turno no encontrado para la organización activa",
      });
    }

    const [saleRows, paymentRows, movementRows, closureRows] =
      await Promise.all([
        context.db
          .select({
            shiftId: sale.shiftId,
            status: sale.status,
            salesCount: sql<number>`count(*)`,
            totalAmount: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          })
          .from(sale)
          .where(
            and(
              eq(sale.organizationId, organizationId),
              eq(sale.shiftId, shiftId)
            )
          )
          .groupBy(sale.shiftId, sale.status),
        context.db
          .select({
            shiftId: payment.shiftId,
            method: payment.method,
            amount: payment.amount,
            saleId: payment.saleId,
            saleTotalAmount: sale.totalAmount,
            createdAt: payment.createdAt,
          })
          .from(payment)
          .leftJoin(sale, eq(sale.id, payment.saleId))
          .where(
            and(
              eq(payment.organizationId, organizationId),
              eq(payment.shiftId, shiftId),
              or(isNull(payment.saleId), ne(sale.status, "cancelled"))
            )
          )
          .orderBy(desc(payment.createdAt)),
        context.db
          .select({
            id: cashMovementTable.id,
            shiftId: cashMovementTable.shiftId,
            type: cashMovementTable.type,
            paymentMethod: cashMovementTable.paymentMethod,
            amount: cashMovementTable.amount,
            description: cashMovementTable.description,
            createdAt: cashMovementTable.createdAt,
          })
          .from(cashMovementTable)
          .where(
            and(
              eq(cashMovementTable.organizationId, organizationId),
              eq(cashMovementTable.shiftId, shiftId)
            )
          )
          .orderBy(desc(cashMovementTable.createdAt)),
        context.db
          .select({
            shiftId: shiftClosure.shiftId,
            paymentMethod: shiftClosure.paymentMethod,
            expectedAmount: shiftClosure.expectedAmount,
            actualAmount: shiftClosure.actualAmount,
            difference: shiftClosure.difference,
          })
          .from(shiftClosure)
          .where(eq(shiftClosure.shiftId, shiftId)),
      ]);

    const operationsByShift = new Map<
      string,
      {
        paidSalesCount: number;
        paidSalesAmount: number;
        cancelledSalesCount: number;
        cancelledSalesAmount: number;
        creditSalesCount: number;
        creditSalesAmount: number;
      }
    >();

    for (const row of saleRows) {
      const current = operationsByShift.get(row.shiftId) ?? {
        paidSalesCount: 0,
        paidSalesAmount: 0,
        cancelledSalesCount: 0,
        cancelledSalesAmount: 0,
        creditSalesCount: 0,
        creditSalesAmount: 0,
      };

      switch (row.status) {
        case "completed":
          current.paidSalesCount += normalizeNumber(row.salesCount);
          current.paidSalesAmount += normalizeNumber(row.totalAmount);
          break;
        case "cancelled":
          current.cancelledSalesCount += normalizeNumber(row.salesCount);
          current.cancelledSalesAmount += normalizeNumber(row.totalAmount);
          break;
        case "credit":
          current.creditSalesCount += normalizeNumber(row.salesCount);
          current.creditSalesAmount += normalizeNumber(row.totalAmount);
          break;
        default:
          break;
      }

      operationsByShift.set(row.shiftId, current);
    }

    const payments = paymentRows.map((row) => ({
      method: row.method,
      amount: normalizeNumber(row.amount),
      saleId: row.saleId,
      saleTotalAmount:
        row.saleTotalAmount === null
          ? null
          : normalizeNumber(row.saleTotalAmount),
      createdAt: toTimestamp(row.createdAt) ?? 0,
    }));

    const movements = movementRows.map((row) => ({
      id: row.id,
      type: row.type,
      paymentMethod: row.paymentMethod,
      amount: normalizeNumber(row.amount),
      description: row.description,
      createdAt: toTimestamp(row.createdAt) ?? 0,
    }));

    const closures = closureRows.map((row) => ({
      paymentMethod: row.paymentMethod,
      expectedAmount: normalizeNumber(row.expectedAmount),
      actualAmount: normalizeNumber(row.actualAmount),
      difference: normalizeNumber(row.difference),
    }));

    const expectedByMethod = buildExpectedAmountsByMethod(
      normalizeNumber(targetShiftRow.startingCash),
      payments.map((paymentRow) => ({
        method: paymentRow.method,
        amount: paymentRow.amount,
        saleId: paymentRow.saleId,
        saleTotalAmount: paymentRow.saleTotalAmount,
      })),
      movements.map((movementRow) => ({
        type: movementRow.type,
        paymentMethod: movementRow.paymentMethod,
        amount: movementRow.amount,
      }))
    );

    const paymentBreakdown = [...expectedByMethod.entries()]
      .map(([method, amount]) => ({
        method,
        amount,
      }))
      .sort((left, right) =>
        comparePaymentMethodIds(left.method, right.method)
      );

    const operations = operationsByShift.get(shiftId) ?? {
      paidSalesCount: 0,
      paidSalesAmount: 0,
      cancelledSalesCount: 0,
      cancelledSalesAmount: 0,
      creditSalesCount: 0,
      creditSalesAmount: 0,
    };

    const totalPayments = payments.reduce(
      (total, paymentRow) => total + paymentRow.amount,
      0
    );
    const totalExpected = paymentBreakdown.reduce(
      (total, current) => total + current.amount,
      0
    );
    const totalActual = closures.reduce(
      (total, current) => total + current.actualAmount,
      0
    );
    const totalDifference = closures.reduce(
      (total, current) => total + current.difference,
      0
    );

    return {
      id: targetShiftRow.id,
      userId: targetShiftRow.userId,
      cashierName: targetShiftRow.cashierName,
      terminalName: targetShiftRow.terminalName,
      status: targetShiftRow.status,
      startingCash: normalizeNumber(targetShiftRow.startingCash),
      openedAt: toTimestamp(targetShiftRow.openedAt) ?? 0,
      closedAt: toTimestamp(targetShiftRow.closedAt),
      notes: targetShiftRow.notes,
      operations,
      paymentBreakdown,
      payments,
      movements,
      closures,
      totals: {
        totalPayments,
        expectedCash:
          expectedByMethod.get("cash") ??
          normalizeNumber(targetShiftRow.startingCash),
        totalExpected,
        totalActual,
        totalDifference,
      },
    };
  }
);

export const active = orgRequiredProcedure.active.handler(
  async ({ context }) => {
    const activeShiftRow = await context.db
      .select({
        id: shift.id,
        terminalName: shift.terminalName,
        status: shift.status,
        openedAt: shift.openedAt,
      })
      .from(shift)
      .where(
        and(
          eq(shift.organizationId, context.organizationId),
          eq(shift.userId, context.user.id),
          eq(shift.status, "open")
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return { shift: activeShiftRow };
  }
);

export const open = orgRequiredProcedure.open.handler(
  async ({ input, context }) => {
    const { organizationId, user } = context;
    const startingCash = toNonNegativeInteger(
      input.startingCash,
      "startingCash"
    );
    const terminalId = normalizeOptionalString(input.terminalId);
    const notes = normalizeOptionalString(input.notes);
    const openedAt = resolveDate(input.openedAt);

    const organizationSettingsRows = await context.db
      .select({
        metadata: organization.metadata,
      })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    const organizationSettings = parseOrganizationSettingsMetadata(
      organizationSettingsRows[0]?.metadata
    );
    const terminalName =
      normalizeOptionalString(input.terminalName) ??
      organizationSettings.pos.defaultTerminalName;

    const [userOpenShift] = await context.db
      .select({ id: shift.id })
      .from(shift)
      .where(
        and(
          eq(shift.organizationId, organizationId),
          eq(shift.userId, user.id),
          eq(shift.status, "open")
        )
      )
      .limit(1);

    if (userOpenShift) {
      throw new ORPCError("CONFLICT", {
        message: "El usuario ya tiene un turno abierto",
      });
    }

    if (terminalId) {
      const [terminalOpenShift] = await context.db
        .select({ id: shift.id })
        .from(shift)
        .where(
          and(
            eq(shift.organizationId, organizationId),
            eq(shift.status, "open"),
            eq(shift.terminalId, terminalId)
          )
        )
        .limit(1);

      if (terminalOpenShift) {
        throw new ORPCError("CONFLICT", {
          message: "La terminal indicada ya tiene un turno abierto",
        });
      }
    }

    const shiftId = crypto.randomUUID();
    await context.db.insert(shift).values({
      id: shiftId,
      organizationId,
      userId: user.id,
      terminalId,
      terminalName,
      status: "open",
      startingCash,
      openedAt,
      notes,
    });

    return {
      id: shiftId,
      status: "open" as const,
      startingCash,
      openedAt: openedAt.getTime(),
    };
  }
);

export const cashMovement = orgRequiredProcedure.cashMovement.handler(
  async ({ input, context }) => {
    const { organizationId, user } = context;
    const validTypes = ["expense", "payout", "inflow"] as const;
    if (!validTypes.includes(input.type as (typeof validTypes)[number])) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Tipo de movimiento de caja inválido",
      });
    }

    const amount = toPositiveInteger(input.amount, "amount");
    const description = normalizeRequiredString(
      input.description,
      "description"
    );
    const paymentMethod = normalizeRequiredString(
      input.paymentMethod,
      "paymentMethod"
    ).toLowerCase();
    const createdAt = resolveDate(input.createdAt);

    const [targetShift, organizationRow] = await Promise.all([
      context.db
        .select({ id: shift.id, userId: shift.userId, status: shift.status })
        .from(shift)
        .where(
          and(
            eq(shift.id, input.shiftId),
            eq(shift.organizationId, organizationId)
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
      context.db
        .select({
          metadata: organization.metadata,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!targetShift) {
      throw new ORPCError("NOT_FOUND", {
        message: "Turno no encontrado para la organización activa",
      });
    }
    if (targetShift.status !== "open") {
      throw new ORPCError("BAD_REQUEST", {
        message: "No se puede registrar movimiento en un turno cerrado",
      });
    }
    if (targetShift.userId !== user.id) {
      throw new ORPCError("FORBIDDEN", {
        message: "Solo el cajero del turno puede registrar movimientos",
      });
    }

    const enabledPaymentMethodIds = new Set(
      getEnabledPaymentMethods(
        parseOrganizationSettingsMetadata(organizationRow?.metadata)
      ).map((pm) => pm.id)
    );
    if (!enabledPaymentMethodIds.has(paymentMethod)) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Método de pago no habilitado: ${paymentMethod}`,
      });
    }

    const movementId = crypto.randomUUID();
    await context.db.insert(cashMovementTable).values({
      id: movementId,
      organizationId,
      shiftId: input.shiftId,
      type: input.type,
      paymentMethod,
      amount,
      description,
      createdAt,
    });

    return {
      id: movementId,
      shiftId: input.shiftId,
      type: input.type,
      paymentMethod,
      amount,
      description,
      createdAt: createdAt.getTime(),
    };
  }
);

export const closeSummary = orgRequiredProcedure.closeSummary.handler(
  async ({ input, context }) => {
    const { organizationId } = context;
    const shiftId = input.shiftId;

    const [targetShift, organizationRow] = await Promise.all([
      context.db
        .select({
          id: shift.id,
          status: shift.status,
          startingCash: shift.startingCash,
          openedAt: shift.openedAt,
          closedAt: shift.closedAt,
        })
        .from(shift)
        .where(
          and(eq(shift.id, shiftId), eq(shift.organizationId, organizationId))
        )
        .limit(1)
        .then((rows) => rows[0]),
      context.db
        .select({
          metadata: organization.metadata,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!targetShift) {
      throw new ORPCError("NOT_FOUND", {
        message: "Turno no encontrado para la organización activa",
      });
    }

    const organizationSettings = parseOrganizationSettingsMetadata(
      organizationRow?.metadata
    );

    const [registeredPayments, registeredMovements, registeredClosures] =
      await Promise.all([
        context.db
          .select({
            method: payment.method,
            amount: payment.amount,
            saleId: payment.saleId,
            saleTotalAmount: sale.totalAmount,
          })
          .from(payment)
          .leftJoin(sale, eq(sale.id, payment.saleId))
          .where(
            and(
              eq(payment.organizationId, organizationId),
              eq(payment.shiftId, shiftId),
              or(isNull(payment.saleId), ne(sale.status, "cancelled"))
            )
          ),
        context.db
          .select({
            type: cashMovementTable.type,
            paymentMethod: cashMovementTable.paymentMethod,
            amount: cashMovementTable.amount,
            description: cashMovementTable.description,
            createdAt: cashMovementTable.createdAt,
          })
          .from(cashMovementTable)
          .where(
            and(
              eq(cashMovementTable.organizationId, organizationId),
              eq(cashMovementTable.shiftId, shiftId)
            )
          )
          .orderBy(desc(cashMovementTable.createdAt)),
        context.db
          .select({
            paymentMethod: shiftClosure.paymentMethod,
            expectedAmount: shiftClosure.expectedAmount,
            actualAmount: shiftClosure.actualAmount,
            difference: shiftClosure.difference,
          })
          .from(shiftClosure)
          .where(eq(shiftClosure.shiftId, shiftId)),
      ]);

    const expectedByMethod = buildExpectedAmountsByMethod(
      targetShift.startingCash,
      registeredPayments,
      registeredMovements
    );
    const movementTotals = {
      inflow: 0,
      expense: 0,
      payout: 0,
    };
    const movementItems = registeredMovements.map((movement) => {
      const normalizedAmount = normalizeNumber(movement.amount);
      switch (movement.type) {
        case "inflow":
          movementTotals.inflow += normalizedAmount;
          break;
        case "expense":
          movementTotals.expense += normalizedAmount;
          break;
        case "payout":
          movementTotals.payout += normalizedAmount;
          break;
        default:
          break;
      }

      return {
        type: movement.type,
        paymentMethod: movement.paymentMethod,
        amount: normalizedAmount,
        description: movement.description,
        createdAt: toTimestamp(movement.createdAt) ?? 0,
      };
    });
    const closureByMethod = new Map(
      registeredClosures.map((closure) => [closure.paymentMethod, closure])
    );

    const summaryByMethod = [...expectedByMethod.entries()]
      .toSorted(([methodA], [methodB]) =>
        comparePaymentMethodIds(methodA, methodB)
      )
      .map(([paymentMethod, expectedAmount]) => {
        const closure = closureByMethod.get(paymentMethod);
        return {
          paymentMethod,
          expectedAmount,
          actualAmount: closure?.actualAmount ?? null,
          difference: closure?.difference ?? null,
        };
      });

    const totalExpected = summaryByMethod.reduce(
      (total, current) => total + current.expectedAmount,
      0
    );

    return {
      shift: {
        id: targetShift.id,
        status: targetShift.status,
        startingCash: targetShift.startingCash,
        openedAt: toTimestamp(targetShift.openedAt),
        closedAt: toTimestamp(targetShift.closedAt),
      },
      summaryByMethod,
      totalExpected,
      paymentMethods: buildPaymentMethodOptions(
        getAllPaymentMethods(organizationSettings),
        [
          ...summaryByMethod.map((row) => row.paymentMethod),
          ...movementItems.map((m) => m.paymentMethod),
          ...registeredClosures.map((c) => c.paymentMethod),
        ]
      ),
      movements: {
        items: movementItems,
        totals: {
          ...movementTotals,
          net:
            movementTotals.inflow -
            movementTotals.expense -
            movementTotals.payout,
        },
      },
      registeredClosures,
    };
  }
);

export const close = orgRequiredProcedure.close.handler(
  ({ input, context }) => {
    const { organizationId, user } = context;
    const closedAt = resolveDate(input.closedAt);
    const notes = normalizeOptionalString(input.notes);
    const actualByMethod = new Map<string, number>();

    for (const closure of input.closures) {
      const paymentMethod = normalizeRequiredString(
        closure.paymentMethod,
        "paymentMethod"
      ).toLowerCase();
      if (actualByMethod.has(paymentMethod)) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Método de pago duplicado en cierre: ${paymentMethod}`,
        });
      }

      actualByMethod.set(
        paymentMethod,
        toNonNegativeInteger(
          closure.actualAmount,
          `actualAmount (${paymentMethod})`
        )
      );
    }

    return context.db.transaction(async (tx) => {
      const [targetShift] = await tx
        .select({
          id: shift.id,
          status: shift.status,
          userId: shift.userId,
          startingCash: shift.startingCash,
          notes: shift.notes,
        })
        .from(shift)
        .where(
          and(
            eq(shift.id, input.shiftId),
            eq(shift.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!targetShift) {
        throw new ORPCError("NOT_FOUND", {
          message: "Turno no encontrado para la organización activa",
        });
      }
      if (targetShift.status !== "open") {
        throw new ORPCError("BAD_REQUEST", {
          message: "El turno ya está cerrado",
        });
      }
      if (targetShift.userId !== user.id) {
        throw new ORPCError("FORBIDDEN", {
          message: "Solo el cajero del turno puede cerrar caja",
        });
      }

      const [existingClosure] = await tx
        .select({ id: shiftClosure.id })
        .from(shiftClosure)
        .where(eq(shiftClosure.shiftId, input.shiftId))
        .limit(1);

      if (existingClosure) {
        throw new ORPCError("CONFLICT", {
          message: "El turno ya cuenta con un cierre registrado",
        });
      }

      const [registeredPayments, registeredMovements] = await Promise.all([
        tx
          .select({
            method: payment.method,
            amount: payment.amount,
            saleId: payment.saleId,
            saleTotalAmount: sale.totalAmount,
          })
          .from(payment)
          .leftJoin(sale, eq(sale.id, payment.saleId))
          .where(
            and(
              eq(payment.organizationId, organizationId),
              eq(payment.shiftId, input.shiftId),
              or(isNull(payment.saleId), ne(sale.status, "cancelled"))
            )
          ),
        tx
          .select({
            type: cashMovementTable.type,
            paymentMethod: cashMovementTable.paymentMethod,
            amount: cashMovementTable.amount,
          })
          .from(cashMovementTable)
          .where(
            and(
              eq(cashMovementTable.organizationId, organizationId),
              eq(cashMovementTable.shiftId, input.shiftId)
            )
          ),
      ]);

      const expectedByMethod = buildExpectedAmountsByMethod(
        targetShift.startingCash,
        registeredPayments,
        registeredMovements
      );

      const allMethods = new Set<string>([
        ...expectedByMethod.keys(),
        ...actualByMethod.keys(),
      ]);
      if (allMethods.size === 0) {
        allMethods.add("cash");
      }

      const closureRows = [...allMethods].map((paymentMethod) => {
        const expectedAmount = expectedByMethod.get(paymentMethod) ?? 0;
        const actualAmount = actualByMethod.get(paymentMethod) ?? 0;
        return {
          id: crypto.randomUUID(),
          shiftId: input.shiftId,
          paymentMethod,
          expectedAmount,
          actualAmount,
          difference: actualAmount - expectedAmount,
        };
      });

      await tx.insert(shiftClosure).values(closureRows);
      await tx
        .update(shift)
        .set({
          status: "closed",
          closedAt,
          notes: notes ?? targetShift.notes,
        })
        .where(eq(shift.id, input.shiftId));

      return {
        shiftId: input.shiftId,
        closedAt: closedAt.getTime(),
        closures: closureRows,
      };
    });
  }
);
