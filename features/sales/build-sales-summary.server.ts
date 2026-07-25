import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { user } from "@/database/drizzle/schema/auth.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import type {
  SalesSummaryQueryArgsSchema,
  SalesSummaryResultSchema,
} from "@/features/sales/sales.schema";
import {
  parseDateBoundary,
  resolveAmountRange,
} from "@/features/sales/sales.shared";
import { normalizeNumber } from "@/lib/domain-values.shared";

type SalesSummaryDbExecutor = Pick<Database, "execute">;
type SalesSummaryInput = z.infer<typeof SalesSummaryQueryArgsSchema>;
type SalesSummary = z.infer<typeof SalesSummaryResultSchema>;

export interface SalesSummaryAuth {
  organizationId: string;
  userId: string;
}

const EMPTY_SALES_SUMMARY: SalesSummary = {
  salesCount: 0,
  totalPending: 0,
  totalRevenue: 0,
};

function normalizeDatabaseNumber(value: unknown) {
  return normalizeNumber(
    typeof value === "number" || typeof value === "string" ? value : null
  );
}

function buildBalanceFilter(balanceStatus: SalesSummaryInput["balanceStatus"]) {
  if (balanceStatus === "with_balance") {
    return sql`where status <> 'cancelled' and balance_due > 0`;
  }
  if (balanceStatus === "settled") {
    return sql`where status = 'cancelled' or balance_due = 0`;
  }
  return sql``;
}

function buildSalesSummaryClauses(
  organizationId: string,
  input: SalesSummaryInput
) {
  const clauses: SQL[] = [sql`${sale.organizationId} = ${organizationId}`];
  const normalizedShiftIds = input.shiftIds?.filter(Boolean) ?? null;
  const normalizedStatus = input.status?.trim() ?? "";
  const normalizedCashierId = input.cashierId?.trim() ?? "";
  const normalizedTerminalName = input.terminalName?.trim() ?? "";
  const normalizedPaymentMethod = input.paymentMethod?.trim() ?? "";
  const normalizedSearch = input.searchQuery?.trim() ?? "";
  const startDateMs = parseDateBoundary(input.startDate);
  const endDateMs = parseDateBoundary(input.endDate);
  const amountRange = resolveAmountRange(input.amountMin, input.amountMax);

  if (normalizedShiftIds?.length) {
    clauses.push(
      sql`${sale.shiftId} in (${sql.join(
        normalizedShiftIds.map((shiftId) => sql`${shiftId}`),
        sql`, `
      )})`
    );
  }
  if (normalizedStatus) {
    clauses.push(sql`${sale.status} = ${normalizedStatus}`);
  }
  if (normalizedCashierId) {
    clauses.push(sql`${sale.userId} = ${normalizedCashierId}`);
  }
  if (startDateMs !== null) {
    clauses.push(sql`${sale.createdAt} >= ${new Date(startDateMs)}`);
  }
  if (endDateMs !== null) {
    clauses.push(
      sql`${sale.createdAt} < ${new Date(endDateMs + 24 * 60 * 60 * 1000)}`
    );
  }
  if (amountRange.minimum !== null) {
    clauses.push(sql`${sale.totalAmount} >= ${amountRange.minimum}`);
  }
  if (amountRange.maximum !== null) {
    clauses.push(sql`${sale.totalAmount} <= ${amountRange.maximum}`);
  }
  if (normalizedTerminalName) {
    clauses.push(sql`exists (
      select 1
      from ${shift}
      where ${shift.id} = ${sale.shiftId}
        and ${shift.organizationId} = ${organizationId}
        and ${shift.terminalName} = ${normalizedTerminalName}
    )`);
  }
  if (normalizedPaymentMethod) {
    clauses.push(sql`exists (
      select 1
      from ${payment}
      where ${payment.saleId} = ${sale.id}
        and ${payment.organizationId} = ${organizationId}
        and ${payment.method} = ${normalizedPaymentMethod}
    )`);
  }
  if (normalizedSearch) {
    const searchPattern = `%${normalizedSearch}%`;
    clauses.push(sql`(
      ${sale.id} ilike ${searchPattern}
      or ${sale.status} ilike ${searchPattern}
      or exists (
        select 1
        from ${customer}
        where ${customer.id} = ${sale.customerId}
          and ${customer.organizationId} = ${organizationId}
          and (
            ${customer.name} ilike ${searchPattern}
            or ${customer.documentNumber} ilike ${searchPattern}
            or ${customer.phone} ilike ${searchPattern}
          )
      )
      or exists (
        select 1
        from ${user}
        where ${user.id} = ${sale.userId}
          and ${user.name} ilike ${searchPattern}
      )
      or exists (
        select 1
        from ${shift}
        where ${shift.id} = ${sale.shiftId}
          and ${shift.organizationId} = ${organizationId}
          and ${shift.terminalName} ilike ${searchPattern}
      )
    )`);
  }

  return clauses;
}

export async function buildSalesSummary(
  db: SalesSummaryDbExecutor,
  auth: SalesSummaryAuth,
  input: SalesSummaryInput
): Promise<SalesSummary> {
  if (input.shiftIds?.length === 0) {
    return EMPTY_SALES_SUMMARY;
  }

  const clauses = buildSalesSummaryClauses(auth.organizationId, input);
  const balanceFilter = buildBalanceFilter(input.balanceStatus);
  const result = await db.execute(sql`
    with filtered_sales as (
      select
        ${sale.status} as status,
        ${sale.totalAmount} as total_amount,
        greatest(
          ${sale.totalAmount} - least(
            ${sale.totalAmount},
            coalesce((
              select sum(${payment.appliedAmount})
              from ${payment}
              where ${payment.saleId} = ${sale.id}
                and ${payment.organizationId} = ${auth.organizationId}
            ), 0)
          ),
          0
        ) as balance_due
      from ${sale}
      where ${sql.join(clauses, sql` and `)}
    )
    select
      count(*) as "salesCount",
      coalesce(sum(
        case when status = 'cancelled' then 0 else total_amount end
      ), 0) as "totalRevenue",
      coalesce(sum(
        case when status = 'cancelled' then 0 else balance_due end
      ), 0) as "totalPending"
    from filtered_sales
    ${balanceFilter}
  `);
  const row = result[0];

  if (!row) {
    return EMPTY_SALES_SUMMARY;
  }

  return {
    salesCount: normalizeDatabaseNumber(row.salesCount),
    totalPending: normalizeDatabaseNumber(row.totalPending),
    totalRevenue: normalizeDatabaseNumber(row.totalRevenue),
  };
}
