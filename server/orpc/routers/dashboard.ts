import { implement } from "@orpc/server";
import { and, asc, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { creditAccount } from "@/database/drizzle/schema/credit.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import {
  payment,
  sale,
  saleItem,
} from "@/database/drizzle/schema/sales.schema";
import {
  buildPaymentMethodLabelMap,
  buildPaymentMethodOptions,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type { AppContext } from "../context";
import { dashboardContract } from "../contracts/dashboard";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const TREND_DAYS = 7;
const TOP_PRODUCTS_WINDOW_DAYS = 30;

interface AggregateSalesMetrics {
  avgTicket: number;
  distinctCustomers: number;
  revenue: number;
  salesCount: number;
}

const dashboardImplementer =
  implement(dashboardContract).$context<AppContext>();

const orgRequiredProcedure = dashboardImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

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

function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
}

function normalizeSalesMetrics(
  row: AggregateSalesMetrics | undefined
): AggregateSalesMetrics {
  return {
    revenue: normalizeNumber(row?.revenue),
    salesCount: normalizeNumber(row?.salesCount),
    avgTicket: normalizeNumber(row?.avgTicket),
    distinctCustomers: normalizeNumber(row?.distinctCustomers),
  };
}

function buildSalesTrend(
  rows: Array<{ dateKey: string; revenue: number; salesCount: number }>,
  now: Date
) {
  const trendByDate = new Map(
    rows.map((row) => [
      row.dateKey,
      {
        revenue: normalizeNumber(row.revenue),
        salesCount: normalizeNumber(row.salesCount),
      },
    ])
  );

  return Array.from({ length: TREND_DAYS }, (_, index) => {
    const currentDate = addDays(startOfDay(now), index - (TREND_DAYS - 1));
    const dateKey = formatDateKey(currentDate);
    const point = trendByDate.get(dateKey);

    return {
      dateKey,
      revenue: point?.revenue ?? 0,
      salesCount: point?.salesCount ?? 0,
    };
  });
}

