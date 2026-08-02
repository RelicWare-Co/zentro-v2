import { type SQL, sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  type AdminUserListItem,
  type AdminUsersQuery,
  AdminUsersResponseSchema,
} from "@/features/admin/admin.schema";
import {
  getAdminPageOffset,
  resolveAdminDateRange,
} from "@/features/admin/admin-filters.shared";
import {
  normalizeAdminNumber,
  toAdminTimestamp,
} from "@/features/admin/admin-sales.shared";

export type AdminUsersDbExecutor = Pick<Database, "execute">;

function asRows(value: unknown) {
  return value as Record<string, unknown>[];
}

function buildRangeConditions(
  range: { endExclusive: Date | null; start: Date | null },
  organizationId: string | null | undefined
) {
  const conditions: SQL[] = [sql`s.status <> 'cancelled'`];
  if (range.start) {
    conditions.push(sql`s.created_at >= ${range.start.toISOString()}`);
  }
  if (range.endExclusive) {
    conditions.push(sql`s.created_at < ${range.endExclusive.toISOString()}`);
  }
  if (organizationId) {
    conditions.push(sql`s.organization_id = ${organizationId}`);
  }
  return conditions;
}

function buildUserSalesCte(query: AdminUsersQuery, timeZone: string) {
  const periodRange = resolveAdminDateRange(
    query.period,
    query.startDate,
    query.endDate,
    timeZone
  );
  const thirtyDayRange = resolveAdminDateRange("30d", null, null, timeZone);
  const periodClause = sql.join(
    buildRangeConditions(periodRange, query.organizationId),
    sql` and `
  );
  const thirtyDayClause = sql.join(
    buildRangeConditions(thirtyDayRange, query.organizationId),
    sql` and `
  );
  const historyClause = sql.join(
    buildRangeConditions(
      { start: null, endExclusive: null },
      query.organizationId
    ),
    sql` and `
  );

  return sql`user_sales as (
    select
      s.user_id,
      coalesce(sum(case when ${periodClause} then coalesce(p.applied_amount, 0) else 0 end), 0) as period_paid,
      coalesce(sum(case when ${thirtyDayClause} then coalesce(p.applied_amount, 0) else 0 end), 0) as paid_30d,
      count(distinct case when ${periodClause} then s.id end) as period_sales_count,
      max(case when ${periodClause} then s.created_at end) as period_last_sale_at,
      coalesce(sum(case when ${historyClause} then coalesce(p.applied_amount, 0) else 0 end), 0) as historical_paid
    from sale s
    left join payment p on p.sale_id = s.id
    group by s.user_id
  )`;
}

function buildUserOrganizationsCte() {
  return sql`user_organizations as (
    select
      m.user_id,
      coalesce(
        json_agg(
          json_build_object('id', o.id, 'name', o.name, 'role', m.role)
          order by o.name asc, o.id asc
        ),
        '[]'::json
      ) as organizations
    from member m
    inner join organization o on o.id = m.organization_id
    group by m.user_id
  )`;
}

function buildUserWhere(query: AdminUsersQuery) {
  const where: SQL[] = [];
  const textColumn = query.searchField === "name" ? "u.name" : "u.email";
  if (query.search) {
    where.push(sql`${sql.raw(textColumn)} ilike ${`%${query.search}%`}`);
  }
  if (query.organizationId) {
    where.push(sql`exists (
      select 1 from member filter_member
      where filter_member.user_id = u.id
        and filter_member.organization_id = ${query.organizationId}
    )`);
  }
  if (query.role === "admin") {
    where.push(sql`(',' || coalesce(u.role, '') || ',') like '%,admin,%'`);
  }
  if (query.role === "user") {
    where.push(
      sql`not ((',' || coalesce(u.role, '') || ',') like '%,admin,%')`
    );
  }
  if (query.banned !== null && query.banned !== undefined) {
    where.push(sql`coalesce(u.banned, false) = ${query.banned}`);
  }
  if (query.emailVerified !== null && query.emailVerified !== undefined) {
    where.push(sql`u.email_verified = ${query.emailVerified}`);
  }
  if (query.hasSales === true) {
    where.push(sql`coalesce(us.period_sales_count, 0) > 0`);
  }
  if (query.hasSales === false) {
    where.push(sql`coalesce(us.period_sales_count, 0) = 0`);
  }
  if (query.paidMin !== null && query.paidMin !== undefined) {
    where.push(sql`coalesce(us.period_paid, 0) >= ${query.paidMin}`);
  }
  if (query.paidMax !== null && query.paidMax !== undefined) {
    where.push(sql`coalesce(us.period_paid, 0) <= ${query.paidMax}`);
  }
  return where;
}

