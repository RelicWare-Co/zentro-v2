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
  sql,
} from "drizzle-orm";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import type {
  DashboardAuth,
  DashboardDbExecutor,
} from "@/features/dashboard/dashboard-helpers.server";
import { normalizeNumber } from "@/features/dashboard/dashboard-helpers.server";
import {
  buildZonedSaleDateKey,
  formatZonedDateKey,
  shiftZonedDateParts,
  type ZonedDateParts,
} from "@/features/dashboard/zoned-time.server";

export const TREND_DAYS = 7;

export interface AggregateSalesMetrics {
  avgTicket: number;
  distinctCustomers: number;
  grossSales: number;
  netRevenue: number;
  revenue: number;
  salesCount: number;
  taxCollected: number;
}

export function normalizeSalesMetrics(
  row: AggregateSalesMetrics | undefined
): AggregateSalesMetrics {
  const netRevenue = normalizeNumber(row?.netRevenue);
  return {
    avgTicket: normalizeNumber(row?.avgTicket),
    distinctCustomers: normalizeNumber(row?.distinctCustomers),
    grossSales: normalizeNumber(row?.grossSales),
    netRevenue,
    revenue: netRevenue,
    salesCount: normalizeNumber(row?.salesCount),
    taxCollected: normalizeNumber(row?.taxCollected),
  };
}

export function buildSalesTrend(
  rows: Array<{
    dateKey: string;
    grossSales: number;
    netRevenue: number;
    salesCount: number;
    taxCollected: number;
  }>,
  today: ZonedDateParts
) {
  const trendByDate = new Map(
    rows.map((row) => [
      row.dateKey,
      {
        grossSales: normalizeNumber(row.grossSales),
        netRevenue: normalizeNumber(row.netRevenue),
        salesCount: normalizeNumber(row.salesCount),
        taxCollected: normalizeNumber(row.taxCollected),
      },
    ])
  );

  return Array.from({ length: TREND_DAYS }, (_, index) => {
    const dateKey = formatZonedDateKey(
      shiftZonedDateParts(today, { days: index - (TREND_DAYS - 1) })
    );
    const point = trendByDate.get(dateKey);

    return {
      dateKey,
      grossSales: point?.grossSales ?? 0,
      netRevenue: point?.netRevenue ?? 0,
      taxCollected: point?.taxCollected ?? 0,
      revenue: point?.netRevenue ?? 0,
      salesCount: point?.salesCount ?? 0,
    };
  });
}

export function fetchShiftSalesMetrics(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  shiftIds: string[]
) {
  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];
  return shiftIds.length > 0
    ? db
        .select({
          grossSales: sql<number>`coalesce(sum(${sale.totalAmount} - ${sale.passThroughTotalAmount}), 0)`,
          netRevenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
          revenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
          salesCount: sql<number>`count(*)`,
          avgTicket: sql<number>`coalesce(avg((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
          distinctCustomers: sql<number>`count(distinct ${sale.customerId})`,
          taxCollected: sql<number>`coalesce(sum(${sale.taxAmount} - ${sale.passThroughTaxAmount}), 0)`,
        })
        .from(sale)
        .where(and(...saleBaseClauses, inArray(sale.shiftId, shiftIds)))
    : Promise.resolve([]);
}

export function fetchPreviousShiftSalesMetrics(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  previousShiftId: string | null
) {
  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];
  return previousShiftId
    ? db
        .select({
          grossSales: sql<number>`coalesce(sum(${sale.totalAmount} - ${sale.passThroughTotalAmount}), 0)`,
          netRevenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
          revenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
          salesCount: sql<number>`count(*)`,
          avgTicket: sql<number>`coalesce(avg((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
          distinctCustomers: sql<number>`count(distinct ${sale.customerId})`,
          taxCollected: sql<number>`coalesce(sum(${sale.taxAmount} - ${sale.passThroughTaxAmount}), 0)`,
        })
        .from(sale)
        .where(and(...saleBaseClauses, eq(sale.shiftId, previousShiftId)))
    : Promise.resolve([]);
}

export function fetchCurrentMonthSalesMetrics(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  monthStart: Date,
  nextMonthStart: Date
) {
  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];
  return db
    .select({
      grossSales: sql<number>`coalesce(sum(${sale.totalAmount} - ${sale.passThroughTotalAmount}), 0)`,
      netRevenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
      revenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
      salesCount: sql<number>`count(*)`,
      taxCollected: sql<number>`coalesce(sum(${sale.taxAmount} - ${sale.passThroughTaxAmount}), 0)`,
    })
    .from(sale)
    .where(
      and(
        ...saleBaseClauses,
        gte(sale.createdAt, monthStart),
        lt(sale.createdAt, nextMonthStart)
      )
    );
}

export function fetchPreviousMonthSalesMetrics(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  previousMonthStart: Date,
  monthStart: Date
) {
  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];
  return db
    .select({
      grossSales: sql<number>`coalesce(sum(${sale.totalAmount} - ${sale.passThroughTotalAmount}), 0)`,
      netRevenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
      revenue: sql<number>`coalesce(sum((${sale.totalAmount} - ${sale.passThroughTotalAmount}) - (${sale.taxAmount} - ${sale.passThroughTaxAmount})), 0)`,
      salesCount: sql<number>`count(*)`,
      taxCollected: sql<number>`coalesce(sum(${sale.taxAmount} - ${sale.passThroughTaxAmount}), 0)`,
    })
    .from(sale)
    .where(
      and(
        ...saleBaseClauses,
        gte(sale.createdAt, previousMonthStart),
        lt(sale.createdAt, monthStart)
      )
    );
}

