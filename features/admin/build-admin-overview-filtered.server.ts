import { sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  type AdminOverviewQuery,
  AdminPlatformOverviewSchema,
} from "@/features/admin/admin.schema";
import { resolveAdminDateRange } from "@/features/admin/admin-filters.shared";
import {
  normalizeAdminNumber,
  toAdminTimestamp,
} from "@/features/admin/admin-sales.shared";
import {
  getZonedDateParts,
  zonedMidnightUtc,
} from "@/features/dashboard/zoned-time.server";

export type AdminOverviewFilteredDbExecutor = Pick<Database, "execute">;

type Row = Record<string, unknown>;

function rows(value: unknown) {
  return value as Row[];
}

function buildSalesCte() {
  return sql`sale_totals as (
    select
      s.id,
      coalesce(sum(case when s.status <> 'cancelled' then coalesce(p.applied_amount, 0) else 0 end), 0) as paid_amount
    from sale s
    left join payment p on p.sale_id = s.id
    group by s.id
  )`;
}

function buildSalesWhere(query: AdminOverviewQuery, timeZone: string) {
  const range = resolveAdminDateRange(
    query.period,
    query.startDate,
    query.endDate,
    timeZone
  );
  const predicates = [sql`s.status <> 'cancelled'`];
  if (query.organizationId) {
    predicates.push(sql`s.organization_id = ${query.organizationId}`);
  }
  if (range.start) {
    predicates.push(sql`s.created_at >= ${range.start.toISOString()}`);
  }
  if (range.endExclusive) {
    predicates.push(sql`s.created_at < ${range.endExclusive.toISOString()}`);
  }
  return sql`where ${sql.join(predicates, sql` and `)}`;
}

function normalizeDateKey(value: unknown) {
  return value ? String(value) : "";
}

const OVERVIEW_RANKING_LIMIT = 20;
const OVERVIEW_DAILY_MAX_POINTS = 45;
const OVERVIEW_WEEKLY_MAX_POINTS = 30;
const OVERVIEW_MONTHLY_MAX_POINTS = 36;

type OverviewGranularity = "day" | "week" | "month";

export function resolveAdminOverviewGranularity(range: {
  start: Date | null;
  endExclusive: Date | null;
}): { granularity: OverviewGranularity; maxPoints: number } {
  if (!(range.start && range.endExclusive)) {
    return { granularity: "month", maxPoints: OVERVIEW_MONTHLY_MAX_POINTS };
  }
  const days = Math.ceil(
    (range.endExclusive.getTime() - range.start.getTime()) / 86_400_000
  );
  if (days <= OVERVIEW_DAILY_MAX_POINTS) {
    return { granularity: "day", maxPoints: OVERVIEW_DAILY_MAX_POINTS };
  }
  if (days <= OVERVIEW_WEEKLY_MAX_POINTS * 7) {
    return { granularity: "week", maxPoints: OVERVIEW_WEEKLY_MAX_POINTS };
  }
  return { granularity: "month", maxPoints: OVERVIEW_MONTHLY_MAX_POINTS };
}

function buildTrendBucket(granularity: OverviewGranularity, timeZone: string) {
  const localCreatedAt = sql`s.created_at at time zone ${timeZone}`;
  if (granularity === "day") {
    return {
      expression: sql`date_trunc('day', ${localCreatedAt})`,
      format: "YYYY-MM-DD",
    };
  }
  if (granularity === "week") {
    return {
      expression: sql`date_trunc('week', ${localCreatedAt})`,
      format: "YYYY-MM-DD",
    };
  }
  return {
    expression: sql`date_trunc('month', ${localCreatedAt})`,
    format: "YYYY-MM",
  };
}

