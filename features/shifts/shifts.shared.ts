import type { z } from "zod";
import {
  buildPaymentMethodOptions,
  comparePaymentMethodIds,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type {
  CloseShiftInputSchema,
  ShiftCloseSummaryResultSchema,
} from "@/schemas/pos";
import type {
  ListShiftsInputSchema,
  ShiftDetailSchema,
} from "@/schemas/shifts";

export type ShiftListItem = z.infer<typeof ShiftDetailSchema>;
export type ShiftCloseSummary = z.infer<typeof ShiftCloseSummaryResultSchema>;
export type ShiftsListParams = z.infer<typeof ListShiftsInputSchema>;
export type CloseShiftInput = z.infer<typeof CloseShiftInputSchema>;

export interface ShiftWithRelations {
  cashMovements?: Array<{
    id: string;
    type: string;
    paymentMethod: string;
    amount: number;
    description: string;
    createdAt: number;
  }>;
  closedAt?: number | null;
  closures?: Array<{
    paymentMethod: string;
    expectedAmount: number;
    actualAmount: number;
    difference: number;
  }>;
  id: string;
  notes?: string | null;
  openedAt: number;
  organizationId: string;
  payments?: Array<{
    method: string;
    amount: number;
    saleId?: string | null;
    createdAt: number;
    sale?: { totalAmount?: number | null; status?: string | null } | null;
  }>;
  sales?: Array<{
    status?: string | null;
    totalAmount?: number | null;
  }>;
  startingCash?: number | null;
  status?: string | null;
  terminalId?: string | null;
  terminalName?: string | null;
  user?: { id: string; name: string } | null;
  userId: string;
}

export function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toTimestamp(value: Date | number | string | null | undefined) {
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

export function buildExpectedAmountsByMethod(
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
        throw new Error(
          `Tipo de movimiento de caja no soportado: ${movement.type}`
        );
    }
  }

  return expectedByMethod;
}

function buildShiftOperations(sales: ShiftWithRelations["sales"] | undefined) {
  const operations = {
    paidSalesCount: 0,
    paidSalesAmount: 0,
    cancelledSalesCount: 0,
    cancelledSalesAmount: 0,
    creditSalesCount: 0,
    creditSalesAmount: 0,
  };

  for (const row of sales ?? []) {
    switch (row.status) {
      case "completed":
        operations.paidSalesCount += 1;
        operations.paidSalesAmount += normalizeNumber(row.totalAmount);
        break;
      case "cancelled":
        operations.cancelledSalesCount += 1;
        operations.cancelledSalesAmount += normalizeNumber(row.totalAmount);
        break;
      case "credit":
        operations.creditSalesCount += 1;
        operations.creditSalesAmount += normalizeNumber(row.totalAmount);
        break;
      default:
        break;
    }
  }

  return operations;
}

function normalizeShiftPayments(shift: ShiftWithRelations) {
  return (shift.payments ?? [])
    .filter(
      (paymentRow) =>
        !paymentRow.saleId || paymentRow.sale?.status !== "cancelled"
    )
    .map((paymentRow) => ({
      method: paymentRow.method,
      amount: normalizeNumber(paymentRow.amount),
      saleId: paymentRow.saleId ?? null,
      saleTotalAmount:
        paymentRow.sale?.totalAmount === null ||
        paymentRow.sale?.totalAmount === undefined
          ? null
          : normalizeNumber(paymentRow.sale.totalAmount),
      createdAt: toTimestamp(paymentRow.createdAt) ?? 0,
    }))
    .toSorted((left, right) => right.createdAt - left.createdAt);
}

function normalizeShiftMovements(shift: ShiftWithRelations) {
  return (shift.cashMovements ?? [])
    .map((movementRow) => ({
      id: movementRow.id,
      type: movementRow.type,
      paymentMethod: movementRow.paymentMethod,
      amount: normalizeNumber(movementRow.amount),
      description: movementRow.description,
      createdAt: toTimestamp(movementRow.createdAt) ?? 0,
    }))
    .toSorted((left, right) => right.createdAt - left.createdAt);
}

