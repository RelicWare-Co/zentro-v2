import type { z } from "zod";
import type {
  CloseShiftInputSchema,
  ShiftCloseSummaryResultSchema,
} from "@/features/pos/pos.schema";
import {
  buildPaymentMethodOptions,
  comparePaymentMethodIds,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type {
  ListShiftsInputSchema,
  ShiftDetailSchema,
  ShiftListCursorSchema,
} from "@/features/shifts/shifts.schema";

export type ShiftListItem = z.infer<typeof ShiftDetailSchema>;
export type ShiftCloseSummary = z.infer<typeof ShiftCloseSummaryResultSchema>;
export type ShiftsListParams = z.infer<typeof ListShiftsInputSchema>;
export type ShiftListCursor = z.infer<typeof ShiftListCursorSchema>;
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
    appliedAmount?: number | null;
    method: string;
    amount: number;
    changeAmount?: number | null;
    saleId?: string | null;
    createdAt: number;
    sale?: { totalAmount?: number | null; status?: string | null } | null;
  }>;
  sales?: Array<{
    id: string;
    status?: string | null;
    totalAmount?: number | null;
    items?: Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      totalAmount: number;
      product?: {
        id: string;
        name: string;
        categoryId: string;
        category?: { id: string; name: string } | null;
      } | null;
    }>;
  }>;
  startingCash?: number | null;
  status?: string | null;
  terminalId?: string | null;
  terminalName?: string | null;
  user?: { id: string; name: string } | null;
  userId: string;
}

import { normalizeNumber } from "@/lib/domain-values.shared";

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

interface ExpectedPaymentInput {
  amount: number;
  appliedAmount?: number | null;
  changeAmount?: number | null;
  method: string;
  saleId?: string | null;
  saleTotalAmount?: number | null;
}

interface LegacySalePaymentStats {
  cashPaid: number;
  saleTotalAmount: number;
  totalPaid: number;
}

function hasExplicitPaymentApplication(paymentRow: ExpectedPaymentInput) {
  return (
    paymentRow.appliedAmount !== null && paymentRow.appliedAmount !== undefined
  );
}

function addPaymentExpectedAmounts(
  expectedByMethod: Map<string, number>,
  payments: ExpectedPaymentInput[]
) {
  for (const registeredPayment of payments) {
    const tenderedAmount = normalizeNumber(registeredPayment.amount);
    const changeAmount = normalizeNumber(registeredPayment.changeAmount ?? 0);
    // Use net inflow per method so cash overpayment minus change does not
    // inflate expected cash at shift close.
    const netAppliedAmount = tenderedAmount - changeAmount;

    expectedByMethod.set(
      registeredPayment.method,
      (expectedByMethod.get(registeredPayment.method) ?? 0) + netAppliedAmount
    );
  }
}

