import { sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  type AdminOrganizationsQuery,
  AdminOrganizationsResponseV2Schema,
} from "@/features/admin/admin.schema";
import {
  getAdminPageOffset,
  resolveAdminDateRange,
} from "@/features/admin/admin-filters.shared";
import { buildAdminModuleStates } from "@/features/admin/admin-modules.server";
import {
  normalizeAdminNumber,
  toAdminTimestamp,
} from "@/features/admin/admin-sales.shared";
import { MODULE_KEYS, type ModuleKey } from "@/features/modules/module-keys";
import { getModuleDefinition } from "@/features/modules/module-registry";

export type AdminOrganizationsListDbExecutor = Pick<Database, "execute">;

type Row = Record<string, unknown>;

function rows(value: unknown) {
  return value as Row[];
}

function conditions(
  range: { endExclusive: Date | null; start: Date | null },
  organizationId?: string
) {
  const result = [sql`s.status <> 'cancelled'`];
  if (range.start) {
    result.push(sql`s.created_at >= ${range.start.toISOString()}`);
  }
  if (range.endExclusive) {
    result.push(sql`s.created_at < ${range.endExclusive.toISOString()}`);
  }
  if (organizationId) {
    result.push(sql`s.organization_id = ${organizationId}`);
  }
  return result;
}

function buildSalesCte(query: AdminOrganizationsQuery, timeZone: string) {
  const periodRange = resolveAdminDateRange(
    query.period,
    query.startDate,
    query.endDate,
    timeZone
  );
  const thirtyDayRange = resolveAdminDateRange("30d", null, null, timeZone);
  const period = sql.join(conditions(periodRange), sql` and `);
  const thirtyDay = sql.join(conditions(thirtyDayRange), sql` and `);
  const historical = sql.join(
    conditions({ start: null, endExclusive: null }),
    sql` and `
  );
  return sql`sales_metrics as (
    select
      s.organization_id,
      coalesce(sum(case when ${period} then coalesce(p.applied_amount, 0) else 0 end), 0) as period_paid,
      coalesce(sum(case when ${thirtyDay} then coalesce(p.applied_amount, 0) else 0 end), 0) as paid_30d,
      coalesce(sum(case when ${historical} then coalesce(p.applied_amount, 0) else 0 end), 0) as historical_paid,
      count(distinct case when ${period} then s.id end) as period_sales_count,
      count(distinct case when ${historical} then s.id end) as historical_sales_count,
      count(distinct case when ${thirtyDay} then s.id end) as sales_count_30d,
      max(case when ${period} then s.created_at end) as period_last_sale_at
    from sale s
    left join payment p on p.sale_id = s.id
    group by s.organization_id
  ), organization_members as (
    select organization_id, count(*) as members_count
    from member
    group by organization_id
  )`;
}

function buildWhere(query: AdminOrganizationsQuery) {
  const predicates = [] as ReturnType<typeof sql>[];
  if (query.search) {
    const pattern = `%${query.search}%`;
    predicates.push(sql`(o.name ilike ${pattern} or o.slug ilike ${pattern})`);
  }
  if (query.hasSales === true) {
    predicates.push(sql`coalesce(sm.period_sales_count, 0) > 0`);
  }
  if (query.hasSales === false) {
    predicates.push(sql`coalesce(sm.period_sales_count, 0) = 0`);
  }
  if (query.paidMin !== null && query.paidMin !== undefined) {
    predicates.push(sql`coalesce(sm.period_paid, 0) >= ${query.paidMin}`);
  }
  if (query.paidMax !== null && query.paidMax !== undefined) {
    predicates.push(sql`coalesce(sm.period_paid, 0) <= ${query.paidMax}`);
  }
  if (query.moduleStatus) {
    const moduleKeys: readonly ModuleKey[] = query.moduleKey
      ? [query.moduleKey]
      : MODULE_KEYS;
    const effectiveStatusPredicates = moduleKeys.map((moduleKey) => {
      const defaultStatus =
        getModuleDefinition(moduleKey).defaultEntitlementStatus;
      return sql`coalesce((
        select module_entitlement.status
        from organization_module_entitlement module_entitlement
        where module_entitlement.organization_id = o.id
          and module_entitlement.module_key = ${moduleKey}
        limit 1
      ), ${defaultStatus}) = ${query.moduleStatus}`;
    });
    predicates.push(sql`(${sql.join(effectiveStatusPredicates, sql` or `)})`);
  }
  return predicates.length
    ? sql`where ${sql.join(predicates, sql` and `)}`
    : sql``;
}

