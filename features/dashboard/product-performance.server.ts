import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import { sale, saleItem } from "@/database/drizzle/schema/sales.schema";
import type {
  DashboardAuth,
  DashboardDbExecutor,
} from "@/features/dashboard/dashboard-helpers.server";
import { normalizeNumber } from "@/features/dashboard/dashboard-helpers.server";
import type { ZonedDateParts } from "@/features/dashboard/zoned-time.server";
import { zonedMidnightUtc } from "@/features/dashboard/zoned-time.server";

export const TOP_PRODUCTS_WINDOW_DAYS = 30;

/** Matches `getEffectiveStockThreshold` + low/out alert semantics in stock-status.shared. */
export function productAtStockRiskSql(lowStockThreshold: number) {
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

export function mapTopProducts(
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

export function fetchActiveProductsCount(
  db: DashboardDbExecutor,
  auth: DashboardAuth
) {
  return db
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
    );
}

export function fetchLowStockCount(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  lowStockThreshold: number
) {
  return db
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
    );
}

export function fetchLowStockProducts(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  lowStockThreshold: number
) {
  return db
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
    .limit(6);
}

export function fetchTopProducts(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  topProductsStart: Date,
  tomorrowStart: Date
) {
  return db
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
    .limit(5);
}

export function fetchTopProductsToday(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  today: ZonedDateParts,
  timeZone: string,
  tomorrowStart: Date
) {
  return db
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
    .limit(5);
}

export function fetchTopProductsShift(
  db: DashboardDbExecutor,
  auth: DashboardAuth,
  shiftIds: string[]
) {
  return shiftIds.length > 0
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
            inArray(sale.shiftId, shiftIds)
          )
        )
        .groupBy(saleItem.productId, product.name, product.stock)
        .orderBy(
          desc(sql`sum(${saleItem.quantity})`),
          desc(sql`sum(${saleItem.totalAmount})`)
        )
        .limit(5)
    : Promise.resolve([]);
}