export function fetchSalesTrend(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  trendStart: Date,
  tomorrowStart: Date,
  timeZone: string
) {
  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];
  const saleDateKey = buildZonedSaleDateKey(sale.createdAt, timeZone);
  const salesTrendDays = db
    .select({
      dateKey: saleDateKey.as("date_key"),
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      passThroughTotalAmount: sale.passThroughTotalAmount,
      passThroughTaxAmount: sale.passThroughTaxAmount,
    })
    .from(sale)
    .where(
      and(
        ...saleBaseClauses,
        gte(sale.createdAt, trendStart),
        lt(sale.createdAt, tomorrowStart)
      )
    )
    .as("sales_trend_days");

  return db
    .select({
      dateKey: salesTrendDays.dateKey,
      grossSales: sql<number>`coalesce(sum(${salesTrendDays.totalAmount} - ${salesTrendDays.passThroughTotalAmount}), 0)`,
      netRevenue: sql<number>`coalesce(sum((${salesTrendDays.totalAmount} - ${salesTrendDays.passThroughTotalAmount}) - (${salesTrendDays.taxAmount} - ${salesTrendDays.passThroughTaxAmount})), 0)`,
      revenue: sql<number>`coalesce(sum((${salesTrendDays.totalAmount} - ${salesTrendDays.passThroughTotalAmount}) - (${salesTrendDays.taxAmount} - ${salesTrendDays.passThroughTaxAmount})), 0)`,
      salesCount: sql<number>`count(*)`,
      taxCollected: sql<number>`coalesce(sum(${salesTrendDays.taxAmount} - ${salesTrendDays.passThroughTaxAmount}), 0)`,
    })
    .from(salesTrendDays)
    .groupBy(salesTrendDays.dateKey)
    .orderBy(asc(salesTrendDays.dateKey));
}

export function fetchRecentSales(db: DashboardDbExecutor, auth: DashboardAuth) {
  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];
  return db
    .select({
      id: sale.id,
      totalAmount: sale.totalAmount,
      status: sale.status,
      customerName: customer.name,
      createdAt: sale.createdAt,
    })
    .from(sale)
    .leftJoin(
      customer,
      and(
        eq(customer.id, sale.customerId),
        eq(customer.organizationId, auth.organizationId)
      )
    )
    .where(and(...saleBaseClauses))
    .orderBy(desc(sale.createdAt))
    .limit(6);
}

export function fetchActiveCustomersCount(
  db: DashboardDbExecutor,
  auth: DashboardAuth
) {
  return db
    .select({
      total: sql<number>`count(*)`,
    })
    .from(customer)
    .where(
      and(
        eq(customer.organizationId, auth.organizationId),
        isNull(customer.deletedAt)
      )
    );
}
