import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { creditAccount } from "@/database/drizzle/schema/credit.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import type {
  DashboardAuth,
  DashboardDbExecutor,
} from "@/features/dashboard/dashboard-helpers.server";

export function fetchPendingCredit(
  db: DashboardDbExecutor,
  auth: DashboardAuth
) {
  return db
    .select({
      balance: sql<number>`coalesce(sum(${creditAccount.balance}), 0)`,
      total: sql<number>`count(*)`,
    })
    .from(creditAccount)
    .innerJoin(
      customer,
      and(
        eq(customer.id, creditAccount.customerId),
        eq(customer.organizationId, auth.organizationId),
        isNull(customer.deletedAt)
      )
    )
    .where(
      and(
        eq(creditAccount.organizationId, auth.organizationId),
        gt(creditAccount.balance, 0)
      )
    );
}
