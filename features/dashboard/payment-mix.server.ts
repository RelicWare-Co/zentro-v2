import { and, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import type {
  DashboardAuth,
  DashboardDbExecutor,
} from "@/features/dashboard/dashboard-helpers.server";
import { normalizeNumber } from "@/features/dashboard/dashboard-helpers.server";
import { buildExpectedAmountsByMethod } from "@/features/shifts/shifts.shared";

interface PaymentMixRow {
  amount: number | string | null;
  appliedAmount: number | string | null;
  changeAmount: number | string | null;
  method: string;
  saleId: string | null;
  saleTotalAmount: number | string | null;
}

export function buildPaymentMix(rows: PaymentMixRow[]) {
  const expectedByMethod = buildExpectedAmountsByMethod(
    0,
    rows.map((row) => ({
      method: row.method,
      amount: normalizeNumber(row.amount),
      appliedAmount:
        row.appliedAmount === null ? null : normalizeNumber(row.appliedAmount),
      changeAmount:
        row.changeAmount === null ? null : normalizeNumber(row.changeAmount),
      saleId: row.saleId,
      saleTotalAmount:
        row.saleTotalAmount === null
          ? null
          : normalizeNumber(row.saleTotalAmount),
    })),
    []
  );

  return [...expectedByMethod.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .filter((row) => row.amount > 0)
    .toSorted((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }
      return left.method.localeCompare(right.method, "es-CO");
    });
}

export function buildCollectedTotal(rows: PaymentMixRow[]) {
  return buildPaymentMix(rows).reduce((total, row) => total + row.amount, 0);
}

export function fetchShiftPaymentMix(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  shiftIds: string[]
) {
  return shiftIds.length > 0
    ? db
        .select({
          method: payment.method,
          amount: payment.amount,
          appliedAmount: payment.appliedAmount,
          changeAmount: payment.changeAmount,
          saleId: payment.saleId,
          saleTotalAmount: sale.totalAmount,
        })
        .from(payment)
        .leftJoin(
          sale,
          and(
            eq(sale.id, payment.saleId),
            eq(sale.organizationId, auth.organizationId)
          )
        )
        .where(
          and(
            eq(payment.organizationId, auth.organizationId),
            inArray(payment.shiftId, shiftIds),
            or(isNull(payment.saleId), ne(sale.status, "cancelled"))
          )
        )
    : Promise.resolve([]);
}

export function fetchMonthPaymentMix(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  monthStart: Date,
  nextMonthStart: Date
) {
  return db
    .select({
      method: payment.method,
      amount: payment.amount,
      appliedAmount: payment.appliedAmount,
      changeAmount: payment.changeAmount,
      saleId: payment.saleId,
      saleTotalAmount: sale.totalAmount,
    })
    .from(payment)
    .leftJoin(
      sale,
      and(
        eq(sale.id, payment.saleId),
        eq(sale.organizationId, auth.organizationId)
      )
    )
    .where(
      and(
        eq(payment.organizationId, auth.organizationId),
        gte(payment.createdAt, monthStart),
        lt(payment.createdAt, nextMonthStart),
        or(isNull(payment.saleId), ne(sale.status, "cancelled"))
      )
    );
}
