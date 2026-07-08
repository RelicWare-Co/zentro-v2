import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
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
import type { DashboardOverviewSchema } from "@/features/dashboard/dashboard.schema";
import {
  buildPaymentMethodLabelMap,
  buildPaymentMethodOptions,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import { buildExpectedAmountsByMethod } from "@/features/shifts/shifts.shared";
import {
  buildZonedSaleDateKey,
  formatZonedDateKey,
  getZonedDateParts,
  isSafeTimeZone,
  shiftZonedDateParts,
  type ZonedDateParts,
  zonedMidnightUtc,
} from "./zoned-time.server";

export type DashboardDbExecutor = Pick<Database, "select">;

type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

interface AggregateSalesMetrics {
  avgTicket: number;
  distinctCustomers: number;
  grossSales: number;
  netRevenue: number;
  revenue: number;
  salesCount: number;
  taxCollected: number;
}

const TREND_DAYS = 7;
const TOP_PRODUCTS_WINDOW_DAYS = 30;

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

/** Matches `getEffectiveStockThreshold` + low/out alert semantics in stock-status.shared. */
function productAtStockRiskSql(lowStockThreshold: number) {
  const effectiveThreshold = sql`coalesce(
    case
      when ${product.minStock} is not null and ${product.minStock} >= 0
      then ${product.minStock}
      else null
    end,
    ${lowStockThreshold}
  )`;
  return sql`${product.stock} <= ${effectiveThreshold}`;
}

function buildSalesTrend(
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

function buildCollectedTotal(
  rows: Array<{
    appliedAmount: number | string | null;
    amount: number | string | null;
    changeAmount: number | string | null;
    method: string;
    saleId: string | null;
    saleTotalAmount: number | string | null;
  }>
) {
  return buildPaymentMix(rows).reduce((total, row) => total + row.amount, 0);
}

function buildPaymentMix(
  rows: Array<{
    appliedAmount: number | string | null;
    amount: number | string | null;
    changeAmount: number | string | null;
    method: string;
    saleId: string | null;
    saleTotalAmount: number | string | null;
  }>
) {
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

function mapTopProducts(
  rows: Array<{
    productId: string;
    name: string;
    quantitySold: number;
    revenue: number;
    stock: number;
  }>
) {
  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    quantitySold: normalizeNumber(row.quantitySold),
    revenue: normalizeNumber(row.revenue),
    stock: normalizeNumber(row.stock),
  }));
}

