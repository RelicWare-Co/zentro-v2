import { and, asc, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import {
  member,
  organization,
  user,
} from "@/database/drizzle/schema/auth.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { organizationModuleEntitlement } from "@/database/drizzle/schema/feature.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import type {
  AdminOrganizationDetailSchema,
  AdminOrganizationsResponseSchema,
} from "@/features/admin/admin.schema";
import {
  formatZonedDateKey,
  getZonedDateParts,
  isSafeTimeZone,
  shiftZonedDateParts,
  type ZonedDateParts,
  zonedMidnightUtc,
} from "@/features/dashboard/zoned-time.server";
import { buildAdminModuleStates } from "./admin-modules.server";

export type AdminOrganizationsDbExecutor = Pick<Database, "select">;

type AdminOrganizationsResponse = z.infer<
  typeof AdminOrganizationsResponseSchema
>;
type AdminOrganizationDetail = z.infer<typeof AdminOrganizationDetailSchema>;

const LAST_30_DAYS = 30;
const DETAIL_TREND_DAYS = 7;
const RECENT_SALES_LIMIT = 8;

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
  const dateValue = value instanceof Date ? value : new Date(value);
  const timestamp = dateValue.getTime();
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

function toTimestampOrNull(value: Date | number | string | null | undefined) {
  if (!value) {
    return null;
  }
  const dateValue = value instanceof Date ? value : new Date(value);
  const timestamp = dateValue.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

interface ZonedWindows {
  last30Start: Date;
  today: ZonedDateParts;
  todayStart: Date;
  tomorrowStart: Date;
  trendStart: Date;
}

function buildZonedWindows(timeZone: string): ZonedWindows {
  const today = getZonedDateParts(new Date(), timeZone);
  return {
    today,
    todayStart: zonedMidnightUtc(today, timeZone),
    tomorrowStart: zonedMidnightUtc(
      shiftZonedDateParts(today, { days: 1 }),
      timeZone
    ),
    last30Start: zonedMidnightUtc(
      shiftZonedDateParts(today, { days: -(LAST_30_DAYS - 1) }),
      timeZone
    ),
    trendStart: zonedMidnightUtc(
      shiftZonedDateParts(today, { days: -(DETAIL_TREND_DAYS - 1) }),
      timeZone
    ),
  };
}

export async function runBuildAdminOrganizations(
  db: AdminOrganizationsDbExecutor,
  timeZone: string
): Promise<AdminOrganizationsResponse> {
  if (!isSafeTimeZone(timeZone)) {
    throw new Error(`Invalid admin organizations time zone: ${timeZone}`);
  }

  const windows = buildZonedWindows(timeZone);
  const notCancelled = ne(sale.status, "cancelled");

  const [
    organizationRows,
    membersCountRows,
    todayRows,
    last30Rows,
    lastSaleRows,
    entitlementRows,
  ] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        metadata: organization.metadata,
      })
      .from(organization)
      .orderBy(asc(organization.name)),
    db
      .select({
        organizationId: member.organizationId,
        total: sql<number>`count(*)`,
      })
      .from(member)
      .groupBy(member.organizationId),
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
          gte(sale.createdAt, windows.todayStart),
          lt(sale.createdAt, windows.tomorrowStart)
        )
      )
      .groupBy(sale.organizationId),
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
          gte(sale.createdAt, windows.last30Start),
          lt(sale.createdAt, windows.tomorrowStart)
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
    db
      .select({
        organizationId: organizationModuleEntitlement.organizationId,
        moduleKey: organizationModuleEntitlement.moduleKey,
        status: organizationModuleEntitlement.status,
      })
      .from(organizationModuleEntitlement),
  ]);

  const membersByOrganization = new Map(
    membersCountRows.map((row) => [row.organizationId, row.total])
  );
  const todayByOrganization = new Map(
    todayRows.map((row) => [row.organizationId, row])
  );
  const last30ByOrganization = new Map(
    last30Rows.map((row) => [row.organizationId, row])
  );
  const lastSaleByOrganization = new Map(
    lastSaleRows.map((row) => [
      row.organizationId,
      toTimestampOrNull(row.lastSaleAt),
    ])
  );
  const entitlementsByOrganization = new Map<
    string,
    Array<{ moduleKey: string; status: string | null }>
  >();
  for (const row of entitlementRows) {
    const existing = entitlementsByOrganization.get(row.organizationId) ?? [];
    existing.push({ moduleKey: row.moduleKey, status: row.status });
    entitlementsByOrganization.set(row.organizationId, existing);
  }

  return {
    generatedAt: Date.now(),
    organizations: organizationRows.map((org) => {
      const todayRow = todayByOrganization.get(org.id);
      const last30Row = last30ByOrganization.get(org.id);

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo ?? null,
        createdAt: toTimestamp(org.createdAt),
        membersCount: normalizeNumber(membersByOrganization.get(org.id)),
        revenueToday: normalizeNumber(todayRow?.revenue),
        salesCountToday: normalizeNumber(todayRow?.salesCount),
        revenue30d: normalizeNumber(last30Row?.revenue),
        salesCount30d: normalizeNumber(last30Row?.salesCount),
        lastSaleAt: lastSaleByOrganization.get(org.id) ?? null,
        modules: buildAdminModuleStates(
          org.metadata,
          entitlementsByOrganization.get(org.id) ?? []
        ),
      };
    }),
  };
}