export const overview = orgRequiredProcedure.overview.handler(
  async ({ context }) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const yesterdayStart = addDays(todayStart, -1);
    const monthStart = startOfMonth(now);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const trendStart = addDays(todayStart, -(TREND_DAYS - 1));
    const topProductsStart = addDays(
      todayStart,
      -(TOP_PRODUCTS_WINDOW_DAYS - 1)
    );
    const saleDateKey = sql<string>`to_char(${sale.createdAt}, 'YYYY-MM-DD')`;

    const organizationRows = await context.db
      .select({
        metadata: organization.metadata,
      })
      .from(organization)
      .where(eq(organization.id, context.organizationId))
      .limit(1);
    const organizationSettings = parseOrganizationSettingsMetadata(
      organizationRows[0]?.metadata
    );
    const lowStockThreshold = organizationSettings.inventory.lowStockThreshold;

    const saleBaseClauses = [
      eq(sale.organizationId, context.organizationId),
      ne(sale.status, "cancelled"),
    ];

    const [
      activeShiftRows,
      todayMetricsRows,
      yesterdayMetricsRows,
      currentMonthRows,
      previousMonthRows,
      activeProductsRows,
      activeCustomersRows,
      lowStockCountRows,
      pendingCreditRows,
      trendRows,
      paymentMixRows,
      topProductsRows,
      lowStockProductRows,
      recentSalesRows,
    ] = await Promise.all([
      context.db
        .select({
          id: shift.id,
          terminalName: shift.terminalName,
          startingCash: shift.startingCash,
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
        .orderBy(desc(shift.openedAt))
        .limit(1),
      context.db
        .select({
          revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          salesCount: sql<number>`count(*)`,
          avgTicket: sql<number>`coalesce(avg(${sale.totalAmount}), 0)`,
          distinctCustomers: sql<number>`count(distinct ${sale.customerId})`,
        })
        .from(sale)
        .where(
          and(
            ...saleBaseClauses,
            sql`${sale.createdAt} >= ${todayStart.toISOString()}`,
            sql`${sale.createdAt} < ${tomorrowStart.toISOString()}`
          )
        ),
      context.db
        .select({
          revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          salesCount: sql<number>`count(*)`,
          avgTicket: sql<number>`coalesce(avg(${sale.totalAmount}), 0)`,
          distinctCustomers: sql<number>`count(distinct ${sale.customerId})`,
        })
        .from(sale)
        .where(
          and(
            ...saleBaseClauses,
            sql`${sale.createdAt} >= ${yesterdayStart.toISOString()}`,
            sql`${sale.createdAt} < ${todayStart.toISOString()}`
          )
        ),
      context.db
        .select({
          revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          salesCount: sql<number>`count(*)`,
        })
        .from(sale)
        .where(
          and(
            ...saleBaseClauses,
            sql`${sale.createdAt} >= ${monthStart.toISOString()}`,
            sql`${sale.createdAt} < ${nextMonthStart.toISOString()}`
          )
        ),
      context.db
        .select({
          revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          salesCount: sql<number>`count(*)`,
        })
        .from(sale)
        .where(
          and(
            ...saleBaseClauses,
            sql`${sale.createdAt} >= ${previousMonthStart.toISOString()}`,
            sql`${sale.createdAt} < ${monthStart.toISOString()}`
          )
        ),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(product)
        .where(
          and(
            eq(product.organizationId, context.organizationId),
            isNull(product.deletedAt),
            eq(product.isModifier, false)
          )
        ),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(customer)
        .where(
          and(
            eq(customer.organizationId, context.organizationId),
            isNull(customer.deletedAt)
          )
        ),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(product)
        .where(
          and(
            eq(product.organizationId, context.organizationId),
            isNull(product.deletedAt),
            eq(product.isModifier, false),
            eq(product.trackInventory, true),
            sql`${product.stock} <= ${lowStockThreshold}`
          )
        ),
      context.db
        .select({
          balance: sql<number>`coalesce(sum(${creditAccount.balance}), 0)`,
          total: sql<number>`count(*)`,
        })
        .from(creditAccount)
        .innerJoin(
          customer,
          and(
            eq(customer.id, creditAccount.customerId),
            eq(customer.organizationId, context.organizationId),
            isNull(customer.deletedAt)
          )
        )
        .where(
          and(
            eq(creditAccount.organizationId, context.organizationId),
            gt(creditAccount.balance, 0)
          )
        ),
      context.db
        .select({
          dateKey: saleDateKey,
          revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
          salesCount: sql<number>`count(*)`,
        })
        .from(sale)
        .where(
          and(
            ...saleBaseClauses,
            sql`${sale.createdAt} >= ${trendStart.toISOString()}`,
            sql`${sale.createdAt} < ${tomorrowStart.toISOString()}`
          )
        )
        .groupBy(saleDateKey)
        .orderBy(asc(saleDateKey)),
      context.db
        .select({
          method: payment.method,
          amount: sql<number>`coalesce(sum(${payment.amount}), 0)`,
        })
        .from(payment)
        .leftJoin(
          sale,
          and(
            eq(sale.id, payment.saleId),
            eq(sale.organizationId, context.organizationId)
          )
        )
        .where(
          and(
            eq(payment.organizationId, context.organizationId),
            sql`${payment.createdAt} >= ${todayStart.toISOString()}`,
            sql`${payment.createdAt} < ${tomorrowStart.toISOString()}`,
            or(isNull(payment.saleId), ne(sale.status, "cancelled"))
          )
        )
        .groupBy(payment.method)
        .orderBy(desc(sql`sum(${payment.amount})`)),
      context.db
        .select({
          productId: saleItem.productId,
          name: product.name,
          quantitySold: sql<number>`coalesce(sum(${saleItem.quantity}), 0)`,
          revenue: sql<number>`coalesce(sum(${saleItem.totalAmount}), 0)`,
          stock: product.stock,
        })
        .from(saleItem)
        .innerJoin(
          sale,
          and(
            eq(sale.id, saleItem.saleId),
            eq(sale.organizationId, context.organizationId),
            ne(sale.status, "cancelled")
          )
        )
        .innerJoin(
          product,
          and(
            eq(product.id, saleItem.productId),
            eq(product.organizationId, context.organizationId),
            isNull(product.deletedAt)
          )
        )
        .where(
          and(
            eq(saleItem.organizationId, context.organizationId),
            sql`${sale.createdAt} >= ${topProductsStart.toISOString()}`,
            sql`${sale.createdAt} < ${tomorrowStart.toISOString()}`
          )
        )
        .groupBy(saleItem.productId, product.name, product.stock)
        .orderBy(
          desc(sql`sum(${saleItem.quantity})`),
          desc(sql`sum(${saleItem.totalAmount})`)
        )
        .limit(5),
      context.db
        .select({
          id: product.id,
          name: product.name,
          categoryName: category.name,
          stock: product.stock,
        })
        .from(product)
        .leftJoin(
          category,
          and(
            eq(category.id, product.categoryId),
            eq(category.organizationId, context.organizationId)
          )
        )
        .where(
          and(
            eq(product.organizationId, context.organizationId),
            isNull(product.deletedAt),
            eq(product.isModifier, false),
            eq(product.trackInventory, true),
            sql`${product.stock} <= ${lowStockThreshold}`
          )
        )
        .orderBy(asc(product.stock), asc(product.name))
        .limit(6),
      context.db
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
            eq(customer.organizationId, context.organizationId)
          )
        )
        .where(and(...saleBaseClauses))
        .orderBy(desc(sale.createdAt))
        .limit(6),
    ]);

    const activeShiftRow = activeShiftRows[0] ?? null;
    const todayMetrics = normalizeSalesMetrics(todayMetricsRows[0]);
    const yesterdayMetrics = normalizeSalesMetrics(yesterdayMetricsRows[0]);
    const currentMonth = currentMonthRows[0];
    const previousMonth = previousMonthRows[0];

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
      stats: {
        todayRevenue: todayMetrics.revenue,
        todaySalesCount: todayMetrics.salesCount,
        todayAvgTicket: todayMetrics.avgTicket,
        todayCustomersServed: todayMetrics.distinctCustomers,
        yesterdayRevenue: yesterdayMetrics.revenue,
        monthRevenue: normalizeNumber(currentMonth?.revenue),
        monthSalesCount: normalizeNumber(currentMonth?.salesCount),
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
          revenue: normalizeNumber(row.revenue),
          salesCount: normalizeNumber(row.salesCount),
        })),
        now
      ),
      paymentMix: paymentMixRows.map((row) => ({
        method: row.method,
        amount: normalizeNumber(row.amount),
      })),
      paymentMethodLabels: buildPaymentMethodLabelMap(
        buildPaymentMethodOptions(
          getAllPaymentMethods(organizationSettings),
          paymentMixRows.map((row) => row.method)
        )
      ),
      topProducts: topProductsRows.map((row) => ({
        productId: row.productId,
        name: row.name,
        quantitySold: normalizeNumber(row.quantitySold),
        revenue: normalizeNumber(row.revenue),
        stock: normalizeNumber(row.stock),
      })),
      lowStockProducts: lowStockProductRows.map((row) => ({
        id: row.id,
        name: row.name,
        categoryName: row.categoryName,
        stock: normalizeNumber(row.stock),
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
);
