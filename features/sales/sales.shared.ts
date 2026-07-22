import type { z } from "zod";
import { buildUniqueCashierFilterOptions } from "@/features/listing/member-filter-options.shared";
import type {
  ListSalesInputSchema,
  SaleDetailSchema,
  SaleListCursorSchema,
  SaleListResultSchema,
} from "@/features/sales/sales.schema";
import {
  comparePaymentMethodIds,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";

export type SaleListItem = z.infer<typeof SaleListResultSchema>["data"][number];
export type SaleDetail = z.infer<typeof SaleDetailSchema>;
export type SalesListParams = z.infer<typeof ListSalesInputSchema>;
export type SaleListCursor = z.infer<typeof SaleListCursorSchema>;

export interface SaleWithRelations {
  createdAt: number;
  customer?: {
    documentNumber?: string | null;
    documentType?: string | null;
    id?: string;
    name?: string | null;
    phone?: string | null;
  } | null;
  customerId?: string | null;
  discountAmount?: number | null;
  id: string;
  items?: Array<{
    accountingTreatment?: string | null;
    discountAmount?: number | null;
    id: string;
    modifiers?: Array<{
      id: string;
      modifierProduct?: { name?: string | null } | null;
      modifierProductId: string;
      quantity: number;
      subtotal: number;
      unitPrice: number;
    }>;
    product?: { name?: string | null } | null;
    productId: string;
    quantity: number;
    subtotal: number;
    taxAmount?: number | null;
    taxRate?: number | null;
    totalAmount: number;
    unitPrice: number;
  }>;
  organizationId: string;
  passThroughSubtotal?: number | null;
  passThroughTaxAmount?: number | null;
  passThroughTotalAmount?: number | null;
  payments?: Array<{
    appliedAmount?: number | null;
    amount: number;
    changeAmount?: number | null;
    createdAt: number;
    creditTransactions?: Array<{
      notes?: string | null;
      type?: string | null;
    }>;
    id: string;
    method: string;
    reference?: string | null;
  }>;
  shift?: {
    id?: string;
    terminalName?: string | null;
  } | null;
  shiftId?: string | null;
  status?: string | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  totalAmount: number;
  user?: {
    email?: string | null;
    id?: string;
    name?: string | null;
  } | null;
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

export function parseDateBoundary(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsedDate = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

export function resolveAmountRange(
  minimum: number | null | undefined,
  maximum: number | null | undefined
) {
  const normalizedMinimum =
    typeof minimum === "number" && Number.isFinite(minimum) && minimum >= 0
      ? Math.trunc(minimum)
      : null;
  const normalizedMaximum =
    typeof maximum === "number" && Number.isFinite(maximum) && maximum >= 0
      ? Math.trunc(maximum)
      : null;

  if (
    normalizedMinimum !== null &&
    normalizedMaximum !== null &&
    normalizedMinimum > normalizedMaximum
  ) {
    return {
      minimum: normalizedMaximum,
      maximum: normalizedMinimum,
    };
  }

  return {
    minimum: normalizedMinimum,
    maximum: normalizedMaximum,
  };
}

function sumPaidAmount(row: SaleWithRelations) {
  if (row.status === "cancelled") {
    return 0;
  }
  const paidAmount = (row.payments ?? []).reduce(
    (total, paymentRow) =>
      total + normalizeNumber(paymentRow.appliedAmount ?? paymentRow.amount),
    0
  );
  return Math.min(normalizeNumber(row.totalAmount), paidAmount);
}

function sumItemCount(row: SaleWithRelations) {
  return (row.items ?? []).reduce(
    (total, itemRow) => total + normalizeNumber(itemRow.quantity),
    0
  );
}

function collectPaymentMethods(row: SaleWithRelations) {
  const methods = new Set<string>();
  for (const paymentRow of row.payments ?? []) {
    methods.add(paymentRow.method);
  }
  return [...methods];
}

export function buildSaleListItem(row: SaleWithRelations): SaleListItem {
  const totalAmount = normalizeNumber(row.totalAmount);
  const paidAmount = sumPaidAmount(row);

  return {
    id: row.id,
    totalAmount,
    status: row.status ?? "completed",
    customerName: row.customer?.name ?? null,
    cashierName: row.user?.name ?? null,
    terminalName: row.shift?.terminalName ?? null,
    createdAt: toTimestamp(row.createdAt) ?? 0,
    itemCount: sumItemCount(row),
    paidAmount,
    balanceDue:
      row.status === "cancelled" ? 0 : Math.max(totalAmount - paidAmount, 0),
    paymentMethods: collectPaymentMethods(row),
  };
}

function resolvePaymentKind(
  paymentRow: NonNullable<SaleWithRelations["payments"]>[number]
): SaleDetail["payments"][number]["kind"] {
  const linkedCreditTransaction = (paymentRow.creditTransactions ?? []).find(
    (transactionRow) => transactionRow.type === "payment"
  );
  return linkedCreditTransaction ? "debt_payment" : "sale_payment";
}

export function buildSaleDetail(row: SaleWithRelations): SaleDetail {
  const payments = (row.payments ?? [])
    .map((paymentRow) => {
      const tenderedAmount = normalizeNumber(paymentRow.amount);
      const appliedAmount = normalizeNumber(
        paymentRow.appliedAmount ?? paymentRow.amount
      );
      return {
        id: paymentRow.id,
        method: paymentRow.method,
        reference: paymentRow.reference ?? null,
        amount: appliedAmount,
        tenderedAmount,
        appliedAmount,
        changeAmount: normalizeNumber(paymentRow.changeAmount),
        createdAt: toTimestamp(paymentRow.createdAt) ?? 0,
        kind: resolvePaymentKind(paymentRow),
        notes:
          (paymentRow.creditTransactions ?? []).find(
            (transactionRow) => transactionRow.type === "payment"
          )?.notes ?? null,
      };
    })
    .toSorted((left, right) => {
      if (right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }
      return right.id.localeCompare(left.id);
    });

  const paidAmount = payments.reduce(
    (total, currentPayment) => total + currentPayment.appliedAmount,
    0
  );
  const totalAmount = normalizeNumber(row.totalAmount);
  const effectivePaidAmount =
    row.status === "cancelled" ? 0 : Math.min(totalAmount, paidAmount);

  return {
    id: row.id,
    status: row.status ?? "completed",
    createdAt: toTimestamp(row.createdAt) ?? 0,
    subtotal: normalizeNumber(row.subtotal),
    taxAmount: normalizeNumber(row.taxAmount),
    discountAmount: normalizeNumber(row.discountAmount),
    totalAmount,
    passThroughSubtotal: normalizeNumber(row.passThroughSubtotal),
    passThroughTaxAmount: normalizeNumber(row.passThroughTaxAmount),
    passThroughTotalAmount: normalizeNumber(row.passThroughTotalAmount),
    paidAmount: effectivePaidAmount,
    balanceDue:
      row.status === "cancelled"
        ? 0
        : Math.max(totalAmount - effectivePaidAmount, 0),
    customer: row.customerId
      ? {
          id: row.customerId,
          name: row.customer?.name ?? "Cliente",
          phone: row.customer?.phone ?? null,
          documentType: row.customer?.documentType ?? null,
          documentNumber: row.customer?.documentNumber ?? null,
        }
      : null,
    cashier: row.user?.id
      ? {
          id: row.user.id,
          name: row.user.name ?? "Cajero",
          email: row.user.email ?? null,
        }
      : null,
    shift: row.shiftId
      ? {
          id: row.shiftId,
          terminalName: row.shift?.terminalName ?? null,
        }
      : null,
    payments,
    items: (row.items ?? [])
      .map((itemRow) => ({
        id: itemRow.id,
        productId: itemRow.productId,
        name: itemRow.product?.name ?? "Producto",
        quantity: normalizeNumber(itemRow.quantity),
        unitPrice: normalizeNumber(itemRow.unitPrice),
        subtotal: normalizeNumber(itemRow.subtotal),
        taxRate: normalizeNumber(itemRow.taxRate),
        taxAmount: normalizeNumber(itemRow.taxAmount),
        discountAmount: normalizeNumber(itemRow.discountAmount),
        totalAmount: normalizeNumber(itemRow.totalAmount),
        accountingTreatment: itemRow.accountingTreatment ?? "revenue",
        modifiers: (itemRow.modifiers ?? []).map((modifierRow) => ({
          id: modifierRow.id,
          modifierProductId: modifierRow.modifierProductId,
          name: modifierRow.modifierProduct?.name ?? "Modificador",
          quantity: normalizeNumber(modifierRow.quantity),
          unitPrice: normalizeNumber(modifierRow.unitPrice),
          subtotal: normalizeNumber(modifierRow.subtotal),
        })),
      }))
      .toSorted((left, right) => right.id.localeCompare(left.id)),
  };
}

function matchesSaleSearch(row: SaleWithRelations, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  const haystack = [
    row.id,
    row.customer?.name ?? "",
    row.user?.name ?? "",
    row.shift?.terminalName ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchQuery);
}

function matchesSaleDateRange(
  row: SaleWithRelations,
  startDateMs: number | null,
  endDateExclusiveMs: number | null
) {
  const createdAt = toTimestamp(row.createdAt) ?? 0;
  if (startDateMs !== null && createdAt < startDateMs) {
    return false;
  }
  if (endDateExclusiveMs !== null && createdAt >= endDateExclusiveMs) {
    return false;
  }
  return true;
}

function matchesSaleBalanceStatus(
  row: SaleWithRelations,
  balanceStatus: NonNullable<SalesListParams["balanceStatus"]>
) {
  const totalAmount = normalizeNumber(row.totalAmount);
  const paidAmount = sumPaidAmount(row);

  switch (balanceStatus) {
    case "with_balance":
      return row.status !== "cancelled" && paidAmount < totalAmount;
    case "settled":
      return row.status === "cancelled" || paidAmount >= totalAmount;
    default:
      return true;
  }
}

function matchesSaleShift(row: SaleWithRelations, input: SalesListParams) {
  return !input.shiftIds || input.shiftIds.includes(row.shiftId ?? "");
}

export function matchesSaleFilters(
  row: SaleWithRelations,
  input: SalesListParams
) {
  const trimmedSearchQuery = input.searchQuery?.trim().toLowerCase() ?? "";
  const startDateMs = parseDateBoundary(input.startDate);
  const endDateMs = parseDateBoundary(input.endDate);
  const endDateExclusiveMs =
    endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;
  const amountRange = resolveAmountRange(input.amountMin, input.amountMax);
  const totalAmount = normalizeNumber(row.totalAmount);

  if (input.status && row.status !== input.status) {
    return false;
  }
  if (!matchesSaleShift(row, input)) {
    return false;
  }
  if (input.cashierId && row.userId !== input.cashierId) {
    return false;
  }
  if (input.terminalName && row.shift?.terminalName !== input.terminalName) {
    return false;
  }
  if (!matchesSaleSearch(row, trimmedSearchQuery)) {
    return false;
  }
  if (
    input.paymentMethod &&
    !(row.payments ?? []).some(
      (paymentRow) => paymentRow.method === input.paymentMethod
    )
  ) {
    return false;
  }
  if (
    input.balanceStatus &&
    !matchesSaleBalanceStatus(row, input.balanceStatus)
  ) {
    return false;
  }
  if (amountRange.minimum !== null && totalAmount < amountRange.minimum) {
    return false;
  }
  if (amountRange.maximum !== null && totalAmount > amountRange.maximum) {
    return false;
  }

  return matchesSaleDateRange(row, startDateMs, endDateExclusiveMs);
}

export function filterSalesByBalanceStatus(
  rows: SaleWithRelations[],
  balanceStatus: SalesListParams["balanceStatus"]
) {
  if (!balanceStatus) {
    return rows;
  }

  return rows.filter((row) => matchesSaleBalanceStatus(row, balanceStatus));
}

export function normalizeSalesListLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

export function buildSalesListPage(
  rows: SaleWithRelations[],
  limit: number
): {
  data: SaleListItem[];
  hasMore: boolean;
  nextCursor: SaleListCursor | null;
  total: number | null;
} {
  const pageSize = normalizeSalesListLimit(limit);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const data = pageRows.map((row) => buildSaleListItem(row));
  const lastRow = pageRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? {
          createdAt: toTimestamp(lastRow.createdAt) ?? 0,
          id: lastRow.id,
        }
      : null;

  return {
    data,
    hasMore,
    nextCursor,
    total: hasMore ? null : data.length,
  };
}

export function buildSaleFilterOptions({
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
    cashiers: buildUniqueCashierFilterOptions(members),
    terminals: normalizedTerminalNames.toSorted((left, right) =>
      left.localeCompare(right, "es-CO")
    ),
    paymentMethods: getAllPaymentMethods(organizationSettings)
      .map((method) => ({
        id: method.id,
        label: method.label,
      }))
      .toSorted((left, right) => comparePaymentMethodIds(left.id, right.id)),
  };
}