export async function runBuildDashboardOverview(
  db: DashboardDbExecutor,
  auth: { organizationId: string; userId: string },
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
  const saleDateKey = buildZonedSaleDateKey(sale.createdAt, timeZone);

  // Shifts often cross midnight (bars close in the early morning), so the
  // "current operation" metrics follow shifts instead of the calendar day:
  // every open shift in the org, or the last closed one when none is open.
  const [organizationRows, openShiftWindowRows, closedShiftWindowRows] =
    await Promise.all([
      db
        .select({
          metadata: organization.metadata,
        })
        .from(organization)
        .where(eq(organization.id, auth.organizationId))
        .limit(1),
      db
        .select({
          id: shift.id,
          openedAt: shift.openedAt,
        })
        .from(shift)
        .where(
          and(
            eq(shift.organizationId, auth.organizationId),
            eq(shift.status, "open")
          )
        )
        .orderBy(asc(shift.openedAt)),
      db
        .select({
          id: shift.id,
          openedAt: shift.openedAt,
          closedAt: shift.closedAt,
        })
        .from(shift)
        .where(
          and(
            eq(shift.organizationId, auth.organizationId),
            eq(shift.status, "closed")
          )
        )
        .orderBy(desc(shift.closedAt))
        .limit(2),
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

  const saleBaseClauses = [
    eq(sale.organizationId, auth.organizationId),
    ne(sale.status, "cancelled"),
  ];

  // Compute the zoned day once as a named column in a derived table, then
  // aggregate over it. Grouping by a real subquery column avoids both Postgres
  // pitfalls of the date-key expression: a SELECT alias is invisible to GROUP
  // BY, and a re-emitted expression carries a different bind placeholder than
  // the SELECT, so the two no longer match.
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
    db
      .select({
        id: shift.id,
        terminalName: shift.terminalName,
        startingCash: shift.startingCash,
        openedAt: shift.openedAt,
      })
      .from(shift)
      .where(
        and(
          eq(shift.organizationId, auth.organizationId),
          eq(shift.userId, auth.userId),
          eq(shift.status, "open")
        )
      )
      .orderBy(desc(shift.openedAt))
      .limit(1),
    salesWindow.shiftIds.length > 0
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
          .where(
            and(...saleBaseClauses, inArray(sale.shiftId, salesWindow.shiftIds))
          )
      : Promise.resolve([]),
    salesWindow.previousShiftId
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
          .where(
            and(
              ...saleBaseClauses,
              eq(sale.shiftId, salesWindow.previousShiftId)
            )
          )
      : Promise.resolve([]),
    db
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
      ),
    db
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
      ),
    db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(product)
      .where(
        and(
          eq(product.organizationId, auth.organizationId),
          isNull(product.deletedAt),
          eq(product.isModifier, false)
        )
      ),
    db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(customer)
      .where(
        and(
          eq(customer.organizationId, auth.organizationId),
          isNull(customer.deletedAt)
        )
      ),
    db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(product)
      .where(
        and(
          eq(product.organizationId, auth.organizationId),
          isNull(product.deletedAt),
          eq(product.isModifier, false),
          eq(product.trackInventory, true),
          productAtStockRiskSql(lowStockThreshold)
        )
      ),
    db
      .select({
        balance: sql<number>`coalesce(sum(${creditAccount.balance}), 0)`,
        total: sql<number>`count(*)`,
      })
      .from(creditAccount)
      .innerJoin(
        customer,
        and(
          eq(customer.id, creditAccount.customerId),
          eq(customer.organizationId, auth.organizationId),
          isNull(customer.deletedAt)
        )
      )
      .where(
        and(
          eq(creditAccount.organizationId, auth.organizationId),
          gt(creditAccount.balance, 0)
        )
      ),
    db
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
      .orderBy(asc(salesTrendDays.dateKey)),
    salesWindow.shiftIds.length > 0
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
              inArray(payment.shiftId, salesWindow.shiftIds),
              or(isNull(payment.saleId), ne(sale.status, "cancelled"))
            )
          )
      : Promise.resolve([]),
    db
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
      ),
    db
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
          eq(sale.organizationId, auth.organizationId),
          ne(sale.status, "cancelled")
        )
      )
      .innerJoin(
        product,
        and(
          eq(product.id, saleItem.productId),
          eq(product.organizationId, auth.organizationId),
          isNull(product.deletedAt)
        )
      )
      .where(
        and(
          eq(saleItem.organizationId, auth.organizationId),
          ne(saleItem.accountingTreatment, "passthrough"),
          gte(sale.createdAt, topProductsStart),
          lt(sale.createdAt, tomorrowStart)
        )
      )
      .groupBy(saleItem.productId, product.name, product.stock)
      .orderBy(
        desc(sql`sum(${saleItem.quantity})`),
        desc(sql`sum(${saleItem.totalAmount})`)
      )
      .limit(5),
    db
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
          eq(sale.organizationId, auth.organizationId),
          ne(sale.status, "cancelled")
        )
      )
      .innerJoin(
        product,
        and(
          eq(product.id, saleItem.productId),
          eq(product.organizationId, auth.organizationId),
          isNull(product.deletedAt)
        )
      )
      .where(
        and(
          eq(saleItem.organizationId, auth.organizationId),
          ne(saleItem.accountingTreatment, "passthrough"),
          gte(sale.createdAt, zonedMidnightUtc(today, timeZone)),
          lt(sale.createdAt, tomorrowStart)
        )
      )
      .groupBy(saleItem.productId, product.name, product.stock)
      .orderBy(
        desc(sql`sum(${saleItem.quantity})`),
        desc(sql`sum(${saleItem.totalAmount})`)
      )
      .limit(5),
    salesWindow.shiftIds.length > 0
      ? db
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
              eq(sale.organizationId, auth.organizationId),
              ne(sale.status, "cancelled")
            )
          )
          .innerJoin(
            product,
            and(
              eq(product.id, saleItem.productId),
              eq(product.organizationId, auth.organizationId),
              isNull(product.deletedAt)
            )
          )
          .where(
            and(
              eq(saleItem.organizationId, auth.organizationId),
              ne(saleItem.accountingTreatment, "passthrough"),
              inArray(sale.shiftId, salesWindow.shiftIds)
            )
          )
          .groupBy(saleItem.productId, product.name, product.stock)
          .orderBy(
            desc(sql`sum(${saleItem.quantity})`),
            desc(sql`sum(${saleItem.totalAmount})`)
          )
          .limit(5)
      : Promise.resolve([]),
    db
      .select({
        id: product.id,
        name: product.name,
        categoryName: category.name,
        stock: product.stock,
        minStock: product.minStock,
      })
      .from(product)
      .leftJoin(
        category,
        and(
          eq(category.id, product.categoryId),
          eq(category.organizationId, auth.organizationId)
        )
      )
      .where(
        and(
          eq(product.organizationId, auth.organizationId),
          isNull(product.deletedAt),
          eq(product.isModifier, false),
          eq(product.trackInventory, true),
          productAtStockRiskSql(lowStockThreshold)
        )
      )
      .orderBy(asc(product.stock), asc(product.name))
      .limit(6),
    db
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
      .limit(6),
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
