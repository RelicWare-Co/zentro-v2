import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import { organization, user } from "@/database/drizzle/schema/auth.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import { cashMovement, shift } from "@/database/drizzle/schema/pos.schema";
import {
  payment,
  sale,
  saleItem,
} from "@/database/drizzle/schema/sales.schema";
import { normalizeNumber } from "@/features/dashboard/dashboard-helpers.server";
import {
  buildZonedSaleDateKey,
  shiftZonedDateParts,
  zonedMidnightUtc,
} from "@/features/dashboard/zoned-time.server";
import type {
  ReportData,
  ReportFilters,
} from "@/features/reports/reports.schema";
import {
  buildPaymentMethodLabelMap,
  buildPaymentMethodOptions,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";

type ReportsDb = Pick<Database, "select" | "selectDistinct">;

const DEFAULT_DETAIL_LIMIT = 100;
export const MAX_REPORT_EXPORT_ROWS = 50_000;

function dateKeyToParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

function buildSaleStatusClause(status: ReportFilters["status"]): SQL {
  return status === "active"
    ? ne(sale.status, "cancelled")
    : eq(sale.status, status);
}

function toTimestamp(value: Date): number {
  return value.getTime();
}

export async function buildBusinessReport(
  db: ReportsDb,
  organizationId: string,
  filters: ReportFilters,
  timeZone: string,
  detailLimit = DEFAULT_DETAIL_LIMIT
): Promise<ReportData> {
  const startParts = dateKeyToParts(filters.startDate);
  const endParts = dateKeyToParts(filters.endDate);
  const start = zonedMidnightUtc(startParts, timeZone);
  const endExclusive = zonedMidnightUtc(
    shiftZonedDateParts(endParts, { days: 1 }),
    timeZone
  );
  const cashierClause = filters.cashierId
    ? eq(sale.userId, filters.cashierId)
    : undefined;
  const salesWhere = and(
    eq(sale.organizationId, organizationId),
    gte(sale.createdAt, start),
    lt(sale.createdAt, endExclusive),
    buildSaleStatusClause(filters.status),
    cashierClause
  );
  const saleDateKey = buildZonedSaleDateKey(sale.createdAt, timeZone);
  const trendDays = db
    .select({
      dateKey: saleDateKey.as("date_key"),
      totalAmount: sale.totalAmount,
      passThroughTotalAmount: sale.passThroughTotalAmount,
      taxAmount: sale.taxAmount,
      passThroughTaxAmount: sale.passThroughTaxAmount,
    })
    .from(sale)
    .where(salesWhere)
    .as("report_sales_days");

  const shiftCashierClause = filters.cashierId
    ? eq(shift.userId, filters.cashierId)
    : undefined;
  const paymentStatusClause =
    filters.status === "active"
      ? or(isNull(payment.saleId), ne(sale.status, "cancelled"))
      : eq(sale.status, filters.status);
  const paymentsWhere = and(
    eq(payment.organizationId, organizationId),
    eq(shift.organizationId, organizationId),
    gte(payment.createdAt, start),
    lt(payment.createdAt, endExclusive),
    shiftCashierClause,
    paymentStatusClause
  );
  const movementsWhere = and(
    eq(cashMovement.organizationId, organizationId),
    eq(shift.organizationId, organizationId),
    gte(cashMovement.createdAt, start),
    lt(cashMovement.createdAt, endExclusive),
    shiftCashierClause
  );

  const [
    organizationRows,
    cashierRows,
    summaryRows,
    trendRows,
    saleRows,
    productRows,
    paymentRows,
    movementSummaryRows,
    movementRows,
  ] = await Promise.all([
    db
      .select({ name: organization.name, metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
    db
      .selectDistinct({ id: user.id, name: user.name })
      .from(shift)
      .innerJoin(user, eq(user.id, shift.userId))
      .where(eq(shift.organizationId, organizationId))
      .orderBy(asc(user.name)),
    db
      .select({
        salesCount: sql<number>`count(*)`,
        grossSales: sql<number>`coalesce(sum(${sale.totalAmount} - ${sale.passThroughTotalAmount}), 0)`,
        netRevenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
        taxCollected: sql<number>`coalesce(sum(${sale.taxAmount} - ${sale.passThroughTaxAmount}), 0)`,
        discounts: sql<number>`coalesce(sum(${sale.discountAmount}), 0)`,
        averageTicket: sql<number>`coalesce(avg(${sale.totalAmount} - ${sale.passThroughTotalAmount}), 0)`,
      })
      .from(sale)
      .where(salesWhere),
    db
      .select({
        dateKey: trendDays.dateKey,
        salesCount: sql<number>`count(*)`,
        grossSales: sql<number>`coalesce(sum(${trendDays.totalAmount} - ${trendDays.passThroughTotalAmount}), 0)`,
        netRevenue: sql<number>`coalesce(sum((${trendDays.totalAmount} - ${trendDays.passThroughTotalAmount}) - (${trendDays.taxAmount} - ${trendDays.passThroughTaxAmount})), 0)`,
      })
      .from(trendDays)
      .groupBy(trendDays.dateKey)
      .orderBy(asc(trendDays.dateKey)),
    db
      .select({
        id: sale.id,
        createdAt: sale.createdAt,
        status: sale.status,
        cashierName: user.name,
        terminalName: shift.terminalName,
        customerName: customer.name,
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        taxAmount: sale.taxAmount,
        totalAmount: sale.totalAmount,
        passThroughTotalAmount: sale.passThroughTotalAmount,
        passThroughTaxAmount: sale.passThroughTaxAmount,
      })
      .from(sale)
      .innerJoin(user, eq(user.id, sale.userId))
      .innerJoin(
        shift,
        and(
          eq(shift.id, sale.shiftId),
          eq(shift.organizationId, organizationId)
        )
      )
      .leftJoin(
        customer,
        and(
          eq(customer.id, sale.customerId),
          eq(customer.organizationId, organizationId)
        )
      )
      .where(salesWhere)
      .orderBy(desc(sale.createdAt), desc(sale.id))
      .limit(detailLimit + 1),
    db
      .select({
        productId: saleItem.productId,
        name: product.name,
        categoryName: category.name,
        quantitySold: sql<number>`coalesce(sum(${saleItem.quantity}), 0)`,
        billedTotal: sql<number>`coalesce(sum(${saleItem.totalAmount}), 0)`,
        netRevenue: sql<number>`coalesce(sum(${saleItem.totalAmount} - ${saleItem.taxAmount}), 0)`,
        taxAmount: sql<number>`coalesce(sum(${saleItem.taxAmount}), 0)`,
        discountAmount: sql<number>`coalesce(sum(${saleItem.discountAmount}), 0)`,
      })
      .from(saleItem)
      .innerJoin(
        sale,
        and(
          eq(sale.id, saleItem.saleId),
          eq(sale.organizationId, organizationId)
        )
      )
      .innerJoin(
        product,
        and(
          eq(product.id, saleItem.productId),
          eq(product.organizationId, organizationId)
        )
      )
      .leftJoin(
        category,
        and(
          eq(category.id, product.categoryId),
          eq(category.organizationId, organizationId)
        )
      )
      .where(and(salesWhere, ne(saleItem.accountingTreatment, "passthrough")))
      .groupBy(saleItem.productId, product.name, category.name)
      .orderBy(desc(sql`sum(${saleItem.totalAmount})`), asc(product.name)),
    db
      .select({
        method: payment.method,
        paymentCount: sql<number>`count(*)`,
        tenderedAmount: sql<number>`coalesce(sum(${payment.amount}), 0)`,
        changeAmount: sql<number>`coalesce(sum(${payment.changeAmount}), 0)`,
        appliedAmount: sql<number>`coalesce(sum(${payment.appliedAmount}), 0)`,
        netCollected: sql<number>`coalesce(sum(${payment.amount} - ${payment.changeAmount}), 0)`,
      })
      .from(payment)
      .innerJoin(
        shift,
        and(
          eq(shift.id, payment.shiftId),
          eq(shift.organizationId, organizationId)
        )
      )
      .leftJoin(
        sale,
        and(
          eq(sale.id, payment.saleId),
          eq(sale.organizationId, organizationId)
        )
      )
      .where(paymentsWhere)
      .groupBy(payment.method)
      .orderBy(desc(sql`sum(${payment.amount} - ${payment.changeAmount})`)),
    db
      .select({
        expensesTotal: sql<number>`coalesce(sum(case when ${cashMovement.type} = 'expense' then ${cashMovement.amount} else 0 end), 0)`,
        payoutsTotal: sql<number>`coalesce(sum(case when ${cashMovement.type} = 'payout' then ${cashMovement.amount} else 0 end), 0)`,
        inflowsTotal: sql<number>`coalesce(sum(case when ${cashMovement.type} = 'inflow' then ${cashMovement.amount} else 0 end), 0)`,
      })
      .from(cashMovement)
      .innerJoin(
        shift,
        and(
          eq(shift.id, cashMovement.shiftId),
          eq(shift.organizationId, organizationId)
        )
      )
      .where(movementsWhere),
    db
      .select({
        id: cashMovement.id,
        createdAt: cashMovement.createdAt,
        type: cashMovement.type,
        paymentMethod: cashMovement.paymentMethod,
        amount: cashMovement.amount,
        description: cashMovement.description,
        cashierName: user.name,
        terminalName: shift.terminalName,
        sourceType: cashMovement.sourceType,
      })
      .from(cashMovement)
      .innerJoin(
        shift,
        and(
          eq(shift.id, cashMovement.shiftId),
          eq(shift.organizationId, organizationId)
        )
      )
      .innerJoin(user, eq(user.id, shift.userId))
      .where(movementsWhere)
      .orderBy(desc(cashMovement.createdAt), desc(cashMovement.id))
      .limit(detailLimit + 1),
  ]);

  const organizationRow = organizationRows[0];
  const settings = parseOrganizationSettingsMetadata(organizationRow?.metadata);
  const paymentMethodIds = new Set([
    ...paymentRows.map((row) => row.method),
    ...movementRows.map((row) => row.paymentMethod),
  ]);
  const paymentMethodLabels = buildPaymentMethodLabelMap(
    buildPaymentMethodOptions(getAllPaymentMethods(settings), paymentMethodIds)
  );
  const salesTruncated = saleRows.length > detailLimit;
  const movementsTruncated = movementRows.length > detailLimit;
  const summary = summaryRows[0];
  const movementSummary = movementSummaryRows[0];
  const collectedTotal = paymentRows.reduce(
    (total, row) => total + normalizeNumber(row.netCollected),
    0
  );
  const selectedCashier = filters.cashierId
    ? cashierRows.find((cashier) => cashier.id === filters.cashierId)
    : undefined;

  return {
    generatedAt: Date.now(),
    organizationName: organizationRow?.name ?? "Organización",
    timeZone,
    period: { startDate: filters.startDate, endDate: filters.endDate },
    filters: {
      cashierId: filters.cashierId ?? null,
      cashierName: selectedCashier?.name ?? null,
      status: filters.status,
    },
    options: { cashiers: cashierRows },
    summary: {
      salesCount: normalizeNumber(summary?.salesCount),
      grossSales: normalizeNumber(summary?.grossSales),
      netRevenue: normalizeNumber(summary?.netRevenue),
      taxCollected: normalizeNumber(summary?.taxCollected),
      discounts: normalizeNumber(summary?.discounts),
      averageTicket: normalizeNumber(summary?.averageTicket),
      collectedTotal,
      expensesTotal: normalizeNumber(movementSummary?.expensesTotal),
      payoutsTotal: normalizeNumber(movementSummary?.payoutsTotal),
      inflowsTotal: normalizeNumber(movementSummary?.inflowsTotal),
    },
    trend: trendRows.map((row) => ({
      dateKey: row.dateKey,
      salesCount: normalizeNumber(row.salesCount),
      grossSales: normalizeNumber(row.grossSales),
      netRevenue: normalizeNumber(row.netRevenue),
    })),
    sales: saleRows.slice(0, detailLimit).map((row) => {
      const accountingBilled =
        normalizeNumber(row.totalAmount) -
        normalizeNumber(row.passThroughTotalAmount);
      const accountingTax =
        normalizeNumber(row.taxAmount) -
        normalizeNumber(row.passThroughTaxAmount);
      return {
        id: row.id,
        createdAt: toTimestamp(row.createdAt),
        status: row.status,
        cashierName: row.cashierName,
        terminalName: row.terminalName,
        customerName: row.customerName,
        subtotal: normalizeNumber(row.subtotal),
        discountAmount: normalizeNumber(row.discountAmount),
        taxAmount: accountingTax,
        totalAmount: normalizeNumber(row.totalAmount),
        passThroughTotalAmount: normalizeNumber(row.passThroughTotalAmount),
        accountingBilled,
        netRevenue: accountingBilled - accountingTax,
      };
    }),
    products: productRows.map((row) => ({
      productId: row.productId,
      name: row.name,
      categoryName: row.categoryName,
      quantitySold: normalizeNumber(row.quantitySold),
      billedTotal: normalizeNumber(row.billedTotal),
      netRevenue: normalizeNumber(row.netRevenue),
      taxAmount: normalizeNumber(row.taxAmount),
      discountAmount: normalizeNumber(row.discountAmount),
    })),
    payments: paymentRows.map((row) => ({
      method: row.method,
      label: paymentMethodLabels[row.method] ?? row.method,
      paymentCount: normalizeNumber(row.paymentCount),
      tenderedAmount: normalizeNumber(row.tenderedAmount),
      changeAmount: normalizeNumber(row.changeAmount),
      appliedAmount: normalizeNumber(row.appliedAmount),
      netCollected: normalizeNumber(row.netCollected),
    })),
    movements: movementRows.slice(0, detailLimit).map((row) => ({
      id: row.id,
      createdAt: toTimestamp(row.createdAt),
      type: row.type,
      paymentMethod: row.paymentMethod,
      paymentMethodLabel:
        paymentMethodLabels[row.paymentMethod] ?? row.paymentMethod,
      amount: normalizeNumber(row.amount),
      description: row.description,
      cashierName: row.cashierName,
      terminalName: row.terminalName,
      sourceType: row.sourceType,
    })),
    truncated: { sales: salesTruncated, movements: movementsTruncated },
  };
}
