import { sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  AdminSaleDetailSchema,
  type AdminSalesQuery,
  AdminSalesResponseSchema,
} from "@/features/admin/admin.schema";
import {
  getAdminPageOffset,
  resolveAdminDateRange,
} from "@/features/admin/admin-filters.shared";
import {
  buildAdminSalesPredicates,
  normalizeAdminNumber,
  toAdminTimestamp,
} from "@/features/admin/admin-sales.shared";
import { formatPaymentMethodIdLabel } from "@/features/settings/settings.shared";

export type AdminSalesDbExecutor = Pick<Database, "execute">;

type Row = Record<string, unknown>;

function rows(value: unknown) {
  return value as Row[];
}

function buildSalesCtes() {
  return sql`sale_totals as (
    select
      s.id,
      coalesce(sum(case when s.status <> 'cancelled' then coalesce(p.applied_amount, 0) else 0 end), 0) as paid_amount
    from sale s
    left join payment p on p.sale_id = s.id
    group by s.id
  )`;
}

function buildOrder(query: AdminSalesQuery) {
  const expressions = {
    createdAt: sql`s.created_at`,
    totalAmount: sql`s.total_amount`,
    paidAmount: sql`st.paid_amount`,
    organizationName: sql`lower(o.name)`,
    sellerName: sql`lower(u.name)`,
  } as const;
  const direction = sql.raw(query.sortDirection);
  return sql`${expressions[query.sortBy]} ${direction} nulls last, s.id ${direction}`;
}

function buildPeriod(query: AdminSalesQuery, timeZone: string) {
  return resolveAdminDateRange(
    query.period,
    query.startDate,
    query.endDate,
    timeZone
  );
}

function buildFilteredWhere(query: AdminSalesQuery, timeZone: string) {
  const range = buildPeriod(query, timeZone);
  const predicates = buildAdminSalesPredicates(query, range, {
    paidColumn: sql`st.paid_amount`,
  });
  return predicates.length
    ? sql`where ${sql.join(predicates, sql` and `)}`
    : sql``;
}

function buildSalesFrom() {
  return sql`from sale s
    inner join sale_totals st on st.id = s.id
    inner join organization o on o.id = s.organization_id
    inner join "user" u on u.id = s.user_id
    inner join shift sh on sh.id = s.shift_id`;
}

export async function runBuildAdminSales(
  db: AdminSalesDbExecutor,
  query: AdminSalesQuery,
  timeZone: string
) {
  const ctes = buildSalesCtes();
  const where = buildFilteredWhere(query, timeZone);
  const order = buildOrder(query);
  const offset = getAdminPageOffset(query.page, query.pageSize);
  const from = buildSalesFrom();

  const [salesResult, countResult, summaryResult, optionsResult] =
    await Promise.all([
      db.execute(sql`
        with ${ctes}
        select
          s.id,
          s.organization_id,
          o.name as organization_name,
          s.user_id as seller_id,
          u.name as seller_name,
          sh.terminal_name,
          s.status,
          s.total_amount,
          st.paid_amount,
          case
            when s.status = 'cancelled' then 0
            else greatest(s.total_amount - st.paid_amount, 0)
          end as balance_due,
          coalesce((
            select json_agg(distinct pm.method order by pm.method)
            from payment pm
            where pm.sale_id = s.id
          ), '[]'::json) as payment_methods,
          s.created_at
        ${from}
        ${where}
        order by ${order}
        limit ${query.pageSize} offset ${offset}
      `),
      db.execute(sql`
        with ${ctes}
        select count(*) as total
        ${from}
        ${where}
      `),
      db.execute(sql`
        with ${ctes}
        select
          count(*) as sales_count,
          coalesce(sum(case when s.status <> 'cancelled' then s.total_amount - s.pass_through_total_amount else 0 end), 0) as sale_amount,
          coalesce(sum(st.paid_amount), 0) as paid_amount,
          coalesce(sum(case when s.status <> 'cancelled' then greatest(s.total_amount - st.paid_amount, 0) else 0 end), 0) as pending_amount
        ${from}
        ${where}
      `),
      Promise.all([
        db.execute(
          sql`select distinct terminal_name from shift where terminal_name is not null order by terminal_name asc`
        ),
        db.execute(
          sql`select distinct method from payment order by method asc`
        ),
      ]),
    ]);

  const total = normalizeAdminNumber(rows(countResult)[0]?.total);
  const sales = rows(salesResult).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name ?? ""),
    sellerId: String(row.seller_id),
    sellerName: row.seller_name ? String(row.seller_name) : null,
    terminalName: row.terminal_name ? String(row.terminal_name) : null,
    status: String(row.status),
    totalAmount: normalizeAdminNumber(row.total_amount),
    paidAmount: Math.max(0, normalizeAdminNumber(row.paid_amount)),
    balanceDue: Math.max(0, normalizeAdminNumber(row.balance_due)),
    paymentMethods: Array.isArray(row.payment_methods)
      ? row.payment_methods.map(String)
      : [],
    createdAt: toAdminTimestamp(row.created_at) ?? 0,
  }));
  const summary = rows(summaryResult)[0] ?? {};
  const [terminalRows, paymentRows] = optionsResult;

  return AdminSalesResponseSchema.parse({
    sales,
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasNext: offset + sales.length < total,
    summary: {
      salesCount: normalizeAdminNumber(summary.sales_count),
      saleAmount: normalizeAdminNumber(summary.sale_amount),
      paidAmount: Math.max(0, normalizeAdminNumber(summary.paid_amount)),
      pendingAmount: Math.max(0, normalizeAdminNumber(summary.pending_amount)),
    },
    filterOptions: {
      terminals: rows(terminalRows)
        .map((row) => String(row.terminal_name))
        .filter(Boolean),
      paymentMethods: rows(paymentRows).map((row) => ({
        id: String(row.method),
        label: formatPaymentMethodIdLabel(String(row.method)),
      })),
    },
  });
}