function buildLegacySalePaymentStats(payments: ExpectedPaymentInput[]) {
  const salePaymentStats = new Map<string, LegacySalePaymentStats>();

  for (const registeredPayment of payments) {
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

  return salePaymentStats;
}

function calculateLegacyCashChange(
  salePaymentStats: Map<string, LegacySalePaymentStats>
) {
  let changeReturnedInCash = 0;

  for (const paymentStats of salePaymentStats.values()) {
    const overpayment = Math.max(
      paymentStats.totalPaid - paymentStats.saleTotalAmount,
      0
    );
    if (overpayment > 0 && paymentStats.cashPaid > 0) {
      changeReturnedInCash += Math.min(overpayment, paymentStats.cashPaid);
    }
  }

  return changeReturnedInCash;
}

function subtractLegacyCashChange(
  expectedByMethod: Map<string, number>,
  payments: ExpectedPaymentInput[]
) {
  const changeReturnedInCash = calculateLegacyCashChange(
    buildLegacySalePaymentStats(payments)
  );
  if (changeReturnedInCash <= 0) {
    return;
  }

  expectedByMethod.set(
    "cash",
    Math.max((expectedByMethod.get("cash") ?? 0) - changeReturnedInCash, 0)
  );
}

function addMovementExpectedAmounts(
  expectedByMethod: Map<string, number>,
  movements: Array<{ type: string; paymentMethod: string; amount: number }>
) {
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
}

export function buildExpectedAmountsByMethod(
  startingCash: number,
  payments: ExpectedPaymentInput[],
  movements: Array<{ type: string; paymentMethod: string; amount: number }>
) {
  const expectedByMethod = new Map<string, number>();

  addPaymentExpectedAmounts(expectedByMethod, payments);
  if (!payments.some(hasExplicitPaymentApplication)) {
    subtractLegacyCashChange(expectedByMethod, payments);
  }

  expectedByMethod.set(
    "cash",
    (expectedByMethod.get("cash") ?? 0) + startingCash
  );

  addMovementExpectedAmounts(expectedByMethod, movements);

  return expectedByMethod;
}

function buildShiftOperations(
  sales: ShiftWithRelations["sales"] | undefined,
  payments: Array<{ saleId: string | null; appliedAmount: number | null }>
) {
  const operations = {
    paidSalesCount: 0,
    paidSalesAmount: 0,
    cancelledSalesCount: 0,
    cancelledSalesAmount: 0,
    creditSalesCount: 0,
    creditSalesAmount: 0,
  };

  const paidBySale = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.saleId) {
      continue;
    }
    const current = paidBySale.get(payment.saleId) ?? 0;
    paidBySale.set(payment.saleId, current + (payment.appliedAmount ?? 0));
  }

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
      case "credit": {
        operations.creditSalesCount += 1;
        const totalAmount = normalizeNumber(row.totalAmount);
        const paidAmount = paidBySale.get(row.id) ?? 0;
        const balanceDue = Math.max(totalAmount - paidAmount, 0);
        operations.creditSalesAmount += balanceDue;
        break;
      }
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
      appliedAmount:
        paymentRow.appliedAmount === null ||
        paymentRow.appliedAmount === undefined
          ? null
          : normalizeNumber(paymentRow.appliedAmount),
      changeAmount:
        paymentRow.changeAmount === null ||
        paymentRow.changeAmount === undefined
          ? null
          : normalizeNumber(paymentRow.changeAmount),
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
      appliedAmount: paymentRow.appliedAmount,
      changeAmount: paymentRow.changeAmount,
      saleId: paymentRow.saleId,
      saleTotalAmount: paymentRow.saleTotalAmount,
    })),
    movements.map((movementRow) => ({
      type: movementRow.type,
      paymentMethod: movementRow.paymentMethod,
      amount: movementRow.amount,
    }))
  );
  const totalExpected = [...expectedByMethod.values()].reduce(
    (total, amount) => total + amount,
    0
  );
  const paymentBreakdown = [...expectedByMethod.entries()]
    .map(([method, amount]) => ({
      method,
      amount:
        method === "cash"
          ? amount - normalizeNumber(shift.startingCash)
          : amount,
    }))
    .sort((left, right) => comparePaymentMethodIds(left.method, right.method));
  const operations = buildShiftOperations(
    shift.sales,
    payments.map((p) => ({ saleId: p.saleId, appliedAmount: p.appliedAmount }))
  );
  const totalPayments = payments.reduce(
    (total, paymentRow) => total + paymentRow.amount,
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

export interface ShiftProductSummaryPayment {
  amount: number;
  method: string;
}

export interface ShiftProductSummaryItem {
  categoryId: string;
  categoryName: string;
  payments: ShiftProductSummaryPayment[];
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  unitPrice: number;
}

export interface ShiftCategorySummary {
  categoryId: string;
  categoryName: string;
  quantity: number;
  totalAmount: number;
}

export interface ShiftProductSummary {
  categories: ShiftCategorySummary[];
  products: ShiftProductSummaryItem[];
  totalAmount: number;
  totalItems: number;
}

function buildSalePaymentMap(
  payments: ShiftWithRelations["payments"]
): Map<string, Array<{ amount: number; method: string }>> {
  const salePayments = new Map<
    string,
    Array<{ amount: number; method: string }>
  >();
  for (const payment of payments ?? []) {
    if (!payment.saleId) {
      continue;
    }
    const existing = salePayments.get(payment.saleId) ?? [];
    existing.push({
      method: payment.method,
      amount: normalizeNumber(payment.appliedAmount ?? payment.amount),
    });
    salePayments.set(payment.saleId, existing);
  }
  return salePayments;
}

interface ProductAccumulator {
  categoryId: string;
  categoryName: string;
  payments: Map<string, number>;
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  unitPrice: number;
}

function upsertProduct(
  productMap: Map<string, ProductAccumulator>,
  item: {
    productId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    product?: {
      name: string;
      categoryId: string;
      category?: { name: string } | null;
    } | null;
  }
): ProductAccumulator {
  const productId = item.productId;
  const existing = productMap.get(productId);
  const quantity = item.quantity;
  const itemTotal = item.totalAmount;

  if (existing) {
    existing.quantity += quantity;
    existing.totalAmount += itemTotal;
    return existing;
  }

  const entry: ProductAccumulator = {
    productId,
    productName: item.product?.name ?? "Producto",
    categoryId: item.product?.categoryId ?? "sin-categoria",
    categoryName: item.product?.category?.name ?? "Sin categoría",
    quantity,
    totalAmount: itemTotal,
    unitPrice: item.unitPrice,
    payments: new Map(),
  };
  productMap.set(productId, entry);
  return entry;
}

function allocatePaymentsToProduct(
  productEntry: ProductAccumulator,
  paymentsForSale: Array<{ amount: number; method: string }>,
  itemTotal: number,
  saleTotal: number
) {
  if (!(saleTotal > 0)) {
    return;
  }
  const proportion = itemTotal / saleTotal;
  for (const payment of paymentsForSale) {
    const allocated = Math.round(payment.amount * proportion);
    const current = productEntry.payments.get(payment.method) ?? 0;
    productEntry.payments.set(payment.method, current + allocated);
  }
}

function buildCategoryMap(
  products: ShiftProductSummaryItem[]
): Map<string, ShiftCategorySummary> {
  const categoryMap = new Map<string, ShiftCategorySummary>();
  for (const product of products) {
    const existing = categoryMap.get(product.categoryId);
    if (existing) {
      existing.quantity += product.quantity;
      existing.totalAmount += product.totalAmount;
    } else {
      categoryMap.set(product.categoryId, {
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        quantity: product.quantity,
        totalAmount: product.totalAmount,
      });
    }
  }
  return categoryMap;
}

export function buildShiftProductSummary(
  shift: ShiftWithRelations
): ShiftProductSummary {
  const salePayments = buildSalePaymentMap(shift.payments);
  const productMap = new Map<string, ProductAccumulator>();

  for (const sale of shift.sales ?? []) {
    if (sale.status === "cancelled") {
      continue;
    }
    const paymentsForSale = salePayments.get(sale.id) ?? [];
    const saleTotal = normalizeNumber(sale.totalAmount);

    for (const item of sale.items ?? []) {
      const productEntry = upsertProduct(productMap, item);
      allocatePaymentsToProduct(
        productEntry,
        paymentsForSale,
        item.totalAmount,
        saleTotal
      );
    }
  }

  const products = [...productMap.values()]
    .map((p) => ({
      ...p,
      payments: [...p.payments.entries()]
        .map(([method, amount]) => ({ amount, method }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const categories = [...buildCategoryMap(products).values()].sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  return {
    products,
    categories,
    totalItems: products.reduce((sum, p) => sum + p.quantity, 0),
    totalAmount: products.reduce((sum, p) => sum + p.totalAmount, 0),
  };
}

export function parseDateBoundary(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
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

export function filterShiftsClientRefinements(
  shifts: ShiftListItem[],
  input: ShiftsListParams
) {
  let rows = shifts;

  if (input.differenceStatus) {
    const differenceStatus = input.differenceStatus;
    rows = rows.filter((shift) =>
      matchesShiftDifferenceStatus(shift, differenceStatus)
    );
  }

  if (input.hasMovements === "no") {
    rows = rows.filter((shift) => shift.movements.length === 0);
  }

  return rows;
}

export function normalizeShiftsListLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 10, 1), 50);
}

export function buildShiftsListPage(
  shifts: ShiftListItem[],
  limit: number
): {
  data: ShiftListItem[];
  hasMore: boolean;
  nextCursor: ShiftListCursor | null;
  total: number | null;
} {
  const pageSize = normalizeShiftsListLimit(limit);
  const hasMore = shifts.length > pageSize;
  const pageRows = hasMore ? shifts.slice(0, pageSize) : shifts;
  const lastRow = pageRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? {
          openedAt: lastRow.openedAt,
          id: lastRow.id,
        }
      : null;

  return {
    data: pageRows,
    hasMore,
    nextCursor,
    total: hasMore ? null : pageRows.length,
  };
}

export function buildShiftFilterOptions({
  members,
  organizationMetadata,
  terminalNames,
}: {
  members: Array<{
    userId: string;
    user?: { name?: string | null } | null;
  }>;
  organizationMetadata: string | null | undefined;
  terminalNames: Iterable<string>;
}) {
  const organizationSettings =
    parseOrganizationSettingsMetadata(organizationMetadata);
  const normalizedTerminalNames = [
    ...new Set(
      [...terminalNames].filter(
        (terminalName): terminalName is string =>
          typeof terminalName === "string" && terminalName.trim().length > 0
      )
    ),
  ];

  return {
    cashiers: members
      .map((memberRow) => ({
        id: memberRow.userId,
        name: memberRow.user?.name ?? "Cajero",
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name, "es-CO")),
    terminals: normalizedTerminalNames.toSorted((left, right) =>
      left.localeCompare(right, "es-CO")
    ),
    paymentMethods: getAllPaymentMethods(organizationSettings).map(
      (method) => ({
        id: method.id,
        label: method.label,
      })
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
      appliedAmount: paymentRow.appliedAmount,
      changeAmount: paymentRow.changeAmount,
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
