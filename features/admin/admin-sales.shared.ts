import { type SQL, sql } from "drizzle-orm";
import type { AdminSalesQuery } from "@/features/admin/admin.schema";
import type { AdminDateRange } from "@/features/admin/admin-filters.shared";

export function normalizeAdminNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toAdminTimestamp(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function buildAdminPaidAmountExpression(
  saleAlias = "s",
  paymentAlias = "p"
) {
  return sql`coalesce(sum(case when ${sql.raw(`${saleAlias}.status`)} <> 'cancelled' then coalesce(${sql.raw(`${paymentAlias}.applied_amount`)}, 0) else 0 end), 0)`;
}

export function buildAdminPeriodPredicate(
  createdAtColumn: SQL,
  range: AdminDateRange
): SQL[] {
  const predicates: SQL[] = [];
  if (range.start) {
    predicates.push(sql`${createdAtColumn} >= ${range.start.toISOString()}`);
  }
  if (range.endExclusive) {
    predicates.push(
      sql`${createdAtColumn} < ${range.endExclusive.toISOString()}`
    );
  }
  return predicates;
}

export function buildAdminSalesPredicates(
  query: AdminSalesQuery,
  range: AdminDateRange,
  options: {
    paidColumn: SQL;
    saleAlias?: string;
  }
): SQL[] {
  const saleAlias = options.saleAlias ?? "s";
  const saleColumn = (name: string) => sql.raw(`${saleAlias}.${name}`);
  const predicates = buildAdminPeriodPredicate(saleColumn("created_at"), range);

  if (query.organizationId) {
    predicates.push(
      sql`${saleColumn("organization_id")} = ${query.organizationId}`
    );
  }
  if (query.sellerId) {
    predicates.push(sql`${saleColumn("user_id")} = ${query.sellerId}`);
  }
  if (query.status) {
    predicates.push(sql`${saleColumn("status")} = ${query.status}`);
  }
  if (query.totalMin !== null && query.totalMin !== undefined) {
    predicates.push(sql`${saleColumn("total_amount")} >= ${query.totalMin}`);
  }
  if (query.totalMax !== null && query.totalMax !== undefined) {
    predicates.push(sql`${saleColumn("total_amount")} <= ${query.totalMax}`);
  }
  if (query.paidMin !== null && query.paidMin !== undefined) {
    predicates.push(sql`${options.paidColumn} >= ${query.paidMin}`);
  }
  if (query.paidMax !== null && query.paidMax !== undefined) {
    predicates.push(sql`${options.paidColumn} <= ${query.paidMax}`);
  }
  if (query.balanceStatus === "with_balance") {
    predicates.push(
      sql`${saleColumn("status")} <> 'cancelled' and greatest(${saleColumn("total_amount")} - ${options.paidColumn}, 0) > 0`
    );
  }
  if (query.balanceStatus === "settled") {
    predicates.push(
      sql`(${saleColumn("status")} = 'cancelled' or greatest(${saleColumn("total_amount")} - ${options.paidColumn}, 0) = 0)`
    );
  }
  if (query.paymentMethod) {
    predicates.push(sql`exists (
      select 1 from payment pm
      where pm.sale_id = ${saleColumn("id")}
        and pm.method = ${query.paymentMethod}
    )`);
  }
  if (query.terminalName) {
    predicates.push(
      sql`${sql.raw("sh.terminal_name")} = ${query.terminalName}`
    );
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    predicates.push(sql`(
      ${saleColumn("id")} ilike ${pattern}
      or ${sql.raw("o.name")} ilike ${pattern}
      or ${sql.raw("u.name")} ilike ${pattern}
      or ${sql.raw("sh.terminal_name")} ilike ${pattern}
    )`);
  }

  return predicates;
}

export function getAdminSortDirection(direction: "asc" | "desc") {
  return sql.raw(direction === "asc" ? "asc" : "desc");
}