export async function runBuildAdminSaleDetail(
  db: AdminSalesDbExecutor,
  saleId: string
) {
  const result = await db.execute(sql`
    select
      s.id,
      s.organization_id,
      o.name as organization_name,
      s.user_id as seller_id,
      u.name as seller_name,
      sh.terminal_name,
      s.status,
      s.created_at,
      s.subtotal,
      s.tax_amount,
      s.discount_amount,
      s.total_amount,
      s.pass_through_total_amount,
      coalesce(sum(case when s.status <> 'cancelled' then coalesce(p.applied_amount, 0) else 0 end), 0) as paid_amount,
      coalesce(json_agg(
        json_build_object(
          'id', p.id,
          'method', p.method,
          'amount', p.amount,
          'appliedAmount', p.applied_amount,
          'changeAmount', p.change_amount,
          'reference', p.reference,
          'createdAt', p.created_at
        ) order by p.created_at asc, p.id asc
      ) filter (where p.id is not null), '[]'::json) as payments
    from sale s
    inner join organization o on o.id = s.organization_id
    inner join "user" u on u.id = s.user_id
    inner join shift sh on sh.id = s.shift_id
    left join payment p on p.sale_id = s.id
    where s.id = ${saleId}
    group by s.id, o.name, u.name, sh.terminal_name
    limit 1
  `);
  const row = rows(result)[0];
  if (!row) {
    return null;
  }
  const paidAmount = Math.max(0, normalizeAdminNumber(row.paid_amount));
  return AdminSaleDetailSchema.parse({
    id: String(row.id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name ?? ""),
    sellerId: String(row.seller_id),
    sellerName: row.seller_name ? String(row.seller_name) : null,
    terminalName: row.terminal_name ? String(row.terminal_name) : null,
    status: String(row.status),
    createdAt: toAdminTimestamp(row.created_at) ?? 0,
    subtotal: normalizeAdminNumber(row.subtotal),
    taxAmount: normalizeAdminNumber(row.tax_amount),
    discountAmount: normalizeAdminNumber(row.discount_amount),
    totalAmount: normalizeAdminNumber(row.total_amount),
    passThroughTotalAmount: normalizeAdminNumber(row.pass_through_total_amount),
    paidAmount,
    balanceDue:
      String(row.status) === "cancelled"
        ? 0
        : Math.max(normalizeAdminNumber(row.total_amount) - paidAmount, 0),
    payments: Array.isArray(row.payments)
      ? row.payments.map((payment) => {
          const value = payment as Record<string, unknown>;
          return {
            id: String(value.id),
            method: String(value.method),
            amount: normalizeAdminNumber(value.amount),
            appliedAmount: normalizeAdminNumber(value.appliedAmount),
            changeAmount: normalizeAdminNumber(value.changeAmount),
            reference: value.reference ? String(value.reference) : null,
            createdAt: toAdminTimestamp(value.createdAt) ?? 0,
          };
        })
      : [],
  });
}
