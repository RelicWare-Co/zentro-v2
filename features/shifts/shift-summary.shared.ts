import {
  buildPaymentMethodOptions,
  comparePaymentMethodIds,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type {
  ShiftCloseSummary,
  ShiftListItem,
  ShiftWithRelations,
} from "@/features/shifts/shift-types.shared";
import { toTimestamp } from "@/features/shifts/shift-types.shared";
import { normalizeNumber } from "@/lib/domain-values.shared";

function getAccountingSaleTotal(row: {
  passThroughTotalAmount?: number | null;
  totalAmount?: number | null;
}) {
  return Math.max(
    normalizeNumber(row.totalAmount) -
      normalizeNumber(row.passThroughTotalAmount),
    0
  );
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
        operations.paidSalesAmount += getAccountingSaleTotal(row);
        break;
      case "cancelled":
        operations.cancelledSalesCount += 1;
        operations.cancelledSalesAmount += getAccountingSaleTotal(row);
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
      isDebtPayment: (paymentRow.creditTransactions ?? []).some(
        (tx) => tx.type === "payment"
      ),
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
  const debtPaymentsByMethod = new Map<string, number>();
  for (const paymentRow of payments) {
    if (!paymentRow.isDebtPayment) {
      continue;
    }
    debtPaymentsByMethod.set(
      paymentRow.method,
      (debtPaymentsByMethod.get(paymentRow.method) ?? 0) + paymentRow.amount
    );
  }
  const debtPaymentBreakdown = [...debtPaymentsByMethod.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((left, right) => comparePaymentMethodIds(left.method, right.method));

  for (const [method, amount] of debtPaymentsByMethod) {
    expectedByMethod.set(method, (expectedByMethod.get(method) ?? 0) - amount);
  }
  const paymentBreakdown = [...expectedByMethod.entries()]
    .map(([method, amount]) => ({
      method,
      amount:
        method === "cash"
          ? amount - normalizeNumber(shift.startingCash)
          : amount,
    }))
    .sort((left, right) => comparePaymentMethodIds(left.method, right.method));
  const totalDebtPayments = debtPaymentBreakdown.reduce(
    (total, entry) => total + entry.amount,
    0
  );
  const totalExpected =
    [...expectedByMethod.values()].reduce(
      (total, amount) => total + amount,
      0
    ) + totalDebtPayments;

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
    debtPaymentBreakdown,
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
  const debtPaymentsByMethod = new Map<string, number>();
  for (const paymentRow of payments) {
    if (!paymentRow.isDebtPayment) {
      continue;
    }
    debtPaymentsByMethod.set(
      paymentRow.method,
      (debtPaymentsByMethod.get(paymentRow.method) ?? 0) + paymentRow.amount
    );
  }
  for (const [method, amount] of debtPaymentsByMethod) {
    expectedByMethod.set(method, (expectedByMethod.get(method) ?? 0) - amount);
  }
  const debtPaymentBreakdown = [...debtPaymentsByMethod.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((left, right) => comparePaymentMethodIds(left.method, right.method));
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
  const totalExpected =
    summaryByMethod.reduce(
      (total, current) => total + current.expectedAmount,
      0
    ) + debtPaymentBreakdown.reduce((total, entry) => total + entry.amount, 0);

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
    debtPaymentBreakdown,
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