export async function runBuildAdminOverviewFiltered(
  db: AdminOverviewFilteredDbExecutor,
  query: AdminOverviewQuery,
  timeZone: string
) {
  const range = resolveAdminDateRange(
    query.period,
    query.startDate,
    query.endDate,
    timeZone
  );
  const ctes = buildSalesCte();
  const where = buildSalesWhere(query, timeZone);
  const trendConfig = resolveAdminOverviewGranularity(range);
  const trendBucket = buildTrendBucket(trendConfig.granularity, timeZone);
  const today = getZonedDateParts(new Date(), timeZone);
  const monthStart = zonedMidnightUtc({ ...today, day: 1 }, timeZone);

  const [metricsResult, trendResult, organizationsResult, totalsResult] =
    await Promise.all([
      db.execute(sql`
        with ${ctes}
        select
          count(*) as sales_count,
          coalesce(sum(s.total_amount - s.pass_through_total_amount), 0) as sale_amount,
          coalesce(sum(st.paid_amount), 0) as paid_amount,
          coalesce(sum(greatest(s.total_amount - st.paid_amount, 0)), 0) as pending_amount,
          coalesce(avg(st.paid_amount), 0) as average_paid,
          count(distinct s.organization_id) as active_organizations
        from sale s
        inner join sale_totals st on st.id = s.id
        ${where}
      `),
      db.execute(sql`
        with ${ctes}, trend_sales as (
          select
            s.organization_id,
            st.paid_amount,
            ${trendBucket.expression} as bucket_start
          from sale s
          inner join sale_totals st on st.id = s.id
          ${where}
        )
        select
          to_char(bucket_start, ${trendBucket.format}) as date_key,
          count(*) as sales_count,
          coalesce(sum(paid_amount), 0) as paid_amount,
          count(distinct organization_id) as active_organizations
        from trend_sales
        group by bucket_start
        order by bucket_start desc
        limit ${trendConfig.maxPoints + 1}
      `),
      db.execute(sql`
        with ${ctes}
        select
          o.id,
          o.name,
          o.slug,
          coalesce(count(s.id), 0) as sales_count,
          coalesce(sum(st.paid_amount), 0) as paid_amount,
          max(s.created_at) as last_sale_at
        from organization o
        left join sale s on s.organization_id = o.id and s.status <> 'cancelled'
        left join sale_totals st on st.id = s.id
          ${range.start ? sql`and s.created_at >= ${range.start.toISOString()}` : sql``}
          ${range.endExclusive ? sql`and s.created_at < ${range.endExclusive.toISOString()}` : sql``}
          ${query.organizationId ? sql`and s.organization_id = ${query.organizationId}` : sql``}
        ${query.organizationId ? sql`where o.id = ${query.organizationId}` : sql``}
        group by o.id, o.name, o.slug
        order by paid_amount desc, o.name asc, o.id asc
        limit ${OVERVIEW_RANKING_LIMIT}
      `),
      Promise.all([
        query.organizationId
          ? db.execute(
              sql`select count(*) as total from organization where id = ${query.organizationId}`
            )
          : db.execute(sql`select count(*) as total from organization`),
        query.organizationId
          ? db.execute(
              sql`select count(distinct user_id) as total from member where organization_id = ${query.organizationId}`
            )
          : db.execute(sql`select count(*) as total from "user"`),
        query.organizationId
          ? db.execute(
              sql`select count(*) as total from organization where id = ${query.organizationId} and created_at >= ${monthStart.toISOString()}`
            )
          : db.execute(
              sql`select count(*) as total from organization where created_at >= ${monthStart.toISOString()}`
            ),
        query.organizationId
          ? db.execute(
              sql`select count(distinct m.user_id) as total from member m inner join "user" u on u.id = m.user_id where m.organization_id = ${query.organizationId} and u.created_at >= ${monthStart.toISOString()}`
            )
          : db.execute(
              sql`select count(*) as total from "user" where created_at >= ${monthStart.toISOString()}`
            ),
      ]),
    ]);

  const metric = rows(metricsResult)[0] ?? {};
  const salesCount = normalizeAdminNumber(metric.sales_count);
  const paidAmount = Math.max(0, normalizeAdminNumber(metric.paid_amount));
  const saleAmount = normalizeAdminNumber(metric.sale_amount);
  const pendingAmount = Math.max(
    0,
    normalizeAdminNumber(metric.pending_amount)
  );
  const rawTrendRows = rows(trendResult);
  const trendTruncated = rawTrendRows.length > trendConfig.maxPoints;
  const trend = rawTrendRows
    .slice(0, trendConfig.maxPoints)
    .toReversed()
    .map((row) => ({
      dateKey: normalizeDateKey(row.date_key),
      revenue: Math.max(0, normalizeAdminNumber(row.paid_amount)),
      salesCount: normalizeAdminNumber(row.sales_count),
      activeOrganizations: normalizeAdminNumber(row.active_organizations),
    }));
  const organizationsDaily = rows(organizationsResult).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    revenueToday: Math.max(0, normalizeAdminNumber(row.paid_amount)),
    salesCountToday: normalizeAdminNumber(row.sales_count),
    lastSaleAt: toAdminTimestamp(row.last_sale_at),
  }));
  const [organizationTotal, userTotal, newOrganizationTotal, newUserTotal] =
    totalsResult;
  const totalOrganizations = normalizeAdminNumber(
    rows(organizationTotal)[0]?.total
  );

  return AdminPlatformOverviewSchema.parse({
    generatedAt: Date.now(),
    totals: {
      organizations: totalOrganizations,
      users: normalizeAdminNumber(rows(userTotal)[0]?.total),
      newOrganizationsThisMonth: normalizeAdminNumber(
        rows(newOrganizationTotal)[0]?.total
      ),
      newUsersThisMonth: normalizeAdminNumber(rows(newUserTotal)[0]?.total),
    },
    today: {
      revenue: paidAmount,
      salesCount,
      avgTicket: salesCount > 0 ? paidAmount / salesCount : 0,
      activeOrganizations: normalizeAdminNumber(metric.active_organizations),
    },
    month: {
      revenue: paidAmount,
      salesCount,
      previousRevenue: 0,
      previousSalesCount: 0,
    },
    salesTrend: trend,
    trendMeta: {
      granularity: trendConfig.granularity,
      maxPoints: trendConfig.maxPoints,
      truncated: trendTruncated,
      startDateKey: trend[0]?.dateKey ?? null,
      endDateKey: trend.at(-1)?.dateKey ?? null,
    },
    rankingMeta: {
      limit: OVERVIEW_RANKING_LIMIT,
      total: totalOrganizations,
      truncated: totalOrganizations > organizationsDaily.length,
    },
    organizationsDaily,
    filters: {
      mode: query.period,
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
      organizationId: query.organizationId ?? null,
      timeZone,
    },
    periodSummary: {
      saleAmount,
      paidAmount,
      pendingAmount,
      salesCount,
      activeOrganizations: normalizeAdminNumber(metric.active_organizations),
    },
  });
}
