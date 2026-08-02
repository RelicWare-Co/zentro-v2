import { sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  type AdminOptionsQuery,
  AdminOptionsResponseSchema,
} from "@/features/admin/admin.schema";
import { getAdminPageOffset } from "@/features/admin/admin-filters.shared";
import { normalizeAdminNumber } from "@/features/admin/admin-sales.shared";

export type AdminOptionsDbExecutor = Pick<Database, "execute">;

type Row = Record<string, unknown>;

function rows(value: unknown) {
  return value as Row[];
}

function selectedIdsPredicate(
  column: ReturnType<typeof sql.raw>,
  ids: string[]
) {
  if (ids.length === 0) {
    return sql`false`;
  }
  return sql`${column} in (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )})`;
}

function mapOption(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name ?? row.secondary_label ?? "Sin nombre"),
    secondaryLabel: row.secondary_label ? String(row.secondary_label) : null,
  };
}

function mergeOptions(pageRows: Row[], selectedRows: Row[]) {
  const items = new Map<string, ReturnType<typeof mapOption>>();
  for (const row of [...pageRows, ...selectedRows]) {
    const option = mapOption(row);
    items.set(option.id, option);
  }
  return [...items.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "es", { sensitivity: "base" }) ||
      left.id.localeCompare(right.id)
  );
}

function buildResourceQuery(query: AdminOptionsQuery) {
  const offset = getAdminPageOffset(query.page, query.pageSize);
  const searchPattern = `%${query.search}%`;

  if (query.resource === "organizations") {
    const searchWhere = query.search
      ? sql`where o.name ilike ${searchPattern} or o.slug ilike ${searchPattern}`
      : sql``;
    return {
      count: sql`select count(*) as total from organization o ${searchWhere}`,
      page: sql`
        select o.id, o.name, o.slug as secondary_label
        from organization o
        ${searchWhere}
        order by lower(o.name) asc, o.id asc
        limit ${query.pageSize} offset ${offset}
      `,
      selected: sql`
        select o.id, o.name, o.slug as secondary_label
        from organization o
        where ${selectedIdsPredicate(sql.raw("o.id"), query.selectedIds)}
      `,
    };
  }

  const sellerWhere =
    query.resource === "sellers"
      ? sql`exists (select 1 from sale option_sale where option_sale.user_id = u.id)`
      : sql`true`;
  const searchWhere = query.search
    ? sql`and (u.name ilike ${searchPattern} or u.email ilike ${searchPattern})`
    : sql``;

  return {
    count: sql`
      select count(*) as total
      from "user" u
      where ${sellerWhere} ${searchWhere}
    `,
    page: sql`
      select u.id, coalesce(nullif(u.name, ''), u.email) as name,
        u.email as secondary_label
      from "user" u
      where ${sellerWhere} ${searchWhere}
      order by lower(coalesce(nullif(u.name, ''), u.email)) asc, u.id asc
      limit ${query.pageSize} offset ${offset}
    `,
    selected: sql`
      select u.id, coalesce(nullif(u.name, ''), u.email) as name,
        u.email as secondary_label
      from "user" u
      where ${selectedIdsPredicate(sql.raw("u.id"), query.selectedIds)}
        and ${sellerWhere}
    `,
  };
}

export async function runBuildAdminOptions(
  db: AdminOptionsDbExecutor,
  query: AdminOptionsQuery
) {
  const resourceQuery = buildResourceQuery(query);
  const [pageResult, countResult, selectedResult] = await Promise.all([
    db.execute(resourceQuery.page),
    db.execute(resourceQuery.count),
    query.selectedIds.length > 0
      ? db.execute(resourceQuery.selected)
      : Promise.resolve([]),
  ]);
  const pageRows = rows(pageResult);
  const total = normalizeAdminNumber(rows(countResult)[0]?.total);

  return AdminOptionsResponseSchema.parse({
    items: mergeOptions(pageRows, rows(selectedResult)),
    total,
    hasNext:
      getAdminPageOffset(query.page, query.pageSize) + pageRows.length < total,
  });
}
