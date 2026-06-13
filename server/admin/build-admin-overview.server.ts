import { and, asc, gte, lt, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { organization, user } from "@/database/drizzle/schema/auth.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import type { AdminPlatformOverviewSchema } from "@/schemas/admin";
import {
  formatZonedDateKey,
  getZonedDateParts,
  isSafeTimeZone,
  shiftZonedDateParts,
  type ZonedDateParts,
  zonedMidnightUtc,
} from "@/server/dashboard/zoned-time.server";

export type AdminOverviewDbExecutor = Pick<Database, "select">;

type AdminPlatformOverview = z.infer<typeof AdminPlatformOverviewSchema>;

const TREND_DAYS = 14;

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

function toTimestampOrNull(value: Date | number | string | null | undefined) {
  if (!value) {
    return null;
  }
  const dateValue = value instanceof Date ? value : new Date(value);
  const timestamp = dateValue.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildPlatformSalesTrend(
  rows: Array<{
    activeOrganizations: number;
    dateKey: string;
    revenue: number;
    salesCount: number;
  }>,
  today: ZonedDateParts
) {
  const trendByDate = new Map(rows.map((row) => [row.dateKey, row]));

  return Array.from({ length: TREND_DAYS }, (_, index) => {
    const dateKey = formatZonedDateKey(
      shiftZonedDateParts(today, { days: index - (TREND_DAYS - 1) })
    );
    const point = trendByDate.get(dateKey);

    return {
      dateKey,
      revenue: normalizeNumber(point?.revenue),
      salesCount: normalizeNumber(point?.salesCount),
      activeOrganizations: normalizeNumber(point?.activeOrganizations),
    };
  });
}

export async function runBuildAdminOverview(
  db: AdminOverviewDbExecutor,
  timeZone: string
): Promise<AdminPlatformOverview> {
  if (!isSafeTimeZone(timeZone)) {
    throw new Error(`Invalid admin overview time zone: ${timeZone}`);
  }

  const now = new Date();
  const today = getZonedDateParts(now, timeZone);
  const monthFirstDay: ZonedDateParts = { ...today, day: 1 };
  const todayStart = zonedMidnightUtc(today, timeZone);
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
  // isSafeTimeZone guarantees the value has no quotes, so inlining it as a
  // literal is safe. A bind param would not match the GROUP BY expression.
  const saleDateKey = sql<string>`to_char(${sale.createdAt} at time zone ${sql.raw(`'${timeZone}'`)}, 'YYYY-MM-DD')`;
  const notCancelled = ne(sale.status, "cancelled");

  const [
    organizationsCountRows,
    usersCountRows,
    newOrganizationsRows,
    newUsersRows,
    todayMetricsRows,
    currentMonthRows,
    previousMonthRows,
    trendRows,
    organizationRows,
    organizationTodayRows,
    organizationLastSaleRows,
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(organization),
    db.select({ total: sql<number>`count(*)` }).from(user),
    db
      .select({ total: sql<number>`count(*)` })
      .from(organization)
      .where(gte(organization.createdAt, monthStart)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(user)
      .where(gte(user.createdAt, monthStart)),
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
        avgTicket: sql<number>`coalesce(avg(${sale.totalAmount}), 0)`,
        activeOrganizations: sql<number>`count(distinct ${sale.organizationId})`,
      })
      .from(sale)
      .where(
        and(
          notCancelled,
          gte(sale.createdAt, todayStart),
          lt(sale.createdAt, tomorrowStart)
        )
      ),
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
      })
      .from(sale)
      .where(
        and(
          notCancelled,
          gte(sale.createdAt, monthStart),
          lt(sale.createdAt, nextMonthStart)
        )
      ),
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
      })
      .from(sale)
      .where(
        and(
          notCancelled,
          gte(sale.createdAt, previousMonthStart),
          lt(sale.createdAt, monthStart)
        )
      ),
    db
      .select({
        dateKey: saleDateKey,
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
        activeOrganizations: sql<number>`count(distinct ${sale.organizationId})`,
      })
      .from(sale)
      .where(
        and(
          notCancelled,
          gte(sale.createdAt, trendStart),
          lt(sale.createdAt, tomorrowStart)
        )
      )
      .groupBy(saleDateKey)
      .orderBy(asc(saleDateKey)),
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(organization)
      .orderBy(asc(organization.name)),
    db
      .select({
        organizationId: sale.organizationId,
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
      })
      .from(sale)
      .where(
        and(
          notCancelled,
          gte(sale.createdAt, todayStart),
          lt(sale.createdAt, tomorrowStart)
        )
      )
      .groupBy(sale.organizationId),
    db
      .select({
        organizationId: sale.organizationId,
        lastSaleAt: sql<Date | null>`max(${sale.createdAt})`,
      })
      .from(sale)
      .where(notCancelled)
      .groupBy(sale.organizationId),
  ]);

  const todayMetrics = todayMetricsRows[0];
  const todayByOrganization = new Map(
    organizationTodayRows.map((row) => [row.organizationId, row])
  );
  const lastSaleByOrganization = new Map(
    organizationLastSaleRows.map((row) => [
      row.organizationId,
      toTimestampOrNull(row.lastSaleAt),
    ])
  );

  const organizationsDaily = organizationRows
    .map((org) => {
      const todayRow = todayByOrganization.get(org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        revenueToday: normalizeNumber(todayRow?.revenue),
        salesCountToday: normalizeNumber(todayRow?.salesCount),
        lastSaleAt: lastSaleByOrganization.get(org.id) ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.revenueToday - left.revenueToday ||
        left.name.localeCompare(right.name)
    );

  return {
    generatedAt: now.getTime(),
    totals: {
      organizations: normalizeNumber(organizationsCountRows[0]?.total),
      users: normalizeNumber(usersCountRows[0]?.total),
      newOrganizationsThisMonth: normalizeNumber(
        newOrganizationsRows[0]?.total
      ),
      newUsersThisMonth: normalizeNumber(newUsersRows[0]?.total),
    },
    today: {
      revenue: normalizeNumber(todayMetrics?.revenue),
      salesCount: normalizeNumber(todayMetrics?.salesCount),
      avgTicket: normalizeNumber(todayMetrics?.avgTicket),
      activeOrganizations: normalizeNumber(todayMetrics?.activeOrganizations),
    },
    month: {
      revenue: normalizeNumber(currentMonthRows[0]?.revenue),
      salesCount: normalizeNumber(currentMonthRows[0]?.salesCount),
      previousRevenue: normalizeNumber(previousMonthRows[0]?.revenue),
      previousSalesCount: normalizeNumber(previousMonthRows[0]?.salesCount),
    },
    salesTrend: buildPlatformSalesTrend(
      trendRows.map((row) => ({
        dateKey: row.dateKey,
        revenue: normalizeNumber(row.revenue),
        salesCount: normalizeNumber(row.salesCount),
        activeOrganizations: normalizeNumber(row.activeOrganizations),
      })),
      today
    ),
    organizationsDaily,
  };
}
