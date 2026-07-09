import type { z } from "zod";
import { fetchPendingCredit } from "@/features/dashboard/credit-summary.server";
import type { DashboardOverviewSchema } from "@/features/dashboard/dashboard.schema";
import {
  type DashboardAuth,
  type DashboardDbExecutor,
  normalizeNumber,
  toTimestamp,
} from "@/features/dashboard/dashboard-helpers.server";
import {
  buildCollectedTotal,
  buildPaymentMix,
  fetchMonthPaymentMix,
  fetchShiftPaymentMix,
} from "@/features/dashboard/payment-mix.server";
import {
  fetchActiveProductsCount,
  fetchLowStockCount,
  fetchLowStockProducts,
  fetchTopProducts,
  fetchTopProductsShift,
  fetchTopProductsToday,
  mapTopProducts,
  TOP_PRODUCTS_WINDOW_DAYS,
} from "@/features/dashboard/product-performance.server";
import {
  buildSalesTrend,
  fetchActiveCustomersCount,
  fetchCurrentMonthSalesMetrics,
  fetchPreviousMonthSalesMetrics,
  fetchPreviousShiftSalesMetrics,
  fetchRecentSales,
  fetchSalesTrend,
  fetchShiftSalesMetrics,
  normalizeSalesMetrics,
  TREND_DAYS,
} from "@/features/dashboard/sales-aggregation.server";
import {
  fetchActiveShift,
  fetchClosedShiftWindow,
  fetchOpenShiftWindow,
  fetchOrganizationMetadata,
} from "@/features/dashboard/shift-summary.server";
import {
  getZonedDateParts,
  isSafeTimeZone,
  shiftZonedDateParts,
  type ZonedDateParts,
  zonedMidnightUtc,
} from "@/features/dashboard/zoned-time.server";
import {
  buildPaymentMethodLabelMap,
  buildPaymentMethodOptions,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";

export * from "@/features/dashboard/credit-summary.server";
export * from "@/features/dashboard/dashboard-helpers.server";
export * from "@/features/dashboard/payment-mix.server";
export * from "@/features/dashboard/product-performance.server";
export * from "@/features/dashboard/sales-aggregation.server";
export * from "@/features/dashboard/shift-summary.server";

type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

export async function runBuildDashboardOverview(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  timeZone: string
): Promise<DashboardOverview> {
  if (!isSafeTimeZone(timeZone)) {
    throw new Error(`Invalid dashboard time zone: ${timeZone}`);
  }

  const now = new Date();
  const today = getZonedDateParts(now, timeZone);
  const monthFirstDay: ZonedDateParts = { ...today, day: 1 };
  const tomorrowStart = zonedMidnightUtc(
    shiftZonedDateParts(today, { days: 1 }),
    timeZone
  );
  const monthStart = zonedMidnightUtc(monthFirstDay, timeZone);
  const nextMonthStart = zonedMidnightUtc(
    shiftZonedDateParts(monthFirstDay, { months: 1 }),
    timeZone
  );
  const previousMonthStart = zonedMidnightUtc(
    shiftZonedDateParts(monthFirstDay, { months: -1 }),
    timeZone
  );
  const trendStart = zonedMidnightUtc(
    shiftZonedDateParts(today, { days: -(TREND_DAYS - 1) }),
    timeZone
  );
  const topProductsStart = zonedMidnightUtc(
    shiftZonedDateParts(today, { days: -(TOP_PRODUCTS_WINDOW_DAYS - 1) }),
    timeZone
  );

  // Shifts often cross midnight (bars close in the early morning), so the
  // "current operation" metrics follow shifts instead of the calendar day:
  // every open shift in the org, or the last closed one when none is open.
  const [organizationRows, openShiftWindowRows, closedShiftWindowRows] =
    await Promise.all([
      fetchOrganizationMetadata(db, auth.organizationId),
      fetchOpenShiftWindow(db, auth),
      fetchClosedShiftWindow(db, auth),
    ]);
  const organizationSettings = parseOrganizationSettingsMetadata(
    organizationRows[0]?.metadata
  );
  const lowStockThreshold = organizationSettings.inventory.lowStockThreshold;

  const lastClosedShift = closedShiftWindowRows[0] ?? null;
  const salesWindow =
    openShiftWindowRows.length > 0
      ? {
          kind: "open" as const,
          shiftIds: openShiftWindowRows.map((row) => row.id),
          previousShiftId: lastClosedShift?.id ?? null,
          openedAt: toTimestamp(openShiftWindowRows[0]?.openedAt),
          closedAt: null,
        }
      : {
          kind: lastClosedShift ? ("closed" as const) : ("none" as const),
          shiftIds: lastClosedShift ? [lastClosedShift.id] : [],
          previousShiftId: closedShiftWindowRows[1]?.id ?? null,
          openedAt: lastClosedShift
            ? toTimestamp(lastClosedShift.openedAt)
            : null,
          closedAt: lastClosedShift
            ? toTimestamp(lastClosedShift.closedAt)
            : null,
        };

  const [
    activeShiftRows,
    shiftMetricsRows,
    previousShiftMetricsRows,
    currentMonthRows,
    previousMonthRows,
    activeProductsRows,
    activeCustomersRows,
    lowStockCountRows,
    pendingCreditRows,
    trendRows,
    paymentMixRows,
    monthPaymentRows,
    topProductsRows,
    topProductsTodayRows,
    topProductsShiftRows,
    lowStockProductRows,
    recentSalesRows,
  ] = await Promise.all([
    fetchActiveShift(db, auth),
    fetchShiftSalesMetrics(db, auth, salesWindow.shiftIds),
    fetchPreviousShiftSalesMetrics(db, auth, salesWindow.previousShiftId),
    fetchCurrentMonthSalesMetrics(db, auth, monthStart, nextMonthStart),
    fetchPreviousMonthSalesMetrics(db, auth, previousMonthStart, monthStart),
    fetchActiveProductsCount(db, auth),
    fetchActiveCustomersCount(db, auth),
    fetchLowStockCount(db, auth, lowStockThreshold),
    fetchPendingCredit(db, auth),
    fetchSalesTrend(db, auth, trendStart, tomorrowStart, timeZone),
    fetchShiftPaymentMix(db, auth, salesWindow.shiftIds),
    fetchMonthPaymentMix(db, auth, monthStart, nextMonthStart),
    fetchTopProducts(db, auth, topProductsStart, tomorrowStart),
    fetchTopProductsToday(db, auth, today, timeZone, tomorrowStart),
    fetchTopProductsShift(db, auth, salesWindow.shiftIds),
    fetchLowStockProducts(db, auth, lowStockThreshold),
    fetchRecentSales(db, auth),
  ]);

  const activeShiftRow = activeShiftRows[0] ?? null;
  const shiftMetrics = normalizeSalesMetrics(shiftMetricsRows[0]);
  const previousShiftMetrics = normalizeSalesMetrics(
    previousShiftMetricsRows[0]
  );
  const currentMonth = currentMonthRows[0];
  const previousMonth = previousMonthRows[0];
  const paymentMix = buildPaymentMix(paymentMixRows);
  const monthCollectedTotal = buildCollectedTotal(monthPaymentRows);
  const shiftCollectedTotal = paymentMix.reduce(
    (total, row) => total + row.amount,
    0
  );

  return {
    generatedAt: now.getTime(),
    lowStockThreshold,
    activeShift: activeShiftRow
      ? {
          id: activeShiftRow.id,
          terminalName: activeShiftRow.terminalName,
          startingCash: normalizeNumber(activeShiftRow.startingCash),
          openedAt: toTimestamp(activeShiftRow.openedAt),
        }
      : null,
    salesWindow: {
      kind: salesWindow.kind,
      shiftCount: salesWindow.shiftIds.length,
      openedAt: salesWindow.openedAt,
      closedAt: salesWindow.closedAt,
    },
    stats: {
      shiftGrossSales: shiftMetrics.grossSales,
      shiftNetRevenue: shiftMetrics.netRevenue,
      shiftTaxCollected: shiftMetrics.taxCollected,
      shiftCollectedTotal,
      shiftRevenue: shiftMetrics.revenue,
      shiftSalesCount: shiftMetrics.salesCount,
      shiftAvgTicket: shiftMetrics.avgTicket,
      shiftCustomersServed: shiftMetrics.distinctCustomers,
      previousShiftGrossSales: previousShiftMetrics.grossSales,
      previousShiftNetRevenue: previousShiftMetrics.netRevenue,
      previousShiftTaxCollected: previousShiftMetrics.taxCollected,
      previousShiftRevenue: previousShiftMetrics.revenue,
      monthGrossSales: normalizeNumber(currentMonth?.grossSales),
      monthNetRevenue: normalizeNumber(currentMonth?.netRevenue),
      monthTaxCollected: normalizeNumber(currentMonth?.taxCollected),
      monthCollectedTotal,
      monthRevenue: normalizeNumber(currentMonth?.revenue),
      monthSalesCount: normalizeNumber(currentMonth?.salesCount),
      previousMonthGrossSales: normalizeNumber(previousMonth?.grossSales),
      previousMonthNetRevenue: normalizeNumber(previousMonth?.netRevenue),
      previousMonthTaxCollected: normalizeNumber(previousMonth?.taxCollected),
      previousMonthRevenue: normalizeNumber(previousMonth?.revenue),
      activeProductsCount: normalizeNumber(activeProductsRows[0]?.total),
      activeCustomersCount: normalizeNumber(activeCustomersRows[0]?.total),
      lowStockCount: normalizeNumber(lowStockCountRows[0]?.total),
      pendingCreditBalance: normalizeNumber(pendingCreditRows[0]?.balance),
      creditAccountsCount: normalizeNumber(pendingCreditRows[0]?.total),
    },
    salesTrend: buildSalesTrend(
      trendRows.map((row) => ({
        dateKey: row.dateKey,
        grossSales: normalizeNumber(row.grossSales),
        netRevenue: normalizeNumber(row.netRevenue),
        salesCount: normalizeNumber(row.salesCount),
        taxCollected: normalizeNumber(row.taxCollected),
      })),
      today
    ),
    paymentMix,
    collectedPaymentMix: paymentMix,
    paymentMethodLabels: buildPaymentMethodLabelMap(
      buildPaymentMethodOptions(
        getAllPaymentMethods(organizationSettings),
        paymentMix.map((row) => row.method)
      )
    ),
    topProducts: mapTopProducts(topProductsRows),
    topProductsToday: mapTopProducts(topProductsTodayRows),
    topProductsShift: mapTopProducts(topProductsShiftRows),
    lowStockProducts: lowStockProductRows.map((row) => ({
      id: row.id,
      name: row.name,
      categoryName: row.categoryName,
      stock: normalizeNumber(row.stock),
      minStock:
        row.minStock === null || row.minStock === undefined
          ? null
          : normalizeNumber(row.minStock),
    })),
    recentSales: recentSalesRows.map((row) => ({
      id: row.id,
      totalAmount: normalizeNumber(row.totalAmount),
      status: row.status,
      customerName: row.customerName,
      createdAt: toTimestamp(row.createdAt),
    })),
  };
}