function buildUserOrder(query: AdminUsersQuery) {
  const expressions = {
    createdAt: sql`u.created_at`,
    lastSaleAt: sql`us.period_last_sale_at`,
    name: sql`lower(u.name)`,
    paidAmount: sql`coalesce(us.period_paid, 0)`,
    paidAmount30d: sql`coalesce(us.paid_30d, 0)`,
    historicalPaidAmount: sql`coalesce(us.historical_paid, 0)`,
  } as const;
  const expression = expressions[query.sortBy];
  const direction = sql.raw(query.sortDirection);
  return sql`${expression} ${direction} nulls last, u.id ${direction}`;
}

function buildUsersCtes(query: AdminUsersQuery, timeZone: string) {
  return sql`${buildUserSalesCte(query, timeZone)}, ${buildUserOrganizationsCte()}`;
}

export async function runBuildAdminUsers(
  db: AdminUsersDbExecutor,
  query: AdminUsersQuery,
  timeZone: string
) {
  const ctes = buildUsersCtes(query, timeZone);
  const where = buildUserWhere(query);
  const whereSql = where.length
    ? sql`where ${sql.join(where, sql` and `)}`
    : sql``;
  const orderBy = buildUserOrder(query);
  const offset = getAdminPageOffset(query.page, query.pageSize);

  const [rowsResult, countResult, summaryResult] = await Promise.all([
    db.execute(sql`
        with ${ctes}
        select
          u.id,
          u.name,
          u.email,
          u.email_verified,
          u.image,
          u.created_at,
          u.updated_at,
          u.role,
          coalesce(u.banned, false) as banned,
          u.ban_reason,
          u.ban_expires,
          coalesce(us.period_paid, 0) as paid_amount,
          coalesce(us.paid_30d, 0) as paid_amount_30d,
          coalesce(us.historical_paid, 0) as historical_paid_amount,
          coalesce(us.period_sales_count, 0) as sales_count,
          us.period_last_sale_at as last_sale_at,
          coalesce(uo.organizations, '[]'::json) as organizations
        from "user" u
        left join user_sales us on us.user_id = u.id
        left join user_organizations uo on uo.user_id = u.id
        ${whereSql}
        order by ${orderBy}
        limit ${query.pageSize} offset ${offset}
      `),
    db.execute(sql`
        with ${ctes}
        select count(*) as total
        from "user" u
        left join user_sales us on us.user_id = u.id
        ${whereSql}
      `),
    db.execute(sql`
        with ${ctes}
        select
          count(*) as total,
          count(*) filter (where (',' || coalesce(u.role, '') || ',') like '%,admin,%') as admins,
          count(*) filter (where coalesce(u.banned, false)) as banned
        from "user" u
        left join user_sales us on us.user_id = u.id
        ${whereSql}
      `),
  ]);

  const total = normalizeAdminNumber(asRows(countResult)[0]?.total);
  const rows = asRows(rowsResult).map((row) => {
    const user: AdminUserListItem = {
      id: String(row.id),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
      emailVerified: row.email_verified === true,
      image: row.image ? String(row.image) : null,
      createdAt: toAdminTimestamp(row.created_at) ?? 0,
      updatedAt: toAdminTimestamp(row.updated_at) ?? 0,
      role: row.role ? String(row.role) : null,
      banned: row.banned === true,
      banReason: row.ban_reason ? String(row.ban_reason) : null,
      banExpires: toAdminTimestamp(row.ban_expires),
      metrics: {
        paidAmount: normalizeAdminNumber(row.paid_amount),
        paidAmount30d: normalizeAdminNumber(row.paid_amount_30d),
        historicalPaidAmount: normalizeAdminNumber(row.historical_paid_amount),
        salesCount: normalizeAdminNumber(row.sales_count),
        lastSaleAt: toAdminTimestamp(row.last_sale_at),
      },
      organizations: Array.isArray(row.organizations)
        ? (row.organizations as AdminUserListItem["organizations"])
        : [],
    };
    return user;
  });
  const summaryRow = asRows(summaryResult)[0] ?? {};

  return AdminUsersResponseSchema.parse({
    users: rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasNext: offset + rows.length < total,
    summary: {
      total: normalizeAdminNumber(summaryRow.total),
      admins: normalizeAdminNumber(summaryRow.admins),
      banned: normalizeAdminNumber(summaryRow.banned),
    },
  });
}