function normalizeShiftClosures(shift: ShiftWithRelations) {
  return (shift.closures ?? [])
    .map((closureRow) => ({
      paymentMethod: closureRow.paymentMethod,
      expectedAmount: normalizeNumber(closureRow.expectedAmount),
      actualAmount: normalizeNumber(closureRow.actualAmount),
      difference: normalizeNumber(closureRow.difference),
    }))
    .toSorted((left, right) =>
      comparePaymentMethodIds(left.paymentMethod, right.paymentMethod)
    );
}

export function buildShiftListItem(shift: ShiftWithRelations): ShiftListItem {
  const payments = normalizeShiftPayments(shift);
  const movements = normalizeShiftMovements(shift);
  const closures = normalizeShiftClosures(shift);
  const expectedByMethod = buildExpectedAmountsByMethod(
    normalizeNumber(shift.startingCash),
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
    .map(([method, amount]) => ({ method, amount }))
    .sort((left, right) => comparePaymentMethodIds(left.method, right.method));
  const operations = buildShiftOperations(shift.sales);
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
    id: shift.id,
    userId: shift.userId,
    cashierName: shift.user?.name ?? "Cajero",
    terminalName: shift.terminalName ?? null,
    status: shift.status ?? "open",
    startingCash: normalizeNumber(shift.startingCash),
    openedAt: toTimestamp(shift.openedAt) ?? 0,
    closedAt: toTimestamp(shift.closedAt),
    notes: shift.notes ?? null,
    operations,
    paymentBreakdown,
    payments,
    movements,
    closures,
    totals: {
      totalPayments,
      expectedCash:
        expectedByMethod.get("cash") ?? normalizeNumber(shift.startingCash),
      totalExpected,
      totalActual,
      totalDifference,
    },
  };
}