export async function runBuildAdminOrganizationDetail(
  db: AdminOrganizationsDbExecutor,
  organizationId: string,
  timeZone: string
): Promise<AdminOrganizationDetail | null> {
  if (!isSafeTimeZone(timeZone)) {
    throw new Error(`Invalid admin organization time zone: ${timeZone}`);
  }

  const windows = buildZonedWindows(timeZone);
  const saleClauses = [
    eq(sale.organizationId, organizationId),
    ne(sale.status, "cancelled"),
  ];
  // isSafeTimeZone guarantees the value has no quotes, so inlining it as a
  // literal is safe. A bind param would not match the GROUP BY expression.
  const saleDateKey = sql<string>`to_char(${sale.createdAt} at time zone ${sql.raw(`'${timeZone}'`)}, 'YYYY-MM-DD')`;

  const [organizationRows] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        metadata: organization.metadata,
      })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
  ]);
  const organizationRow = organizationRows[0];
  if (!organizationRow) {
    return null;
  }

  const [
    memberRows,
    todayMetricsRows,
    last30MetricsRows,
    totalMetricsRows,
    customersCountRows,
    productsCountRows,
    trendRows,
    recentSalesRows,
    entitlementRows,
  ] = await Promise.all([
    db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        name: user.name,
        email: user.email,
        banned: user.banned,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt)),
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
      })
      .from(sale)
      .where(
        and(
          ...saleClauses,
          gte(sale.createdAt, windows.todayStart),
          lt(sale.createdAt, windows.tomorrowStart)
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
          ...saleClauses,
          gte(sale.createdAt, windows.last30Start),
          lt(sale.createdAt, windows.tomorrowStart)
        )
      ),
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
        lastSaleAt: sql<Date | null>`max(${sale.createdAt})`,
      })
      .from(sale)
      .where(and(...saleClauses)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(customer)
      .where(
        and(
          eq(customer.organizationId, organizationId),
          isNull(customer.deletedAt)
        )
      ),
    db
      .select({ total: sql<number>`count(*)` })
      .from(product)
      .where(
        and(
          eq(product.organizationId, organizationId),
          isNull(product.deletedAt),
          eq(product.isModifier, false)
        )
      ),
    db
      .select({
        dateKey: saleDateKey,
        revenue: sql<number>`coalesce(sum(${sale.totalAmount}), 0)`,
        salesCount: sql<number>`count(*)`,
      })
      .from(sale)
      .where(
        and(
          ...saleClauses,
          gte(sale.createdAt, windows.trendStart),
          lt(sale.createdAt, windows.tomorrowStart)
        )
      )
      .groupBy(saleDateKey)
      .orderBy(asc(saleDateKey)),
    db
      .select({
        id: sale.id,
        totalAmount: sale.totalAmount,
        status: sale.status,
        createdAt: sale.createdAt,
        sellerName: user.name,
      })
      .from(sale)
      .leftJoin(user, eq(user.id, sale.userId))
      .where(and(...saleClauses))
      .orderBy(desc(sale.createdAt))
      .limit(RECENT_SALES_LIMIT),
    db
      .select({
        moduleKey: organizationModuleEntitlement.moduleKey,
        status: organizationModuleEntitlement.status,
      })
      .from(organizationModuleEntitlement)
      .where(eq(organizationModuleEntitlement.organizationId, organizationId)),
  ]);

  const totalMetrics = totalMetricsRows[0];
  const trendByDate = new Map(trendRows.map((row) => [row.dateKey, row]));
  const salesTrend = Array.from({ length: DETAIL_TREND_DAYS }, (_, index) => {
    const dateKey = formatZonedDateKey(
      shiftZonedDateParts(windows.today, {
        days: index - (DETAIL_TREND_DAYS - 1),
      })
    );
    const point = trendByDate.get(dateKey);
    return {
      dateKey,
      revenue: normalizeNumber(point?.revenue),
      salesCount: normalizeNumber(point?.salesCount),
    };
  });

  return {
    generatedAt: Date.now(),
    organization: {
      id: organizationRow.id,
      name: organizationRow.name,
      slug: organizationRow.slug,
      logo: organizationRow.logo ?? null,
      createdAt: toTimestamp(organizationRow.createdAt),
    },
    metrics: {
      revenueToday: normalizeNumber(todayMetricsRows[0]?.revenue),
      salesCountToday: normalizeNumber(todayMetricsRows[0]?.salesCount),
      revenue30d: normalizeNumber(last30MetricsRows[0]?.revenue),
      salesCount30d: normalizeNumber(last30MetricsRows[0]?.salesCount),
      totalRevenue: normalizeNumber(totalMetrics?.revenue),
      totalSalesCount: normalizeNumber(totalMetrics?.salesCount),
      membersCount: memberRows.length,
      customersCount: normalizeNumber(customersCountRows[0]?.total),
      productsCount: normalizeNumber(productsCountRows[0]?.total),
      lastSaleAt: toTimestampOrNull(totalMetrics?.lastSaleAt),
    },
    members: memberRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      banned: row.banned === true,
      createdAt: toTimestamp(row.createdAt),
    })),
    modules: buildAdminModuleStates(organizationRow.metadata, entitlementRows),
    salesTrend,
    recentSales: recentSalesRows.map((row) => ({
      id: row.id,
      totalAmount: normalizeNumber(row.totalAmount),
      status: row.status,
      sellerName: row.sellerName ?? null,
      createdAt: toTimestamp(row.createdAt),
    })),
  };
}