function buildOrder(query: AdminOrganizationsQuery) {
  const expressions = {
    createdAt: sql`o.created_at`,
    lastSaleAt: sql`sm.period_last_sale_at`,
    membersCount: sql`coalesce(om.members_count, 0)`,
    name: sql`lower(o.name)`,
    paidAmount: sql`coalesce(sm.period_paid, 0)`,
    paidAmount30d: sql`coalesce(sm.paid_30d, 0)`,
    historicalPaidAmount: sql`coalesce(sm.historical_paid, 0)`,
  } as const;
  const direction = sql.raw(query.sortDirection);
  return sql`${expressions[query.sortBy]} ${direction} nulls last, o.id ${direction}`;
}

export async function runBuildAdminOrganizationsList(
  db: AdminOrganizationsListDbExecutor,
  query: AdminOrganizationsQuery,
  timeZone: string
) {
  const ctes = buildSalesCte(query, timeZone);
  const where = buildWhere(query);
  const order = buildOrder(query);
  const offset = getAdminPageOffset(query.page, query.pageSize);
  const [listResult, countResult, summaryResult, entitlementResult] =
    await Promise.all([
      db.execute(sql`
        with ${ctes}
        select
          o.id,
          o.name,
          o.slug,
          o.logo,
          o.created_at,
          o.metadata,
          coalesce(om.members_count, 0) as members_count,
          coalesce(sm.period_paid, 0) as period_paid,
          coalesce(sm.period_sales_count, 0) as period_sales_count,
          coalesce(sm.paid_30d, 0) as paid_30d,
          coalesce(sm.historical_paid, 0) as historical_paid,
          coalesce(sm.historical_sales_count, 0) as historical_sales_count,
          sm.period_last_sale_at
        from organization o
        left join sales_metrics sm on sm.organization_id = o.id
        left join organization_members om on om.organization_id = o.id
        ${where}
        order by ${order}
        limit ${query.pageSize} offset ${offset}
      `),
      db.execute(sql`
        with ${ctes}
        select count(*) as total
        from organization o
        left join sales_metrics sm on sm.organization_id = o.id
        left join organization_members om on om.organization_id = o.id
        ${where}
      `),
      db.execute(sql`
        with ${ctes}
        select
          count(*) as total_organizations,
          count(*) filter (where coalesce(sm.period_sales_count, 0) > 0) as active_organizations,
          coalesce(sum(sm.period_paid), 0) as paid_amount,
          coalesce(sum(om.members_count), 0) as members_count
        from organization o
        left join sales_metrics sm on sm.organization_id = o.id
        left join organization_members om on om.organization_id = o.id
        ${where}
      `),
      db.execute(sql`
        select organization_id, module_key, status
        from organization_module_entitlement
      `),
    ]);

  const entitlements = new Map<
    string,
    Array<{ moduleKey: string; status: string | null }>
  >();
  for (const row of rows(entitlementResult)) {
    const list = entitlements.get(String(row.organization_id)) ?? [];
    list.push({
      moduleKey: String(row.module_key),
      status: row.status ? String(row.status) : null,
    });
    entitlements.set(String(row.organization_id), list);
  }

  const organizations = rows(listResult).map((row) => {
    const paidAmount = normalizeAdminNumber(row.period_paid);
    const historicalPaidAmount = normalizeAdminNumber(row.historical_paid);
    const salesCount = normalizeAdminNumber(row.period_sales_count);
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      slug: String(row.slug ?? ""),
      logo: row.logo ? String(row.logo) : null,
      createdAt: toAdminTimestamp(row.created_at) ?? 0,
      membersCount: normalizeAdminNumber(row.members_count),
      revenueToday: paidAmount,
      salesCountToday: salesCount,
      revenue30d: normalizeAdminNumber(row.paid_30d),
      salesCount30d: normalizeAdminNumber(row.sales_count_30d),
      lastSaleAt: toAdminTimestamp(row.period_last_sale_at),
      paidAmount,
      historicalPaidAmount,
      historicalSalesCount: normalizeAdminNumber(row.historical_sales_count),
      modules: buildAdminModuleStates(
        row.metadata ? String(row.metadata) : null,
        entitlements.get(String(row.id)) ?? []
      ),
    };
  });
  const total = normalizeAdminNumber(rows(countResult)[0]?.total);
  const summary = rows(summaryResult)[0] ?? {};

  return AdminOrganizationsResponseV2Schema.parse({
    generatedAt: Date.now(),
    organizations,
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasNext: offset + organizations.length < total,
    summary: {
      totalOrganizations: normalizeAdminNumber(summary.total_organizations),
      activeOrganizations: normalizeAdminNumber(summary.active_organizations),
      paidAmount: normalizeAdminNumber(summary.paid_amount),
      membersCount: normalizeAdminNumber(summary.members_count),
    },
    filterOptions: {
      modules: buildAdminModuleStates(null, []).map((module) => ({
        key: module.key,
        label: module.label,
      })),
    },
  });
}