function parseDateBoundary(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

function matchesShiftSearch(shift: ShiftListItem, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  const haystack = [
    shift.id,
    shift.cashierName,
    shift.terminalName ?? "",
    shift.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchQuery);
}

function matchesShiftPaymentMethod(
  shift: ShiftListItem,
  paymentMethod: string
) {
  return (
    shift.payments.some((paymentRow) => paymentRow.method === paymentMethod) ||
    shift.movements.some(
      (movementRow) => movementRow.paymentMethod === paymentMethod
    ) ||
    shift.closures.some(
      (closureRow) => closureRow.paymentMethod === paymentMethod
    )
  );
}

function matchesShiftDifferenceStatus(
  shift: ShiftListItem,
  differenceStatus: NonNullable<ShiftsListParams["differenceStatus"]>
) {
  switch (differenceStatus) {
    case "over":
      return shift.totals.totalDifference > 0;
    case "short":
      return shift.totals.totalDifference < 0;
    case "balanced":
      return shift.closures.length > 0 && shift.totals.totalDifference === 0;
    default:
      return true;
  }
}

function matchesShiftDateRange(
  shift: ShiftListItem,
  startDateMs: number | null,
  endDateExclusiveMs: number | null
) {
  if (startDateMs !== null && shift.openedAt < startDateMs) {
    return false;
  }
  if (endDateExclusiveMs !== null && shift.openedAt >= endDateExclusiveMs) {
    return false;
  }
  return true;
}

function matchesShiftFilters(shift: ShiftListItem, input: ShiftsListParams) {
  const trimmedSearchQuery = input.searchQuery?.trim().toLowerCase() ?? "";
  const startDateMs = parseDateBoundary(input.startDate);
  const endDateMs = parseDateBoundary(input.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;

  if (input.status && shift.status !== input.status) {
    return false;
  }
  if (input.cashierId && shift.userId !== input.cashierId) {
    return false;
  }
  if (input.terminalName && shift.terminalName !== input.terminalName) {
    return false;
  }
  if (!matchesShiftSearch(shift, trimmedSearchQuery)) {
    return false;
  }
  if (
    input.paymentMethod &&
    !matchesShiftPaymentMethod(shift, input.paymentMethod)
  ) {
    return false;
  }
  if (input.hasMovements === "yes" && shift.movements.length === 0) {
    return false;
  }
  if (input.hasMovements === "no" && shift.movements.length > 0) {
    return false;
  }
  if (
    input.differenceStatus &&
    !matchesShiftDifferenceStatus(shift, input.differenceStatus)
  ) {
    return false;
  }

  return matchesShiftDateRange(shift, startDateMs, endDateExclusiveMs);
}

export function filterShifts(
  shifts: ShiftListItem[],
  input: ShiftsListParams
): ShiftListItem[] {
  return shifts.filter((shift) => matchesShiftFilters(shift, input));
}

export function paginateShifts(
  shifts: ShiftListItem[],
  input: ShiftsListParams
) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const cursor = Math.max(input.cursor ?? 0, 0);
  const pageRows = shifts.slice(cursor, cursor + limit);
  const hasMore = cursor + limit < shifts.length;
  const nextCursor = hasMore ? cursor + limit : null;

  return {
    data: pageRows,
    total: shifts.length,
    hasMore,
    nextCursor,
  };
}

export function buildShiftFilterOptions(
  shifts: ShiftListItem[],
  organizationMetadata: string | null | undefined
) {
  const organizationSettings =
    parseOrganizationSettingsMetadata(organizationMetadata);
  const cashierMap = new Map<string, string>();
  const terminalNames = new Set<string>();
  const paymentMethodIds = new Set<string>();

  for (const shift of shifts) {
    cashierMap.set(shift.userId, shift.cashierName);
    if (shift.terminalName) {
      terminalNames.add(shift.terminalName);
    }
    for (const paymentRow of shift.payments) {
      paymentMethodIds.add(paymentRow.method);
    }
    for (const movementRow of shift.movements) {
      paymentMethodIds.add(movementRow.paymentMethod);
    }
    for (const closureRow of shift.closures) {
      paymentMethodIds.add(closureRow.paymentMethod);
    }
  }

  return {
    cashiers: [...cashierMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .toSorted((left, right) => left.name.localeCompare(right.name, "es-CO")),
    terminals: [...terminalNames].toSorted((left, right) =>
      left.localeCompare(right, "es-CO")
    ),
    paymentMethods: buildPaymentMethodOptions(
      getAllPaymentMethods(organizationSettings),
      paymentMethodIds
    ),
  };
}

export function buildShiftCloseSummary(
  shift: ShiftWithRelations,
  organizationMetadata: string | null | undefined
): ShiftCloseSummary {
  const organizationSettings =
    parseOrganizationSettingsMetadata(organizationMetadata);
  const payments = normalizeShiftPayments(shift);
  const movements = normalizeShiftMovements(shift);
  const registeredClosures = normalizeShiftClosures(shift);
  const expectedByMethod = buildExpectedAmountsByMethod(
    normalizeNumber(shift.startingCash),
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
  const movementTotals = {
    inflow: 0,
    expense: 0,
    payout: 0,
  };
  const movementItems = movements.map((movement) => {
    switch (movement.type) {
      case "inflow":
        movementTotals.inflow += movement.amount;
        break;
      case "expense":
        movementTotals.expense += movement.amount;
        break;
      case "payout":
        movementTotals.payout += movement.amount;
        break;
      default:
        break;
    }

    return {
      type: movement.type,
      paymentMethod: movement.paymentMethod,
      amount: movement.amount,
      description: movement.description,
      createdAt: movement.createdAt,
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
      id: shift.id,
      status: shift.status ?? "open",
      startingCash: normalizeNumber(shift.startingCash),
      openedAt: toTimestamp(shift.openedAt),
      closedAt: toTimestamp(shift.closedAt),
    },
    summaryByMethod,
    totalExpected,
    paymentMethods: buildPaymentMethodOptions(
      getAllPaymentMethods(organizationSettings),
      [
        ...summaryByMethod.map((row) => row.paymentMethod),
        ...movementItems.map((movement) => movement.paymentMethod),
        ...registeredClosures.map((closure) => closure.paymentMethod),
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
